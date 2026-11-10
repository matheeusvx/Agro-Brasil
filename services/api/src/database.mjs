import { MongoClient } from 'mongodb';

export async function connectDatabase({ uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', name = process.env.MONGODB_DATABASE || 'agro_mais_brasil' } = {}) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(name);
    await db.command({ ping: 1 });
    await Promise.all([
      db.collection('memberships').createIndex({ userId: 1, organizationId: 1 }, { unique: true }),
      db.collection('demoTokens').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('productions').createIndex({ organizationId: 1, createdAt: -1 }),
      db.collection('productions').createIndex({ organizationId: 1, propertyId: 1, createdAt: -1, _id: -1 }),
      db.collection('productions').createIndex({ 'lot.id': 1 }, { unique: true }),
      db.collection('offers').createIndex({ lotId: 1 }, { unique: true }),
      db.collection('orders').createIndex({ sellerOrganizationId: 1, createdAt: -1 }),
      db.collection('orders').createIndex({ sellerOrganizationId: 1, lotId: 1, status: 1 }),
      db.collection('orders').createIndex({ requesterOrganizationId: 1, createdAt: -1 }),
      db.collection('orders').createIndex({ 'shipment.id': 1 }, { unique: true, partialFilterExpression: { 'shipment.id': { $type: 'string' } } }),
      db.collection('traceEvents').createIndex({ lotId: 1, recordedAt: 1 }),
      db.collection('traceEvents').createIndex({ operationId: 1, type: 1 }, { unique: true }),
      db.collection('commands').createIndex({ createdAt: 1 })
    ]);
    return { client, db };
  } catch (error) { await client.close(); throw error; }
}
