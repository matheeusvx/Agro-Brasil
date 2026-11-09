import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../services/api/src/database.mjs';
import { createApp } from '../services/api/src/app.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';
import { productionDocument } from '../services/api/src/domain.mjs';
import { weatherProvider } from '../services/api/src/weather.mjs';
const existing=false, directory=resolve('.data/production-android');
let mongo, connection, server, token, base;
try {
  await mkdir(directory, { recursive: true });
  if (existing) {
    const sessions = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8'));
    token = sessions.sessions.find(s => s.type === 'PEQUENO_PRODUTOR_RURAL')?.token;
    assert.ok(token, 'Seed de demonstração necessário, sem imprimir token.');
  } else {
    const dbPath = resolve(`.data/mobile-smoke-${randomUUID()}`); await mkdir(dbPath, {recursive:true});
    mongo = await MongoMemoryServer.create({binary:{version:process.env.MONGOMS_VERSION || '8.0.16',downloadDir:resolve('.cache/mongodb-binaries')},instance:{dbPath,ip:'127.0.0.1'}});
    connection = await connectDatabase({uri:mongo.getUri(),name:'mobile_smoke'});
    const db = connection.db, userId = randomUUID(), organizationId = randomUUID(); token = randomBytes(32).toString('base64url');
    await db.collection('users').insertOne({_id:userId,status:'ATIVO',isDemonstration:true});
    await db.collection('organizations').insertOne({_id:organizationId,name:'Pequeno produtor fictício — SMOKE',type:'PEQUENO_PRODUTOR_RURAL',status:'ATIVA',isDemonstration:true});
    await db.collection('memberships').insertOne({userId,organizationId,role:'ADMIN',status:'ATIVO'});
    await db.collection('demoTokens').insertOne({userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+3600000)});
    await db.collection('properties').insertOne({_id:randomUUID(),organizationId,name:'Propriedade fictícia — SMOKE',municipality:'São Paulo',uf:'SP',status:'ATIVA',isDemonstration:true});
    const mainProperty = (await db.collection('properties').findOne({organizationId}))._id;
    const secondProperty = randomUUID();
    await db.collection('properties').insertOne({_id:secondProperty,organizationId,name:'Outra propriedade vazia',municipality:'Suzano',uf:'SP',status:'ATIVA',isDemonstration:true});
    const context = {organizationId,userId,isDemonstration:true};
    const crops = [{_id:randomUUID(),name:'Alface',status:'ATIVA'},{_id:randomUUID(),name:'Tomate',status:'ATIVA'}];
    await db.collection('crops').insertMany(crops);
    const productions = Array.from({length:205},(_,i)=>productionDocument({propertyId:mainProperty,cropId:crops[i%2]._id,seasonLabel:'Primavera 2026',quantityKg:1,harvestedOn:'2026-10-01',location:{municipality:'São Paulo',uf:'SP'}},context,crops[i%2]));
    await db.collection('productions').insertMany(productions);
    const until = new Date(Date.now()+2*86400000).toISOString();
    const offers = productions.slice(0,4).map((p,i)=>({_id:randomUUID(),lotId:p.lot.id,sellerOrganizationId:organizationId,sellerName:'Produtor fictício',cropName:p.cropName,territory:p.location,quantityGrams:1000,availableGrams:i===0?600:i===1?200:1000,reservedGrams:i===0?400:0,dispatchedGrams:0,receivedGrams:i===1?800:0,destinationMode:i===1?'DOACAO':'VENDA',status:i===2?'RASCUNHO':'PUBLICADA',availableUntil:i===3?'2000-01-01T00:00:00Z':until,createdAt:new Date().toISOString(),isDemonstration:true}));
    await db.collection('offers').insertMany(offers);
    await db.collection('orders').insertMany([{_id:randomUUID(),offerId:offers[0]._id,lotId:offers[0].lotId,sellerOrganizationId:organizationId,requesterOrganizationId:randomUUID(),status:'ACEITO',quantityGrams:400,createdAt:new Date().toISOString(),isDemonstration:true},{_id:randomUUID(),offerId:offers[1]._id,lotId:offers[1].lotId,sellerOrganizationId:organizationId,requesterOrganizationId:randomUUID(),status:'SOLICITADO',quantityGrams:100,createdAt:new Date().toISOString(),isDemonstration:true}]);
    server = createApp(db,{demoAuthEnabled:true,weather:weatherProvider({enabled:false})}).listen(0,'127.0.0.1');
    await once(server,'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  await writeFile(resolve(directory,'session.json'),JSON.stringify({token,port:server.address().port}));
  console.log('Servidor Android isolado pronto; identidade demonstrativa somente em arquivo local ignorado.');
  await new Promise(done=>process.once('SIGINT',done));
} finally {
  if(server) await new Promise(done=>server.close(done));
  if(connection) await connection.client.close();
  if(mongo) await mongo.stop({doCleanup:false});
}
