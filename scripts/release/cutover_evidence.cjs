#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { canonical, rows, sha256 } = require('./sqlserver_contract.cjs');

const PROTECTED_PACKAGE_ID = 'cmtozl8lt003onzfjiou8phrb';
const PROTECTED_VENDOR_ID = 'cmqd2jthf0007qhfugjjbvtog';

async function captureApplicationEvidence(pool) {
  const tables = await rows(pool, `SELECT s.name AS schemaName,t.name AS tableName
    FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
    WHERE t.is_ms_shipped=0 AND t.name NOT LIKE '_prisma_migrations%'
    ORDER BY s.name,t.name`);
  const applicationRowCounts = [];
  const primaryKeyRows = await rows(pool, `SELECT s.name AS schemaName,t.name AS tableName,ic.key_ordinal,c.name AS columnName
    FROM sys.key_constraints kc JOIN sys.tables t ON t.object_id=kc.parent_object_id
    JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=kc.unique_index_id
    JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
    WHERE kc.type='PK' ORDER BY s.name,t.name,ic.key_ordinal`);
  const primaryKeys = new Map();
  for (const row of primaryKeyRows) {
    const key = `${row.schemaName}.${row.tableName}`;
    if (!primaryKeys.has(key)) primaryKeys.set(key, []);
    primaryKeys.get(key).push(row.columnName);
  }
  const materialTableFingerprints = [];
  const stableMaterial = (value) => {
    if (Buffer.isBuffer(value)) return { $bufferSha256: crypto.createHash('sha256').update(value).digest('hex'), $bytes: value.length };
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stableMaterial);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableMaterial(value[key])]));
    return typeof value === 'bigint' ? value.toString() : value;
  };
  const materialHash = (value) => sha256(`${JSON.stringify(stableMaterial(value))}\n`);
  const materialResult = await pool.request().query(tables.map((table) => {
    const key = `${table.schemaName}.${table.tableName}`;
    const columns = primaryKeys.get(key) || [];
    const order = columns.length ? ` ORDER BY ${columns.map((column) => `[${column}]`).join(',')}` : '';
    return `SELECT * FROM [${table.schemaName}].[${table.tableName}]${order}`;
  }).join(';\n'));
  const recordsets = materialResult.recordsets || [materialResult.recordset];
  if (recordsets.length !== tables.length) throw new Error('Application material batch returned an unexpected recordset count');
  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    const key = `${table.schemaName}.${table.tableName}`;
    const columns = primaryKeys.get(key) || [];
    const data = recordsets[index];
    applicationRowCounts.push({ ...table, rowCount: data.length });
    const primaryKeySet = data.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
    materialTableFingerprints.push({ ...table, rowCount: data.length, primaryKeyColumns: columns,
      primaryKeySetSha256: materialHash(primaryKeySet), materialEvidenceSha256: materialHash(data) });
  }
  const protectedEvidence = {
    vendor: await rows(pool, `SELECT id,name,businessName,category,demo,seedBatchId,isPubliclyListed,accountStatus
      FROM dbo.vendors WHERE id='${PROTECTED_VENDOR_ID}'`),
    employeeMembership: await rows(pool, `SELECT vm.id,vm.vendorId,vm.userId,vm.role,vm.status,u.name
      FROM dbo.vendor_memberships vm JOIN dbo.users u ON u.id=vm.userId
      WHERE vm.vendorId='${PROTECTED_VENDOR_ID}' AND u.name='Bradley Coopers'`),
    package: await rows(pool, `SELECT id,bookingId,vendorId,status,isCurrent,version,adminAuditDecisionId,customerAccessGrantId
      FROM dbo.service_video_package_evidence WHERE id='${PROTECTED_PACKAGE_ID}'`),
    audit: await rows(pool, `SELECT id,packageId,decision,customerProofReleased,publicDisplayEligibility
      FROM dbo.service_video_admin_audit_decision_evidence WHERE packageId='${PROTECTED_PACKAGE_ID}' ORDER BY createdAt,id`),
    proposals: await rows(pool, `SELECT id,packageId,status,isCurrent,audience,authorizationModel,packageVisibilityDecisionId
      FROM dbo.service_video_publication_proposals WHERE packageId='${PROTECTED_PACKAGE_ID}' ORDER BY createdAt,id`),
    visibility: await rows(pool, `SELECT id,packageId,decision,isCurrent,version,publicationProposalId
      FROM dbo.service_video_package_visibility_decisions WHERE packageId='${PROTECTED_PACKAGE_ID}' ORDER BY createdAt,id`),
    standingConsentCount: await rows(pool, `SELECT COUNT_BIG(*) AS recordCount FROM dbo.employee_public_media_consent_decisions`),
  };
  const assignment = await rows(pool, `SELECT COUNT_BIG(*) AS activeRows,COUNT(DISTINCT deviceId) AS distinctActiveDeviceIds
    FROM dbo.device_assignments WHERE unassignedAt IS NULL`);
  const assignmentDuplicates = await rows(pool, `SELECT deviceId,COUNT_BIG(*) AS activeCount
    FROM dbo.device_assignments WHERE unassignedAt IS NULL GROUP BY deviceId HAVING COUNT_BIG(*)>1 ORDER BY deviceId`);
  const reviewReasons = await rows(pool, `SELECT
    SUM(CASE WHEN ratingInvalidationReason IS NULL THEN 1 ELSE 0 END) AS nullCount,
    SUM(CASE WHEN ratingInvalidationReason IS NOT NULL THEN 1 ELSE 0 END) AS nonNullCount,
    MAX(LEN(ratingInvalidationReason)) AS maxCharacterLength,
    SUM(CASE WHEN LEN(ratingInvalidationReason)>1000 THEN 1 ELSE 0 END) AS countOver1000 FROM dbo.reviews`);
  return {
    applicationRowCounts,
    applicationRowCountsSha256: sha256(canonical(applicationRowCounts)),
    materialTableFingerprints,
    materialTableFingerprintsSha256: sha256(canonical(materialTableFingerprints)),
    protectedEvidence,
    protectedEvidenceSha256: sha256(canonical(protectedEvidence)),
    preflight: { assignment, assignmentDuplicates, reviewReasons },
  };
}

