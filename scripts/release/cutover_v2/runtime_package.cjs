#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APPROVED_PACKAGE_SETTINGS = Object.freeze([
  'DEPLOYED_COMMIT',
  'DEPLOYED_PACKAGE',
  'WEBSITE_RUN_FROM_PACKAGE',
]);
const MIN_PACKAGE_SAFETY_BUFFER_MS = 24 * 60 * 60 * 1000;
const RUNTIME_CLASSIFICATIONS = Object.freeze({
  VERIFIED_CANDIDATE: 'VERIFIED_CANDIDATE',
  VERIFIED_RECOVERY: 'VERIFIED_RECOVERY',
  UNKNOWN: 'UNKNOWN',
  MISMATCHED: 'MISMATCHED',
  UNAVAILABLE: 'UNAVAILABLE',
});

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
  const safetyBufferMs = new Date(identity.expiresAt).getTime() - requiredUntil.getTime();
  assert(safetyBufferMs >= MIN_PACKAGE_SAFETY_BUFFER_MS,
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
    safetyBufferHours: safetyBufferMs / (60 * 60 * 1000),
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

function observedPackageName(settings) {
  try {
    return path.posix.basename(parsePackageReference(settings.WEBSITE_RUN_FROM_PACKAGE).path);
  } catch {
    return null;
  }
}

function unavailablePackageError(error) {
  return /download failed|expires|expiry|availability|http \d+|signed package reference|package reference/i
    .test(error?.message || '');
}

async function classifyRuntime({ settings, runtime, role, verifyPackage = verifyRemotePackage }) {
  if (!['CANDIDATE', 'RECOVERY'].includes(role)) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.MISMATCHED,
      reason: 'AUTHORIZED_RUNTIME_BINDING_MISSING_OR_DIFFERENT' };
  }
  const verifiedState = role === 'CANDIDATE'
    ? RUNTIME_CLASSIFICATIONS.VERIFIED_CANDIDATE
    : RUNTIME_CLASSIFICATIONS.VERIFIED_RECOVERY;
  if (!settings?.WEBSITE_RUN_FROM_PACKAGE || !settings?.DEPLOYED_COMMIT || !settings?.DEPLOYED_PACKAGE) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.UNKNOWN,
      reason: 'REQUIRED_RUNTIME_SETTINGS_MISSING' };
  }
  if (runtime?.manifestBindingVerified !== true || runtime.manifestRole !== role
    || !runtime.targetAppServiceResourceId) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.MISMATCHED,
      reason: 'AUTHORIZED_RUNTIME_BINDING_MISSING_OR_DIFFERENT' };
  }
  if (settings.DEPLOYED_COMMIT !== runtime.commit) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.MISMATCHED,
      reason: 'DEPLOYED_SOURCE_IDENTITY_DIFFERS' };
  }
  const pointerPackageName = observedPackageName(settings);
  if (!pointerPackageName) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.UNAVAILABLE,
      reason: 'OBSERVED_PACKAGE_REFERENCE_INVALID' };
  }
  if (pointerPackageName !== settings.DEPLOYED_PACKAGE) {
    return { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.MISMATCHED,
      reason: 'OBSERVED_POINTER_AND_PACKAGE_LABEL_DIFFER' };
  }
  try {
    const remotePackage = await verifyPackage({
      reference: settings.WEBSITE_RUN_FROM_PACKAGE,
      expectedSha256: runtime.sha256,
      expectedSize: runtime.size,
      requiredThrough: runtime.requiredThrough,
    });
    assert.equal(remotePackage.sha256, assertSha256(runtime.sha256, 'Runtime binding hash'),
      'Observed package SHA-256 differs from the authorized runtime binding');
    assert.equal(Number(remotePackage.size), Number(runtime.size),
      'Observed package size differs from the authorized runtime binding');
    return {
      verdict: 'PASS',
      state: verifiedState,
      activeState: role === 'CANDIDATE' ? 'CANDIDATE_ACTIVE' : 'RECOVERY_ACTIVE',
      role,
      pointerExact: runtimeMatches(settings, runtime),
      aliasAccepted: !runtimeMatches(settings, runtime),
      observedPackageName: pointerPackageName,
      authorizedPackageName: runtime.packageName,
      targetAppServiceResourceId: runtime.targetAppServiceResourceId,
      remotePackage,
    };
  } catch (error) {
    return {
      verdict: 'FAIL_CLOSED',
      state: unavailablePackageError(error)
        ? RUNTIME_CLASSIFICATIONS.UNAVAILABLE
        : RUNTIME_CLASSIFICATIONS.MISMATCHED,
      reason: error.message,
    };
  }
}

