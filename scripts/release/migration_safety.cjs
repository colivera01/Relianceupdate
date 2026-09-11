#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ENVIRONMENTS = new Set(['local', 'disposable', 'beta', 'production']);
const PROTECTED_ENVIRONMENTS = new Set(['beta', 'production']);
const WRITE_COMMANDS = new Set(['migrate deploy', 'migrate resolve', 'migrate dev', 'migrate reset', 'db push']);
const NEVER_PROTECTED = new Set(['migrate dev', 'migrate reset', 'db push']);
const ALLOWED_COMMANDS = new Set(['migrate status', ...WRITE_COMMANDS]);

function parsePrismaSqlServerUrl(value) {
  if (!value || !value.startsWith('sqlserver://')) throw new Error('A SQL Server DATABASE_URL is required');
  const parts = value.slice('sqlserver://'.length).split(';').filter(Boolean);
  const authority = parts.shift();
  const authorityParts = authority.split(':');
  const options = Object.fromEntries(parts.map((part) => {
    const at = part.indexOf('=');
    if (at < 1) throw new Error('Malformed SQL Server connection option');
    return [part.slice(0, at).toLowerCase(), part.slice(at + 1)];
  }));
  return {
    server: authorityParts[0].toLowerCase(),
    port: Number(authorityParts[1] || 1433),
    database: String(options.database || '').toLowerCase(),
    user: options.user,
    password: options.password,
    options: {
      encrypt: options.encrypt !== 'false',
      trustServerCertificate: options.trustservercertificate === 'true',
      enableArithAbort: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 180000,
    connectionTimeout: 30000,
  };
}

function commandName(args) {
  const words = args.filter((value) => !value.startsWith('-'));
  if (words[0] === 'db' && words[1] === 'push') return 'db push';
  if (words[0] === 'migrate' && words[1]) return `migrate ${words[1]}`;
  return words.slice(0, 2).join(' ');
}

function loadKnownTargets(root) {
  const directory = path.join(root, 'config', 'release-targets');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
}

function sameServer(left, right) {
  const normalize = (value) => String(value || '').toLowerCase().replace(/\.database\.windows\.net$/, '');
  return normalize(left) === normalize(right);
}

function looksProtected(identity, knownTargets) {
  const known = knownTargets.find((target) => sameServer(target.server, identity.server)
    && String(target.database).toLowerCase() === identity.database);
  const nameSignal = /(^|[-_.])(beta|prod|production)([-_.]|$)/i.test(`${identity.server}/${identity.database}`);
  return { protected: Boolean(known || nameSignal), known };
}

function evaluatePolicy({ root, environment, databaseUrl, args, disposableAcknowledged, writeApproved, lockToken, targetSpec, releaseReceipt }) {
  if (!ENVIRONMENTS.has(environment)) return { allowed: false, reason: 'RELIANCE_DB_ENVIRONMENT must be local, disposable, beta, or production' };
  const identity = parsePrismaSqlServerUrl(databaseUrl);
  if (!identity.server || !identity.database) return { allowed: false, reason: 'DATABASE_URL must name an exact server and database' };
  const command = commandName(args);
  if (!ALLOWED_COMMANDS.has(command)) return { allowed: false, reason: `Prisma command is not allowlisted: ${command}` };
  const observed = looksProtected(identity, loadKnownTargets(root));
  if (observed.known && observed.known.environment !== environment) {
    return { allowed: false, reason: `Declared environment conflicts with known ${observed.known.environment} target` };
  }
  if (observed.protected && !PROTECTED_ENVIRONMENTS.has(environment)) {
    return { allowed: false, reason: 'Protected server/database identity cannot be declared local or disposable' };
  }
  if (NEVER_PROTECTED.has(command)) {
    if (PROTECTED_ENVIRONMENTS.has(environment) || observed.protected) {
      return { allowed: false, reason: `${command} is permanently blocked for beta and production` };
    }
    if (environment !== 'disposable' || disposableAcknowledged !== 'YES') {
      return { allowed: false, reason: `${command} requires RELIANCE_DB_ENVIRONMENT=disposable and RELIANCE_DISPOSABLE=YES` };
    }
    if (!/(rehearsal|checkpoint|disposable|test|dev)/i.test(identity.database)) {
      return { allowed: false, reason: 'Disposable database name lacks a required disposable marker' };
    }
  }
  if (PROTECTED_ENVIRONMENTS.has(environment) && WRITE_COMMANDS.has(command)) {
    if (writeApproved !== 'YES') return { allowed: false, reason: 'Protected write requires RELIANCE_MIGRATION_WRITE_APPROVED=YES' };
    if (!lockToken) return { allowed: false, reason: 'Protected write must run inside the migration lock wrapper' };
    if (!targetSpec || !releaseReceipt) return { allowed: false, reason: 'Protected write requires target specification and release receipt' };
  }
  return {
    allowed: true,
    reason: 'Policy requirements satisfied',
    command,
    environment,
    target: { server: identity.server, database: identity.database },
    protected: PROTECTED_ENVIRONMENTS.has(environment) || observed.protected,
  };
}

module.exports = {
  ALLOWED_COMMANDS,
  NEVER_PROTECTED,
  PROTECTED_ENVIRONMENTS,
  commandName,
  evaluatePolicy,
  parsePrismaSqlServerUrl,
  sameServer,
};
