#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { runAzureAsync } = require('./azure_cli.cjs');

const ALLOW_RULE = 'reliance-cutover-operator';
const DENY_RULE = 'reliance-cutover-deny-all';
const ACCEPTANCE_READ_ONLY_SETTING = 'RELIANCE_ACCEPTANCE_READ_ONLY';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function defaultRunner(args) {
  return runAzureAsync(args, { label: 'Azure quiescence operation' });
}

function assertSnapshotBinding(binding) {
  assert(binding && typeof binding === 'object', 'Quiescence snapshot binding is required');
  assert(String(binding.cutoverId || '').trim(), 'Snapshot cutover ID is required');
  assert(Number.isSafeInteger(binding.controlGeneration) && binding.controlGeneration >= 1,
    'Snapshot control generation is invalid');
  assert(String(binding.targetAppServiceResourceId || '').startsWith('/subscriptions/'),
    'Snapshot App Service resource ID is invalid');
  assert.match(binding.candidateSha || '', /^[a-f0-9]{40}$/i, 'Snapshot candidate SHA is invalid');
  assert.match(binding.authorizationSha256 || '', /^[a-f0-9]{64}$/i, 'Snapshot authorization hash is invalid');
  assert(String(binding.controllerId || '').trim(), 'Snapshot controller ID is required');
  assert(Number.isSafeInteger(binding.leaseGeneration) && binding.leaseGeneration >= 1,
    'Snapshot lease generation is invalid');
  assert(!Number.isNaN(new Date(binding.cutoverCreatedAt).getTime()), 'Snapshot cutover creation time is invalid');
  return binding;
}

function snapshotIdentity(document) {
  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return { bytes, snapshotSha256: sha256(bytes), snapshotId: document.snapshotId };
}

class AppQuiescence {
  constructor({ subscription, resourceGroup, appService, snapshotFile, operatorCidr, environment,
    runner = defaultRunner, now = () => new Date(), randomUUID = () => crypto.randomUUID() }) {
    this.subscription = subscription;
    this.resourceGroup = resourceGroup;
    this.appService = appService;
    this.snapshotFile = snapshotFile;
    this.operatorCidr = operatorCidr;
    this.environment = environment;
    this.runner = runner;
    this.now = now;
    this.randomUUID = randomUUID;
  }

  async az(args, json = true) {
    const output = await this.runner([...args, '--subscription', this.subscription, '-g', this.resourceGroup,
      '-n', this.appService, '-o', json ? 'json' : 'none']);
    return json ? JSON.parse(output || 'null') : null;
  }

  async readState() {
    const app = await this.az(['webapp', 'show']);
    const source = await this.az(['webapp', 'deployment', 'source', 'show']);
    const deployments = await this.az(['webapp', 'log', 'deployment', 'list']);
    const restrictions = await this.az(['webapp', 'config', 'access-restriction', 'show']);
    const acceptanceSettings = await this.az(['webapp', 'config', 'appsettings', 'list', '--query',
      `[?name=='${ACCEPTANCE_READ_ONLY_SETTING}']`]);
    const acceptanceReadOnly = acceptanceSettings?.length
      ? { present: true, value: acceptanceSettings[0].value }
      : { present: false, value: null };
    return { appState: app.state, appId: app.id, source, deployments, restrictions, acceptanceReadOnly };
  }

  validateExecution() {
    if (this.environment === 'beta') {
      assert.equal(process.env.RELIANCE_CUTOVER_EXECUTE, 'YES', 'Beta quiescence requires cutover authorization');
      assert(process.env.RELIANCE_MIGRATION_LOCK_TOKEN, 'Beta quiescence requires the parent lock token');
    } else {
      assert.equal(this.environment, 'disposable');
      assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY');
    }
  }

