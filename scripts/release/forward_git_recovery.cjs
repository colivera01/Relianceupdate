#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const root = path.resolve(value('--root') || process.cwd());
const oldSha = value('--old');
const candidateSha = value('--candidate');
const branch = value('--branch') || 'review/reliance-cutover-v2-rollback-20260914';
const materialize = args.includes('--materialize');

function git(gitArgs, options = {}) {
  const result = spawnSync('git', gitArgs, { cwd: options.cwd || root, encoding: 'utf8', env: { ...process.env, ...options.env } });
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.stdout || result.error?.message).trim());
  return result.stdout.trim();
}

function main() {
  assert(/^[a-f0-9]{40}$/.test(oldSha || ''), '--old must be an exact commit SHA');
  assert(/^[a-f0-9]{40}$/.test(candidateSha || ''), '--candidate must be an exact commit SHA');
  git(['merge-base', '--is-ancestor', oldSha, candidateSha]);
  const oldTree = git(['rev-parse', `${oldSha}^{tree}`]);
  const message = `recovery: restore pre-forward-baseline tree\n\nRestores tree ${oldTree} from ${oldSha} after candidate ${candidateSha}.`;
  const commitEnv = {
    GIT_AUTHOR_NAME: 'Reliance Release Recovery',
    GIT_AUTHOR_EMAIL: 'release-recovery@reliance.invalid',
    GIT_COMMITTER_NAME: 'Reliance Release Recovery',
    GIT_COMMITTER_EMAIL: 'release-recovery@reliance.invalid',
    GIT_AUTHOR_DATE: '2026-09-14T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-09-14T00:00:00Z',
  };
  const rollbackSha = git(['commit-tree', oldTree, '-p', candidateSha, '-m', message], { env: commitEnv });
  assert.equal(git(['rev-parse', `${rollbackSha}^{tree}`]), oldTree, 'Rollback tree does not equal authoritative old tree');
  git(['merge-base', '--is-ancestor', candidateSha, rollbackSha]);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reliance-forward-recovery-'));
  try {
    const bare = path.join(temporary, 'remote.git');
    git(['init', '--bare', bare]);
    git(['push', '--porcelain', bare, `${oldSha}:refs/heads/authoritative`]);
    git(['push', '--porcelain', bare, `${candidateSha}:refs/heads/authoritative`]);
    git(['push', '--porcelain', bare, `${rollbackSha}:refs/heads/authoritative`]);
    const observed = git(['--git-dir', bare, 'rev-parse', 'refs/heads/authoritative']);
    assert.equal(observed, rollbackSha, 'Forward rollback rehearsal ended at an unexpected commit');
    assert.equal(git(['--git-dir', bare, 'rev-parse', `${observed}^{tree}`]), oldTree, 'Rehearsed rollback tree differs');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  if (materialize) git(['branch', '-f', branch, rollbackSha]);
  console.log(JSON.stringify({ verdict: 'PASS', oldSha, candidateSha, oldTree, rollbackSha, rollbackTree: oldTree,
    forwardOnly: true, forcePushUsed: false, branch: materialize ? branch : null }, null, 2));
}

try { main(); } catch (error) {
  console.error(`FORWARD_GIT_RECOVERY_FAILED: ${error.message}`);
  process.exitCode = 2;
}
