// Verificação HTTP do isolamento dos três públicos pelo portal Next.js real
// (API + MongoDB locais). Sem mocks. Relatório sem tokens nem IDs completos.
// Uso: node scripts/verify-portal-publicos.mjs [http://127.0.0.1:3101]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const portal = process.argv[2] || 'http://127.0.0.1:3101';
const base = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8')).sessions;
const extra = JSON.parse(await readFile('.data/demo-sessions-publicos.json', 'utf8')).sessions;
const token = type => base.find(s => s.type === type).token;
const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const mask = id => (id ? id.slice(0, 4) + '…' : id);

async function login(value) {
  const res = await fetch(portal + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: portal }, body: JSON.stringify({ token: value }) });
  const body = await res.json();
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { status: res.status, body, cookie };
}
function client(cookie) {
  return {
    get: async path => { const r = await fetch(portal + path, { headers: { Cookie: cookie } }); return { status: r.status, body: await r.json() }; },
    post: async (path, body) => { const r = await fetch(portal + path, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: portal, 'Idempotency-Key': 'verificacao-publicos-1' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; },
  };
}
const homeOk = (r, orgId, type) => {
  assert.equal(r.status, 200);
  assert.equal(r.body.data.schemaVersion, 1);
  assert.equal(r.body.data.organizationId, orgId);
  assert.equal(r.body.data.organizationType, type);
  for (const op of [...r.body.data.operations, ...r.body.data.pending])
    assert.deepEqual(Object.keys(op).sort(), ['createdAt', 'id', 'lotId', 'offerId', 'quantityKg', 'shipment', 'status']);
};

check('1. produtor mantém rotas originais e não acessa homes novas', async () => {
  const s = await login(token('PEQUENO_PRODUTOR_RURAL')); assert.equal(s.status, 200);
  const c = client(s.cookie);
  for (const p of ['/api/agro/catalog', '/api/agro/productions?limit=1', '/api/agro/orders?limit=1', '/api/agro/offers?scope=mine&limit=1']) assert.equal((await c.get(p)).status, 200, p);
  assert.equal((await c.get('/api/agro/cooperative-home')).status, 404);
  assert.equal((await c.get('/api/agro/institution-home')).status, 404);
  return { memberships: s.body.memberships.map(m => m.type) };
});
check('2. cooperativa vê só a própria home; rotas do produtor e de instituição bloqueadas', async () => {
  const s = await login(token('COOPERATIVA')); const c = client(s.cookie);
  const home = await c.get('/api/agro/cooperative-home?limit=5&offset=0'); homeOk(home, s.body.organizationId, 'COOPERATIVA');
  for (const p of ['/api/agro/producer-home', '/api/agro/catalog', '/api/agro/productions', '/api/agro/orders', '/api/agro/institution-home', '/api/agro/offers', '/api/agro/cooperative-home?scope=mine'])
    assert.equal((await c.get(p)).status, 404, p);
  // Somente leitura: escritas são verificadas em banco descartável (scripts/e2e-portal-operacoes.mjs).
  assert.equal((await c.post('/api/agro/orders', {})).status, 404, 'cooperativa não cria pedido');
  return { total: home.body.data.total, byStatus: Object.fromEntries(Object.entries(home.body.data.byStatus).map(([k, v]) => [k, v.count])), canWrite: home.body.data.canWrite };
});
check('3. instituição vê só a própria home e ofertas públicas', async () => {
  const s = await login(token('INSTITUICAO')); const c = client(s.cookie);
  const home = await c.get('/api/agro/institution-home?limit=5&offset=0'); homeOk(home, s.body.organizationId, 'INSTITUICAO');
  const offers = await c.get('/api/agro/offers?limit=12&offset=0'); assert.equal(offers.status, 200);
  for (const p of ['/api/agro/producer-home', '/api/agro/catalog', '/api/agro/cooperative-home', '/api/agro/offers?scope=mine'])
    assert.equal((await c.get(p)).status, 404, p);
  assert.equal((await c.post('/api/agro/productions', {})).status, 404, 'instituição não registra produção');
  return { total: home.body.data.total, offers: offers.body.pagination.total, canWrite: home.body.data.canWrite };
});
check('4. vínculos múltiplos alternam sem dados residuais', async () => {
  const multi = extra.find(s => s.key === 'demo-publicos-multiplo');
  const s = await login(multi.token); const c = client(s.cookie);
  const types = s.body.memberships.map(m => m.type);
  assert.deepEqual([...new Set(types)].sort(), ['COOPERATIVA', 'INSTITUICAO', 'PEQUENO_PRODUTOR_RURAL']);
  assert.equal(s.body.memberships.find(m => m.organizationId === s.body.organizationId).type, 'PEQUENO_PRODUTOR_RURAL');
  const seen = [];
  for (const m of s.body.memberships) {
    const sw = await c.post('/api/session', { organizationId: m.organizationId }); assert.equal(sw.status, 200); assert.equal(sw.body.organizationId, m.organizationId);
    if (m.type === 'COOPERATIVA') { const h = await c.get('/api/agro/cooperative-home?limit=5&offset=0'); homeOk(h, m.organizationId, 'COOPERATIVA'); assert.equal(h.body.data.canWrite, true); assert.equal((await c.get('/api/agro/institution-home')).status, 404); seen.push({ type: m.type, role: m.role, total: h.body.data.total }); }
    if (m.type === 'INSTITUICAO') { const h = await c.get('/api/agro/institution-home?limit=5&offset=0'); homeOk(h, m.organizationId, 'INSTITUICAO'); assert.equal(h.body.data.canWrite, m.role !== 'LEITOR'); assert.equal((await c.get('/api/agro/cooperative-home')).status, 404); seen.push({ type: m.type, role: m.role, total: h.body.data.total }); }
    if (m.type === 'PEQUENO_PRODUTOR_RURAL') { assert.equal((await c.get('/api/agro/catalog')).status, 200); assert.equal((await c.get('/api/agro/cooperative-home')).status, 404); seen.push({ type: m.type, role: m.role }); }
  }
  const foreign = await c.post('/api/session', { organizationId: base.find(b => b.type === 'COMPRADOR_LOCAL').organizationId });
  assert.equal(foreign.status, 403);
  return { switched: seen };
});
check('5. LEITOR de cooperativa recebe canWrite=false', async () => {
  const leitor = extra.find(s => s.key === 'demo-publicos-leitor-cooperativa');
  const s = await login(leitor.token); const c = client(s.cookie);
  const h = await c.get('/api/agro/cooperative-home?limit=5&offset=0'); homeOk(h, s.body.organizationId, 'COOPERATIVA');
  assert.equal(h.body.data.canWrite, false);
  return { role: s.body.memberships[0].role, canWrite: false };
});
check('6. comprador local e sessão inválida são recusados', async () => {
  const buyer = await login(token('COMPRADOR_LOCAL')); assert.equal(buyer.status, 403);
  const anon = await fetch(portal + '/api/agro/cooperative-home'); assert.equal(anon.status, 401);
  const bad = await fetch(portal + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: portal }, body: JSON.stringify({ token: 'x'.repeat(40) }) });
  assert.equal(bad.status, 401);
  return { compradorLocal: buyer.status, semSessao: anon.status, tokenInvalido: bad.status };
});

const report = { verifiedAt: new Date().toISOString(), environment: 'DEMONSTRACAO_LOCAL_FICTICIA', portal: 'next start (build de produção)', results: [] };
let failed = 0;
for (const { name, fn } of checks) {
  try { report.results.push({ name, ok: true, detail: await fn() }); console.log('ok', name); }
  catch (error) { failed++; report.results.push({ name, ok: false, error: error.message }); console.log('FALHA', name, error.message); }
}
await mkdir('docs/design/publicos-web', { recursive: true });
await writeFile('docs/design/publicos-web/verificacao-http.json', JSON.stringify(report, (k, v) => (/organizationId$/i.test(k) ? mask(v) : v), 2) + '\n');
console.log(`${checks.length - failed}/${checks.length} verificações aprovadas.`);
process.exit(failed ? 1 : 0);
