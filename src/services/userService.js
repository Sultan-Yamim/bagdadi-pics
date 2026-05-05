// userService.js - Cosmos DB wrapper for the users container.
// Uses the email address as the document id (unique) so lookups are direct reads.

const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE || 'bagdadipics';
const containerId = 'users';

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

async function findUserByEmail(email) {
  const container = await getContainer();
  try {
    const { resource } = await container.item(email, email).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function createUser(user) {
  const container = await getContainer();
  const { resource } = await container.items.create(user);
  return resource;
}

module.exports = { findUserByEmail, createUser };
