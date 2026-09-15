#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { runAzureAsync } = require('./azure_cli.cjs');

const ALLOW_RULE = 'reliance-cutover-operator';
const DENY_RULE = 'reliance-cutover-deny-all';
const ACCEPTANCE_READ_ONLY_SETTING = 'RELIANCE_ACCEPTANCE_READ_ONLY';

function defaultRunner(args) {
  return runAzureAsync(args, { label: 'Azure quiescence operation' });
}

class AppQuiescence {
  constructor({ subscription, resourceGroup, appService, snapshotFile, operatorCidr, environment, runner = defaultRunner }) {
    this.subscription = subscription;
    this.resourceGroup = resourceGroup;
    this.appService = appService;
    this.snapshotFile = snapshotFile;
    this.operatorCidr = operatorCidr;
    this.environment = environment;
    this.runner = runner;
  }

  async az(args, json = true) {
    const output = await this.runner([...args, '--subscription', this.subscription, '-g', this.resourceGroup, '-n', this.appService, '-o', json ? 'json' : 'none']);
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

  async freeze() {
    this.validateExecution();
    assert(!fs.existsSync(this.snapshotFile), 'Quiescence snapshot already exists');
    const before = await this.readState();
    const sourceFrozen = before.source.isManualIntegration === true
      || (!before.source.repoUrl && before.source.isGitHubAction !== true);
    assert.equal(sourceFrozen, true, 'Deployment Center must be manual or unconfigured');
    assert((before.deployments || []).every((item) => item.complete === true && Number(item.status) === 4),
      'A deployment is incomplete or unsuccessful');
    const names = (before.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    assert(!names.includes(ALLOW_RULE) && !names.includes(DENY_RULE), 'Cutover access rule collision');
    fs.writeFileSync(this.snapshotFile, `${JSON.stringify({ snapshotVersion: 1, capturedAt: new Date().toISOString(), ...before }, null, 2)}\n`, { flag: 'wx' });
    await this.az(['webapp', 'stop'], false);
    const after = await this.az(['webapp', 'show']);
    assert.equal(String(after.state).toLowerCase(), 'stopped', 'App Service did not stop');
    return { verdict: 'PASS', appState: after.state, businessWritesQuiesced: true, snapshotFile: this.snapshotFile };
  }

  async restrictedRestart() {
    this.validateExecution();
    assert(fs.existsSync(this.snapshotFile), 'Quiescence snapshot is missing');
    assert(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(this.operatorCidr || ''), 'Exact operator CIDR is required');
    const before = await this.readState();
    if (before.acceptanceReadOnly.value !== 'YES') {
      await this.az(['webapp', 'config', 'appsettings', 'set', '--settings', `${ACCEPTANCE_READ_ONLY_SETTING}=YES`], false);
    }
    const names = (before.restrictions.ipSecurityRestrictions || []).map((rule) => rule.name);
    if (!names.includes(ALLOW_RULE)) {
      await this.az(['webapp', 'config', 'access-restriction', 'add', '--rule-name', ALLOW_RULE, '--action', 'Allow', '--ip-address', this.operatorCidr, '--priority', '100'], false);
    }
    if (!names.includes(DENY_RULE)) {
      await this.az(['webapp', 'config', 'access-restriction', 'add', '--rule-name', DENY_RULE, '--action', 'Deny', '--ip-address', '0.0.0.0/0', '--priority', '65000'], false);
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
    const deploymentControlSha256 = crypto.createHash('sha256').update(JSON.stringify({
      appId: state.appId,
      source: state.source,
      deployments: state.deployments,
    })).digest('hex');
    return { verdict: 'PASS', restrictedToOperator: true, readOnlyMode: true,
      deploymentsComplete: true, deploymentControlSha256 };
  }

  async restore() {
    this.validateExecution();
    const before = JSON.parse(fs.readFileSync(this.snapshotFile, 'utf8'));
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
    fs.rmSync(this.snapshotFile, { force: true });
    return { verdict: 'PASS', appState: restored.appState, restrictionsRestored: true };
  }
}

module.exports = { ACCEPTANCE_READ_ONLY_SETTING, ALLOW_RULE, AppQuiescence, DENY_RULE };

if (require.main === module) {
  const args = process.argv.slice(2);
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const mode = ['--dry-run', '--freeze', '--restricted-restart', '--restore'].find((flag) => args.includes(flag));
  void (async () => {
  try {
    assert(mode, 'Choose --dry-run, --freeze, --restricted-restart, or --restore');
    const control = new AppQuiescence({
      subscription: value('--subscription'), resourceGroup: value('--resource-group'), appService: value('--app-service'),
      snapshotFile: value('--snapshot'), operatorCidr: value('--operator-cidr'), environment: value('--environment'),
    });
    const result = mode === '--dry-run' ? await control.dryRun()
      : mode === '--freeze' ? await control.freeze()
        : mode === '--restricted-restart' ? await control.restrictedRestart() : await control.restore();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(`APP_QUIESCENCE_FAILED: ${error.message}`); process.exitCode = 2; }
  })();
}
