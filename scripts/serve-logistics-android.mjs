// API isolada para validar o painel de Logística: banco temporário e estados
// criados somente pelos comandos HTTP reais, nunca inseridos direto em pedidos.
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { connectDatabase } from '../services/api/src/database.mjs';
import { createApp } from '../services/api/src/app.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';
import { weatherProvider } from '../services/api/src/weather.mjs';

const port = Number(process.env.LOGISTICS_PORT || 3310);
const directory = resolve('.data/logistics-android');
const flag = { isDemonstration: true };
const at = (municipality, uf = 'SP') => ({ location: { municipality, uf }, locationConfirmed: true });
let mongo, connection, server;

try {
  const dbPath = resolve(`.data/logistics-${randomUUID()}`);
  await mkdir(dbPath, { recursive: true });
  await mkdir(directory, { recursive: true });
  mongo = await MongoMemoryReplSet.create({
    binary: { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') },
    instanceOpts: [{ dbPath }],
    replSet: { count: 1, name: 'agroLogistics', storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  });
  connection = await connectDatabase({ uri: mongo.getUri(), name: 'agro_logistics' });
  const db = connection.db;

  const actors = {};
  async function actor(name, type, label, userId = randomUUID()) {
    const orgId = randomUUID();
    const token = randomBytes(32).toString('base64url');
    actors[name] = { orgId, userId, token };
    await db.collection('users').updateOne({ _id: userId }, { $set: { status: 'ATIVO', ...flag } }, { upsert: true });
    await db.collection('organizations').insertOne({ _id: orgId, name: label, type, status: 'ATIVA', ...flag });
    await db.collection('memberships').insertOne({ userId, organizationId: orgId, role: 'ADMIN', status: 'ATIVO' });
    await db.collection('demoTokens').insertOne({ userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 4 * 3600000) });
  }
  await actor('producer', 'PEQUENO_PRODUTOR_RURAL', 'Produtor fictício A');
  await actor('producerB', 'PEQUENO_PRODUTOR_RURAL', 'Produtor fictício B', actors.producer.userId);
  actors.producerB.token = actors.producer.token;
  await actor('institution', 'INSTITUICAO', 'Instituição fictícia');
  await actor('buyer', 'COMPRADOR_LOCAL', 'Comprador fictício');
  await actor('cooperative', 'COOPERATIVA', 'Cooperativa fictícia');

  const property = (organizationId, name, municipality) => ({ _id: randomUUID(), organizationId, name, municipality, uf: 'SP', status: 'ATIVA', ...flag });
  const main = property(actors.producer.orgId, 'Sítio Esperança · fictício', 'Mogi das Cruzes');
  const empty = property(actors.producer.orgId, 'Chácara Nova · sem pedidos', 'Suzano');
  const other = property(actors.producerB.orgId, 'Sítio Outra Organização · fictício', 'Ibiúna');
  await db.collection('properties').insertMany([main, empty, other]);
  const crops = Object.fromEntries(['Alface', 'Tomate', 'Mandioca', 'Banana', 'Couve', 'Milho', 'Abóbora'].map(name => [name, { _id: randomUUID(), name, status: 'ATIVA' }]));
  await db.collection('crops').insertMany(Object.values(crops));

  server = createApp(db, { demoAuthEnabled: true, weather: weatherProvider({ enabled: false }) }).listen(port, '127.0.0.1');
  await once(server, 'listening');

  async function post(who, endpoint, body) {
    const a = actors[who];
    const response = await fetch(`http://127.0.0.1:${port}/api/v1${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${a.token}`, 'X-Organization-Id': a.orgId, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (response.status >= 300) throw new Error(`${endpoint}: ${response.status} ${json.error?.code}`);
    return json.data;
  }

  // Um pedido percorre somente as etapas que a API permite, com o ator correto.
  async function journey(crop, quantityKg, stage, { seller = 'producer', place = main, requester = 'institution', cooperative = false, pickupAt = 'Mogi das Cruzes', receiptAt = 'São Paulo' } = {}) {
    const production = await post(seller, '/productions', { propertyId: place._id, cropId: crops[crop]._id, seasonLabel: 'Primavera 2026', quantityKg, harvestedOn: '2026-11-01', ...at(place.municipality) });
    const offer = await post(seller, '/offers', { lotId: production.lot.id, quantityKg, destinationMode: 'DOACAO', availableUntil: new Date(Date.now() + 15 * 86400000).toISOString() });
    await post(seller, `/offers/${offer.id}/publish`, at(place.municipality));
    const order = await post(requester, '/orders', { offerId: offer.id, quantityKg, ...at(receiptAt) });
    if (stage === 'SOLICITADO') return;
    if (stage === 'CANCELADO_ANTES') return post(requester, `/orders/${order.id}/cancel`, at(receiptAt));
    const accepted = await post(seller, `/orders/${order.id}/accept`, { ...at(place.municipality), ...(cooperative ? { cooperativeOrganizationId: actors.cooperative.orgId } : {}) });
    if (stage === 'ACEITO') return;
    if (stage === 'CANCELADO_APOS') return post(seller, `/orders/${order.id}/cancel`, at(place.municipality));
    await post(cooperative ? 'cooperative' : seller, `/shipments/${accepted.shipment.id}/pickup`, at(pickupAt));
    if (stage === 'RETIRADO') return;
    await post(requester, `/shipments/${accepted.shipment.id}/receipts`, { quantityAcceptedKg: quantityKg, ...at(receiptAt) });
  }

  await journey('Alface', 4, 'SOLICITADO');
  await journey('Tomate', 2.5, 'SOLICITADO', { requester: 'buyer' });
  await journey('Mandioca', 12, 'ACEITO');
  await journey('Banana', 8, 'ACEITO', { cooperative: true });
  await journey('Couve', 3, 'RETIRADO');
  await journey('Milho', 6, 'RETIRADO', { cooperative: true, pickupAt: 'Suzano' });
  await journey('Abóbora', 10, 'RECEBIDO');
  await journey('Alface', 5.5, 'RECEBIDO', { cooperative: true, pickupAt: 'Suzano', receiptAt: 'Guarulhos', requester: 'buyer' });
  await journey('Tomate', 7, 'RECEBIDO');
  await journey('Couve', 1.5, 'CANCELADO_ANTES');
  await journey('Mandioca', 2, 'CANCELADO_APOS');
  await journey('Milho', 20, 'RECEBIDO', { seller: 'producerB', place: other, pickupAt: 'Ibiúna', receiptAt: 'Sorocaba' });

  await writeFile(resolve(directory, 'session.json'), JSON.stringify({
    port, token: actors.producer.token, userId: actors.producer.userId,
    organizationId: actors.producer.orgId, otherOrganizationId: actors.producerB.orgId,
    mainPropertyId: main._id, emptyPropertyId: empty._id, otherPropertyId: other._id,
  }));
  console.log(`API de Logística isolada pronta na porta ${port}; identidade somente em arquivo local ignorado.`);
  await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done); });
} finally {
  if (server) await new Promise(done => server.close(done));
  if (connection) await connection.client.close();
  if (mongo) await mongo.stop({ doCleanup: false });
}
