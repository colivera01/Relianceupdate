#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ZERO_OID = '0'.repeat(40);
const UNCERTAIN_CODE = 'RELIANCE_GIT_OUTCOME_UNCERTAIN';

function assertCommit(value, label) {
  assert.match(value || '', /^[a-f0-9]{40}$/i, `${label} must be a Git commit SHA`);
  return value.toLowerCase();
}

function assertTree(value, label) {
  assert.match(value || '', /^[a-f0-9]{40}$/i, `${label} must be a Git tree SHA`);
  return value.toLowerCase();
}

function assertName(value, label) {
  assert.match(value || '', /^[A-Za-z0-9._/-]+$/, `${label} contains unsupported characters`);
  assert(!String(value).includes('..'), `${label} cannot contain a double-dot sequence`);
  return value;
}

function gitProcess(root, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function commandFailure(label, result) {
  const error = new Error(`${label} failed closed`);
  error.code = 'RELIANCE_GIT_COMMAND_FAILED';
  error.status = result?.status;
  return error;
}

function uncertain(label, cause) {
  const error = new Error(`${label} outcome is uncertain and requires durable reconciliation`);
  error.code = UNCERTAIN_CODE;
  error.cause = cause;
  return error;
}

function repositoryFromRemoteUrl(value) {
  const sanitized = String(value || '').trim().replace(/\\/g, '/').replace(/\.git$/, '');
  const pathValue = sanitized.includes('://')
    ? new URL(sanitized).pathname
    : sanitized.replace(/^[^:]+:/, '/');
  const parts = pathValue.split('/').filter(Boolean);
  assert(parts.length >= 2, 'Git remote repository identity is unavailable');
  return parts.slice(-2).join('/');
}

function parseLsRemote(output, ref) {
  const rows = String(output || '').split(/\r?\n/).filter(Boolean)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 2 && parts[1] === ref);
  assert(rows.length <= 1, `Git remote returned ambiguous identity for ${ref}`);
  return rows.length ? assertCommit(rows[0][0], `Remote ${ref}`) : null;
}

function hookSource() {
  return `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8').split(/\\r?\\n/).filter(Boolean);
const expectedRef = process.env.RELIANCE_GIT_EXPECTED_REF;
const expectedOid = process.env.RELIANCE_GIT_EXPECTED_OID;
const row = input.map((line) => line.trim().split(/\\s+/)).find((parts) => parts[2] === expectedRef);
if (!row || row[3].toLowerCase() !== expectedOid.toLowerCase()) {
  process.stderr.write('RELIANCE_GIT_PRECONDITION_FAILED\\n');
  process.exit(42);
}
`;
}

class GitReleaseControl {
  constructor({ root, remote = 'origin', repository, branch, expectedStartSha, candidateSha,
    rollbackSha, rollbackTree, releaseTags, runGit = gitProcess, beforePush = null }) {
    this.root = path.resolve(root);
    this.remote = assertName(remote, 'Git remote');
    this.repository = assertName(repository, 'Git repository');
    this.branch = assertName(branch, 'Git branch');
    this.expectedStartSha = assertCommit(expectedStartSha, 'Expected starting remote');
    this.candidateSha = assertCommit(candidateSha, 'Candidate');
    this.rollbackSha = assertCommit(rollbackSha, 'Rollback');
    this.rollbackTree = assertTree(rollbackTree, 'Rollback tree');
    assert(Array.isArray(releaseTags) && releaseTags.length >= 1, 'At least one reviewed release tag is required');
    this.releaseTags = releaseTags.map((tag) => ({
      name: assertName(tag.name, 'Release tag'),
      targetSha: assertCommit(tag.targetSha, 'Release tag target'),
    }));
    assert.equal(this.releaseTags.length, 1, 'Exactly one reviewed release tag is required');
    assert.equal(this.releaseTags[0].name, `release/accepted/${this.candidateSha}`,
      'Release tag name differs from the reviewed candidate convention');
    assert.equal(this.releaseTags[0].targetSha, this.candidateSha,
      'Release tag target differs from the authorized candidate');
    this.runGit = runGit;
    this.beforePush = beforePush;
  }

  branchRef() { return `refs/heads/${this.branch}`; }

  async command(args, label, { allowFailure = false, env = process.env } = {}) {
    const result = await this.runGit(this.root, args, { env });
    if (!allowFailure && result.status !== 0) throw commandFailure(label, result);
    return result;
  }

  async verifyRepository() {
    const result = await this.command(['remote', 'get-url', this.remote], 'Git remote lookup');
    const observed = repositoryFromRemoteUrl(result.stdout);
    assert.equal(observed.toLowerCase(), this.repository.toLowerCase(), 'Git remote repository differs');
    return { verdict: 'PASS', remote: this.remote, repository: this.repository, branch: this.branch };
  }

