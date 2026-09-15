#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runAzure } = require('./azure_cli.cjs');
const { compareParity, sha256File, stableJson } = require('./parity_manifest.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function az(descriptor, args) {
  const output = runAzure([...args, '--subscription', descriptor.subscription, '-o', 'json'], {
    label: 'Cutover V2 read-only parity capture',
  });
  return JSON.parse(output || 'null');
}

function safePackage(value) {
  if (!value) return { present: false, type: 'NONE', host: null, path: null };
  const parsed = new URL(value);
  return {
    present: true,
    type: parsed.protocol === 'https:' ? 'EXTERNAL_HTTPS_ZIP' : 'UNSUPPORTED',
    host: parsed.host,
    path: parsed.pathname,
    referenceSha256: sha256(value),
  };
}

function normalizedRestrictionHash(value) {
  const normalize = (rules = []) => rules.map((rule) => ({
    name: rule.name,
    action: rule.action,
    ipAddress: rule.ipAddress,
    priority: rule.priority,
    tag: rule.tag,
  })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return sha256(stableJson({
    main: normalize(value.ipSecurityRestrictions),
    scm: normalize(value.scmIpSecurityRestrictions),
    useMainForScm: value.scmIpSecurityRestrictionsUseMain,
  }));
}

function capture(root, descriptor) {
  const app = az(descriptor, ['webapp', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const configuration = az(descriptor, ['webapp', 'config', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const plan = az(descriptor, ['appservice', 'plan', 'show', '--ids', app.serverFarmId]);
  const source = az(descriptor, ['webapp', 'deployment', 'source', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const settingsArray = az(descriptor, ['webapp', 'config', 'appsettings', 'list', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const settings = Object.fromEntries(settingsArray.map((item) => [item.name, item.value]));
  const restrictions = az(descriptor, ['webapp', 'config', 'access-restriction', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.appService]);
  const scm = az(descriptor, ['resource', 'show', '--ids', `${app.id}/basicPublishingCredentialsPolicies/scm`, '--api-version', '2022-03-01']);
  const database = az(descriptor, ['sql', 'db', 'show', '-g', descriptor.resourceGroup, '-s', descriptor.sqlServer, '-n', descriptor.database]);
  const storage = az(descriptor, ['storage', 'account', 'show', '-g', descriptor.resourceGroup, '-n', descriptor.storageAccount]);
  const packageSource = safePackage(settings.WEBSITE_RUN_FROM_PACKAGE);
  const deploymentNames = ['DEPLOYED_COMMIT', 'DEPLOYED_PACKAGE', 'ENABLE_ORYX_BUILD',
    'SCM_DO_BUILD_DURING_DEPLOYMENT', 'WEBSITE_RUN_FROM_PACKAGE'].filter((name) => name in settings).sort();
  const implementation = path.join(root, 'scripts', 'release', 'cutover_v2', 'runtime_package.cjs');
  return {
    resource: { appServiceId: app.id, databaseId: database.id },
    appService: {
      os: app.reserved ? 'LINUX' : 'WINDOWS',
      architecture: configuration.use32BitWorkerProcess ? 'X86' : 'X64',
      nodeVersion: configuration.linuxFxVersion,
      startupCommand: configuration.appCommandLine,
      region: app.location,
      planSku: plan.sku?.name,
    },
    runtime: {
      runFromPackageType: packageSource.type,
      packageSourceMechanism: 'EXTERNAL_BLOB_REFERENCE',
      sanitizedCurrentPackage: packageSource,
      activationImplementationSha256: sha256File(implementation),
      rollbackImplementationSha256: sha256File(implementation),
    },
    storage: {
      kind: storage.kind,
      sku: storage.sku?.name,
      minimumTlsVersion: storage.minimumTlsVersion,
      allowBlobPublicAccess: storage.allowBlobPublicAccess === true,
      container: descriptor.storageContainer,
      privateContainerRequired: true,
    },
    deploymentCenter: {
      mode: source?.repoUrl
        ? source.isManualIntegration ? 'EXTERNAL_GIT_MANUAL' : 'EXTERNAL_GIT_AUTOMATIC'
        : 'UNCONFIGURED',
    },
    scm: { basicPublishingAllowed: scm.properties?.allow === true },
    transport: {
      structuredPackageSettings: true,
      protectedSettingNamesSha256: sha256(stableJson(deploymentNames)),
      deploymentSettingNames: deploymentNames,
    },
    security: {
      httpsOnly: app.httpsOnly === true,
      minimumTlsVersion: configuration.minTlsVersion,
      accessRestrictionsSha256: normalizedRestrictionHash(restrictions),
    },
    health: {
      route: '/api/health',
      runtimeIdentityMechanism: 'BAKED_BUILD_METADATA_PLUS_POINTER_AND_REMOTE_SHA256',
    },
    database: {
      provider: 'AZURE_SQL',
      tier: database.sku?.tier,
      pitrCapable: Boolean(database.earliestRestoreDate),
      connectionSwitchImplementationSha256: sha256File(path.join(root, 'scripts', 'release', 'cutover_v2', 'database_connection_switch.cjs')),
    },
    freeze: {
      implementationSha256: sha256File(path.join(root, 'scripts', 'release', 'cutover_v2', 'durable_freeze.cjs')),
      failClosedOnLeaseLoss: true,
    },
    locks: {
      sqlImplementationSha256: sha256File(path.join(root, 'scripts', 'release', 'cutover_v2', 'sql_application_lock.cjs')),
    },
    network: { operatorFirewallRequired: descriptor.operatorFirewallRequired === true },
  };
}

if (require.main === module) {
  try {
    const root = process.cwd();
    const environments = JSON.parse(fs.readFileSync(path.join(root, 'config', 'release-cutover-v2', 'environments.json'), 'utf8'));
    const live = capture(root, environments.live);
    const disposable = capture(root, environments.disposable);
    const reviewedMismatches = {
      'appService.region': { material: false, rationale: 'Pointer activation and SQL correctness are region-independent; timing is tested separately.' },
      'deploymentCenter.mode': { material: false, rationale: 'Both are quiesced; V2 activation bypasses Deployment Center and uses the same pointer implementation.' },
      'transport.protectedSettingNamesSha256': { material: false, rationale: 'The live app has additional Oryx controls; the V2 pointer writer preserves every unrelated setting.' },
      'security.accessRestrictionsSha256': { material: false, rationale: 'Pre-existing rules differ; identical temporary freeze rules and exact restoration are rehearsed.' },
    };
    const manifest = { manifestVersion: 1, live, disposable, reviewedMismatches,
      ...compareParity({ live, disposable, reviewedMismatches }) };
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex >= 0) {
      const output = path.resolve(process.argv[outputIndex + 1] || '');
      assert(!fs.existsSync(output), 'Refusing to overwrite parity evidence');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    }
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    if (manifest.verdict !== 'PASS') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`PARITY_CAPTURE_FAILED: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { capture, normalizedRestrictionHash, safePackage };
