#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE_STATUS = 'WAITING_FOR_PRODUCT_OWNER_ACCEPTANCE';
const ACCEPTANCE_CHECKLIST_VERSION = 'reliance-forward-baseline-physical-v1';
const DEFAULT_ACCEPTANCE_TIMEOUT_MS = 30 * 60 * 1000;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assertBinding(binding) {
  assert(/^[a-f0-9]{40}$/.test(binding.candidateSha || ''), 'Acceptance candidate SHA is invalid');
  for (const field of ['runtimeArtifactSha256', 'migrationArtifactSha256', 'releaseReceiptSha256',
    'structuralSha256', 'ledgerSha256', 'protectedDataSha256', 'deploymentControlSha256']) {
    assert(/^[a-f0-9]{64}$/.test(binding[field] || ''), `Acceptance ${field} is invalid`);
  }
  assert(String(binding.targetResourceId || '').startsWith('/subscriptions/'), 'Acceptance target resource is invalid');
  assert(Array.isArray(binding.activeMigrations) && binding.activeMigrations.length === 2,
    'Acceptance migration state is incomplete');
  assert(binding.technicalCutoverCompletedAt, 'Technical-cutover timestamp is missing');
}

function createAcceptanceState({ stateFile, decisionFile, binding, timeoutMs = DEFAULT_ACCEPTANCE_TIMEOUT_MS,
  now = () => new Date(), randomUUID = () => crypto.randomUUID(), randomBytes = (size) => crypto.randomBytes(size) }) {
  assert(stateFile, 'Acceptance state output is required');
  assert(decisionFile, 'Acceptance decision output is required');
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 15 * 60_000 && timeoutMs <= 45 * 60_000,
    'Acceptance timeout must be between 15 and 45 minutes');
  assertBinding(binding);
  assert(!fs.existsSync(stateFile), 'Acceptance state already exists');
  assert(!fs.existsSync(decisionFile), 'Acceptance decision already exists');
  const created = now();
  const cutoverId = randomUUID();
  const bindingSha256 = sha256(Buffer.from(JSON.stringify(binding), 'utf8'));
  const challengeNonce = randomBytes(24).toString('hex');
  const state = {
    acceptanceStateVersion: 1,
    status: ACCEPTANCE_STATUS,
    cutoverId,
    challenge: sha256(Buffer.from(`${cutoverId}:${bindingSha256}:${challengeNonce}`, 'utf8')),
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + timeoutMs).toISOString(),
    timeoutMinutes: timeoutMs / 60_000,
    checklistVersion: ACCEPTANCE_CHECKLIST_VERSION,
    decisionFile: path.resolve(decisionFile),
    bindingSha256,
    binding,
  };
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
  return state;
}

function validateDecision(state, decision, now = new Date()) {
  assert.equal(state.status, ACCEPTANCE_STATUS, 'Cutover is not waiting for Product Owner acceptance');
  assert.equal(decision.decisionVersion, 1, 'Unsupported acceptance decision version');
  assert(['ACCEPT', 'REJECT'].includes(decision.action), 'Decision must be ACCEPT or REJECT');
  assert.equal(decision.cutoverId, state.cutoverId, 'Acceptance cutover ID differs');
  assert.equal(decision.challenge, state.challenge, 'Acceptance challenge differs');
  assert.equal(decision.candidateSha, state.binding.candidateSha, 'Acceptance candidate differs');
  assert.equal(decision.targetResourceId, state.binding.targetResourceId, 'Acceptance target differs');
  const decidedAt = new Date(decision.decidedAt).getTime();
  const createdAt = new Date(state.createdAt).getTime();
  const expiresAt = new Date(state.expiresAt).getTime();
  assert(Number.isFinite(decidedAt) && Number.isFinite(createdAt) && Number.isFinite(expiresAt),
    'Acceptance timestamps are invalid');
  assert(decidedAt >= createdAt,
    'Acceptance decision predates the waiting state');
  assert(decidedAt <= expiresAt,
    'Acceptance decision was made after the deadline');
  assert(now.getTime() <= expiresAt, 'Acceptance window expired');
  return decision;
}

