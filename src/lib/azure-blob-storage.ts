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
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
const containerName =
  process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() ||
  process.env.AZURE_STORAGE_CONTAINER?.trim() ||
  "media";

const hasConnectionString = Boolean(connectionString);
const hasContainerEnv = Boolean(
  process.env.AZURE_STORAGE_CONTAINER?.trim() ||
    process.env.AZURE_STORAGE_CONTAINER_NAME?.trim()
);
const hasAccountKeyConfig = Boolean(accountName && accountKey);
const storageConfigBranch = hasConnectionString
  ? "connection-string"
  : hasAccountKeyConfig
    ? "account-key"
    : "fallback";
const sasGenerationAvailable = hasConnectionString || hasAccountKeyConfig;

console.info("[azure-blob-storage] runtime env detection", {
  hasConnectionString,
  hasContainerEnv,
  hasAccountName: Boolean(accountName),
  hasAccountKey: Boolean(accountKey),
  containerName,
  branch: storageConfigBranch,
  connectionStringModeActive: hasConnectionString,
  sasGenerationAvailable,
});

if (!hasConnectionString && !hasAccountKeyConfig) {
  console.warn(
    "Azure Storage is not fully configured. Set either AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY"
  );
}

function parseConnectionStringValue(key: string): string | null {
  if (!connectionString) return null;
  const parts = connectionString.split(";");
  for (const part of parts) {
    const [rawKey, ...valueParts] = part.split("=");
    if (!rawKey || valueParts.length === 0) continue;
    if (rawKey.trim().toLowerCase() !== key.toLowerCase()) continue;
    return valueParts.join("=").trim() || null;
  }
  return null;
}

function getAccountConfigFromConnectionString(): {
  accountName: string;
  accountKey: string;
} | null {
  const parsedAccountName = parseConnectionStringValue("AccountName");
  const parsedAccountKey = parseConnectionStringValue("AccountKey");
  if (!parsedAccountName || !parsedAccountKey) return null;
  return {
    accountName: parsedAccountName,
    accountKey: parsedAccountKey,
  };
}

function getStorageSharedKeyCredential():
  | { credential: StorageSharedKeyCredential; accountName: string }
  | null {
  if (hasConnectionString) {
    const fromConnectionString = getAccountConfigFromConnectionString();
    if (fromConnectionString) {
      return {
        credential: new StorageSharedKeyCredential(
          fromConnectionString.accountName,
          fromConnectionString.accountKey
        ),
        accountName: fromConnectionString.accountName,
      };
    }
  }

  if (accountName && accountKey) {
    return {
      credential: new StorageSharedKeyCredential(accountName, accountKey),
      accountName,
    };
  }

  return null;
}

/**
 * Get Azure Blob Service Client
 */
function getBlobServiceClient(): BlobServiceClient | null {
  if (connectionString) {
    try {
      return BlobServiceClient.fromConnectionString(connectionString);
    } catch (error) {
      console.error("[azure-blob-storage] Invalid connection string configuration", error);
      return null;
    }
  }

  if (accountName && accountKey) {
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    return new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }

  return null;
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
  const sharedKeyConfig = getStorageSharedKeyCredential();
  if (!sharedKeyConfig) {
    throw new Error(
      "Azure Storage not configured for SAS generation. Provide AZURE_STORAGE_CONNECTION_STRING (with AccountName/AccountKey) or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY"
    );
  }

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasOptions: BlobSASSignatureValues = {
    containerName,
    blobName: blobKey,
    permissions: BlobSASPermissions.parse("w"), // Write only
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyConfig.credential
  ).toString();
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
  const sharedKeyConfig = getStorageSharedKeyCredential();
  if (!sharedKeyConfig) {
    throw new Error(
      "Azure Storage not configured for SAS generation. Provide AZURE_STORAGE_CONNECTION_STRING (with AccountName/AccountKey) or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY"
    );
  }

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasOptions: BlobSASSignatureValues = {
    containerName,
    blobName: blobKey,
    permissions: BlobSASPermissions.parse("r"), // Read only
    expiresOn,
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyConfig.credential
  ).toString();
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
  const sharedKeyConfig = getStorageSharedKeyCredential();
  if (!sharedKeyConfig) {
    throw new Error(
      "Azure Storage not configured for SAS URL generation. Provide AZURE_STORAGE_CONNECTION_STRING (with AccountName/AccountKey) or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY"
    );
  }
  const sasToken = await generateUploadSAS(blobKey, expiresInMinutes);
  const url = `https://${sharedKeyConfig.accountName}.blob.core.windows.net/${containerName}/${blobKey}?${sasToken}`;
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
  const sharedKeyConfig = getStorageSharedKeyCredential();
  if (!sharedKeyConfig) {
    throw new Error(
      "Azure Storage not configured for SAS URL generation. Provide AZURE_STORAGE_CONNECTION_STRING (with AccountName/AccountKey) or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY"
    );
  }
  const sasToken = await generateDownloadSAS(blobKey, expiresInMinutes);
  const url = `https://${sharedKeyConfig.accountName}.blob.core.windows.net/${containerName}/${blobKey}?${sasToken}`;
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
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    return null;
  }

  try {
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

