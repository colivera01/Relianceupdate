// src/lib/azure-blob-storage.ts
// Azure Blob Storage helper with SAS token generation

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  BlobSASSignatureValues,
} from "@azure/storage-blob";

// Azure Storage configuration from environment variables
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "media";

if (!accountName || !accountKey) {
  console.warn(
    "Azure Storage credentials not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY"
  );
}

/**
 * Get Azure Blob Service Client
 */
function getBlobServiceClient(): BlobServiceClient | null {
  if (!accountName || !accountKey) {
    return null;
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );

  return blobServiceClient;
}

/**
 * Generate SAS token for blob upload (write permission)
 * @param blobKey - The blob key/path (e.g., "vendor/{vendorId}/media/{assetId}.{ext}")
 * @param expiresInMinutes - Token expiration in minutes (default: 60)
 * @returns SAS token string
 */
export async function generateUploadSAS(
  blobKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  if (!accountName || !accountKey) {
    throw new Error("Azure Storage not configured");
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasOptions: BlobSASSignatureValues = {
    containerName,
    blobName: blobKey,
    permissions: BlobSASPermissions.parse("w"), // Write only
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  return sasToken;
}

/**
 * Generate SAS token for blob download/read (read permission)
 * @param blobKey - The blob key/path
 * @param expiresInMinutes - Token expiration in minutes (default: 60)
 * @returns SAS token string
 */
export async function generateDownloadSAS(
  blobKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  if (!accountName || !accountKey) {
    throw new Error("Azure Storage not configured");
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasOptions: BlobSASSignatureValues = {
    containerName,
    blobName: blobKey,
    permissions: BlobSASPermissions.parse("r"), // Read only
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  return sasToken;
}

/**
 * Generate full SAS URL for blob upload
 * @param blobKey - The blob key/path
 * @param expiresInMinutes - Token expiration in minutes (default: 60)
 * @returns Full URL with SAS token
 */
export async function generateUploadUrl(
  blobKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const sasToken = await generateUploadSAS(blobKey, expiresInMinutes);
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobKey}?${sasToken}`;
  return url;
}

/**
 * Generate full SAS URL for blob download
 * @param blobKey - The blob key/path
 * @param expiresInMinutes - Token expiration in minutes (default: 60)
 * @returns Full URL with SAS token
 */
export async function generateDownloadUrl(
  blobKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const sasToken = await generateDownloadSAS(blobKey, expiresInMinutes);
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobKey}?${sasToken}`;
  return url;
}

/**
 * Verify blob exists and get its properties (including size)
 * @param blobKey - The blob key/path
 * @returns Blob properties or null if not found
 */
export async function getBlobProperties(blobKey: string): Promise<{
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
} | null> {
  if (!accountName || !accountKey) {
    return null;
  }

  try {
    const blobServiceClient = getBlobServiceClient();
    if (!blobServiceClient) {
      return null;
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobKey);

    const properties = await blobClient.getProperties();

    return {
      exists: true,
      contentLength: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
    };
  } catch (error: any) {
    if (error.statusCode === 404) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Delete blob (for cleanup job)
 * @param blobKey - The blob key/path
 */
export async function deleteBlob(blobKey: string): Promise<boolean> {
  if (!accountName || !accountKey) {
    return false;
  }

  try {
    const blobServiceClient = getBlobServiceClient();
    if (!blobServiceClient) {
      return false;
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobKey);

    await blobClient.delete();
    return true;
  } catch (error: any) {
    if (error.statusCode === 404) {
      return true; // Already deleted
    }
    console.error(`Error deleting blob ${blobKey}:`, error);
    return false;
  }
}

