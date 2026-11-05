import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { sessions } = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8'));
const lotId = process.argv[2]; assert.ok(lotId, 'Informe o UUID do lote demonstrado na interface.');
const base = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
const report = { verifiedAt: new Date().toISOString(), environment: 'DEMONSTRACAO_LOCAL_FICTICIA', readOnlyVerification: true, lotId, profiles: [] };
for (const session of sessions) {
  const headers = { Authorization: `Bearer ${session.token}`, 'X-Organization-Id': session.organizationId };
  async function get(endpoint) { const res = await fetch(`${base}${endpoint}`, { headers }); assert.equal(res.status, 200, endpoint); return res.json(); }
  const orders = (await get('/orders')).data.filter(o => o.lotId === lotId);
  assert.ok(orders.length, `Sem operação demonstrada: ${session.type}`);
  assert.ok(orders.every(o => o.status === 'RECEBIDO'));
  const events = (await get(`/lots/${lotId}/events?limit=100`)).data;
  assert.ok(events.some(e => e.type === 'ORIGEM_REGISTRADA'));
  assert.ok(events.some(e => e.type === 'RECEBIMENTO_CONFIRMADO'));
  if (session.type !== 'PEQUENO_PRODUTOR_RURAL') {
    const allowed = new Set(orders.map(o => o.id));
    assert.ok(events.every(e => !e.orderId || allowed.has(e.orderId)), 'Vazamento de outra operação.');
  } else {
    report.offers = (await get('/offers?scope=mine')).data.filter(o => o.lotId === lotId);
  }
  report.profiles.push({ type: session.type, organizationId: session.organizationId,
    orders: orders.map(o => ({ id: o.id, status: o.status, quantityKg: o.quantityKg, shipmentId: o.shipment.id, carrierOrganizationId: o.shipment.carrierOrganizationId, receiptId: o.shipment.receipt.id })),
    events: events.map(e => ({ id: e.id, type: e.type, orderId: e.orderId || null, occurredAt: e.occurredAt, responsibleOrganizationId: e.responsibleOrganizationId, location: e.location })) });
}
await writeFile('docs/evidencias/incremento-2-interface.json', JSON.stringify(report, null, 2) + '\n');
console.log('Quatro perfis e histórico verificados por leitura HTTP. Relatório sem tokens: docs/evidencias/incremento-2-interface.json');
