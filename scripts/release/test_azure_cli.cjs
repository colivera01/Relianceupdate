#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { runProcessAsync } = require('./azure_cli.cjs');

(async () => {
  const ticks = [];
  const timer = setInterval(() => ticks.push(Date.now()), 10);
  try {
    const output = await runProcessAsync(process.execPath, [
      '-e',
      "setTimeout(() => process.stdout.write('PASS\\n'), 100)",
    ], { label: 'async subprocess probe' });
    assert.equal(output, 'PASS');
    assert(ticks.length >= 2, 'Async subprocess blocked the event loop');

    await assert.rejects(
      runProcessAsync(process.execPath, ['-e', "process.stderr.write('expected failure'); process.exit(7)"], { label: 'failure probe' }),
      /failure probe failed \(7\): expected failure/,
    );
    console.log(JSON.stringify({ verdict: 'PASS', eventLoopTicks: ticks.length }));
  } finally {
    clearInterval(timer);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
