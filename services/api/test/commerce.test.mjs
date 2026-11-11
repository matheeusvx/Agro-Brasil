import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { connectDatabase } from '../src/database.mjs';
import { createApp } from '../src/app.mjs';
import { tokenHash } from '../src/auth.mjs';

test('jornada comercial com transações reais e quatro públicos', { timeout: 180000 }, async t => {
  const path = resolve(`.data/commerce-${randomUUID()}`); await mkdir(path, { recursive: true });
  const binary = { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') };
  let mongo; let connection; let server; let base;
  const profiles = {};
  const location = { location: { municipality: 'São Paulo', uf: 'SP' }, locationConfirmed: true };
  const start = async () => { server = createApp(connection.db, { demoAuthEnabled: true }).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; };
  const request = async (profile, endpoint, body, key = randomUUID()) => {
    const p = profiles[profile];
    const response = await fetch(`${base}/api/v1${endpoint}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${p.token}`, 'X-Organization-Id': p.orgId, 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, replayed: response.headers.get('Idempotency-Replayed'), body: await response.json() };
  };
  const ok = async (profile, endpoint, body, status = 200, key) => { const result = await request(profile, endpoint, body, key); assert.equal(result.status, status, JSON.stringify(result.body));
    if (profile === 'producer' && endpoint !== '/productions' && !endpoint.includes('excess-impact')) {
      const property = await connection.db.collection('properties').findOne({ organizationId: profiles.producer.orgId });
      if (property) {
        const r = await request('producer', '/properties/' + property._id + '/excess-impact');
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const lots = await connection.db.collection('productions').find({ propertyId: property._id, organizationId: profiles.producer.orgId }).toArray();
        const offers = await connection.db.collection('offers').find({ lotId: { $in: lots.map(p => p.lot.id) }, status: 'PUBLICADA' }).toArray();
        const total = field => offers.reduce((n, o) => n + o[field], 0);
        assert.equal(Math.round(r.body.data.funnelKg.acceptedNet * 1000), total('reservedGrams') + total('dispatchedGrams') + total('receivedGrams'));
        assert.equal(Math.round(r.body.data.funnelKg.pickedUp * 1000), total('dispatchedGrams') + total('receivedGrams'));
        assert.equal(Math.round(r.body.data.funnelKg.received * 1000), total('receivedGrams'));
        const d = r.body.data, b = d.balancesKg;
        assert.equal(Math.round(d.funnelKg.published * 1000), [b.availableActive, b.expiredAvailable, b.reservedNow, b.inTransitNow, d.funnelKg.received].reduce((n, kg) => n + Math.round(kg * 1000), 0));
      }
    }
    return result.body.data; };
  let offer; let lot; let order; let direct; let receiptReplay;
  try {
    mongo = await MongoMemoryReplSet.create({ binary, instanceOpts: [{ dbPath: path }], replSet: { count: 1, name: 'agroTest', storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
    connection = await connectDatabase({ uri: mongo.getUri(), name: 'agro_commerce' });
    const db = connection.db;
    for (const [name, type] of Object.entries({ producer: 'PEQUENO_PRODUTOR_RURAL', institution: 'INSTITUICAO', buyer: 'COMPRADOR_LOCAL', cooperative: 'COOPERATIVA', stranger: 'COOPERATIVA' })) {
      const p = { orgId: randomUUID(), userId: randomUUID(), token: randomBytes(32).toString('base64url') }; profiles[name] = p;
      await db.collection('users').insertOne({ _id: p.userId, status: 'ATIVO' });
      await db.collection('organizations').insertOne({ _id: p.orgId, name: `${name} FICTÍCIO`, type, status: 'ATIVA' });
      await db.collection('memberships').insertOne({ userId: p.userId, organizationId: p.orgId, role: 'ADMIN', status: 'ATIVO' });
      await db.collection('demoTokens').insertOne({ userId: p.userId, tokenHash: tokenHash(p.token), expiresAt: new Date(Date.now() + 3600000) });
    }
    const propertyId = randomUUID(); const cropId = randomUUID();
    await db.collection('properties').insertOne({ _id: propertyId, organizationId: profiles.producer.orgId, status: 'ATIVA' });
    await db.collection('crops').insertOne({ _id: cropId, name: 'Alface', status: 'ATIVA' });
    await start();
    const production = await ok('producer', '/productions', { propertyId, cropId, seasonLabel: 'TESTE FICTÍCIO', quantityKg: 10, harvestedOn: new Date().toISOString().slice(0, 10), ...location }, 201);
    lot = production.lot;
    const offerBody = { lotId: lot.id, quantityKg: 10, destinationMode: 'DOACAO', availableUntil: new Date(Date.now() + 86400000).toISOString() };
    await t.test('nega publicação por outro público e oferta superior ao lote', async () => {
      assert.equal((await request('institution', '/offers', offerBody)).status, 403);
      assert.equal((await request('producer', '/offers', { ...offerBody, quantityKg: 11 })).status, 409);
      assert.equal((await request('producer', '/offers', { ...offerBody, quantityKg: .0001 })).status, 400);
      assert.equal((await request('producer', '/offers', { ...offerBody, destinationMode: 'VENDA', unitPriceCents: -1 })).status, 400);
      assert.equal((await request('producer', '/offers', { ...offerBody, availableUntil: '2027-02-30T12:00:00Z' })).status, 400);
      assert.equal(await db.collection('offers').countDocuments(), 0);
    });
    await t.test('criação idempotente, chave com outro conteúdo e limite de uma oferta por lote', async () => {
      const key = randomUUID(); offer = await ok('producer', '/offers', offerBody, 201, key);
      const repeated = await request('producer', '/offers', offerBody, key); assert.equal(repeated.status, 201); assert.equal(repeated.replayed, 'true'); assert.equal(repeated.body.data.id, offer.id);
      assert.equal((await request('producer', '/offers', { ...offerBody, quantityKg: 9 }, key)).status, 409);
      assert.equal((await request('producer', '/offers', offerBody)).status, 409);
      assert.equal(await db.collection('offers').countDocuments(), 1);
    });
    await t.test('rascunho não é listado e publicação expõe somente projeção comercial', async () => {
      assert.equal((await ok('institution', '/offers')).length, 0);
      await ok('producer', `/offers/${offer.id}/publish`, location);
      const listed = await ok('institution', '/offers'); assert.equal(listed.length, 1);
      assert.equal(listed[0].propertyId, undefined); assert.equal(listed[0].createdBy, undefined); assert.equal(listed[0].events, undefined);
      assert.equal((await request('institution', `/lots/${lot.id}`)).status, 404);
    });
    await t.test('solicitação não pode ultrapassar saldo nem escolher organização arbitrária', async () => {
      assert.equal((await request('institution', '/orders', { offerId: offer.id, quantityKg: 11, ...location })).status, 409);
      assert.equal((await request('institution', '/orders', { offerId: offer.id, quantityKg: 1, ...location, requesterOrganizationId: profiles.buyer.orgId })).status, 400);
      assert.equal((await request('cooperative', '/orders', { offerId: offer.id, quantityKg: 1, ...location })).status, 403);
    });
    let pendingBuyer;
    await t.test('pedidos e aceites concorrentes nunca reservam além do saldo', async () => {
      const created = await Promise.all([ok('institution', '/orders', { offerId: offer.id, quantityKg: 7, ...location }, 201), ok('buyer', '/orders', { offerId: offer.id, quantityKg: 7, ...location }, 201)]);
      const results = await Promise.all(created.map(o => request('producer', `/orders/${o.id}/accept`, { ...location, cooperativeOrganizationId: profiles.cooperative.orgId })));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      order = results.find(r => r.status === 200).body.data;
      pendingBuyer = created.find(o => o.id !== order.id);
      const balance = await db.collection('offers').findOne({ _id: offer.id }); assert.equal(balance.availableGrams, 3000); assert.equal(balance.reservedGrams, 7000);
      assert.equal((await db.collection('orders').findOne({ _id: pendingBuyer.id })).status, 'SOLICITADO');
    });
    await t.test('outra organização não vê pedidos, eventos e remessas; origem privada não vaza', async () => {
      assert.equal((await ok('stranger', '/orders')).length, 0);
      assert.equal((await request('stranger', `/lots/${lot.id}/events`)).status, 404);
      assert.equal((await request('stranger', `/shipments/${order.shipment.id}/pickup`, location)).status, 404);
      const recipient = order.requesterOrganizationId === profiles.institution.orgId ? 'institution' : 'buyer';
      const events = await ok(recipient, `/lots/${lot.id}/events`);
      assert.ok(events.some(e => e.type === 'ORIGEM_REGISTRADA')); assert.ok(events.every(e => !e.responsibleUserId && !e.locationConfirmedBy));
      assert.ok(!events.some(e => e.orderId === pendingBuyer.id));
    });
    await t.test('recebimento antes da retirada e retirada por destinatário são recusados', async () => {
      const recipient = order.requesterOrganizationId === profiles.institution.orgId ? 'institution' : 'buyer';
      assert.equal((await request(recipient, `/shipments/${order.shipment.id}/receipts`, { ...location, quantityAcceptedKg: 7 })).status, 409);
      assert.equal((await request(recipient, `/shipments/${order.shipment.id}/pickup`, location)).status, 404);
    });
    await t.test('cooperativa designada retira; repetição concorrente com mesma chave não duplica', async () => {
      const key = randomUUID(); const endpoint = `/shipments/${order.shipment.id}/pickup`;
      const results = await Promise.all([request('cooperative', endpoint, location, key), request('cooperative', endpoint, location, key)]);
      assert.ok(results.every(r => r.status === 200)); assert.equal(results[0].body.data.shipment.id, results[1].body.data.shipment.id);
      assert.equal((await request('cooperative', endpoint, location)).status, 409);
      assert.equal(await db.collection('traceEvents').countDocuments({ orderId: order.id, type: 'RETIRADA_REGISTRADA' }), 1);
    });
    await t.test('não cancela após retirada nem confirma recebimento parcial', async () => {
      assert.equal((await request('producer', `/orders/${order.id}/cancel`, location)).status, 409);
      const recipient = order.requesterOrganizationId === profiles.institution.orgId ? 'institution' : 'buyer';
      assert.equal((await request(recipient, `/shipments/${order.shipment.id}/receipts`, { ...location, quantityAcceptedKg: 6 })).status, 409);
    });
    await t.test('destinatário confirma; repetição não duplica quantidade nem histórico', async () => {
      const recipient = order.requesterOrganizationId === profiles.institution.orgId ? 'institution' : 'buyer'; const key = randomUUID();
      const endpoint = `/shipments/${order.shipment.id}/receipts`; const body = { ...location, quantityAcceptedKg: 7 };
      receiptReplay = { recipient, endpoint, body, key };
      assert.equal((await request('cooperative', endpoint, body)).status, 404);
      await ok(recipient, endpoint, body, 201, key);
      assert.equal((await request(recipient, endpoint, body, key)).replayed, 'true');
      assert.equal((await request(recipient, endpoint, body)).status, 409);
      const balance = await db.collection('offers').findOne({ _id: offer.id }); assert.equal(balance.receivedGrams, 7000); assert.equal(balance.dispatchedGrams, 0);
      assert.equal(await db.collection('traceEvents').countDocuments({ orderId: order.id, type: 'RECEBIMENTO_CONFIRMADO' }), 1);
    });
    await t.test('cancela solicitado sem liberar e cancela aceito exatamente uma vez', async () => {
      await ok('producer', `/orders/${pendingBuyer.id}/cancel`, location);
      const d = await ok('buyer', '/orders', { offerId: offer.id, quantityKg: 2, ...location }, 201);
      direct = await ok('producer', `/orders/${d.id}/accept`, location);
      const key = randomUUID(); const endpoint = `/orders/${d.id}/cancel`;
      const results = await Promise.all([request('buyer', endpoint, location, key), request('buyer', endpoint, location, key)]);
      assert.ok(results.every(r => r.status === 200)); assert.equal((await request('buyer', endpoint, location)).status, 409);
      const balance = await db.collection('offers').findOne({ _id: offer.id }); assert.equal(balance.availableGrams, 3000); assert.equal(balance.reservedGrams, 0);
    });
    let directCompleted;
    await t.test('fluxo direto sem cooperativa para comprador local', async () => {
      const d = await ok('buyer', '/orders', { offerId: offer.id, quantityKg: 1.001, ...location }, 201);
      directCompleted = await ok('producer', `/orders/${d.id}/accept`, location);
      assert.equal(directCompleted.shipment.carrierOrganizationId, null);
      await ok('producer', `/shipments/${directCompleted.shipment.id}/pickup`, location);
      await ok('buyer', `/shipments/${directCompleted.shipment.id}/receipts`, { ...location, quantityAcceptedKg: 1.001 }, 201);
      const balance = await db.collection('offers').findOne({ _id: offer.id });
      assert.equal(balance.availableGrams, 1999); assert.equal(balance.receivedGrams, 8001);
      assert.equal(balance.availableGrams + balance.reservedGrams + balance.dispatchedGrams + balance.receivedGrams, balance.quantityGrams);
    });
    await t.test('falha ao inserir evento desfaz reserva, pedido e comando na mesma transação', async () => {
      const pending = await ok('institution', '/orders', { offerId: offer.id, quantityKg: 1, ...location }, 201);
      // Colisão controlada no índice único do evento força falha após atualização de saldo.
      const injected = { _id: randomUUID(), operationId: pending.id, type: 'PEDIDO_ACEITO', lotId: 'TESTE-FALHA-ISOLADA' };
      await db.collection('traceEvents').insertOne(injected);
      const before = await db.collection('offers').findOne({ _id: offer.id }); const commands = await db.collection('commands').countDocuments();
      assert.equal((await request('producer', `/orders/${pending.id}/accept`, location)).status, 409);
      assert.equal((await db.collection('orders').findOne({ _id: pending.id })).status, 'SOLICITADO');
      assert.deepEqual(await db.collection('offers').findOne({ _id: offer.id }), before); assert.equal(await db.collection('commands').countDocuments(), commands);
      await db.collection('traceEvents').deleteOne({ _id: injected._id }); // Somente fixture isolada de teste.
    });
    await t.test('origem permanece intacta e eventos são paginados sem expor outra operação', async () => {
      const stored = await db.collection('productions').findOne({ _id: production.id }); assert.deepEqual(stored.lot.events, production.lot.events);
      const events = await ok('producer', `/lots/${lot.id}/events`); assert.equal(events[0].id, lot.events[0].id);
      for (const event of events) { assert.ok(event.occurredAt); assert.ok(event.responsibleOrganizationId); assert.ok(event.locationConfirmedAt); }
      const first = await request('buyer', `/lots/${lot.id}/events?limit=1&offset=0`); const second = await request('buyer', `/lots/${lot.id}/events?limit=1&offset=1`);
      assert.equal(first.body.data.length, 1); assert.equal(second.body.data.length, 1); assert.notEqual(first.body.data[0].id, second.body.data[0].id);
    });
    await t.test('perfil leitor e localização não confirmada não alteram operações', async () => {
      await db.collection('memberships').updateOne({ userId: profiles.producer.userId, organizationId: profiles.producer.orgId }, { $set: { role: 'LEITOR' } });
      assert.equal((await request('producer', `/orders/${direct.id}/accept`, location)).status, 403);
      await db.collection('memberships').updateOne({ userId: profiles.producer.userId, organizationId: profiles.producer.orgId }, { $set: { role: 'ADMIN' } });
      assert.equal((await request('producer', `/orders/${direct.id}/accept`, { ...location, locationConfirmed: false })).status, 400);
    });
    await t.test('impacto: ciclos, modalidades, prazo, isolamento e LEITOR', async () => {
      const url = '/properties/' + propertyId + '/excess-impact';
      const get = async () => {
        const r = await request('producer', url); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.data;
      };
      let d = await get();
      assert.deepEqual(d.funnelKg, { registered: 10, published: 10, acceptedNet: 8.001, pickedUp: 8.001, received: 8.001 });
      assert.deepEqual(d.byModeKg.DOACAO, { published: 10, received: 8.001 });
      const otherProperty = randomUUID(), foreignProperty = randomUUID(), empty = randomUUID();
      await db.collection('properties').insertMany([
        { _id: otherProperty, organizationId: profiles.producer.orgId, status: 'ATIVA' },
        { _id: empty, organizationId: profiles.producer.orgId, status: 'ATIVA' },
        { _id: foreignProperty, organizationId: profiles.buyer.orgId, status: 'ATIVA' }
      ]);
      const make = async (pid, kg) => ok('producer', '/productions', { propertyId: pid, cropId, seasonLabel: 'FICTICIO', quantityKg: kg, harvestedOn: new Date().toISOString().slice(0, 10), ...location }, 201);
      const saleProduction = await make(propertyId, .123);
      const sale = await ok('producer', '/offers', { ...offerBody, lotId: saleProduction.lot.id, quantityKg: .123, destinationMode: 'VENDA', unitPriceCents: 100 }, 201);
      d = await get(); assert.equal(d.funnelKg.registered, 10.123); assert.equal(d.funnelKg.published, 10);
      await ok('producer', '/offers/' + sale.id + '/publish', location);
      const o = await ok('buyer', '/orders', { offerId: sale.id, quantityKg: .023, ...location }, 201);
      const accepted = await ok('producer', '/orders/' + o.id + '/accept', location);
      await ok('producer', '/shipments/' + accepted.shipment.id + '/pickup', location);
      await ok('buyer', '/shipments/' + accepted.shipment.id + '/receipts', { ...location, quantityAcceptedKg: .023 }, 201);
      await db.collection('offers').updateOne({ _id: sale.id }, { $set: { availableUntil: '2020-01-01T00:00:00.000Z' } });
      const other = await make(otherProperty, 999);
      const otherOffer = await ok('producer', '/offers', { ...offerBody, lotId: other.lot.id, quantityKg: 999 }, 201);
      await ok('producer', '/offers/' + otherOffer.id + '/publish', location);
      const before = await db.collection('offers').find({}).toArray();
      for (const role of ['ADMIN', 'EDITOR', 'LEITOR']) {
        await db.collection('memberships').updateOne({ userId: profiles.producer.userId }, { $set: { role } });
        d = await get();
        assert.deepEqual(d.funnelKg, { registered: 10.123, published: 10.123, acceptedNet: 8.024, pickedUp: 8.024, received: 8.024 });
        assert.deepEqual(d.byModeKg.VENDA, { published: .123, received: .023 });
        assert.equal(d.balancesKg.expiredAvailable, .1); assert.equal(d.balancesKg.availableActive, 1.999);
        assert.equal(d.schemaVersion, 1); assert.equal(d.isDemonstration, true); assert.equal(new Date(d.asOf).toISOString(), d.asOf);
      }
      assert.deepEqual(await db.collection('offers').find({}).toArray(), before);
      const zero = await request('producer', '/properties/' + empty + '/excess-impact');
      assert.deepEqual(zero.body.data.funnelKg, { registered: 0, published: 0, acceptedNet: 0, pickedUp: 0, received: 0 });
      await db.collection('productions').insertMany(Array.from({ length: 101 }, () => ({ _id: randomUUID(), organizationId: profiles.producer.orgId, propertyId: empty, quantityKg: .001, lot: { id: randomUUID() } })));
      assert.equal((await request('producer', '/properties/' + empty + '/excess-impact')).body.data.funnelKg.registered, .101);
      assert.equal((await request('producer', '/properties/' + foreignProperty + '/excess-impact')).status, 404);
      assert.equal((await request('buyer', url)).status, 403);
      assert.equal((await request('producer', '/properties/invalid/excess-impact')).status, 400);
      const noAuth = await fetch(base + '/api/v1' + url); assert.equal(noAuth.status, 401); assert.equal(noAuth.headers.get('cache-control'), 'no-store');
      await db.collection('memberships').updateOne({ userId: profiles.producer.userId }, { $set: { role: 'ADMIN', status: 'INATIVO' } });
      assert.equal((await request('producer', url)).status, 403);
      await db.collection('memberships').updateOne({ userId: profiles.producer.userId }, { $set: { status: 'ATIVO' } });
    });
    await t.test('dados, eventos e idempotência sobrevivem ao reinício da aplicação', async () => {
      const count = await db.collection('traceEvents').countDocuments({ lotId: lot.id });
      await new Promise(resolve => server.close(resolve)); server = undefined; await connection.client.close();
      connection = await connectDatabase({ uri: mongo.getUri(), name: 'agro_commerce' }); await start();
      const orders = await ok('producer', '/orders'); assert.equal(orders.find(o => o.id === directCompleted.id).status, 'RECEBIDO');
      const replay = await request(receiptReplay.recipient, receiptReplay.endpoint, receiptReplay.body, receiptReplay.key);
      assert.equal(replay.status, 201); assert.equal(replay.replayed, 'true');
      assert.equal((await ok('producer', `/lots/${lot.id}/events`)).length, count + 1);
      const balance = await connection.db.collection('offers').findOne({ _id: offer.id });
      await mkdir('docs/evidencias', { recursive: true });
      await writeFile('docs/evidencias/incremento-2-transacoes.json', JSON.stringify({ verifiedAt: new Date().toISOString(), environment: 'TESTE_ISOLADO_FICTICIO', database: 'MongoDB replica set real', offerId: offer.id, lotId: lot.id, cooperativeOrderId: order.id, directOrderId: directCompleted.id, balance, traceEventCount: count, originalEventPreserved: true, applicationRestartVerified: true }, null, 2));
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (connection) await connection.client.close();
    if (mongo) await mongo.stop({ doCleanup: false });
  }
});
