const { spawnSync } = require('node:child_process');
const net = require('node:net');

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

function canReachHost(hostname, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
    const finalize = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(2_500);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });
}

async function canReachBaseUrl(baseUrl) {
  const target = new URL(baseUrl);
  const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
  const hostnames = Array.from(
    new Set(
      [target.hostname]
        .concat(target.hostname === '127.0.0.1' ? ['localhost'] : [])
        .concat(target.hostname === 'localhost' ? ['127.0.0.1'] : [])
    )
  );

  for (const hostname of hostnames) {
    if (await canReachHost(hostname, port)) {
      return true;
    }
  }

  return false;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const skipGlobalDbSetup = rawArgs.includes('--skip-global-db-setup');
  const specArgs = rawArgs.filter((arg) => arg !== '--skip-global-db-setup');

  if (specArgs.length === 0) {
    console.error('Usage: node scripts/dev/run-playwright-live-aware.cjs [--skip-global-db-setup] <playwright-args...>');
    process.exit(1);
  }

  const hasLiveServer = await canReachBaseUrl(DEFAULT_BASE_URL);
  const runner = process.execPath;
  const cliPath = require.resolve('@playwright/test/cli');
  const args = [cliPath, 'test', ...specArgs];

  if (hasLiveServer) {
    args.push('--config', 'playwright.noweb.config.ts');
  }

  const result = spawnSync(runner, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(skipGlobalDbSetup ? { PLAYWRIGHT_SKIP_GLOBAL_DB_SETUP: '1' } : {}),
    },
  });

  if (result.error) {
    console.error(result.error);
  }

  if (typeof result.status === 'number') {
    process.exit(result.status);
  }

  process.exit(1);
}

main();
