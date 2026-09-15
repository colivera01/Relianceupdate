#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

async function main() {
  assert.equal(process.env.RELIANCE_REHEARSAL_AUTHORIZATION, 'DISPOSABLE_ONLY',
    'Durable control initialization is disposable-only');
  const account = process.env.RELIANCE_DISPOSABLE_STORAGE_ACCOUNT;
  const key = process.env.RELIANCE_DISPOSABLE_STORAGE_KEY;
  const containerName = process.env.RELIANCE_DISPOSABLE_CONTROL_CONTAINER || 'runtime';
  const blobName = process.env.RELIANCE_DISPOSABLE_CONTROL_BLOB || 'cutover-control/environment-v2.json';
  assert(account && key, 'Disposable storage account and key are required');
  assert(!/streliancebetawcus/i.test(account), 'Live beta storage is forbidden');
  const credential = new StorageSharedKeyCredential(account, key);
  const service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
  const container = service.getContainerClient(containerName);
  assert(await container.exists(), 'Existing disposable container is required');
  const blob = container.getBlockBlobClient(blobName);
  if (!(await blob.exists())) {
    const content = JSON.stringify({ version: 1, state: 'OPEN', generation: 0, createdAt: new Date().toISOString() });
    await blob.upload(content, Buffer.byteLength(content), {
      conditions: { ifNoneMatch: '*' },
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  }
  const properties = await blob.getProperties();
  process.stdout.write(`${JSON.stringify({
    verdict: 'PASS',
    environment: 'disposable',
    account,
    container: containerName,
    blob: blobName,
    publicAccess: false,
    leaseState: properties.leaseState,
    secretPrinted: false,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`DISPOSABLE_FREEZE_INITIALIZATION_FAILED: ${error.message}\n`);
  process.exitCode = 2;
});
