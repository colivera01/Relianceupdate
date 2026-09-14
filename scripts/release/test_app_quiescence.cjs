#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AppQuiescence } = require('./app_quiescence.cjs');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-quiescence-test-'));
const snapshot = path.join(temp, 'snapshot.json');
let state = 'Running';
let rules = [{ name: 'Allow all', action: 'Allow', ipAddress: 'Any', priority: 2147483647 }];
let acceptanceReadOnly;
const runner = (args) => {
  const text = args.join(' ');
  if (text.includes('deployment source show')) return JSON.stringify({ isManualIntegration: true, repoUrl: 'test', branch: 'test' });
  if (text.includes('log deployment list')) return JSON.stringify([{ complete: true, status: 4 }]);
  if (text.includes('access-restriction show')) return JSON.stringify({ ipSecurityRestrictions: rules });
  if (text.includes('appsettings list')) return JSON.stringify(acceptanceReadOnly === undefined
    ? [] : [{ name: 'RELIANCE_ACCEPTANCE_READ_ONLY', value: acceptanceReadOnly }]);
  if (text.includes('appsettings set')) { acceptanceReadOnly = args.find((item) => item.startsWith('RELIANCE_ACCEPTANCE_READ_ONLY='))?.split('=')[1]; return ''; }
  if (text.includes('appsettings delete')) { acceptanceReadOnly = undefined; return ''; }
  if (text.includes('access-restriction add')) {
    const name = args[args.indexOf('--rule-name') + 1];
    const action = args[args.indexOf('--action') + 1];
    rules = [...rules, { name, action }];
    return '';
  }
  if (text.includes('access-restriction remove')) {
    const name = args[args.indexOf('--rule-name') + 1];
    const action = args[args.indexOf('--action') + 1];
    const matchingRule = rules.find((rule) => rule.name === name);
    assert(matchingRule, `Unknown access restriction: ${name}`);
    assert.equal(action, matchingRule.action, `Access restriction removal must declare the ${matchingRule.action} action`);
    rules = rules.filter((rule) => rule.name !== name);
    return '';
  }
  if (text.includes('webapp stop')) { state = 'Stopped'; return ''; }
  if (text.includes('webapp start')) { state = 'Running'; return ''; }
  if (text.includes('webapp show')) return JSON.stringify({ state, id: '/disposable/app' });
  throw new Error(`Unexpected command: ${text}`);
};

try {
  const control = new AppQuiescence({ subscription: 's', resourceGroup: 'g', appService: 'a', snapshotFile: snapshot,
    operatorCidr: '203.0.113.10/32', environment: 'disposable', runner });
  assert.equal(control.dryRun().writeExecuted, false);
  process.env.RELIANCE_REHEARSAL_AUTHORIZATION = 'DISPOSABLE_ONLY';
  assert.equal(control.freeze().businessWritesQuiesced, true);
  assert.equal(state, 'Stopped');
  assert.equal(control.restrictedRestart().restrictedToOperator, true);
  assert.equal(state, 'Running');
  assert.equal(acceptanceReadOnly, 'YES');
  assert.equal(control.verifyAcceptanceMode().readOnlyMode, true);
  assert.equal(control.restore().restrictionsRestored, true);
  assert.deepEqual(rules, [{ name: 'Allow all', action: 'Allow', ipAddress: 'Any', priority: 2147483647 }]);
  assert.equal(acceptanceReadOnly, undefined);
  assert.equal(fs.existsSync(snapshot), false);
  console.log(JSON.stringify({ verdict: 'PASS', stop: true, restrictedRestart: true, exactRestore: true }));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
