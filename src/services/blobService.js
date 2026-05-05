// blobService.js - thin wrapper around Azure Blob Storage for photo files.
// Uses connection string from env. Container is created on first use if missing.

const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'photos';

if (!connectionString) {
  console.warn('[blobService] AZURE_STORAGE_CONNECTION_STRING not set - uploads will fail');
}

let _containerClientPromise = null;

function getContainerClient() {
  if (_containerClientPromise) return _containerClientPromise;
  _containerClientPromise = (async () => {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    // 'blob' = anonymous read access on individual blobs (lets us serve images
    // by URL directly without SAS tokens, which is fine for a demo gallery).
    await containerClient.createIfNotExists({ access: 'blob' });
    return containerClient;
  })();
  return _containerClientPromise;
}

/**
 * Upload a photo buffer. Returns { blobName, url }.
 */
async function uploadPhoto(buffer, originalName, contentType) {
  const containerClient = await getContainerClient();
  const ext = (originalName.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  const blobName = `${uuidv4()}${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' },
  });
  return { blobName, url: blockBlobClient.url };
}

/**
 * Delete a blob by name. No-op if it doesn't exist.
 */
async function deletePhoto(blobName) {
  if (!blobName) return;
  const containerClient = await getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * Get the public URL for a blob (works because container access is 'blob').
 */
async function getPhotoUrl(blobName) {
  const containerClient = await getContainerClient();
  return containerClient.getBlockBlobClient(blobName).url;
}

module.exports = { uploadPhoto, deletePhoto, getPhotoUrl };