  async remoteHead() {
    const ref = this.branchRef();
    const result = await this.command(['ls-remote', '--heads', this.remote, ref], 'Git remote branch lookup');
    const value = parseLsRemote(result.stdout, ref);
    assert(value, 'Authoritative Git branch is missing');
    return value;
  }

  async commitTree(commit) {
    const value = assertCommit(commit, 'Commit');
    const result = await this.command(['rev-parse', `${value}^{tree}`], 'Git tree lookup');
    return assertTree(result.stdout, 'Observed tree');
  }

  async verifyTopology() {
    const parent = await this.command(['rev-parse', `${this.rollbackSha}^`], 'Rollback parent lookup');
    assert.equal(assertCommit(parent.stdout, 'Rollback parent'), this.candidateSha,
      'Rollback commit is not a direct child of the candidate');
    assert.equal(await this.commitTree(this.rollbackSha), this.rollbackTree, 'Rollback tree differs');
    const ancestor = await this.command(['merge-base', '--is-ancestor', this.expectedStartSha, this.candidateSha],
      'Candidate ancestry verification', { allowFailure: true });
    assert.equal(ancestor.status, 0, 'Candidate is not a fast-forward of the authorized starting remote');
    return { verdict: 'PASS', rollbackDirectChild: true, rollbackTree: this.rollbackTree, fastForward: true };
  }

  async atomicPush({ targetSha, ref, expectedOid, label }) {
    const target = assertCommit(targetSha, `${label} target`);
    const expected = expectedOid === ZERO_OID ? ZERO_OID : assertCommit(expectedOid, `${label} expected remote`);
    if (this.beforePush) await this.beforePush({ targetSha: target, ref, expectedOid: expected, label });
    const hookRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-git-guard-'));
    const hook = path.join(hookRoot, 'pre-push');
    try {
      fs.writeFileSync(hook, hookSource(), { flag: 'wx', mode: 0o700 });
      const env = { ...process.env, RELIANCE_GIT_EXPECTED_REF: ref, RELIANCE_GIT_EXPECTED_OID: expected };
      const result = await this.command(['-c', `core.hooksPath=${hookRoot.replace(/\\/g, '/')}`,
        'push', '--porcelain', this.remote, `${target}:${ref}`], label, { allowFailure: true, env });
      if (result.status !== 0) {
        let observed;
        try { observed = ref.startsWith('refs/heads/') ? await this.remoteHead() : await this.remoteTag(ref.slice(10)); }
        catch (error) { throw uncertain(label, error); }
        if (observed === target) return { verdict: 'PASS', result: 'RECONCILED_AFTER_UNCERTAIN_PUSH', observed };
        if (observed !== expected && !(expected === ZERO_OID && observed === null)) {
          throw new Error(`${label} refused because the remote changed concurrently`);
        }
        throw commandFailure(label, result);
      }
      let observed;
      try { observed = ref.startsWith('refs/heads/') ? await this.remoteHead() : await this.remoteTag(ref.slice(10)); }
      catch (error) { throw uncertain(label, error); }
      assert.equal(observed, target, `${label} independent remote verification differs`);
      return { verdict: 'PASS', result: 'FAST_FORWARD_VERIFIED', observed };
    } finally {
      fs.rmSync(hookRoot, { recursive: true, force: true });
    }
  }

  async inspect() {
    await this.verifyRepository();
    await this.verifyTopology();
    const remoteHead = await this.remoteHead();
    return { verdict: 'PASS', remote: this.remote, repository: this.repository,
      branch: this.branch, remoteHead };
  }

  initialDurableState(observedRemoteBefore) {
    return {
      remote: this.remote,
      repository: this.repository,
      branch: this.branch,
      expectedStartingRemoteSha: this.expectedStartSha,
      authorizedCandidateSha: this.candidateSha,
      authorizedRollbackSha: this.rollbackSha,
      authorizedRollbackTree: this.rollbackTree,
      promotion: { phase: 'NOT_STARTED', attempted: false, result: null,
        observedRemoteBefore: observedRemoteBefore || null, observedRemoteAfter: null },
      rollback: { required: false, attempted: false, result: null,
        observedRemoteBefore: null, observedRemoteAfter: null },
      tags: { phase: 'NOT_STARTED', attempted: false,
        entries: this.releaseTags.map((tag) => ({ ...tag, result: null, observedTarget: null })) },
    };
  }

