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

async function getOrCreate(pool, tuple, id) {
  const existing = await pool.request()
    .input('bookingId', sql.NVarChar(1000), tuple.bookingId)
    .input('vendorId', sql.NVarChar(1000), tuple.vendorId)
    .input('mediaSessionId', sql.NVarChar(1000), tuple.mediaSessionId)
    .query(`SELECT TOP (1) [id] FROM [dbo].[review_windows]
      WHERE [bookingId]=@bookingId AND [vendorId]=@vendorId AND [mediaSessionId]=@mediaSessionId
      ORDER BY [createdAt] DESC`);
  if (existing.recordset[0]) return { id: existing.recordset[0].id, created: false };

  try {
    await pool.request()
      .input('id', sql.NVarChar(1000), id)
      .input('bookingId', sql.NVarChar(1000), tuple.bookingId)
      .input('vendorId', sql.NVarChar(1000), tuple.vendorId)
      .input('mediaSessionId', sql.NVarChar(1000), tuple.mediaSessionId)
      .query(`INSERT INTO [dbo].[review_windows]
        ([id],[bookingId],[vendorId],[mediaSessionId],[reviewId],[status],[openedAt],[expiresAt],[closedAt],[createdAt],[updatedAt])
        VALUES (@id,@bookingId,@vendorId,@mediaSessionId,NULL,N'active',SYSUTCDATETIME(),'9999-12-31T23:59:59.999',NULL,SYSUTCDATETIME(),SYSUTCDATETIME())`);
    return { id, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const fallback = await pool.request()
      .input('bookingId', sql.NVarChar(1000), tuple.bookingId)
      .input('vendorId', sql.NVarChar(1000), tuple.vendorId)
      .input('mediaSessionId', sql.NVarChar(1000), tuple.mediaSessionId)
      .query(`SELECT TOP (1) [id] FROM [dbo].[review_windows]
        WHERE [bookingId]=@bookingId AND [vendorId]=@vendorId AND [mediaSessionId]=@mediaSessionId
        ORDER BY [createdAt] DESC`);
    assert(fallback.recordset[0], 'Unique conflict did not resolve to the canonical tuple');
    return { id: fallback.recordset[0].id, created: false };
  }
}

async function counts(pool) {
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM [dbo].[review_windows]) AS reviewWindows,
      (SELECT COUNT_BIG(*) FROM [dbo].[reviews]) AS reviews,
      (SELECT COUNT_BIG(*) FROM [dbo].[employee_customer_rating_evidence]) AS employeeRatings`);
  return Object.fromEntries(Object.entries(result.recordset[0]).map(([key, value]) => [key, Number(value)]));
}

async function main() {
  assert(process.env.REVIEW_WINDOW_SQLSERVER_DISPOSABLE === '1', 'Explicit disposable SQL Server acknowledgement is required');
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const config = parseSqlServerUrl(process.env.DATABASE_URL);
  assert(config.database && config.database !== 'reliance-beta-db', 'Live beta database is forbidden');
  assert(/reviewwindow|review-window|rwfix/i.test(config.database), 'Database name must identify the Review Window disposable copy');

  const pool = await sql.connect(config);
  const prefix = `rwfix_${crypto.randomUUID().replace(/-/g, '')}_`;
  const before = await counts(pool);
  let historicalBefore;
  try {
    const database = await pool.request().query('SELECT DB_NAME() AS [name]');
    assert(database.recordset[0]?.name === config.database, 'Connected database does not match requested disposable database');

    const indexes = await pool.request().query(`
      SELECT i.name, CAST(i.is_unique AS bit) AS isUnique, i.filter_definition AS filterDefinition,
             STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
      WHERE i.object_id=OBJECT_ID(N'dbo.review_windows')
      GROUP BY i.name,i.is_unique,i.filter_definition`);
    const reviewIdIndex = indexes.recordset.find((item) => item.name === 'review_windows_reviewId_key');
    assert(reviewIdIndex?.isUnique, 'reviewId index is not unique');
    assert(String(reviewIdIndex.columns) === 'reviewId', 'reviewId index has the wrong key');
    assert(/reviewId.*IS NOT NULL/i.test(String(reviewIdIndex.filterDefinition)), 'reviewId index is not safely filtered');
    const tupleIndex = indexes.recordset.find((item) => item.name === 'review_windows_booking_vendor_media_key');
    assert(tupleIndex?.isUnique, 'canonical Review Window identity is not unique');
    assert(String(tupleIndex.columns) === 'bookingId,vendorId,mediaSessionId', 'canonical Review Window identity has the wrong key');

    historicalBefore = await pool.request()
      .input('id', sql.NVarChar(1000), 'cmtkl96gs000rtkfihnxj43me')
      .query('SELECT * FROM [dbo].[review_windows] WHERE [id]=@id');
    assert(historicalBefore.recordset.length === 1, 'Protected historical Review Window is missing');

    const candidates = await pool.request().query(`
      SELECT TOP (4) b.[id] AS bookingId,b.[vendorId],ms.[id] AS mediaSessionId
      FROM [dbo].[bookings] b
      JOIN [dbo].[media_sessions] ms ON ms.[bookingId]=b.[id] AND ms.[vendorId]=b.[vendorId]
      WHERE b.[vendorId] IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM [dbo].[review_windows] rw
          WHERE rw.[bookingId]=b.[id] AND rw.[vendorId]=b.[vendorId] AND rw.[mediaSessionId]=ms.[id]
        )
      ORDER BY b.[createdAt] DESC,ms.[createdAt] DESC`);
    assert(candidates.recordset.length >= 3, 'Disposable copy needs three unused valid review tuples');
    const [tupleA, tupleB, tupleRace] = candidates.recordset;

    const different = await Promise.all([
      getOrCreate(pool, tupleA, `${prefix}different_a`),
      getOrCreate(pool, tupleB, `${prefix}different_b`),
    ]);
    assert(different.every((item) => item.created), 'Different-booking starts must both create');
    assert(different[0].id !== different[1].id, 'Different-booking starts must remain independent');

    const same = await Promise.all([
      getOrCreate(pool, tupleRace, `${prefix}same_a`),
      getOrCreate(pool, tupleRace, `${prefix}same_b`),
    ]);
    assert(same[0].id === same[1].id, 'Same-booking race did not converge on one window');
    assert(same.filter((item) => item.created).length === 1, 'Same-booking race created more than one canonical window');

    const nullCount = await pool.request()
      .input('prefix', sql.NVarChar(1000), `${prefix}%`)
      .query('SELECT COUNT_BIG(*) AS [count] FROM [dbo].[review_windows] WHERE [id] LIKE @prefix AND [reviewId] IS NULL');
    assert(Number(nullCount.recordset[0].count) === 3, 'Multiple NULL reviewId rows were not preserved');

    const unlinkedReview = await pool.request().query(`
      SELECT TOP (1) r.[id]
      FROM [dbo].[reviews] r
      WHERE NOT EXISTS (SELECT 1 FROM [dbo].[review_windows] rw WHERE rw.[reviewId]=r.[id])
      ORDER BY r.[createdAt] DESC`);
    assert(unlinkedReview.recordset[0], 'Disposable copy needs one unlinked Review for non-null uniqueness validation');
    const reviewId = unlinkedReview.recordset[0].id;
    await pool.request()
      .input('id', sql.NVarChar(1000), different[0].id)
      .input('reviewId', sql.NVarChar(1000), reviewId)
      .query('UPDATE [dbo].[review_windows] SET [reviewId]=@reviewId,[updatedAt]=SYSUTCDATETIME() WHERE [id]=@id');
    let duplicateDenied = false;
    try {
      await pool.request()
        .input('id', sql.NVarChar(1000), different[1].id)
        .input('reviewId', sql.NVarChar(1000), reviewId)
        .query('UPDATE [dbo].[review_windows] SET [reviewId]=@reviewId,[updatedAt]=SYSUTCDATETIME() WHERE [id]=@id');
    } catch (error) {
      duplicateDenied = isUniqueViolation(error);
    }
    assert(duplicateDenied, 'Duplicate non-null reviewId was not denied');

    console.log(JSON.stringify({
      verdict: 'PASS',
      mode: 'disposable-sqlserver',
      database: config.database,
      multipleNullReviewIds: 'PASS',
      duplicateNonNullReviewId: 'DENIED',
      sameBookingRace: { verdict: 'PASS', canonicalWindowId: same[0].id },
      differentBookingConcurrency: 'PASS',
      reviewIdIndex: { name: reviewIdIndex.name, filterDefinition: reviewIdIndex.filterDefinition },
      tupleIndex: { name: tupleIndex.name, columns: tupleIndex.columns },
    }, null, 2));
  } finally {
    try {
      await pool.request()
        .input('prefix', sql.NVarChar(1000), `${prefix}%`)
        .query('DELETE FROM [dbo].[review_windows] WHERE [id] LIKE @prefix');
      const after = await counts(pool);
      assert(JSON.stringify(after) === JSON.stringify(before), `Synthetic validation cleanup mismatch: ${JSON.stringify({ before, after })}`);
      if (historicalBefore) {
        const historicalAfter = await pool.request()
          .input('id', sql.NVarChar(1000), 'cmtkl96gs000rtkfihnxj43me')
          .query('SELECT * FROM [dbo].[review_windows] WHERE [id]=@id');
        assert(JSON.stringify(historicalAfter.recordset) === JSON.stringify(historicalBefore.recordset), 'Protected historical Review Window changed');
      }
    } finally {
      await pool.close();
    }
  }
}

main().catch((error) => {
  console.error(`REVIEW_WINDOW_SQLSERVER_CONTRACT_FAILED: ${error.message}`);
  process.exitCode = 1;
});