  async dryRun() {
    const state = await this.readState();
    const sourceFrozen = state.source.isManualIntegration === true
      || (!state.source.repoUrl && state.source.isGitHubAction !== true);
    assert.equal(sourceFrozen, true, 'Deployment Center must be manual or unconfigured');
    assert((state.deployments || []).every((item) => item.complete === true && Number(item.status) === 4),
      'A deployment is incomplete or unsuccessful');
    const names = (state.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    assert(!names.includes(ALLOW_RULE) && !names.includes(DENY_RULE), 'Cutover access rules already exist');
    return { verdict: 'PASS', mode: 'DRY_RUN', appState: state.appState,
      deploymentIntegration: state.source.isManualIntegration === true ? 'MANUAL' : 'UNCONFIGURED',
      deploymentsComplete: true, freezeWouldStopApp: true, restrictedRestartPlanned: true, writeExecuted: false };
  }

  readAndVerifySnapshot({ expected, mutationBoundary = null }) {
    assert(expected && typeof expected === 'object', 'Expected quiescence snapshot identity is required');
    assert(fs.existsSync(this.snapshotFile), 'Quiescence snapshot is missing');
    const bytes = fs.readFileSync(this.snapshotFile);
    assert.equal(sha256(bytes), expected.snapshotSha256, 'Quiescence snapshot hash differs');
    const document = JSON.parse(bytes);
    assert.equal(document.snapshotVersion, 2, 'Unsupported quiescence snapshot version');
    assert.equal(document.snapshotId, expected.snapshotId, 'Quiescence snapshot ID differs');
    assert.deepEqual(document.binding, expected.binding, 'Quiescence snapshot binding differs');
    assertSnapshotBinding(document.binding);
    assert.equal(document.preCutoverState.appId.toLowerCase(),
      document.binding.targetAppServiceResourceId.toLowerCase(), 'Quiescence snapshot target differs');
    const createdAt = new Date(document.createdAt).getTime();
    const cutoverCreatedAt = new Date(document.binding.cutoverCreatedAt).getTime();
    assert(Number.isFinite(createdAt) && createdAt >= cutoverCreatedAt,
      'Quiescence snapshot predates the bound cutover');
    assert(createdAt <= this.now().getTime(), 'Quiescence snapshot creation time is in the future');
    if (mutationBoundary) {
      const boundary = new Date(mutationBoundary).getTime();
      assert(Number.isFinite(boundary) && createdAt <= boundary,
        'Quiescence snapshot was created after the mutation boundary');
    }
    return { document, snapshotId: document.snapshotId, snapshotSha256: expected.snapshotSha256 };
  }

  async freeze({ binding, expectedSnapshot = null } = {}) {
    this.validateExecution();
    assertSnapshotBinding(binding);
    if (fs.existsSync(this.snapshotFile)) {
      assert.deepEqual(binding, expectedSnapshot?.binding,
        'Active cutover binding differs from the immutable quiescence snapshot');
      const verified = this.readAndVerifySnapshot({ expected: expectedSnapshot });
      const current = await this.readState();
      assert.equal(current.appId.toLowerCase(), binding.targetAppServiceResourceId.toLowerCase(),
        'Current App Service differs from the snapshot cutover target');
      if (String(current.appState).toLowerCase() !== 'stopped') await this.az(['webapp', 'stop'], false);
      const after = await this.az(['webapp', 'show']);
      assert.equal(String(after.state).toLowerCase(), 'stopped', 'App Service did not remain stopped');
      return { verdict: 'PASS', appState: after.state, businessWritesQuiesced: true,
        snapshotFile: this.snapshotFile, snapshotId: verified.snapshotId,
        snapshotSha256: verified.snapshotSha256, snapshotBinding: verified.document.binding,
        originalSnapshotPreserved: true, alreadyQuiesced: true };
    }
    assert.equal(expectedSnapshot, null, 'Original quiescence snapshot is missing');
    const before = await this.readState();
    assert.equal(before.appId.toLowerCase(), binding.targetAppServiceResourceId.toLowerCase(),
      'Current App Service differs from the snapshot cutover target');
    const sourceFrozen = before.source.isManualIntegration === true
      || (!before.source.repoUrl && before.source.isGitHubAction !== true);
    assert.equal(sourceFrozen, true, 'Deployment Center must be manual or unconfigured');
    assert((before.deployments || []).every((item) => item.complete === true && Number(item.status) === 4),
      'A deployment is incomplete or unsuccessful');
    const names = (before.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    assert(!names.includes(ALLOW_RULE) && !names.includes(DENY_RULE), 'Cutover access rule collision');
    const document = { snapshotVersion: 2, snapshotId: this.randomUUID(), createdAt: this.now().toISOString(),
      binding: { ...binding }, preCutoverState: before };
    const identity = snapshotIdentity(document);
    fs.writeFileSync(this.snapshotFile, identity.bytes, { flag: 'wx' });
    await this.az(['webapp', 'stop'], false);
    const after = await this.az(['webapp', 'show']);
    assert.equal(String(after.state).toLowerCase(), 'stopped', 'App Service did not stop');
    return { verdict: 'PASS', appState: after.state, businessWritesQuiesced: true,
      snapshotFile: this.snapshotFile, snapshotId: identity.snapshotId,
      snapshotSha256: identity.snapshotSha256, snapshotBinding: document.binding,
      originalSnapshotPreserved: true, alreadyQuiesced: false };
  }

  async restrictedRestart({ expectedSnapshot, mutationBoundary = null } = {}) {
    this.validateExecution();
    this.readAndVerifySnapshot({ expected: expectedSnapshot, mutationBoundary });
    assert(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(this.operatorCidr || ''), 'Exact operator CIDR is required');
    const before = await this.readState();
    if (before.acceptanceReadOnly.value !== 'YES') {
      await this.az(['webapp', 'config', 'appsettings', 'set', '--settings', `${ACCEPTANCE_READ_ONLY_SETTING}=YES`], false);
    }
    const names = (before.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    if (!names.includes(ALLOW_RULE)) {
      await this.az(['webapp', 'config', 'access-restriction', 'add', '--rule-name', ALLOW_RULE, '--action', 'Allow',
        '--ip-address', this.operatorCidr, '--priority', '100'], false);
    }
    if (!names.includes(DENY_RULE)) {
      await this.az(['webapp', 'config', 'access-restriction', 'add', '--rule-name', DENY_RULE, '--action', 'Deny',
        '--ip-address', '0.0.0.0/0', '--priority', '65000'], false);
    }
    await this.az(['webapp', 'start'], false);
    const state = await this.readState();
    const rules = state.restrictions.ipSecurityRestrictions || [];
    assert(rules.some((rule) => rule.name === ALLOW_RULE && rule.action === 'Allow'));
    assert(rules.some((rule) => rule.name === DENY_RULE && rule.action === 'Deny'));
    assert.equal(state.acceptanceReadOnly.value, 'YES', 'Acceptance read-only mode was not enabled');
    return { verdict: 'PASS', appState: state.appState, restrictedToOperator: true, readOnlyMode: true };
  }

  async verifyAcceptanceMode() {
    const state = await this.readState();
    const rules = state.restrictions.ipSecurityRestrictions || [];
    assert.equal(String(state.appState).toLowerCase(), 'running', 'App is not running for acceptance');
    assert(rules.some((rule) => rule.name === ALLOW_RULE && rule.action === 'Allow'), 'Operator access rule is missing');
    assert(rules.some((rule) => rule.name === DENY_RULE && rule.action === 'Deny'), 'Deny-all access rule is missing');
    assert.equal(state.acceptanceReadOnly.value, 'YES', 'Acceptance read-only mode is not active');
    assert((state.deployments || []).every((item) => item.complete === true && Number(item.status) === 4),
      'A competing deployment is active or failed');
    const deploymentControlSha256 = sha256(JSON.stringify({ appId: state.appId, source: state.source,
      deployments: state.deployments }));
    return { verdict: 'PASS', restrictedToOperator: true, readOnlyMode: true,
      deploymentsComplete: true, deploymentControlSha256 };
  }

  async restore({ expectedSnapshot, mutationBoundary = null } = {}) {
    this.validateExecution();
    const { document } = this.readAndVerifySnapshot({ expected: expectedSnapshot, mutationBoundary });
    const before = document.preCutoverState;
    const current = await this.readState();
    const names = (current.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    if (names.includes(ALLOW_RULE)) await this.az(['webapp', 'config', 'access-restriction', 'remove', '--rule-name', ALLOW_RULE, '--action', 'Allow'], false);
    if (names.includes(DENY_RULE)) await this.az(['webapp', 'config', 'access-restriction', 'remove', '--rule-name', DENY_RULE, '--action', 'Deny'], false);
    if (before.acceptanceReadOnly.present) {
      await this.az(['webapp', 'config', 'appsettings', 'set', '--settings',
        `${ACCEPTANCE_READ_ONLY_SETTING}=${before.acceptanceReadOnly.value}`], false);
    } else if (current.acceptanceReadOnly.present) {
      await this.az(['webapp', 'config', 'appsettings', 'delete', '--setting-names', ACCEPTANCE_READ_ONLY_SETTING], false);
    }
    if (String(before.appState).toLowerCase() === 'running') await this.az(['webapp', 'start'], false);
    else await this.az(['webapp', 'stop'], false);
    const restored = await this.readState();
    assert.deepEqual(restored.restrictions, before.restrictions, 'Access restrictions were not restored exactly');
    assert.deepEqual(restored.acceptanceReadOnly, before.acceptanceReadOnly,
      'Acceptance read-only setting was not restored exactly');
    return { verdict: 'PASS', appState: restored.appState, restrictionsRestored: true,
      snapshotId: document.snapshotId, snapshotSha256: expectedSnapshot.snapshotSha256 };
  }
}

module.exports = { ACCEPTANCE_READ_ONLY_SETTING, ALLOW_RULE, AppQuiescence, DENY_RULE,
  assertSnapshotBinding, snapshotIdentity };

if (require.main === module) {
  process.stderr.write('APP_QUIESCENCE_FAILED: use the reviewed Cutover V2 orchestrator\n');
  process.exitCode = 2;
}
