#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ORACLE_ADDITIONS = `
-- Reliance beta structural-oracle additions unsupported or misrepresented by
-- Prisma's SQL Server schema renderer. These statements preserve current beta
-- semantics; they are not forward product changes.

CREATE UNIQUE NONCLUSTERED INDEX [bookings_creationRequestKey_key]
ON [dbo].[bookings]([creationRequestKey])
WHERE [creationRequestKey] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [consent_records_one_current_per_booking_key]
ON [dbo].[consent_records]([bookingId])
WHERE [isCurrent] = 1;

CREATE UNIQUE NONCLUSTERED INDEX [consent_records_token_key]
ON [dbo].[consent_records]([token])
WHERE [token] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [content_reports_caseReference_key]
ON [dbo].[content_reports]([caseReference])
WHERE [caseReference] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [employee_recording_safety_evidence_chainKey_submissionRequestHash_key]
ON [dbo].[employee_recording_safety_evidence]([chainKey], [submissionRequestHash])
WHERE [submissionRequestHash] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [employee_recording_safety_evidence_locationAttemptId_key]
ON [dbo].[employee_recording_safety_evidence]([locationAttemptId])
WHERE [locationAttemptId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [recording_scope_assessments_one_current_per_booking_key]
ON [dbo].[recording_scope_assessments]([bookingId])
WHERE [isCurrent] = 1;

CREATE UNIQUE NONCLUSTERED INDEX [review_windows_reviewId_key]
ON [dbo].[review_windows]([reviewId])
WHERE [reviewId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [reviews_bookingId_unique_not_null]
ON [dbo].[reviews]([bookingId])
WHERE [bookingId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [reviews_userId_submissionRequestId_unique_not_null]
ON [dbo].[reviews]([userId], [submissionRequestId])
WHERE [submissionRequestId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [users_phone_key]
ON [dbo].[users]([phone])
WHERE [phone] IS NOT NULL;

ALTER TABLE [dbo].[employee_customer_rating_evidence]
ADD CONSTRAINT [employee_customer_rating_evidence_rating_check]
CHECK ([rating] >= 1 AND [rating] <= 5);

ALTER TABLE [dbo].[reviews]
ADD CONSTRAINT [reviews_ratingValidityStatus_check]
CHECK ([ratingValidityStatus] IS NULL OR [ratingValidityStatus] IN ('verified', 'invalid'));
`;

const UNFILTERED_CONSTRAINTS = Object.freeze([
  ',\n    CONSTRAINT [users_phone_key] UNIQUE NONCLUSTERED ([phone])',
  ',\n    CONSTRAINT [employee_recording_safety_evidence_locationAttemptId_key] UNIQUE NONCLUSTERED ([locationAttemptId])',
  ',\n    CONSTRAINT [employee_recording_safety_evidence_chainKey_submissionRequestHash_key] UNIQUE NONCLUSTERED ([chainKey],[submissionRequestHash])',
  ',\n    CONSTRAINT [content_reports_caseReference_key] UNIQUE NONCLUSTERED ([caseReference])',
  ',\n    CONSTRAINT [review_windows_reviewId_key] UNIQUE NONCLUSTERED ([reviewId])',
  ',\n    CONSTRAINT [consent_records_token_key] UNIQUE NONCLUSTERED ([token])',
]);

function render({ root }) {
  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  const result = spawnSync(process.execPath, [
    prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel',
    'prisma/schema.prisma', '--script',
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || 'Prisma baseline rendering failed');
  let sql = result.stdout.replace(/\r\n/g, '\n').trimEnd();
  for (const constraint of UNFILTERED_CONSTRAINTS) {
    assert(sql.includes(constraint), `Expected Prisma-rendered constraint was not found: ${constraint}`);
    sql = sql.replace(constraint, '');
  }
  return `${sql}\n${ORACLE_ADDITIONS}`;
}

function writeBaseline({ root, output }) {
  const target = path.resolve(root, output);
  assert(!fs.existsSync(target), 'Refusing to overwrite an existing baseline');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, render({ root }), { flag: 'wx' });
  return target;
}

if (require.main === module) {
  try {
    const root = process.cwd();
    const index = process.argv.indexOf('--output');
    assert(index >= 0 && process.argv[index + 1], '--output is required');
    process.stdout.write(`${JSON.stringify({ verdict: 'PASS', output: writeBaseline({ root, output: process.argv[index + 1] }) })}\n`);
  } catch (error) {
    process.stderr.write(`FORWARD_BASELINE_GENERATION_FAILED: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { ORACLE_ADDITIONS, UNFILTERED_CONSTRAINTS, render, writeBaseline };