async function classifyConfiguredRuntime({
  settings,
  candidateRuntime,
  recoveryRuntime,
  verifyPackage = verifyRemotePackage,
}) {
  const runtimes = [candidateRuntime, recoveryRuntime];
  const matchingCommit = runtimes.filter((runtime) => runtime?.commit === settings?.DEPLOYED_COMMIT);
  if (!matchingCommit.length) {
    const observedName = observedPackageName(settings) || settings?.DEPLOYED_PACKAGE || '';
    const resemblesReviewedPackage = runtimes.some((runtime) =>
      [runtime?.packageName, observedPackageName({ WEBSITE_RUN_FROM_PACKAGE: runtime?.reference })]
        .includes(observedName));
    return { verdict: 'FAIL_CLOSED',
      state: resemblesReviewedPackage ? RUNTIME_CLASSIFICATIONS.MISMATCHED : RUNTIME_CLASSIFICATIONS.UNKNOWN,
      reason: resemblesReviewedPackage ? 'REVIEWED_PACKAGE_HAS_WRONG_SOURCE_IDENTITY' : 'ARBITRARY_RUNTIME_NOT_RECOGNIZED' };
  }
  const results = [];
  for (const runtime of matchingCommit) {
    const role = runtime.manifestRole;
    results.push(await classifyRuntime({ settings, runtime, role, verifyPackage }));
  }
  const verified = results.find((result) => result.verdict === 'PASS');
  if (verified) return verified;
  return results.find((result) => result.state === RUNTIME_CLASSIFICATIONS.MISMATCHED)
    || results.find((result) => result.state === RUNTIME_CLASSIFICATIONS.UNAVAILABLE)
    || { verdict: 'FAIL_CLOSED', state: RUNTIME_CLASSIFICATIONS.UNKNOWN,
      reason: 'RUNTIME_NOT_POSITIVELY_IDENTIFIED' };
}

function runChild(executable, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

async function invokeStructuredUpdater({ root, resourceGroup, appService, runtime, apply = true, env = process.env }) {
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
  const result = await runChild(process.env.PYTHON || 'python', args, {
    cwd: root,
    env: { ...env, [packageUrlVariable]: runtime.reference },
  });
  assert.equal(result.status, 0, `Structured package-setting updater failed: ${(result.stderr || '').trim()}`);
  const output = JSON.parse(result.stdout);
  assert.equal(output.remotePackageSha256, runtime.sha256.toLowerCase());
  assert.equal(output.remotePackageSize, Number(runtime.size));
  return output;
}

async function verifyRunningRuntime({ runtime, readSettings, health, verifyPackage = verifyRemotePackage }) {
  const settings = await readSettings();
  const classification = await classifyRuntime({ settings, runtime, role: runtime.manifestRole, verifyPackage });
  assert.equal(classification.verdict, 'PASS',
    `Configured runtime is not a verified ${runtime.manifestRole || 'reviewed'} package: ${classification.reason || classification.state}`);
  const remote = classification.remotePackage;
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

async function setRuntimePointer({
  runtime,
  verifyPackage = verifyRemotePackage,
  applySettings,
  readSettings,
}) {
  const before = await readSettings();
  const classification = await classifyRuntime({ settings: before, runtime,
    role: runtime.manifestRole, verifyPackage });
  if (classification.verdict === 'PASS') {
    return {
      verdict: 'PASS',
      activation: classification.pointerExact
        ? 'NO-OP_POINTER_ALREADY_SET'
        : 'NO-OP_VERIFIED_RUNTIME_ALIAS_ALREADY_ACTIVE',
      configured: selectedSettings(before),
      remotePackage: classification.remotePackage,
      classification,
    };
  }
  const remote = await verifyPackage({
    reference: runtime.reference,
    expectedSha256: runtime.sha256,
    expectedSize: runtime.size,
    requiredThrough: runtime.requiredThrough,
  });
  await applySettings(runtime);
  const configured = await readSettings();
  assert(runtimeMatches(configured, runtime), 'Package pointer verification failed after update');
  return {
    verdict: 'PASS',
    activation: 'PACKAGE_POINTER_SET_WHILE_APP_FROZEN',
    configured: selectedSettings(configured),
    remotePackage: remote,
  };
}

async function rollbackRuntimePointer(options) {
  const result = await setRuntimePointer({
    runtime: options.recoveryRuntime,
    verifyPackage: options.verifyPackage,
    applySettings: options.applySettings,
    readSettings: options.readSettings,
  });
  return {
    ...result,
    runtimeRollback: ['NO-OP_POINTER_ALREADY_SET', 'NO-OP_VERIFIED_RUNTIME_ALIAS_ALREADY_ACTIVE']
      .includes(result.activation)
      ? 'NO-OP'
      : 'PACKAGE_POINTER_RESTORED_WHILE_APP_FROZEN',
  };
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
  const classification = await classifyRuntime({ settings, runtime: recoveryRuntime,
    role: recoveryRuntime.manifestRole, verifyPackage });
  if (classification.verdict === 'PASS') {
    return {
      verdict: 'PASS',
      runtimeRollback: 'NO-OP',
      reason: 'CURRENT_RUNTIME_EQUALS_REQUIRED_RECOVERY_RUNTIME',
      configured: selectedSettings(settings),
      remotePackage: classification.remotePackage,
      classification,
    };
  }
  const remote = await verifyPackage({
    reference: recoveryRuntime.reference,
    expectedSha256: recoveryRuntime.sha256,
    expectedSize: recoveryRuntime.size,
    requiredThrough: recoveryRuntime.requiredThrough,
  });
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
  MIN_PACKAGE_SAFETY_BUFFER_MS,
  RUNTIME_CLASSIFICATIONS,
  activateRuntime,
  assertSha256,
  classifyConfiguredRuntime,
  classifyRuntime,
  invokeStructuredUpdater,
  parsePackageReference,
  runChild,
  rollbackRuntime,
  rollbackRuntimePointer,
  runtimeMatches,
  setRuntimePointer,
  selectedSettings,
  verifyRemotePackage,
  verifyRunningRuntime,
};