function submitDecision({ stateFile, action, cutoverId, challenge, now = () => new Date() }) {
  const state = readJson(stateFile);
  assert(['ACCEPT', 'REJECT'].includes(action), 'Decision must be ACCEPT or REJECT');
  assert.equal(state.status, ACCEPTANCE_STATUS, 'Cutover is not waiting for acceptance');
  assert.equal(cutoverId, state.cutoverId, 'Cutover ID differs');
  assert.equal(challenge, state.challenge, 'Acceptance challenge differs');
  const decidedAt = now();
  assert(decidedAt.getTime() <= new Date(state.expiresAt).getTime(), 'Acceptance window expired');
  const decision = {
    decisionVersion: 1,
    action,
    cutoverId,
    challenge,
    candidateSha: state.binding.candidateSha,
    targetResourceId: state.binding.targetResourceId,
    decidedAt: decidedAt.toISOString(),
    explicitProductOwnerAction: true,
  };
  fs.writeFileSync(state.decisionFile, `${JSON.stringify(decision, null, 2)}\n`, { flag: 'wx' });
  return { ...decision, decisionSha256: sha256(fs.readFileSync(state.decisionFile)) };
}

async function waitForAcceptance({ stateFile, decisionFile, binding, timeoutMs = DEFAULT_ACCEPTANCE_TIMEOUT_MS,
  pollMs = 30_000, assertInvariants, onWaiting = () => {}, simulation = null }) {
  const state = createAcceptanceState({ stateFile, decisionFile, binding, timeoutMs });
  onWaiting(state);
  if (simulation === 'ACCEPT' || simulation === 'REJECT') {
    submitDecision({ stateFile, action: simulation, cutoverId: state.cutoverId, challenge: state.challenge });
  }
  const deadline = new Date(state.expiresAt).getTime();
  while (Date.now() <= deadline) {
    await assertInvariants(state);
    if (fs.existsSync(decisionFile)) {
      const decision = validateDecision(state, readJson(decisionFile));
      return { state, decision, decisionSha256: sha256(fs.readFileSync(decisionFile)) };
    }
    if (simulation === 'TIMEOUT') break;
    await delay(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
  return { state, decision: { action: 'TIMEOUT', decidedAt: new Date().toISOString() }, decisionSha256: null };
}

function createAcceptanceReceipt({ output, state, decision, decisionSha256, authorizationReference,
  authoritativeSha, health, smoke, tagTargets }) {
  assert.equal(decision.action, 'ACCEPT', 'Only an explicit ACCEPT can create an acceptance receipt');
  assert(output, 'Acceptance receipt output is required');
  assert(!fs.existsSync(output), 'Acceptance receipt already exists');
  const receipt = {
    acceptanceReceiptVersion: 1,
    cutoverId: state.cutoverId,
    authorizationReference,
    productOwnerAcceptance: {
      action: decision.action,
      explicit: decision.explicitProductOwnerAction === true,
      acceptedAt: decision.decidedAt,
      decisionSha256,
    },
    candidateSha: state.binding.candidateSha,
    githubAuthoritativeSha: authoritativeSha,
    runtimeArtifactSha256: state.binding.runtimeArtifactSha256,
    migrationArtifactSha256: state.binding.migrationArtifactSha256,
    releaseReceiptSha256: state.binding.releaseReceiptSha256,
    activeMigrations: state.binding.activeMigrations,
    structuralSha256: state.binding.structuralSha256,
    ledgerSha256: state.binding.ledgerSha256,
    protectedDataSha256: state.binding.protectedDataSha256,
    deploymentControlSha256: state.binding.deploymentControlSha256,
    health,
    smoke,
    checklistVersion: state.checklistVersion,
    tagTargets,
    environment: state.binding.environment,
    targetResourceId: state.binding.targetResourceId,
  };
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  return { receipt, sha256: sha256(fs.readFileSync(output)) };
}

function cli() {
  const args = process.argv.slice(2);
  const action = String(args[0] || '').toUpperCase();
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  assert(['ACCEPT', 'REJECT'].includes(action), 'Choose accept or reject');
  const result = submitDecision({
    stateFile: path.resolve(value('--state') || ''),
    action,
    cutoverId: value('--cutover-id'),
    challenge: value('--challenge'),
  });
  console.log(JSON.stringify({ verdict: 'DECISION_RECORDED', action: result.action,
    cutoverId: result.cutoverId, decidedAt: result.decidedAt, decisionSha256: result.decisionSha256 }, null, 2));
}

if (require.main === module) {
  try { cli(); } catch (error) { console.error(`CUTOVER_ACCEPTANCE_FAILED: ${error.message}`); process.exitCode = 2; }
}

module.exports = {
  ACCEPTANCE_CHECKLIST_VERSION,
  ACCEPTANCE_STATUS,
  createAcceptanceReceipt,
  createAcceptanceState,
  DEFAULT_ACCEPTANCE_TIMEOUT_MS,
  submitDecision,
  validateDecision,
  waitForAcceptance,
};
