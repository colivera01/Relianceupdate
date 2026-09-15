#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const APPROVED_PACKAGE_SETTINGS = Object.freeze([
  'DEPLOYED_COMMIT',
  'DEPLOYED_PACKAGE',
  'WEBSITE_RUN_FROM_PACKAGE',
]);

function assertSha256(value, label) {
  assert.match(value || '', /^[a-f0-9]{64}$/i, `${label} must be a SHA-256 value`);
  return value.toLowerCase();
}

function parsePackageReference(value) {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, 'https:', 'Package reference must use HTTPS');
  assert(parsed.pathname.toLowerCase().endsWith('.zip'), 'Package reference must identify a ZIP');
  const expiryValue = parsed.searchParams.get('se');
  const expiresAt = expiryValue ? new Date(expiryValue) : null;
  if (expiresAt) assert(!Number.isNaN(expiresAt.getTime()), 'Package-reference expiry is invalid');
  return {
    host: parsed.host,
    path: parsed.pathname,
    sanitizedReference: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
    expiresAt: expiresAt?.toISOString() || null,
    referenceSha256: crypto.createHash('sha256').update(value).digest('hex'),
  };
}

async function responseBytes(response) {
  assert.equal(response.status, 200, `Package download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyRemotePackage({
  reference,
  expectedSha256,
  expectedSize,
  requiredThrough,
  fetchImpl = fetch,
}) {
  const identity = parsePackageReference(reference);
  const requiredUntil = new Date(requiredThrough);
  assert(!Number.isNaN(requiredUntil.getTime()), 'Required package-availability timestamp is invalid');
  assert(identity.expiresAt, 'A bounded signed package reference must expose its expiry');
  assert(new Date(identity.expiresAt).getTime() >= requiredUntil.getTime(),
    'Package reference expires before the required cutover, acceptance, rollback, and safety window');
  const bytes = await responseBytes(await fetchImpl(reference, { method: 'GET', cache: 'no-store' }));
  const observedSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const observedSize = bytes.length;
  assert.equal(observedSize, Number(expectedSize), 'Remote package size differs from the reviewed artifact');
  assert.equal(observedSha256, assertSha256(expectedSha256, 'Expected package hash'),
    'Remote package SHA-256 differs from the reviewed artifact');
  return {
    verdict: 'PASS',
    ...identity,
    size: observedSize,
    sha256: observedSha256,
    validThrough: requiredUntil.toISOString(),
  };
}

function selectedSettings(settings) {
  const result = {};
  for (const name of APPROVED_PACKAGE_SETTINGS) {
    if (name === 'WEBSITE_RUN_FROM_PACKAGE' && settings[name]) {
      const identity = parsePackageReference(settings[name]);
      result[name] = {
        sanitizedReference: identity.sanitizedReference,
        referenceSha256: identity.referenceSha256,
        expiresAt: identity.expiresAt,
      };
    } else {
      result[name] = settings[name] || '';
    }
  }
  return result;
}

function runtimeMatches(settings, runtime) {
  return settings.WEBSITE_RUN_FROM_PACKAGE === runtime.reference
    && settings.DEPLOYED_COMMIT === runtime.commit
    && settings.DEPLOYED_PACKAGE === runtime.packageName;
}

function invokeStructuredUpdater({ root, resourceGroup, appService, runtime, apply = true, env = process.env }) {
  const script = path.join(root, 'scripts', 'release', 'update_azure_package_settings.py');
  const packageUrlVariable = 'RELIANCE_CUTOVER_PACKAGE_URL';
  const args = [script,
    '--resource-group', resourceGroup,
    '--app', appService,
    '--commit', runtime.commit,
    '--package', runtime.packageName,
    '--package-url-env', packageUrlVariable,
    '--expected-size', String(runtime.size),
    '--expected-sha256', assertSha256(runtime.sha256, 'Runtime package hash'),
    '--required-through', runtime.requiredThrough,
  ];
  if (apply) args.push('--apply');
  const result = spawnSync(process.env.PYTHON || 'python', args, {
    cwd: root,
    env: { ...env, [packageUrlVariable]: runtime.reference },
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, `Structured package-setting updater failed: ${(result.stderr || '').trim()}`);
  const output = JSON.parse(result.stdout);
  assert.equal(output.remotePackageSha256, runtime.sha256.toLowerCase());
  assert.equal(output.remotePackageSize, Number(runtime.size));
  return output;
}

async function verifyRunningRuntime({ runtime, readSettings, health, verifyPackage = verifyRemotePackage }) {
  const settings = await readSettings();
  assert(runtimeMatches(settings, runtime), 'Configured runtime does not match expected package settings');
  const remote = await verifyPackage({
    reference: runtime.reference,
    expectedSha256: runtime.sha256,
    expectedSize: runtime.size,
    requiredThrough: runtime.requiredThrough,
  });
  const observedHealth = await health();
  assert.equal(observedHealth.ok, true, 'Application health check failed');
  if (runtime.requireBuildMetadata !== false) {
    assert.equal(observedHealth.build?.sourceCommit, runtime.commit, 'Running build commit differs');
    assert.equal(observedHealth.build?.packageName, runtime.packageName, 'Running build package differs');
  }
  return {
    verdict: 'PASS',
    settings: selectedSettings(settings),
    remotePackage: remote,
    health: observedHealth,
    buildMetadata: runtime.requireBuildMetadata === false ? 'LEGACY_RECOVERY_PACKAGE_NOT_REQUIRED' : 'VERIFIED',
  };
}

async function activateRuntime({
  runtime,
  verifyPackage = verifyRemotePackage,
  applySettings,
  readSettings,
  restart,
  health,
}) {
  const remote = await verifyPackage({
    reference: runtime.reference,
    expectedSha256: runtime.sha256,
    expectedSize: runtime.size,
    requiredThrough: runtime.requiredThrough,
  });
  await applySettings(runtime);
  const configured = await readSettings();
  assert(runtimeMatches(configured, runtime), 'Package pointer verification failed after update');
  await restart();
  const running = await verifyRunningRuntime({ runtime, readSettings, health, verifyPackage });
  return { verdict: 'PASS', activation: 'PACKAGE_POINTER', remotePackage: remote, running };
}

async function rollbackRuntime({
  recoveryRuntime,
  verifyPackage = verifyRemotePackage,
  applySettings,
  readSettings,
  restart,
  health,
}) {
  const settings = await readSettings();
  const remote = await verifyPackage({
    reference: recoveryRuntime.reference,
    expectedSha256: recoveryRuntime.sha256,
    expectedSize: recoveryRuntime.size,
    requiredThrough: recoveryRuntime.requiredThrough,
  });
  if (runtimeMatches(settings, recoveryRuntime)) {
    return {
      verdict: 'PASS',
      runtimeRollback: 'NO-OP',
      reason: 'CURRENT_RUNTIME_EQUALS_REQUIRED_RECOVERY_RUNTIME',
      configured: selectedSettings(settings),
      remotePackage: remote,
    };
  }
  await applySettings(recoveryRuntime);
  assert(runtimeMatches(await readSettings(), recoveryRuntime), 'Recovery package pointer verification failed');
  await restart();
  const running = await verifyRunningRuntime({
    runtime: recoveryRuntime,
    readSettings,
    health,
    verifyPackage,
  });
  return { verdict: 'PASS', runtimeRollback: 'PACKAGE_POINTER_RESTORED', remotePackage: remote, running };
}

module.exports = {
  APPROVED_PACKAGE_SETTINGS,
  activateRuntime,
  assertSha256,
  invokeStructuredUpdater,
  parsePackageReference,
  rollbackRuntime,
  runtimeMatches,
  selectedSettings,
  verifyRemotePackage,
  verifyRunningRuntime,
};
