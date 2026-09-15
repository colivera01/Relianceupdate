#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function invocation(args) {
  if (process.platform === 'win32') {
    const candidates = [
      process.env.RELIANCE_AZURE_CLI_PYTHON,
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft SDKs', 'Azure', 'CLI2', 'python.exe'),
    ].filter(Boolean);
    const python = candidates.find((candidate) => fs.existsSync(candidate));
    if (python) return { executable: python, args: ['-IBm', 'azure.cli', ...args] };
  }
  return { executable: 'az', args };
}

function runAzureResult(args, options = {}) {
  const call = invocation(args);
  return spawnSync(call.executable, call.args, {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...options.env },
  });
}

function runAzure(args, options = {}) {
  const result = runAzureResult(args, options);
  if (result.error || result.status !== 0) {
    throw new Error(`${options.label || 'Azure operation'} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result.stdout.trim();
}

function runProcessAsync(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
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
    child.once('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`${options.label || executable} failed (${signal || code}): ${stderr.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function runAzureAsync(args, options = {}) {
  const call = invocation(args);
  return runProcessAsync(call.executable, call.args, options);
}

module.exports = { invocation, runAzure, runAzureAsync, runAzureResult, runProcessAsync };

