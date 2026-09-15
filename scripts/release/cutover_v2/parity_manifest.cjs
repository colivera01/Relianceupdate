#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const REQUIRED_PROPERTIES = Object.freeze([
  'appService.os',
  'appService.architecture',
  'appService.nodeVersion',
  'appService.startupCommand',
  'appService.region',
  'appService.planSku',
  'runtime.runFromPackageType',
  'runtime.packageSourceMechanism',
  'runtime.activationImplementationSha256',
  'runtime.rollbackImplementationSha256',
  'storage.kind',
  'storage.sku',
  'storage.minimumTlsVersion',
  'storage.allowBlobPublicAccess',
  'storage.privateContainerRequired',
  'deploymentCenter.mode',
  'scm.basicPublishingAllowed',
  'transport.structuredPackageSettings',
  'transport.protectedSettingNamesSha256',
  'security.httpsOnly',
  'security.minimumTlsVersion',
  'security.accessRestrictionsSha256',
  'health.route',
  'health.runtimeIdentityMechanism',
  'database.provider',
  'database.tier',
  'database.pitrCapable',
  'database.connectionSwitchImplementationSha256',
  'freeze.implementationSha256',
  'freeze.failClosedOnLeaseLoss',
  'locks.sqlImplementationSha256',
  'network.operatorFirewallRequired',
]);

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function compareParity({ live, disposable, reviewedMismatches = {} }) {
  const comparisons = REQUIRED_PROPERTIES.map((property) => {
    const liveValue = getPath(live, property);
    const disposableValue = getPath(disposable, property);
    const present = liveValue !== undefined && disposableValue !== undefined;
    const match = present && stableJson(liveValue) === stableJson(disposableValue);
    const review = reviewedMismatches[property] || null;
    return {
      property,
      live: liveValue,
      disposable: disposableValue,
      match,
      reviewed: Boolean(review),
      material: review?.material ?? true,
      rationale: review?.rationale || null,
      verdict: match ? 'MATCH' : review && review.material === false ? 'REVIEWED_NON_MATERIAL' : 'FAIL',
    };
  });
  const failures = comparisons.filter((item) => item.verdict === 'FAIL');
  const deploymentPath = comparisons.find((item) => item.property === 'runtime.activationImplementationSha256');
  assert(deploymentPath?.match, 'Live and disposable deployment implementation paths must match exactly');
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    liveAndDisposableDeploymentImplementationPath: deploymentPath.match ? 'MATCH' : 'MISMATCH',
    comparisons,
    failures: failures.map((item) => item.property),
    manifestSha256: crypto.createHash('sha256').update(stableJson({ live, disposable, reviewedMismatches })).digest('hex'),
  };
}

module.exports = { REQUIRED_PROPERTIES, compareParity, getPath, sha256File, stableJson };
