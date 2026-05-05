// cosmosService.js - thin wrapper around Azure Cosmos DB (NoSQL / SQL API)
// for photo metadata. Database/container are created on first use.

const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE || 'bagdadipics';
const containerId = process.env.COSMOS_CONTAINER || 'photos';

if (!endpoint || !key) {
  console.warn('[cosmosService] COSMOS_ENDPOINT/COSMOS_KEY not set - DB calls will fail');
}

let _containerPromise = null;

function getContainer() {
  if (_containerPromise) return _containerPromise;
  _containerPromise = (async () => {
    const client = new CosmosClient({ endpoint, key });
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({
      id: containerId,
      partitionKey: { paths: ['/id'] },
    });
    return container;
  })();
  return _containerPromise;
}

/**
 * Create a new photo metadata record.
 */
async function createPhoto(doc) {
  const container = await getContainer();
  const { resource } = await container.items.create(doc);
  return resource;
}

/**
 * List all photos, newest first.
 */
async function listPhotos() {
  const container = await getContainer();
  const { resources } = await container.items
    .query('SELECT * FROM c ORDER BY c.createdAt DESC')
    .fetchAll();
  return resources;
}

/**
 * Get one photo by id.
 */
async function getPhoto(id) {
  const container = await getContainer();
  try {
    const { resource } = await container.item(id, id).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

/**
 * Update an existing photo. Pass the full doc back (Cosmos replace semantics).
 */
async function updatePhoto(id, patch) {
  const container = await getContainer();
  const existing = await getPhoto(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  const { resource } = await container.item(id, id).replace(merged);
  return resource;
}

/**
 * Delete a photo doc by id.
 */
async function deletePhoto(id) {
  const container = await getContainer();
  try {
    await container.item(id, id).delete();
    return true;
  } catch (err) {
    if (err.code === 404) return false;
    throw err;
  }
}

module.exports = { createPhoto, listPhotos, getPhoto, updatePhoto, deletePhoto };
