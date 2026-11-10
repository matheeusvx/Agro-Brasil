// Cenário de DEMONSTRAÇÃO: pequeno produtor com bastante demanda.
// Gera produções, ofertas, pedidos em todas as etapas, eventos de
// rastreabilidade e a configuração de Minha Fazenda — tudo pela API real,
// passando pelas mesmas regras de negócio, transações e validações.
// Participantes, propriedade e volumes são fictícios e marcados como
// demonstração. Tokens são temporários, ficam só em memória e são removidos
// ao final. Uso: npm run seed:demo:alta-demanda (API e MongoDB locais ativos).
import { randomBytes, randomUUID } from 'node:crypto';
import { connectDatabase } from '../services/api/src/database.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';

const SCENARIO = 'pequeno-produtor-alta-demanda-v1';
const api = (process.env.AGRO_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api/v1';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/v1$/.test(api)) throw new Error('Cenário restrito à API local.');
if (process.env.DEMO_AUTH_ENABLED !== 'true') throw new Error('Habilite DEMO_AUTH_ENABLED=true apenas para demonstração local.');

const { client, db } = await connectDatabase();
const temporaryTokens = [];
try {
  if (await db.collection('demoScenarios').findOne({ _id: SCENARIO })) {
    console.log('Cenário de alta demanda já aplicado. Nada foi alterado.');
    process.exit(0);
  }
  const producerOrg = await db.collection('organizations').findOne({ demoKey: 'demo-PEQUENO_PRODUTOR_RURAL' });
  const producerUser = await db.collection('users').findOne({ demoKey: 'demo-PEQUENO_PRODUTOR_RURAL' });
  const property = await db.collection('properties').findOne({ demoKey: 'sitio-demo', organizationId: producerOrg?._id });
  if (!producerOrg || !producerUser || !property) throw new Error('Execute npm run seed:demo antes deste cenário.');

  // Participantes fictícios adicionais (idempotentes por demoKey).
  async function participant(key, name, type) {
    let org = await db.collection('organizations').findOne({ demoKey: key });
    if (!org) {
      org = { _id: randomUUID(), demoKey: key, name: `${name} — DEMONSTRAÇÃO`, type, status: 'ATIVA', isDemonstration: true };
      await db.collection('organizations').insertOne(org);
    }
    let user = await db.collection('users').findOne({ demoKey: key });
    if (!user) {
      user = { _id: randomUUID(), demoKey: key, displayName: `Participante fictício — ${name}`, status: 'ATIVO', isDemonstration: true };
      await db.collection('users').insertOne(user);
    }
    await db.collection('memberships').updateOne({ userId: user._id, organizationId: org._id }, { $set: { status: 'ATIVO', role: 'ADMIN' }, $setOnInsert: { _id: randomUUID() } }, { upsert: true });
    return { org, user };
  }
  const existing = async key => {
    const org = await db.collection('organizations').findOne({ demoKey: key });
    const user = await db.collection('users').findOne({ demoKey: key });
    return { org, user };
  };
  const coop = await existing('demo-COOPERATIVA');
  const institution = await existing('demo-INSTITUICAO');
  const buyer = await existing('demo-COMPRADOR_LOCAL');
  const school = await participant('demo-escola-municipal', 'Escola Municipal Vila Verde', 'INSTITUICAO');
  const market = await participant('demo-mercadinho-bairro', 'Mercadinho do Bairro', 'COMPRADOR_LOCAL');
  const restaurant = await participant('demo-restaurante-sabor', 'Restaurante Sabor da Terra', 'COMPRADOR_LOCAL');
  const coop2 = await participant('demo-cooperativa-vale', 'Cooperativa Vale Verde', 'COOPERATIVA');
  for (const p of [coop, institution, buyer]) if (!p.org || !p.user) throw new Error('Execute npm run seed:demo antes deste cenário.');

  // Culturas usadas no cenário (catálogo global, idempotente por nome).
  const cropNames = ['Alface', 'Couve', 'Rúcula', 'Tomate', 'Cenoura', 'Abobrinha', 'Milho', 'Mandioca', 'Laranja', 'Banana'];
  for (const name of cropNames) await db.collection('crops').updateOne({ name }, { $setOnInsert: { _id: randomUUID(), name, status: 'ATIVA' } }, { upsert: true });
  const crops = new Map((await db.collection('crops').find({ name: { $in: cropNames } }).toArray()).map(c => [c.name, c._id]));

  // Sessões temporárias (30 min) só em memória.
  async function session(user, org) {
    const token = randomBytes(32).toString('base64url');
    await db.collection('demoTokens').insertOne({ tokenHash: tokenHash(token), userId: user._id, expiresAt: new Date(Date.now() + 30 * 60000) });
    temporaryTokens.push(tokenHash(token));
    return async (method, path, body) => {
      const res = await fetch(api + path, {
        method,
        headers: { Authorization: 'Bearer ' + token, 'X-Organization-Id': org._id, 'Content-Type': 'application/json', ...(method === 'POST' && path !== '/productions' ? { 'Idempotency-Key': randomUUID() } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.error?.code ?? ''} ${json.error?.message ?? ''}`);
      return json.data ?? json;
    };
  }
  const as = {
    producer: await session(producerUser, producerOrg),
    coop: await session(coop.user, coop.org),
    coop2: await session(coop2.user, coop2.org),
    institution: await session(institution.user, institution.org),
    buyer: await session(buyer.user, buyer.org),
    school: await session(school.user, school.org),
    market: await session(market.user, market.org),
    restaurant: await session(restaurant.user, restaurant.org),
  };
  const here = { location: { municipality: property.municipality || 'São Paulo', uf: property.uf || 'SP' }, locationConfirmed: true };
  const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const until = days => new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');

  // ---------- Produções (colheitas das últimas três semanas) ----------
  const harvests = [
    ['alface1', 'Alface', 180, 1], ['alface2', 'Alface', 150, 8], ['couve', 'Couve', 120, 2], ['rucula', 'Rúcula', 60, 1],
    ['tomate1', 'Tomate', 420, 3], ['tomate2', 'Tomate', 380, 10], ['cenoura', 'Cenoura', 260, 5], ['abobrinha', 'Abobrinha', 140, 4],
    ['milho', 'Milho', 900, 14], ['mandioca', 'Mandioca', 650, 12], ['laranja', 'Laranja', 540, 6], ['banana', 'Banana', 300, 9],
  ];
  const lots = {};
  for (const [key, crop, kg, ago] of harvests) {
    const p = await as.producer('POST', '/productions', { propertyId: property._id, cropId: crops.get(crop), seasonLabel: '2026/2', quantityKg: kg, harvestedOn: day(ago), ...here });
    lots[key] = p;
  }

  // ---------- Ofertas ----------
  const offerPlan = {
    alface1: [160, 450, 4], alface2: [120, 420, 2], couve: [100, 500, 4], rucula: [50, 900, 3],
    tomate1: [400, 650, 6], tomate2: [300, 600, 3], cenoura: [240, 380, 7], abobrinha: [120, 420, 5],
    milho: [800, 250, 10], mandioca: [600, 300, 9], laranja: [500, 280, 8],
  };
  const drafts = new Set(['abobrinha']); // rascunho: ainda não publicada
  const offers = {};
  for (const [key, [kg, cents, days]] of Object.entries(offerPlan)) {
    const donation = key === 'mandioca';
    const offer = await as.producer('POST', '/offers', { lotId: lots[key].lot.id, quantityKg: kg, availableUntil: until(days), destinationMode: donation ? 'DOACAO' : 'VENDA', ...(donation ? {} : { unitPriceCents: cents }) });
    if (!drafts.has(key)) await as.producer('POST', `/offers/${offer.id}/publish`, here);
    offers[key] = offer;
  }

  // ---------- Pedidos em todas as etapas ----------
  const order = (who, key, kg) => as[who]('POST', '/orders', { offerId: offers[key].id, quantityKg: kg, ...here });
  const accept = (o, carrier = coop.org._id) => as.producer('POST', `/orders/${o.id}/accept`, { cooperativeOrganizationId: carrier, ...here });
  const pickup = (o, who = 'producer') => as[who]('POST', `/shipments/${o.shipment.id}/pickup`, here);
  const receive = (o, who, kg) => as[who]('POST', `/shipments/${o.shipment.id}/receipts`, { quantityAcceptedKg: kg, ...here });

  // Recebidos (ciclo completo)
  for (const [who, key, kg, carrier] of [['school', 'mandioca', 150, coop.org._id], ['institution', 'milho', 200, coop2.org._id], ['restaurant', 'tomate2', 60, coop.org._id], ['market', 'laranja', 80, coop2.org._id]]) {
    const accepted = await accept(await order(who, key, kg), carrier);
    await pickup(accepted, carrier === coop.org._id ? 'coop' : 'coop2');
    await receive(accepted, who, kg);
  }
  // Em entrega (retirada registrada, aguardando recebimento)
  for (const [who, key, kg] of [['buyer', 'tomate1', 90], ['school', 'cenoura', 70]]) {
    await pickup(await accept(await order(who, key, kg)), 'producer');
  }
  // Aceitos, aguardando retirada
  for (const [who, key, kg, carrier] of [['restaurant', 'alface1', 40, coop.org._id], ['institution', 'laranja', 120, coop2.org._id], ['market', 'milho', 150, coop.org._id]]) {
    await accept(await order(who, key, kg), carrier);
  }
  // Solicitados, aguardando a análise do produtor
  for (const [who, key, kg] of [['market', 'alface1', 30], ['buyer', 'couve', 25], ['school', 'tomate1', 80], ['restaurant', 'rucula', 15], ['institution', 'mandioca', 120]]) {
    await order(who, key, kg);
  }
  // Cancelado pelo comprador antes da retirada
  const cancelled = await order('buyer', 'alface2', 50);
  await as.buyer('POST', `/orders/${cancelled.id}/cancel`, here);

  // ---------- Minha Fazenda coerente com os registros ----------
  const L = k => lots[k].id;
  const C = (...n) => n.map(x => crops.get(x));
  const elements = [
    { name: 'Horta Norte', type: 'VEGETABLE_GARDEN', position: { x: 0.22, y: 0.3 }, productionIds: [L('alface1'), L('alface2'), L('couve'), L('rucula')], cropIds: C('Alface', 'Couve', 'Rúcula') },
    { name: 'Estufa de tomates', type: 'VEGETABLE_GARDEN', position: { x: 0.42, y: 0.16 }, productionIds: [L('tomate1'), L('tomate2')], cropIds: C('Tomate') },
    { name: 'Canteiro de raízes', type: 'VEGETABLE_GARDEN', position: { x: 0.16, y: 0.56 }, productionIds: [L('cenoura'), L('abobrinha')], cropIds: C('Cenoura', 'Abobrinha') },
    { name: 'Milharal', type: 'CULTIVATION', position: { x: 0.64, y: 0.2 }, productionIds: [L('milho')], cropIds: C('Milho') },
    { name: 'Roça de mandioca', type: 'CULTIVATION', position: { x: 0.84, y: 0.36 }, productionIds: [L('mandioca')], cropIds: C('Mandioca') },
    { name: 'Pomar de laranjas', type: 'ORCHARD', position: { x: 0.3, y: 0.8 }, productionIds: [L('laranja')], cropIds: C('Laranja') },
    { name: 'Bananal', type: 'ORCHARD', position: { x: 0.52, y: 0.88 }, productionIds: [L('banana')], cropIds: C('Banana') },
    { name: 'Galpão de embalagem', type: 'STORAGE', position: { x: 0.6, y: 0.55 }, productionIds: [L('alface1'), L('tomate1'), L('cenoura'), L('laranja')], cropIds: [] },
    { name: 'Ponto de coleta', type: 'COLLECTION', position: { x: 0.84, y: 0.72 }, productionIds: [L('tomate1'), L('milho'), L('laranja'), L('mandioca')], cropIds: [] },
    { name: 'Casa de sementes', type: 'OTHER', position: { x: 0.4, y: 0.5 }, productionIds: [], cropIds: [] },
  ].map(e => ({ id: randomUUID(), ...e }));
  const current = await as.producer('GET', `/properties/${property._id}/farm-layout`);
  await as.producer('PUT', `/properties/${property._id}/farm-layout`, { version: current.version, elements });

  await db.collection('demoScenarios').insertOne({ _id: SCENARIO, propertyId: property._id, appliedAt: new Date().toISOString(), isDemonstration: true });
  console.log(`Cenário aplicado em "${property.name}": ${harvests.length} produções, ${Object.keys(offers).length} ofertas, 15 pedidos (5 solicitados, 3 aceitos, 2 em entrega, 4 recebidos, 1 cancelado) e ${elements.length} setores em Minha Fazenda.` +
    (current.elements.length ? ` A configuração anterior da fazenda (${current.elements.length} setores) foi substituída.` : ''));
} finally {
  if (temporaryTokens.length) await db.collection('demoTokens').deleteMany({ tokenHash: { $in: temporaryTokens } });
  await client.close();
}
