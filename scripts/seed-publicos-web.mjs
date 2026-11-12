// Participantes fictícios extras para validar o portal multi-público:
// usuário com vínculos de tipos diferentes, LEITOR de cooperativa e uma
// instituição sem pedidos (estado vazio). Não cria pedidos nem altera saldos.
// Requer `npm run seed:demo` antes. Tokens ficam em .data/ (não versionado).
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectDatabase } from '../services/api/src/database.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';

if (process.env.DEMO_AUTH_ENABLED !== 'true') throw new Error('Habilite DEMO_AUTH_ENABLED=true apenas para demonstração local.');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(uri)) throw new Error('Seed restrito a MongoDB local sem credenciais.');
const { client, db } = await connectDatabase();
try {
  const org = async key => {
    const found = await db.collection('organizations').findOne({ demoKey: key });
    if (!found) throw new Error(`Organização ${key} ausente: execute npm run seed:demo antes.`);
    return found;
  };
  const producer = await org('demo-PEQUENO_PRODUTOR_RURAL');
  const cooperative = await org('demo-COOPERATIVA');
  const institution = await org('demo-INSTITUICAO');
  let emptyInstitution = await db.collection('organizations').findOne({ demoKey: 'demo-INSTITUICAO-vazia' });
  if (!emptyInstitution) {
    emptyInstitution = { _id: randomUUID(), demoKey: 'demo-INSTITUICAO-vazia', name: 'Instituição sem pedidos — DEMONSTRAÇÃO', type: 'INSTITUICAO', status: 'ATIVA', isDemonstration: true };
    await db.collection('organizations').insertOne(emptyInstitution);
  }
  const users = [
    { key: 'demo-publicos-multiplo', name: 'Participante fictício com vários vínculos', memberships: [
      [producer, 'LEITOR'], [cooperative, 'EDITOR'], [institution, 'LEITOR'], [emptyInstitution, 'ADMIN']] },
    { key: 'demo-publicos-leitor-cooperativa', name: 'Participante fictício leitor da cooperativa', memberships: [[cooperative, 'LEITOR']] },
  ];
  const sessions = [];
  for (const spec of users) {
    let user = await db.collection('users').findOne({ demoKey: spec.key });
    if (!user) { user = { _id: randomUUID(), demoKey: spec.key, displayName: spec.name, status: 'ATIVO', isDemonstration: true }; await db.collection('users').insertOne(user); }
    for (const [organization, role] of spec.memberships)
      await db.collection('memberships').updateOne({ userId: user._id, organizationId: organization._id }, { $set: { status: 'ATIVO', role }, $setOnInsert: { _id: randomUUID() } }, { upsert: true });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('demoTokens').deleteMany({ userId: user._id });
    await db.collection('demoTokens').insertOne({ tokenHash: tokenHash(token), userId: user._id, expiresAt });
    sessions.push({ key: spec.key, roles: spec.memberships.map(([o, role]) => ({ type: o.type, role })), token, expiresAt });
  }
  await mkdir('.data', { recursive: true });
  await writeFile('.data/demo-sessions-publicos.json', JSON.stringify({ warning: 'Tokens temporários locais. Não compartilhar, publicar nem anexar como evidência.', sessions }, null, 2));
  console.log('Participantes extras criados: vínculos múltiplos, LEITOR de cooperativa e instituição sem pedidos. Tokens em .data/demo-sessions-publicos.json (não versionado).');
} finally { await client.close(); }
