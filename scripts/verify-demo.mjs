import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Somente leitura HTTP. Nunca salva ou imprime os tokens no relatório.
const fixture = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8'));
const session = fixture.sessions.find(s => s.type === 'PEQUENO_PRODUTOR_RURAL');
assert.ok(session, 'Execute seed:demo antes desta verificação.');
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
async function get(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${session.token}`, 'X-Organization-Id': session.organizationId } });
  assert.equal(response.status, 200, `GET ${path}`);
  return response.json();
}
const health = await get('/health');
const list = await get('/api/v1/productions');
const indicators = await get('/api/v1/productions/indicators');
const expectedLot = process.argv[2];
const production = expectedLot ? list.data.find(p => p.lot.id === expectedLot) : list.data.find(p => p.isDemonstration);
assert.ok(production, 'Cadastre uma produção demonstrativa pela interface antes de verificar.');
const lot = (await get(`/api/v1/lots/${production.lot.id}`)).data;
assert.equal(lot.productionId, production.id);
assert.equal(lot.events[0].type, 'ORIGEM_REGISTRADA');
assert.ok(lot.events[0].locationConfirmedBy);
const report = {
  verifiedAt: new Date().toISOString(), environment: 'DEMONSTRACAO_LOCAL',
  database: health.database, productionId: production.id, lotId: lot.id,
  crop: production.cropName, quantityKg: production.quantityKg,
  seasonLabel: production.seasonLabel, isDemonstration: production.isDemonstration,
  event: { type: lot.events[0].type, occurredAt: lot.events[0].occurredAt,
    location: lot.events[0].location, responsibleRecorded: Boolean(lot.events[0].responsibleUserId), locationConfirmationRecorded: true },
  indicators, readOnlyVerification: true,
  limitations: ['Cadastro e origem apenas; sem oferta, pedido, retirada ou recebimento.', 'Não representa produção real ou benefício social medido.']
};
await mkdir('docs/evidencias', { recursive: true });
await writeFile('docs/evidencias/demonstracao.json', JSON.stringify(report, null, 2) + '\n');
console.log('Demonstração consultada e verificada. Relatório sem tokens: docs/evidencias/demonstracao.json');