function assertProtectedReliance(evidence) {
  const vendor = evidence.protectedEvidence.vendor[0];
  const membership = evidence.protectedEvidence.employeeMembership[0];
  const packageEvidence = evidence.protectedEvidence.package[0];
  const audit = evidence.protectedEvidence.audit[0];
  const currentProposal = evidence.protectedEvidence.proposals.find((item) => item.isCurrent);
  const currentVisibility = evidence.protectedEvidence.visibility.find((item) => item.isCurrent);
  if (!vendor || vendor.id !== PROTECTED_VENDOR_ID || vendor.demo !== false || vendor.seedBatchId !== null) throw new Error('Protected Vendor differs');
  if (!membership || membership.role !== 'EMPLOYEE' || membership.status !== 'ACTIVE') throw new Error('Protected Employee membership differs');
  if (!packageEvidence || packageEvidence.status !== 'PRIVATE_APPROVED' || !packageEvidence.isCurrent) throw new Error('Protected package differs');
  if (!audit || audit.decision !== 'PASS' || !audit.customerProofReleased) throw new Error('Protected Audit differs');
  if (!currentProposal || currentProposal.status !== 'AWAITING_STANDING_EMPLOYEE_CONSENT') throw new Error('Protected proposal differs');
  if (!currentVisibility || currentVisibility.decision !== 'SHARE_PUBLICLY') throw new Error('Customer Share Publicly differs');
  const count = Number(evidence.protectedEvidence.standingConsentCount[0]?.recordCount ?? -1);
  if (count !== 0) throw new Error('Bradley standing consent count differs');
  return { verdict: 'PASS', package: 'PRIVATE_APPROVED', customerSharePublicly: 'PRESERVED', bradleyConsent: 'NONE' };
}

module.exports = { PROTECTED_PACKAGE_ID, PROTECTED_VENDOR_ID, assertProtectedReliance, captureApplicationEvidence };
