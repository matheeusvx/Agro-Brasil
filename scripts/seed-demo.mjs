import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectDatabase } from '../services/api/src/database.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';

if (process.env.DEMO_AUTH_ENABLED !== 'true') throw new Error('Habilite DEMO_AUTH_ENABLED=true apenas para demonstração local.');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(uri)) throw new Error('Seed restrito a MongoDB local sem credenciais.');
const { client, db } = await connectDatabase();
try {
  const types = ['PEQUENO_PRODUTOR_RURAL', 'COOPERATIVA', 'INSTITUICAO', 'COMPRADOR_LOCAL'];
  const sessions = [];
  // Nomes legíveis para quem usa as telas; o tipo interno fica só no campo type.
  const names = { PEQUENO_PRODUTOR_RURAL: 'Produtor rural', COOPERATIVA: 'Cooperativa', INSTITUICAO: 'Instituição', COMPRADOR_LOCAL: 'Comprador local' };
  for (const type of types) {
    const key = `demo-${type}`;
    // IDs determinísticos por consulta; não duplica organizações ao repetir o seed.
    let org = await db.collection('organizations').findOne({ demoKey: key });
    const name = `${names[type]} — DEMONSTRAÇÃO`;
    if (!org) { org = { _id: randomUUID(), demoKey: key, name, type, status: 'ATIVA', isDemonstration: true }; await db.collection('organizations').insertOne(org); }
    else if (org.name !== name) await db.collection('organizations').updateOne({ _id: org._id, demoKey: key }, { $set: { name } });
    let user = await db.collection('users').findOne({ demoKey: key });
    if (!user) { user = { _id: randomUUID(), demoKey: key, displayName: `Participante fictício ${type}`, status: 'ATIVO', isDemonstration: true }; await db.collection('users').insertOne(user); }
    await db.collection('memberships').updateOne({ userId: user._id, organizationId: org._id }, { $set: { status: 'ATIVO', role: 'ADMIN' }, $setOnInsert: { _id: randomUUID() } }, { upsert: true });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('demoTokens').deleteMany({ userId: user._id });
    await db.collection('demoTokens').insertOne({ tokenHash: tokenHash(token), userId: user._id, expiresAt });
    sessions.push({ type, organizationId: org._id, token, expiresAt });
    if (type === 'PEQUENO_PRODUTOR_RURAL') await db.collection('properties').updateOne({ demoKey: 'sitio-demo' }, { $setOnInsert: { _id: randomUUID(), organizationId: org._id, name: 'Sítio fictício — DEMONSTRAÇÃO', municipality: 'São Paulo', uf: 'SP', status: 'ATIVA', isDemonstration: true } }, { upsert: true });
  }
  for (const name of ['Alface', 'Tomate', 'Abobrinha']) await db.collection('crops').updateOne({ name }, { $setOnInsert: { _id: randomUUID(), name, status: 'ATIVA' } }, { upsert: true });
  await mkdir('.data', { recursive: true });
  await writeFile('.data/demo-sessions.json', JSON.stringify({ warning: 'Tokens temporários locais. Não compartilhar, publicar nem anexar como evidência.', sessions }, null, 2));
  console.log('Seed concluído: quatro organizações fictícias, vínculos, propriedade e culturas. Tokens locais em .data/demo-sessions.json (não versionado). Nenhuma produção ou impacto real foi inventado.');
} finally { await client.close(); }
