#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const sql = require('mssql');

function parseSqlServerUrl(connectionString) {
  const raw = connectionString.replace(/^sqlserver:\/\//i, '');
  const parts = raw.split(';');
  const serverPart = parts.shift();
  const [server, portText] = serverPart.split(':');
  const values = Object.fromEntries(parts.map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).toLowerCase(), decodeURIComponent(part.slice(separator + 1))];
  }));
  return {
    server,
    port: Number(portText || 1433),
    database: values.database,
    user: values.user,
    password: values.password,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
    options: {
      encrypt: values.encrypt !== 'false',
      trustServerCertificate: values.trustservercertificate === 'true',
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isUniqueViolation(error) {
  const numbers = [error?.number, ...(error?.precedingErrors || []).map((item) => item?.number)];
  return numbers.some((number) => number === 2601 || number === 2627);
}

async function counts(pool) {
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM [dbo].[reviews]) AS reviews,
      (SELECT COUNT_BIG(*) FROM [dbo].[review_windows]) AS reviewWindows,
      (SELECT COUNT_BIG(*) FROM [dbo].[employee_customer_rating_evidence]) AS employeeRatings`);
  return Object.fromEntries(Object.entries(result.recordset[0]).map(([key, value]) => [key, Number(value)]));
}

async function insertReview(pool, row, id, bookingId) {
  await pool.request()
    .input('id', sql.NVarChar(1000), id)
    .input('userId', sql.NVarChar(1000), row.userId)
    .input('vendorId', sql.NVarChar(1000), row.vendorId)
    .input('bookingId', sql.NVarChar(1000), bookingId)
    .query(`INSERT INTO [dbo].[reviews]
      ([id],[userId],[vendorId],[bookingId],[rating],[source],[submittedVia],
       [moderationStatus],[visibilityStatus],[attributionVersion],[createdAt],[updatedAt],[demo])
      VALUES
      (@id,@userId,@vendorId,@bookingId,5,N'customer',N'manual',
       N'not_applicable',N'private',3,SYSUTCDATETIME(),SYSUTCDATETIME(),0)`);
  return id;
}

async function main() {
  assert(process.env.REVIEW_BOOKING_SQLSERVER_DISPOSABLE === '1', 'Explicit disposable SQL Server acknowledgement is required');
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const config = parseSqlServerUrl(process.env.DATABASE_URL);
  assert(config.database && config.database !== 'reliance-beta-db', 'Live beta database is forbidden');
  assert(/reviewbooking|review-booking|reviewfix/i.test(config.database), 'Database name must identify the review-booking disposable copy');

  const pool = await sql.connect(config);
  const prefix = `reviewfix_${crypto.randomUUID().replace(/-/g, '')}_`;
  const before = await counts(pool);
  let preparedWindowBefore;
  try {
    const database = await pool.request().query('SELECT DB_NAME() AS [name]');
    assert(database.recordset[0]?.name === config.database, 'Connected database does not match requested disposable database');

    const migrationState = await pool.request().query(`
      SELECT
        SUM(CASE WHEN [finished_at] IS NOT NULL AND [rolled_back_at] IS NULL THEN 1 ELSE 0 END) AS applied,
        SUM(CASE WHEN [finished_at] IS NULL AND [rolled_back_at] IS NULL THEN 1 ELSE 0 END) AS unresolved
      FROM [dbo].[_prisma_migrations]`);
    assert(Number(migrationState.recordset[0].applied) === 56, 'Disposable copy must have 56 successful migrations');
    assert(Number(migrationState.recordset[0].unresolved) === 0, 'Disposable copy must have no unresolved migration');

    const duplicateGroups = await pool.request().query(`
      SELECT [bookingId]
      FROM [dbo].[reviews]
      WHERE [bookingId] IS NOT NULL
      GROUP BY [bookingId]
      HAVING COUNT_BIG(*) > 1`);
    assert(duplicateGroups.recordset.length === 0, 'Duplicate non-null booking Review groups exist');

    const indexes = await pool.request().query(`
      SELECT i.[name], CAST(i.[is_unique] AS bit) AS isUnique,
             CAST(i.[is_disabled] AS bit) AS isDisabled,
             CAST(i.[has_filter] AS bit) AS hasFilter,
             i.[filter_definition] AS filterDefinition,
             STRING_AGG(c.[name], ',') WITHIN GROUP (ORDER BY ic.[key_ordinal]) AS columns
      FROM sys.indexes AS i
      JOIN sys.index_columns AS ic
        ON ic.[object_id]=i.[object_id] AND ic.[index_id]=i.[index_id] AND ic.[is_included_column]=0
      JOIN sys.columns AS c
        ON c.[object_id]=ic.[object_id] AND c.[column_id]=ic.[column_id]
      WHERE i.[object_id]=OBJECT_ID(N'dbo.reviews')
        AND i.[name]=N'reviews_bookingId_unique_not_null'
      GROUP BY i.[name],i.[is_unique],i.[is_disabled],i.[has_filter],i.[filter_definition]`);
    const index = indexes.recordset[0];
    assert(index, 'reviews_bookingId_unique_not_null is missing');
    assert(index.isUnique && !index.isDisabled && index.hasFilter, 'Review booking index is not an enabled filtered unique index');
    assert(String(index.columns) === 'bookingId', 'Review booking index has the wrong key');
    assert(/bookingId.*IS NOT NULL/i.test(String(index.filterDefinition)), 'Review booking index has the wrong filter');

    preparedWindowBefore = await pool.request()
      .input('id', sql.NVarChar(1000), 'cmtrvfi0g0007tdfi0uwni8ok')
      .query('SELECT * FROM [dbo].[review_windows] WHERE [id]=@id');
    assert(preparedWindowBefore.recordset.length === 1, 'Prepared acceptance ReviewWindow is missing from disposable copy');
    assert(preparedWindowBefore.recordset[0].reviewId == null, 'Prepared acceptance ReviewWindow is already submitted');
    assert(String(preparedWindowBefore.recordset[0].status).toLowerCase() === 'active', 'Prepared acceptance ReviewWindow is not active');

    const candidates = await pool.request().query(`
      SELECT TOP (3) b.[id] AS bookingId,b.[userId],b.[vendorId]
      FROM [dbo].[bookings] AS b
      WHERE b.[userId] IS NOT NULL
        AND b.[vendorId] IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM [dbo].[reviews] AS r WHERE r.[bookingId]=b.[id])
      ORDER BY b.[createdAt] DESC`);
    assert(candidates.recordset.length >= 3, 'Disposable copy needs three bookings without Reviews');
    const [sameBooking, differentA, differentB] = candidates.recordset;

    const sameResults = await Promise.allSettled([
      insertReview(pool, sameBooking, `${prefix}same_a`, sameBooking.bookingId),
      insertReview(pool, sameBooking, `${prefix}same_b`, sameBooking.bookingId),
    ]);
    assert(sameResults.filter((item) => item.status === 'fulfilled').length === 1, 'Same-booking race must create exactly one Review');
    const rejected = sameResults.find((item) => item.status === 'rejected');
    assert(rejected && isUniqueViolation(rejected.reason), 'Same-booking loser was not denied by database uniqueness');

    const unrelated = await Promise.all([
      insertReview(pool, differentA, `${prefix}different_a`, differentA.bookingId),
      insertReview(pool, differentB, `${prefix}different_b`, differentB.bookingId),
    ]);
    assert(unrelated.length === 2, 'Different bookings must each accept one Review');

    await Promise.all([
      insertReview(pool, sameBooking, `${prefix}null_a`, null),
      insertReview(pool, sameBooking, `${prefix}null_b`, null),
    ]);
    const nullRows = await pool.request()
      .input('prefix', sql.NVarChar(1000), `${prefix}null_%`)
      .query('SELECT COUNT_BIG(*) AS [count] FROM [dbo].[reviews] WHERE [id] LIKE @prefix AND [bookingId] IS NULL');
    assert(Number(nullRows.recordset[0].count) === 2, 'Multiple historical NULL bookingId Reviews must remain valid');

    console.log(JSON.stringify({
      verdict: 'PASS',
      mode: 'disposable-sqlserver',
      database: config.database,
      migrationCount: 56,
      index: {
        name: index.name,
        columns: index.columns,
        unique: Boolean(index.isUnique),
        enabled: !index.isDisabled,
        filterDefinition: index.filterDefinition,
      },
      sameBookingConcurrentInsert: 'ONE_ACCEPTED_ONE_DENIED',
      differentBookings: 'BOTH_ACCEPTED',
      multipleNullBookingIds: 'ACCEPTED',
      preparedReviewWindow: 'UNCHANGED',
    }, null, 2));
  } finally {
    try {
      await pool.request()
        .input('prefix', sql.NVarChar(1000), `${prefix}%`)
        .query('DELETE FROM [dbo].[reviews] WHERE [id] LIKE @prefix');
      const after = await counts(pool);
      assert(JSON.stringify(after) === JSON.stringify(before), `Synthetic validation cleanup mismatch: ${JSON.stringify({ before, after })}`);
      if (preparedWindowBefore) {
        const preparedWindowAfter = await pool.request()
          .input('id', sql.NVarChar(1000), 'cmtrvfi0g0007tdfi0uwni8ok')
          .query('SELECT * FROM [dbo].[review_windows] WHERE [id]=@id');
        assert(JSON.stringify(preparedWindowAfter.recordset) === JSON.stringify(preparedWindowBefore.recordset), 'Prepared acceptance ReviewWindow changed');
      }
    } finally {
      await pool.close();
    }
  }
}

main().catch((error) => {
  console.error(`REVIEW_BOOKING_SQLSERVER_CONTRACT_FAILED: ${error.message}`);
  process.exitCode = 1;
});
