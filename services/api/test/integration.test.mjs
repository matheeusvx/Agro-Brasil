import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../src/database.mjs';
import { createApp } from '../src/app.mjs';
import { tokenHash } from '../src/auth.mjs';

// Sem mocks de persistência: processo mongod real, base exclusiva por execução.
test('fluxo HTTP, persistência MongoDB e isolamento entre organizações', { timeout: 240000 }, async t => {
  const dbPath = resolve(`.data/integration-${randomUUID()}`); await mkdir(dbPath, { recursive: true });
  let mongo; let connection; let server;
  const openServer = async db => { const s = createApp(db, { demoAuthEnabled: true }).listen(0, '127.0.0.1'); await once(s, 'listening'); return s; };
  try {
    mongo = await MongoMemoryServer.create({ binary: { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') }, instance: { dbPath, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
    connection = await connectDatabase({ uri: mongo.getUri(), name: 'agro_integration' });
    const ids = Object.fromEntries(['user', 'otherUser', 'org', 'otherOrg', 'institution', 'property', 'foreignProperty', 'crop'].map(key => [key, randomUUID()]));
    const token = randomBytes(32).toString('base64url');
    const otherToken = randomBytes(32).toString('base64url');
    const db = connection.db;
    await db.collection('users').insertMany([{ _id: ids.user, status: 'ATIVO' }, { _id: ids.otherUser, status: 'ATIVO' }]);
    await db.collection('organizations').insertMany([{ _id: ids.org, type: 'PEQUENO_PRODUTOR_RURAL', status: 'ATIVA' }, { _id: ids.otherOrg, type: 'PEQUENO_PRODUTOR_RURAL', status: 'ATIVA' }, { _id: ids.institution, type: 'INSTITUICAO', status: 'ATIVA' }]);
    await db.collection('memberships').insertMany([{ userId: ids.user, organizationId: ids.org, role: 'ADMIN', status: 'ATIVO' }, { userId: ids.otherUser, organizationId: ids.otherOrg, role: 'ADMIN', status: 'ATIVO' }, { userId: ids.user, organizationId: ids.institution, role: 'ADMIN', status: 'ATIVO' }]);
    await db.collection('demoTokens').insertMany([{ userId: ids.user, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) }, { userId: ids.otherUser, tokenHash: tokenHash(otherToken), expiresAt: new Date(Date.now() + 3600000) }]);
    await db.collection('properties').insertMany([{ _id: ids.property, organizationId: ids.org, status: 'ATIVA' }, { _id: ids.foreignProperty, organizationId: ids.otherOrg, status: 'ATIVA' }]);
    await db.collection('crops').insertOne({ _id: ids.crop, name: 'Alface', status: 'ATIVA' });
    server = await openServer(db);
    let base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, { bearer = token, organization = ids.org, body, method = 'GET' } = {}) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${bearer}`, 'X-Organization-Id': organization, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const body = { propertyId: ids.property, cropId: ids.crop, seasonLabel: '2026/2', quantityKg: 12.5, harvestedOn: new Date().toISOString().slice(0, 10), location: { municipality: 'São Paulo', uf: 'SP' }, locationConfirmed: true };
    let production;
    await t.test('nega acesso sem identidade', async () => assert.equal((await fetch(`${base}/api/v1/productions`)).status, 401));
    await t.test('uma pessoa consulta seus dois vínculos autorizados', async () => assert.equal((await (await request('/api/v1/me')).json()).memberships.length, 2));
    await t.test('nega organização sem vínculo e não grava', async () => { assert.equal((await request('/api/v1/productions', { method: 'POST', organization: ids.otherOrg, body })).status, 403); assert.equal(await db.collection('productions').countDocuments(), 0); });
    await t.test('instituição não registra produção de pequeno produtor rural', async () => assert.equal((await request('/api/v1/productions', { method: 'POST', organization: ids.institution, body })).status, 403));
    await t.test('não aceita propriedade de outra organização', async () => assert.equal((await request('/api/v1/productions', { method: 'POST', body: { ...body, propertyId: ids.foreignProperty } })).status, 400));
    await t.test('valida entrada HTTP', async () => { assert.equal((await request('/api/v1/productions', { method: 'POST', body: { ...body, quantityKg: 0 } })).status, 400); assert.equal((await request('/api/v1/productions?limit=-1')).status, 400); });
    await t.test('cria produção, lote e evento em uma gravação persistida', async () => {
      const response = await request('/api/v1/productions', { method: 'POST', body }); assert.equal(response.status, 201);
      production = (await response.json()).data;
      assert.equal(production.lot.events.length, 1); assert.equal(production.createdBy, ids.user);
      assert.equal((await db.collection('productions').findOne({ _id: production.id })).lot.id, production.lot.id);
    });
    await t.test('consulta e agrega indicadores reais da organização', async () => {
      assert.equal((await (await request('/api/v1/productions')).json()).data.length, 1);
      const indicators = await (await request('/api/v1/productions/indicators')).json(); assert.equal(indicators.total, 1); assert.equal(indicators.distribution[0].quantityKg, 12.5);
      assert.equal((await (await request(`/api/v1/lots/${production.lot.id}`)).json()).data.events[0].responsibleUserId, ids.user);
    });
    await t.test('banco standalone recusa comércio sem simular transação', async () => {
      const response = await request('/api/v1/offers', { method: 'POST', body: { lotId: production.lot.id, quantityKg: 1, destinationMode: 'DOACAO', availableUntil: new Date(Date.now() + 86400000).toISOString() } });
      assert.equal(response.status, 400); // Chave obrigatória é validada antes da capacidade.
      const real = await fetch(`${base}/api/v1/offers`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Organization-Id': ids.org, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ lotId: production.lot.id, quantityKg: 1, destinationMode: 'DOACAO', availableUntil: new Date(Date.now() + 86400000).toISOString() }) });
      assert.equal(real.status, 503); assert.equal((await real.json()).error.code, 'TRANSACTIONS_REQUIRED');
      assert.equal(await db.collection('offers').countDocuments(), 0);
    });
    await t.test('home prioriza ação, limita pendências/lotes e isola propriedade', async () => {
      const pending = ['RETIRADO', 'ACEITO', 'SOLICITADO', 'SOLICITADO'].map((status, i) => ({ _id: randomUUID(), lotId: production.lot.id, sellerOrganizationId: ids.org, requesterOrganizationId: ids.institution, quantityGrams: 1000, status, createdAt: `2026-11-0${i + 1}T12:00:00Z` }));
      await db.collection('orders').insertMany(pending);
      const result = await request(`/api/v1/producer-home?propertyId=${ids.property}`); assert.equal(result.status, 200);
      const home = await result.json(); assert.equal(home.hasProductions, true); assert.equal(home.pending.length, 2); assert.ok(home.pending.every(p => p.status === 'SOLICITADO')); assert.equal(home.recentLots.length, 1);
      assert.equal((await request(`/api/v1/producer-home?propertyId=${ids.foreignProperty}`)).status, 404);
      assert.equal((await request(`/api/v1/properties/${ids.foreignProperty}/weather`)).status, 404);
      await db.collection('orders').deleteMany({ _id: { $in: pending.map(p => p._id) } });
      const clean = await (await request(`/api/v1/producer-home?propertyId=${ids.property}`)).json(); assert.deepEqual(clean.pending, []);
    });
    await t.test('home sem produção e clima sem configuração não fabricam conteúdo', async () => {
      const fresh = randomUUID(); await db.collection('properties').insertOne({ _id: fresh, name: 'Propriedade vazia fictícia', organizationId: ids.org, status: 'ATIVA' });
      const home = await (await request(`/api/v1/producer-home?propertyId=${fresh}`)).json(); assert.equal(home.hasProductions, false); assert.deepEqual(home.recentLots, []); assert.deepEqual(home.pending, []);
      const weather = await (await request(`/api/v1/properties/${fresh}/weather`)).json(); assert.equal(weather.status, 'unavailable'); assert.equal(weather.temperatureC, undefined);
    });
    await t.test('impede leitura cruzada por ID e listagem', async () => {
      const other = { bearer: otherToken, organization: ids.otherOrg };
      assert.equal((await request(`/api/v1/productions/${production.id}`, other)).status, 404);
      assert.equal((await request(`/api/v1/lots/${production.lot.id}`, other)).status, 404);
      assert.equal((await (await request('/api/v1/productions', other)).json()).data.length, 0);
    });
    await t.test('perfil leitor não cria e vínculo revogado perde acesso', async () => {
      await db.collection('memberships').updateOne({ userId: ids.user, organizationId: ids.org }, { $set: { role: 'LEITOR' } });
      assert.equal((await request('/api/v1/productions', { method: 'POST', body })).status, 403);
      await db.collection('memberships').updateOne({ userId: ids.user, organizationId: ids.org }, { $set: { role: 'ADMIN', status: 'INATIVO' } });
      assert.equal((await request('/api/v1/productions')).status, 403);
      await db.collection('memberships').updateOne({ userId: ids.user, organizationId: ids.org }, { $set: { status: 'ATIVO' } });
    });
    await t.test('trata JSON inválido, tamanho excessivo, 404 e serve a página', async () => {
      const headers = { Authorization: `Bearer ${token}`, 'X-Organization-Id': ids.org, 'Content-Type': 'application/json' };
      assert.equal((await fetch(`${base}/api/v1/productions`, { method: 'POST', headers, body: '{' })).status, 400);
      assert.equal((await fetch(`${base}/api/v1/productions`, { method: 'POST', headers, body: JSON.stringify({ value: 'x'.repeat(17000) }) })).status, 413);
      assert.equal((await request('/api/v1/inexistente')).status, 404);
      const response = await fetch(base); assert.equal(response.status, 200); assert.match(await response.text(), /Minha produção/);
    });
    await t.test('mantém registro após reiniciar API e processo MongoDB no mesmo diretório', async () => {
      await new Promise(resolve => server.close(resolve)); server = undefined; await connection.client.close(); connection = undefined;
      const port = mongo.instanceInfo.port; await mongo.stop({ doCleanup: false });
      mongo = await MongoMemoryServer.create({ binary: { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') }, instance: { dbPath, port, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
      connection = await connectDatabase({ uri: mongo.getUri(), name: 'agro_integration' }); server = await openServer(connection.db); base = `http://127.0.0.1:${server.address().port}`;
      assert.equal((await (await request(`/api/v1/productions/${production.id}`)).json()).data.id, production.id);
    });
    await t.test('token expirado é recusado', async () => { await connection.db.collection('demoTokens').updateOne({ userId: ids.user }, { $set: { expiresAt: new Date(0) } }); assert.equal((await request('/api/v1/productions')).status, 401); });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (connection) await connection.client.close();
    if (mongo) await mongo.stop({ doCleanup: false });
  }
});
