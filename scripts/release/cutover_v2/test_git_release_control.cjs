#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GitReleaseControl } = require('./git_release_control.cjs');

const results = [];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function write(file, value) {
  fs.writeFileSync(file, value, { encoding: 'utf8' });
}

function commit(cwd, message) {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-git-release-'));
  const remoteParent = path.join(root, 'owner');
  const remote = path.join(remoteParent, 'repo.git');
  const source = path.join(root, 'source');
  fs.mkdirSync(remoteParent, { recursive: true });
  fs.mkdirSync(source);
  git(remoteParent, ['init', '--bare', remote]);
  git(source, ['init', '-b', 'authoritative']);
  git(source, ['config', 'user.name', 'Reliance Disposable Test']);
  git(source, ['config', 'user.email', 'reliance-disposable@example.invalid']);
  write(path.join(source, 'state.txt'), 'original\n');
  const original = commit(source, 'original');
  git(source, ['remote', 'add', 'disposable', remote]);
  git(source, ['push', 'disposable', 'HEAD:refs/heads/authoritative']);
  write(path.join(source, 'state.txt'), 'candidate\n');
  const candidate = commit(source, 'candidate');
  write(path.join(source, 'state.txt'), 'original\n');
  const rollback = commit(source, 'forward rollback');
  const rollbackTree = git(source, ['rev-parse', `${rollback}^{tree}`]);
  assert.equal(rollbackTree, git(source, ['rev-parse', `${original}^{tree}`]));
  const tags = [{ name: `release/accepted/${candidate}`, targetSha: candidate }];
  const createControl = (options = {}) => new GitReleaseControl({
    root: source,
    remote: 'disposable',
    repository: 'owner/repo',
    branch: 'authoritative',
    expectedStartSha: original,
    candidateSha: candidate,
    rollbackSha: rollback,
    rollbackTree,
    releaseTags: tags,
    ...options,
  });
  return { root, remote, source, original, candidate, rollback, rollbackTree, tags, createControl,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

async function test(name, operation) {
  const current = fixture();
  try {
    await operation(current);
    results.push({ name, verdict: 'PASS' });
  } catch (error) {
    results.push({ name, verdict: 'FAIL', error: error.message });
  } finally {
    current.cleanup();
  }
}

async function main() {
  await test('success promotes by fast-forward and independently verifies candidate', async (f) => {
    const result = await f.createControl().promoteCandidate();
    assert.equal(result.promotionAttempted, true);
    assert.equal(result.observedRemoteAfter, f.candidate);
    assert.equal((await f.createControl().verifyCandidatePromotion()).observedRemoteHead, f.candidate);
  });

  await test('recovery after promotion fast-forwards to exact rollback tree', async (f) => {
    const control = f.createControl();
    await control.promoteCandidate();
    const result = await control.forwardOnlyRecovery();
    assert.equal(result.rollbackAttempted, true);
    assert.equal(result.observedRemoteAfter, f.rollback);
    assert.equal(result.observedRemoteTree, f.rollbackTree);
  });

  await test('failure before promotion leaves original branch and creates no rollback commit update', async (f) => {
    const control = f.createControl();
    const result = await control.forwardOnlyRecovery();
    assert.equal(result.result, 'CANDIDATE_NOT_PROMOTED');
    assert.equal(result.rollbackAttempted, false);
    assert.equal(await control.remoteHead(), f.original);
  });

  await test('concurrent remote change fails closed without overwriting the competing commit', async (f) => {
    const competitor = path.join(f.root, 'competitor');
    git(f.root, ['clone', f.remote, competitor]);
    git(competitor, ['config', 'user.name', 'Reliance Concurrent Test']);
    git(competitor, ['config', 'user.email', 'reliance-concurrent@example.invalid']);
    git(competitor, ['checkout', 'authoritative']);
    write(path.join(competitor, 'concurrent.txt'), 'concurrent\n');
    const concurrent = commit(competitor, 'concurrent update');
    let changed = false;
    const control = f.createControl({ beforePush: async () => {
      if (!changed) {
        git(competitor, ['push', 'origin', 'HEAD:refs/heads/authoritative']);
        changed = true;
      }
    } });
    await assert.rejects(control.promoteCandidate(), /remote changed concurrently/);
    assert.equal(await control.remoteHead(), concurrent);
  });

  await test('controller loss after promotion reconciles already-promoted remote idempotently', async (f) => {
    await f.createControl().promoteCandidate();
    const result = await f.createControl().promoteCandidate();
    assert.equal(result.promotionAttempted, false);
    assert.equal(result.result, 'RECONCILED_ALREADY_PROMOTED');
  });

  await test('controller loss during rollback reconciles already-rolled-back remote idempotently', async (f) => {
    const first = f.createControl();
    await first.promoteCandidate();
    await first.forwardOnlyRecovery();
    const result = await f.createControl().forwardOnlyRecovery();
    assert.equal(result.rollbackAttempted, false);
    assert.equal(result.result, 'RECONCILED_ALREADY_ROLLED_BACK');
    assert.equal(result.observedRemoteTree, f.rollbackTree);
  });

  await test('absent release tag is created at the exact candidate and verified', async (f) => {
    const control = f.createControl();
    await control.promoteCandidate();
    const result = await control.ensureReleaseTags();
    assert.equal(result.entries[0].observedTarget, f.candidate);
    assert.equal((await control.verifyReleaseTags()).entries[0].observedTarget, f.candidate);
  });

  await test('existing exact release tag is idempotently accepted', async (f) => {
    const control = f.createControl();
    await control.promoteCandidate();
    await control.ensureReleaseTags();
    const result = await f.createControl().ensureReleaseTags();
    assert.equal(result.entries[0].result, 'IDEMPOTENT_ALREADY_VERIFIED');
  });

  await test('existing mismatched release tag fails closed and is never moved', async (f) => {
    const control = f.createControl();
    await control.promoteCandidate();
    git(f.source, ['push', 'disposable', `${f.original}:refs/tags/${f.tags[0].name}`]);
    await assert.rejects(control.ensureReleaseTags(), /targets a different commit/);
    assert.equal(await control.remoteTag(f.tags[0].name), f.original);
  });

  await test('reject timeout and technical recovery path create no success tags', async (f) => {
    const control = f.createControl();
    await control.promoteCandidate();
    await control.forwardOnlyRecovery();
    assert.equal(await control.remoteTag(f.tags[0].name), null);
  });

  const failures = results.filter((entry) => entry.verdict === 'FAIL');
  process.stdout.write(`${JSON.stringify({ verdict: failures.length ? 'FAIL' : 'PASS',
    tests: results.length, failures, results }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ verdict: 'FAIL', error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
});
