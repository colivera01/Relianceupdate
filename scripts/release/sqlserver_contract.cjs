#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { parsePrismaSqlServerUrl } = require('./migration_safety.cjs');

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};
const canonical = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function rows(pool, query) {
  return (await pool.request().query(query)).recordset.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  ));
}

const STRUCTURAL_QUERIES = {
  schemas: `SELECT name FROM sys.schemas WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest') ORDER BY name`,
  tables: `SELECT s.name AS schemaName,t.name AS tableName FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name`,
  columns: `SELECT s.name AS schemaName,t.name AS tableName,c.column_id,c.name AS columnName,ty.name AS dataType,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,cc.definition AS computedDefinition,cc.is_persisted,c.collation_name AS collationName FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name,c.column_id`,
  primaryKeys: `SELECT s.name AS schemaName,t.name AS tableName,kc.name AS objectName,ic.key_ordinal,c.name AS columnName FROM sys.key_constraints kc JOIN sys.tables t ON t.object_id=kc.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=kc.unique_index_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id WHERE kc.type='PK' ORDER BY s.name,t.name,kc.name,ic.key_ordinal`,
  foreignKeys: `SELECT s.name AS schemaName,t.name AS tableName,fk.name AS objectName,fkc.constraint_column_id,pc.name AS columnName,rs.name AS referencedSchema,rt.name AS referencedTable,rc.name AS referencedColumn,fk.delete_referential_action_desc AS deleteAction,fk.update_referential_action_desc AS updateAction,fk.is_disabled,fk.is_not_trusted FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id=fk.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fk.parent_object_id AND pc.column_id=fkc.parent_column_id JOIN sys.tables rt ON rt.object_id=fk.referenced_object_id JOIN sys.schemas rs ON rs.schema_id=rt.schema_id JOIN sys.columns rc ON rc.object_id=fk.referenced_object_id AND rc.column_id=fkc.referenced_column_id ORDER BY s.name,t.name,fk.name,fkc.constraint_column_id`,
  uniqueConstraints: `SELECT s.name AS schemaName,t.name AS tableName,kc.name AS objectName,ic.key_ordinal,c.name AS columnName FROM sys.key_constraints kc JOIN sys.tables t ON t.object_id=kc.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=kc.unique_index_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id WHERE kc.type='UQ' ORDER BY s.name,t.name,kc.name,ic.key_ordinal`,
  indexes: `SELECT s.name AS schemaName,t.name AS tableName,i.name AS objectName,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.has_filter,i.filter_definition,i.type_desc,ic.key_ordinal,ic.is_included_column,ic.is_descending_key,c.name AS columnName FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=i.object_id AND c.column_id=ic.column_id WHERE t.is_ms_shipped=0 AND i.name IS NOT NULL ORDER BY s.name,t.name,i.name,ic.is_included_column,ic.key_ordinal,c.name`,
  checks: `SELECT s.name AS schemaName,t.name AS tableName,cc.name AS objectName,cc.definition,cc.is_disabled,cc.is_not_trusted FROM sys.check_constraints cc JOIN sys.tables t ON t.object_id=cc.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id ORDER BY s.name,t.name,cc.name`,
  defaults: `SELECT s.name AS schemaName,t.name AS tableName,c.name AS columnName,dc.name AS objectName,dc.definition FROM sys.default_constraints dc JOIN sys.tables t ON t.object_id=dc.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=dc.parent_column_id ORDER BY s.name,t.name,c.column_id`,
  triggers: `SELECT s.name AS schemaName,o.name AS parentObject,tr.name AS objectName,tr.is_disabled,OBJECT_DEFINITION(tr.object_id) AS definition FROM sys.triggers tr JOIN sys.objects o ON o.object_id=tr.parent_id JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE tr.parent_class=1 ORDER BY s.name,o.name,tr.name`,
  views: `SELECT s.name AS schemaName,v.name AS objectName,OBJECT_DEFINITION(v.object_id) AS definition FROM sys.views v JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE v.is_ms_shipped=0 ORDER BY s.name,v.name`,
  procedures: `SELECT s.name AS schemaName,p.name AS objectName,OBJECT_DEFINITION(p.object_id) AS definition FROM sys.procedures p JOIN sys.schemas s ON s.schema_id=p.schema_id WHERE p.is_ms_shipped=0 ORDER BY s.name,p.name`,
  functions: `SELECT s.name AS schemaName,o.name AS objectName,o.type_desc,OBJECT_DEFINITION(o.object_id) AS definition FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.type IN ('FN','IF','TF','FS','FT') AND o.is_ms_shipped=0 ORDER BY s.name,o.name`,
  sequences: `SELECT s.name AS schemaName,seq.name AS objectName,TYPE_NAME(seq.user_type_id) AS dataType,CONVERT(nvarchar(100),seq.start_value) AS startValue,CONVERT(nvarchar(100),seq.increment) AS incrementValue,CONVERT(nvarchar(100),seq.minimum_value) AS minimumValue,CONVERT(nvarchar(100),seq.maximum_value) AS maximumValue,seq.is_cycling FROM sys.sequences seq JOIN sys.schemas s ON s.schema_id=seq.schema_id ORDER BY s.name,seq.name`,
};

async function connect(databaseUrl) {
  const sql = require('mssql');
  return sql.connect(parsePrismaSqlServerUrl(databaseUrl));
}

async function capture(pool) {
  const identity = (await rows(pool, `SELECT DB_NAME() AS databaseName, @@SERVERNAME AS serverName`))[0];
  const ledgerTable = (await rows(pool, `SELECT OBJECT_ID('dbo._prisma_migrations') AS objectId`))[0]?.objectId;
  const ledger = ledgerTable ? await rows(pool, `SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count FROM dbo._prisma_migrations ORDER BY started_at, id`) : [];
  const structural = {};
  for (const [name, query] of Object.entries(STRUCTURAL_QUERIES)) structural[name] = await rows(pool, query);
  const structuralText = canonical(structural);
  const ledgerText = canonical(ledger);
  return {
    identity,
    ledger,
    structural,
    structuralSha256: sha256(structuralText),
    ledgerSha256: sha256(ledgerText),
    ledgerRows: ledger.length,
    successfulDistinctMigrations: new Set(ledger.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name)).size,
    successfulMigrationNames: [...new Set(ledger.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name))].sort(),
  };
}

module.exports = { STRUCTURAL_QUERIES, canonical, capture, connect, rows, sha256, stable };