  async promoteCandidate() {
    await this.verifyRepository();
    await this.verifyTopology();
    const before = await this.remoteHead();
    if (before === this.candidateSha) {
      return { verdict: 'PASS', promotionAttempted: false, result: 'RECONCILED_ALREADY_PROMOTED',
        observedRemoteBefore: before, observedRemoteAfter: before };
    }
    assert.equal(before, this.expectedStartSha,
      'Candidate promotion refused because the authoritative remote differs from the authorized starting SHA');
    const pushed = await this.atomicPush({ targetSha: this.candidateSha, ref: this.branchRef(),
      expectedOid: this.expectedStartSha, label: 'Candidate fast-forward promotion' });
    const after = await this.remoteHead();
    assert.equal(after, this.candidateSha, 'Candidate promotion remote verification differs');
    return { verdict: 'PASS', promotionAttempted: true, result: pushed.result,
      observedRemoteBefore: before, observedRemoteAfter: after };
  }

  async verifyCandidatePromotion() {
    await this.verifyRepository();
    const observed = await this.remoteHead();
    assert.equal(observed, this.candidateSha, 'Authoritative remote is not the authorized candidate');
    return { verdict: 'PASS', remote: this.remote, repository: this.repository,
      branch: this.branch, observedRemoteHead: observed, expectedCandidateSha: this.candidateSha };
  }

  async forwardOnlyRecovery() {
    await this.verifyRepository();
    await this.verifyTopology();
    const before = await this.remoteHead();
    if (before === this.expectedStartSha) {
      return { verdict: 'PASS', rollbackRequired: false, rollbackAttempted: false,
        result: 'CANDIDATE_NOT_PROMOTED', observedRemoteBefore: before, observedRemoteAfter: before };
    }
    if (before === this.rollbackSha) {
      assert.equal(await this.commitTree(this.rollbackSha), this.rollbackTree, 'Remote rollback tree differs');
      return { verdict: 'PASS', rollbackRequired: true, rollbackAttempted: false,
        result: 'RECONCILED_ALREADY_ROLLED_BACK', observedRemoteBefore: before, observedRemoteAfter: before,
        observedRemoteTree: this.rollbackTree };
    }
    assert.equal(before, this.candidateSha,
      'Forward-only Git recovery refused because the authoritative remote is neither start, candidate, nor rollback');
    const pushed = await this.atomicPush({ targetSha: this.rollbackSha, ref: this.branchRef(),
      expectedOid: this.candidateSha, label: 'Forward-only Git rollback' });
    const after = await this.remoteHead();
    assert.equal(after, this.rollbackSha, 'Forward-only Git rollback remote verification differs');
    const tree = await this.commitTree(after);
    assert.equal(tree, this.rollbackTree, 'Forward-only Git rollback tree verification differs');
    return { verdict: 'PASS', rollbackRequired: true, rollbackAttempted: true,
      result: pushed.result, observedRemoteBefore: before, observedRemoteAfter: after,
      observedRemoteTree: tree };
  }

  async remoteTag(name) {
    const tag = assertName(name, 'Release tag');
    const ref = `refs/tags/${tag}`;
    const peeled = `${ref}^{}`;
    const result = await this.command(['ls-remote', '--tags', this.remote, ref, peeled], 'Git remote tag lookup');
    const direct = parseLsRemote(result.stdout, ref);
    const resolved = parseLsRemote(result.stdout, peeled);
    return resolved || direct;
  }

  async ensureReleaseTags() {
    await this.verifyCandidatePromotion();
    const entries = [];
    for (const tag of this.releaseTags) {
      assert.equal(tag.targetSha, this.candidateSha, 'Release tag target differs from the authorized candidate');
      const before = await this.remoteTag(tag.name);
      if (before) {
        assert.equal(before, tag.targetSha, `Existing release tag ${tag.name} targets a different commit`);
        entries.push({ ...tag, result: 'IDEMPOTENT_ALREADY_VERIFIED', observedTarget: before });
        continue;
      }
      const pushed = await this.atomicPush({ targetSha: tag.targetSha, ref: `refs/tags/${tag.name}`,
        expectedOid: ZERO_OID, label: `Release tag ${tag.name}` });
      const after = await this.remoteTag(tag.name);
      assert.equal(after, tag.targetSha, `Release tag ${tag.name} independent verification differs`);
      entries.push({ ...tag, result: pushed.result, observedTarget: after });
    }
    return { verdict: 'PASS', attempted: true, phase: 'VERIFIED', entries };
  }

  async verifyReleaseTags() {
    const entries = [];
    for (const tag of this.releaseTags) {
      const observed = await this.remoteTag(tag.name);
      assert.equal(observed, tag.targetSha, `Release tag ${tag.name} verification differs`);
      entries.push({ ...tag, result: 'VERIFIED', observedTarget: observed });
    }
    return { verdict: 'PASS', phase: 'VERIFIED', entries };
  }
}

module.exports = {
  GitReleaseControl,
  UNCERTAIN_CODE,
  ZERO_OID,
  assertCommit,
  parseLsRemote,
  repositoryFromRemoteUrl,
};
