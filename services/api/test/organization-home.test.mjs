import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { connectDatabase } from '../src/database.mjs';
import { createApp } from '../src/app.mjs';
import { Decimal128 } from 'mongodb';
import { tokenHash } from '../src/auth.mjs';

test('homes: MongoDB real, escopo, contagens e permissões', { timeout: 180000 }, async t => {
  let mongo, connection, server;
  try {
    const dir = resolve('.data/homes-' + randomUUID()); await mkdir(dir, { recursive: true });
    mongo = await MongoMemoryReplSet.create({ binary: { version: '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') }, instanceOpts: [{ dbPath: dir }], replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
    connection = await connectDatabase({ uri: mongo.getUri(), name: 'homes_test' });
    const db = connection.db, userId = randomUUID(), token = randomBytes(32).toString('base64url');
    await db.collection('users').insertOne({ _id: userId, status: 'ATIVO' });
    await db.collection('demoTokens').insertOne({ userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 3600000) });
    const orgs = {};
    for (const [name, type] of Object.entries({ c1: 'COOPERATIVA', c2: 'COOPERATIVA', i1: 'INSTITUICAO', i2: 'INSTITUICAO', p: 'PEQUENO_PRODUTOR_RURAL', b: 'COMPRADOR_LOCAL' })) {
      orgs[name] = randomUUID(); await db.collection('organizations').insertOne({ _id: orgs[name], type, status: 'ATIVA' });
      await db.collection('memberships').insertOne({ userId, organizationId: orgs[name], status: 'ATIVO', role: 'ADMIN' });
    }
    server = createApp(db, { demoAuthEnabled: true }).listen(0, '127.0.0.1'); await once(server, 'listening');
    const request = async (org, route, body) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/${route}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'X-Organization-Id': orgs[org], 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') };
    };
    await t.test('vazio válido e paginação inválida', async () => {
      for (const [o,r] of [['c1','cooperative-home'],['i1','institution-home']]) {
        const v = await request(o,r); assert.equal(v.status,200); assert.equal(v.body.data.total,0); assert.deepEqual(v.body.data.pending,[]); assert.equal(v.cache,'no-store');
        assert.equal((await request(o,r+'?limit=0')).status,400);
      }
    });
    const ids = [];
    for (const status of ['SOLICITADO','ACEITO','RETIRADO','RECEBIDO','CANCELADO']) {
      const id=randomUUID(); ids.push(id);
      await db.collection('orders').insertOne({ _id:id, lotId:randomUUID(), offerId:randomUUID(), requesterOrganizationId:orgs.i1, sellerOrganizationId:orgs.p, status, quantityGrams:1250, createdAt:'2026-11-12T12:00:00.000Z', createdBy:'SEGREDO', ...(status !== 'SOLICITADO' ? { shipment:{ id:randomUUID(), carrierOrganizationId:orgs.c1, status:{ ACEITO:'PLANEJADA',RETIRADO:'RETIRADA',RECEBIDO:'RECEBIDA',CANCELADO:'CANCELADA' }[status], receipt:{receivedBy:'SEGREDO'} } } : {}) });
    }
    await t.test('contagens globais, prioridades, projeção e paginação', async () => {
      const i=await request('i1','institution-home?limit=1&offset=1'); assert.equal(i.body.data.total,5); assert.equal(i.body.data.operations.length,1); assert.equal(i.body.pagination.total,5);
      assert.deepEqual(i.body.data.pending.map(o=>o.status),['RETIRADO','ACEITO','SOLICITADO']);
      for(const v of Object.values(i.body.data.byStatus))assert.deepEqual(v,{count:1,quantityKg:1.25});
      const c=await request('c1','cooperative-home');assert.equal(c.body.data.total,4);assert.equal(c.body.data.byStatus.SOLICITADO.count,0);assert.deepEqual(c.body.data.pending.map(o=>o.status),['ACEITO','RETIRADO']);
      assert.equal(JSON.stringify(c.body).includes('SEGREDO'),false);assert.equal(JSON.stringify(c.body).includes(orgs.i1),false);
      assert.deepEqual((await request('i1','institution-home?offset=100')).body.data.operations,[]);
    });
    await t.test('duas organizações de cada tipo, mesmo usuário, isolamento bilateral', async () => {
      await db.collection('orders').insertOne({ _id:randomUUID(), requesterOrganizationId:orgs.i2, sellerOrganizationId:orgs.p, status:'ACEITO', quantityGrams:9000, createdAt:'2026-11-12T13:00:00.000Z', shipment:{id:randomUUID(),carrierOrganizationId:orgs.c2,status:'PLANEJADA'} });
      for(const [o,r,n] of [['i1','institution-home',5],['i2','institution-home',1],['c1','cooperative-home',4],['c2','cooperative-home',1]]) {
        const v=await request(o,r);assert.equal(v.body.data.total,n);if(o.endsWith('2'))assert.equal(v.body.data.operations.some(x=>ids.includes(x.id)),false);
      }
    });
    await t.test('tipos incorretos, LEITOR, revogação e organização inativa', async () => {
      for(const o of ['i1','p','b'])assert.equal((await request(o,'cooperative-home')).status,403);
      for(const o of ['c1','p','b'])assert.equal((await request(o,'institution-home')).status,403);
      for(const [o,r] of [['i1','institution-home'],['c1','cooperative-home']]) {
        await db.collection('memberships').updateOne({organizationId:orgs[o]},{$set:{role:'LEITOR'}});
        assert.equal((await request(o,r)).body.data.canWrite,false);
        const location={location:{municipality:'São Paulo',uf:'SP'},locationConfirmed:true};
        const order=await db.collection('orders').findOne({status:'ACEITO',requesterOrganizationId:orgs.i1});
        assert.equal((await request(o,`shipments/${order.shipment.id}/pickup`,location)).status,403);
        assert.equal((await request(o,`shipments/${order.shipment.id}/receipts`,{...location,quantityAcceptedKg:1.25})).status,403);
        if(o==='i1') assert.equal((await request(o,'orders',{...location,offerId:randomUUID(),quantityKg:1})).status,403);
        await db.collection('memberships').updateOne({organizationId:orgs[o]},{$set:{status:'INATIVO'}});assert.equal((await request(o,r)).status,403);
        await db.collection('memberships').updateOne({organizationId:orgs[o]},{$set:{status:'ATIVO'}});
        await db.collection('organizations').updateOne({_id:orgs[o]},{$set:{status:'INATIVA'}});assert.equal((await request(o,r)).status,403);
      }
    });
    await t.test('EDITOR consulta e falha de consulta retorna 500', async()=>{
      await db.collection('memberships').updateOne({organizationId:orgs.i2},{$set:{role:'EDITOR'}});
      assert.equal((await request('i2','institution-home')).body.data.canWrite,true);
      const original=db.collection.bind(db);
      db.collection=name=>name==='orders'?{aggregate(){throw new Error('falha simulada de consulta');}}:original(name);
      try { const v=await request('i2','institution-home');assert.equal(v.status,500);assert.equal(v.body.data,undefined);assert.equal(JSON.stringify(v.body).includes('simulada'),false); }finally{db.collection=original;}
    });
    await t.test('quantidades individuais inválidas não são compensadas nem ignoradas', async t => {
      await db.collection('organizations').updateOne({_id:orgs.i1},{$set:{status:'ATIVA'}});
      const cases = [
        ['negativo compensado', -1, 1251], ['zero', 0, 1250],
        ['frações cuja soma é inteira', 0.5, 0.5], ['string numérica', '1250', 1250],
        ['null', null, 1250], ['ausente', undefined, 1250], ['array numérico', [1250], 1250],
        ['objeto', {value:1250}, 1250], ['booleano', true, 1250],
        ['NaN', NaN, 1250], ['infinito', Infinity, 1250], ['menos infinito', -Infinity, 1250],
        ['acima do limite comercial', 1e12 + 1, 1250],
        ['inteiro inseguro', Number.MAX_SAFE_INTEGER + 1, 1250],
        ['decimal BSON fora do contrato', Decimal128.fromString('1250'), 1250]
      ];
      for (const [name, value, companion] of cases) await t.test(name, async () => {
        const documents = [value, companion].map(quantity => ({ _id:randomUUID(),
          requesterOrganizationId:orgs.i2, status:'RECEBIDO', createdAt:'2000-01-01T00:00:00.000Z',
          ...(quantity === undefined ? {} : {quantityGrams:quantity}),
          shipment:{id:randomUUID(),carrierOrganizationId:orgs.c2,status:'RECEBIDA'} }));
        await db.collection('orders').insertMany(documents);
        try {
          assert.equal((await request('i1','institution-home')).status,200);
          // Corruption is outside the requested page AND outside pending states.
          for (const [org, route] of [['i2','institution-home'],['c2','cooperative-home']]) {
            const r = await request(org, route+'?limit=1');
            assert.equal(r.status,500,name);assert.deepEqual(r.body,{error:{code:'INTERNAL_ERROR',message:'Não foi possível concluir a operação.'}});
            assert.equal(r.cache,'no-store');
          }
        } finally { await db.collection('orders').deleteMany({_id:{$in:documents.map(d=>d._id)}}); }
      });
      // Domain boundaries remain valid and quantities still reconcile in both homes.
      const boundaries=[1,1e12].map(quantityGrams=>({_id:randomUUID(),requesterOrganizationId:orgs.i2,
        status:'RECEBIDO',quantityGrams,createdAt:'2000-01-01T00:00:00.000Z',
        shipment:{id:randomUUID(),carrierOrganizationId:orgs.c2,status:'RECEBIDA'}}));
      await db.collection('orders').insertMany(boundaries);
      try { for(const [org,route] of [['i2','institution-home'],['c2','cooperative-home']]) {
        const r=await request(org,route+'?limit=1');assert.equal(r.status,200);
        assert.deepEqual(r.body.data.byStatus.RECEBIDO,{count:2,quantityKg:1000000000.001});
      } } finally {await db.collection('orders').deleteMany({_id:{$in:boundaries.map(d=>d._id)}});}
    });
    await t.test('dado inconsistente não vira zero',async()=>{await db.collection('organizations').updateOne({_id:orgs.i1},{$set:{status:'ATIVA'}});await db.collection('orders').updateOne({_id:ids[0]},{$set:{quantityGrams:-1}});assert.equal((await request('i1','institution-home')).status,500);});
  } finally { if(server)await new Promise(r=>server.close(r));if(connection)await connection.client.close();if(mongo)await mongo.stop(); }
});
