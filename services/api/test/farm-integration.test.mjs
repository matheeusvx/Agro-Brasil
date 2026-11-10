import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../src/database.mjs';
import { createApp } from '../src/app.mjs';
import { tokenHash } from '../src/auth.mjs';
import { productionDocument } from '../src/domain.mjs';

test('Minha Fazenda: HTTP, isolamento, concorrência e persistência real', { timeout: 240000 }, async t => {
  const dbPath = resolve(`.data/farm-test-${randomUUID()}`); await mkdir(dbPath, { recursive: true });
  const binary = { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') };
  let mongo, connection, server, base;
  const ids = Object.fromEntries(['org', 'otherOrg', 'user', 'property', 'sameOrgProperty', 'foreignProperty', 'crop', 'crop2'].map(k => [k, randomUUID()]));
  const token = randomBytes(32).toString('base64url');
  const context = { organizationId: ids.org, userId: ids.user, role: 'ADMIN', organizationType: 'PEQUENO_PRODUTOR_RURAL', isDemonstration: true };
  const start = async () => { server = createApp(connection.db, { demoAuthEnabled: true }).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api/v1`; };
  const request = async (suffix = 'farm-layout', body, propertyId = ids.property, org = ids.org) => {
    const r = await fetch(`${base}/properties/${propertyId}/${suffix}`, { method: body === undefined ? 'GET' : 'PUT', headers: { Authorization: `Bearer ${token}`, 'X-Organization-Id': org, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: r.status, ...(await r.json()) };
  };
  try {
    mongo = await MongoMemoryServer.create({ binary, instance: { dbPath, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
    connection = await connectDatabase({ uri: mongo.getUri(), name: 'farm_isolated' });
    const db = connection.db;
    await db.collection('users').insertOne({ _id: ids.user, status: 'ATIVO' });
    await db.collection('organizations').insertMany([ids.org, ids.otherOrg].map(_id => ({ _id, type: 'PEQUENO_PRODUTOR_RURAL', status: 'ATIVA' })));
    await db.collection('memberships').insertOne({ userId: ids.user, organizationId: ids.org, status: 'ATIVO', role: 'ADMIN' });
    await db.collection('demoTokens').insertOne({ userId: ids.user, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) });
    await db.collection('properties').insertMany([ids.property, ids.sameOrgProperty, ids.foreignProperty].map(_id => ({ _id, name: 'Sítio de teste', organizationId: _id === ids.foreignProperty ? ids.otherOrg : ids.org, status: 'ATIVA' })));
    await db.collection('crops').insertMany([{ _id: ids.crop, name: 'Alface', status: 'ATIVA' }, { _id: ids.crop2, name: 'Tomate', status: 'ATIVA' }]);
    const makeProduction = (propertyId, cropId, quantityKg, org = ids.org) => productionDocument({ propertyId, cropId, quantityKg, seasonLabel: '2026/2', harvestedOn: '2026-11-01', location: { municipality: 'São Paulo', uf: 'SP' } }, { ...context, organizationId: org }, { name: cropId === ids.crop ? 'Alface' : 'Tomate' });
    const p = makeProduction(ids.property, ids.crop, 10), p2 = makeProduction(ids.property, ids.crop2, 20), other = makeProduction(ids.sameOrgProperty, ids.crop, 999), foreign = makeProduction(ids.foreignProperty, ids.crop, 888, ids.otherOrg);
    const elements = [{ id: randomUUID(), name: 'Horta Norte', type: 'VEGETABLE_GARDEN', position: { x: .2, y: .4 }, productionIds: [p._id], cropIds: [ids.crop] }, { id: randomUUID(), name: 'Coleta', type: 'COLLECTION', position: { x: .8, y: .4 }, productionIds: [p._id, p2._id], cropIds: [] }];
    await start();
    await t.test('estado inicial e propriedade sem produções', async () => {
      const initial = await request(); assert.equal(initial.status, 200); assert.equal(initial.data.state, 'UNCONFIGURED'); assert.deepEqual(initial.data.elements, []);
      const overview = await request('farm-overview'); assert.equal(overview.data.summary.productionCount, 0); assert.deepEqual(overview.data.productions, []);
      assert.equal(await db.collection('farmLayouts').countDocuments(), 0);
    });
    await t.test('setor somente com cultura não cria produção, lote ou estoque', async () => {
      const sector = { ...elements[0], productionIds: [] };
      assert.equal((await request('farm-layout', { version: 0, elements: [sector] }, ids.sameOrgProperty)).status, 200);
      const r = await request('farm-overview', undefined, ids.sameOrgProperty);
      assert.equal(r.data.summary.productionCount, 0); assert.equal(r.data.elements[0].state, 'NO_LINKED_PRODUCTIONS');
      assert.equal(await db.collection('productions').countDocuments(), 0);
      // Remove somente a configuração da fixture, para exercitar a corrida de criação abaixo.
      await db.collection('farmLayouts').deleteOne({ _id: ids.sameOrgProperty });
    });
    await db.collection('productions').insertMany([p, p2, other, foreign]);
    await t.test('cria setores personalizados e atualiza preservando IDs', async () => {
      const r = await request('farm-layout', { version: 0, elements }); assert.equal(r.status, 200); assert.equal(r.data.version, 1); assert.deepEqual(r.data.elements, elements);
      elements[0].position.x = .3;
      const update = await request('farm-layout', { version: 1, elements }); assert.equal(update.data.version, 2);
      assert.deepEqual((await request()).data.elements, elements);
    });
    await t.test('bloqueia referências de outra propriedade, organização, inexistentes e cultura incompatível', async () => {
      for (const bad of [{ productionIds: [other._id] }, { productionIds: [foreign._id] }, { productionIds: [randomUUID()] }, { cropIds: [randomUUID()] }, { cropIds: [ids.crop2] }]) {
        const r = await request('farm-layout', { version: 2, elements: [{ ...elements[0], ...bad }] }); assert.equal(r.status, 400); assert.equal(r.error.code, 'INVALID_REFERENCE');
      }
      assert.equal((await request()).data.version, 2);
    });
    await t.test('isola organizações e propriedades em leitura e escrita', async () => {
      for (const suffix of ['farm-layout', 'farm-overview']) {
        assert.equal((await request(suffix, undefined, ids.foreignProperty)).status, 404);
        assert.equal((await request(suffix, undefined, ids.property, ids.otherOrg)).status, 403);
        assert.equal((await request(suffix, undefined, 'invalid')).status, 400);
      }
      assert.equal((await request('farm-layout', { version: 0, elements }, ids.foreignProperty)).status, 404);
      assert.equal((await request('farm-layout', { version: 0, elements }, ids.sameOrgProperty)).status, 400);
      assert.equal((await fetch(`${base}/properties/${ids.property}/farm-layout`)).status, 401);
    });
    await t.test('LEITOR visualiza mas não edita; vínculo inativo bloqueia acesso', async () => {
      await db.collection('memberships').updateOne({ userId: ids.user }, { $set: { role: 'LEITOR' } });
      assert.equal((await request()).data.canEdit, false); assert.equal((await request('farm-overview')).data.productions[0].actions.createOffer, false);
      assert.equal((await request('farm-layout', { version: 2, elements })).status, 403);
      await db.collection('memberships').updateOne({ userId: ids.user }, { $set: { status: 'INATIVO' } }); assert.equal((await request()).status, 403);
      await db.collection('memberships').updateOne({ userId: ids.user }, { $set: { role: 'EDITOR', status: 'ATIVO' } });
    });
    await t.test('validação HTTP não altera versão existente', async () => {
      for (const bad of [{ id: 'bad' }, { position: { x: 2, y: 0 } }, { type: 'INVALID' }]) assert.equal((await request('farm-layout', { version: 2, elements: [{ ...elements[0], ...bad }] })).status, 400);
      assert.equal((await request('farm-overview?limit=101')).status, 400);
      assert.equal((await request('farm-layout', { version: 2, elements: [{ ...elements[0], name: 'x'.repeat(17000) }] })).status, 413);
      assert.equal((await request()).data.version, 2);
    });
    await t.test('concorrência na atualização e criação: exatamente um vencedor', async () => {
      const responses = await Promise.all([request('farm-layout', { version: 2, elements }), request('farm-layout', { version: 2, elements: [] })]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      assert.equal((await request()).data.version, 3);
      const creates = await Promise.all([request('farm-layout', { version: 0, elements: [] }, ids.sameOrgProperty), request('farm-layout', { version: 0, elements: [] }, ids.sameOrgProperty)]);
      assert.deepEqual(creates.map(r => r.status).sort(), [200, 409]);
      assert.equal((await request('farm-layout', { version: 3, elements })).data.version, 4);
    });
    await t.test('múltiplas culturas, paginação, ofertas, pedidos e eventos reais sem somar estoque fictício', async () => {
      await db.collection('offers').insertOne({ _id: randomUUID(), sellerOrganizationId: ids.org, lotId: p.lot.id, status: 'PUBLICADA', quantityGrams: 8000, availableGrams: 3000, reservedGrams: 2000, dispatchedGrams: 2000, receivedGrams: 1000, availableUntil: '2099-01-01T00:00:00.000Z' });
      const statuses = ['SOLICITADO', 'ACEITO', 'RETIRADO', 'RECEBIDO'];
      await db.collection('orders').insertMany(statuses.map((status, i) => ({ _id: randomUUID(), sellerOrganizationId: ids.org, lotId: p.lot.id, quantityGrams: 1000, status, createdAt: `2026-11-0${i + 1}T12:00:00Z`, ...(status === 'RECEBIDO' ? { shipment: { id: randomUUID(), status: 'RECEBIDA', receipt: { receivedBy: ids.user } } } : {}) })));
      await db.collection('orders').insertOne({ _id: randomUUID(), sellerOrganizationId: ids.org, lotId: other.lot.id, quantityGrams: 900000, status: 'SOLICITADO' });
      await db.collection('traceEvents').insertOne({ _id: randomUUID(), lotId: p.lot.id, operationId: randomUUID(), type: 'RETIRADA_REGISTRADA', recordedAt: '2026-11-02T12:00:00Z' });
      const r = await request('farm-overview?limit=1'); assert.equal(r.status, 200);
      assert.equal(r.data.summary.productionCount, 2); assert.equal(r.data.summary.registeredQuantityKg, 30); assert.equal(r.data.summary.crops.length, 2); assert.equal(r.data.productions.length, 1); assert.equal(r.data.pagination.total, 2);
      const sector = r.data.elements[0]; assert.equal(sector.state, 'ACTION_PENDING'); assert.equal(sector.productionCount, 1);
      const operation = sector.productions[0]; assert.equal(operation.offer.quantityKg, 8); assert.equal(operation.offer.availableKg, 3); assert.equal(operation.registeredQuantityKg, 10);
      assert.equal(operation.orderStates.length, 4); assert.ok(operation.orderStates.every(o => o.count === 1)); assert.equal(operation.lot.recentEvents[0].type, 'RETIRADA_REGISTRADA');
      assert.equal(operation.recentOrders.length, 3); assert.equal(operation.recentOrders[0].status, 'RECEBIDO'); assert.equal(operation.recentOrders[0].shipmentStatus, 'RECEBIDA');
      assert.equal(JSON.stringify(r).includes('receivedBy'), false);
      assert.equal(JSON.stringify(r).includes(other._id), false); assert.equal(JSON.stringify(r).includes(foreign._id), false);
    });
    await t.test('referência posteriormente indisponível não vaza dados operacionais', async () => {
      await db.collection('productions').updateOne({ _id: p._id }, { $set: { propertyId: ids.sameOrgProperty } });
      const r = await request('farm-overview');
      assert.deepEqual(r.data.elements[0].missingProductionIds, [p._id]); assert.deepEqual(r.data.elements[0].productions, []);
      assert.equal(r.data.summary.registeredQuantityKg, 20);
      assert.equal(JSON.stringify(r.data).includes(p.lot.id), false);
      await db.collection('productions').updateOne({ _id: p._id }, { $set: { propertyId: ids.property } });
    });
    await t.test('falha MongoDB de validação retorna erro sem substituir layout anterior', async () => {
      const before = await db.collection('farmLayouts').findOne({ _id: ids.property });
      await db.command({ collMod: 'farmLayouts', validator: { version: { $lt: 5 } }, validationLevel: 'strict', validationAction: 'error' });
      const failed = await request('farm-layout', { version: 4, elements: [] }); assert.equal(failed.status, 500); assert.equal(failed.error.code, 'INTERNAL_ERROR');
      assert.deepEqual(await db.collection('farmLayouts').findOne({ _id: ids.property }), before);
      await db.command({ collMod: 'farmLayouts', validator: {}, writeConcern: { w: 'majority', j: true } });
    });
    await t.test('layout sobrevive ao encerramento e reabertura da API e MongoDB', async () => {
      const before = (await request()).data;
      await new Promise(resolve => server.close(resolve)); server = undefined; await connection.client.close(); connection = undefined;
      await mongo.stop({ doCleanup: false });
      mongo = await MongoMemoryServer.create({ binary, instance: { dbPath, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
      connection = await connectDatabase({ uri: mongo.getUri(), name: 'farm_isolated' }); await start();
      assert.deepEqual((await request()).data, before);
      assert.equal((await request('farm-overview')).data.summary.registeredQuantityKg, 30);
    });
    await t.test('substituição por lista vazia é explícita e não apaga produções', async () => {
      const r = await request('farm-layout', { version: 4, elements: [] });
      assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.data.state, 'EMPTY');
      assert.equal(await connection.db.collection('productions').countDocuments(), 4);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (connection) await connection.client.close();
    if (mongo) await mongo.stop({ doCleanup: false });
  }
});
