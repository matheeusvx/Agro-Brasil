import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProduction, productionDocument, HttpError } from '../src/domain.mjs';

const id = '10000000-0000-4000-8000-000000000001';
const valid = () => ({ propertyId: id, cropId: id, seasonLabel: '2026/2', quantityKg: 12.5, harvestedOn: '2026-11-05', location: { municipality: 'São Paulo', uf: 'SP' }, locationConfirmed: true });
const now = new Date('2026-11-05T12:00:00Z');
test('aceita produção válida e remove espaços de textos', () => { const input = valid(); input.seasonLabel = ' 2026/2 '; assert.equal(validateProduction(input, now).seasonLabel, '2026/2'); });
test('rejeita massas inválidas, strings e precisão além de grama', () => {
  for (const quantityKg of [0, -1, NaN, Infinity, '10', 1e10, .0001]) assert.throws(() => validateProduction({ ...valid(), quantityKg }, now), HttpError);
});
test('rejeita data inexistente, futura e datetime no lugar de data', () => {
  for (const harvestedOn of ['2026-02-30', '2026-11-06', '2026-11-05T00:00:00Z', 'inválida']) assert.throws(() => validateProduction({ ...valid(), harvestedOn }, now), HttpError);
});
test('exige município, UF válida e confirmação explícita de origem', () => {
  for (const patch of [{ locationConfirmed: false }, { location: null }, { location: { municipality: '', uf: 'SP' } }, { location: { municipality: 'Teste', uf: 'XX' } }]) assert.throws(() => validateProduction({ ...valid(), ...patch }, now), HttpError);
});
test('rejeita tentativa de atribuir organização, responsável ou operadores MongoDB', () => {
  for (const patch of [{ organizationId: id }, { createdBy: id }, { propertyId: { $ne: null } }, { cropId: 'x' }]) assert.throws(() => validateProduction({ ...valid(), ...patch }, now), HttpError);
});
test('produção, lote e origem possuem IDs distintos e responsáveis definidos pelo contexto', () => {
  const document = productionDocument(validateProduction(valid(), now), { organizationId: id, userId: id, isDemonstration: true }, { name: 'Alface' }, now);
  assert.equal(new Set([document._id, document.lot.id, document.lot.events[0].id]).size, 3);
  assert.equal(document.lot.productionId, document._id); assert.equal(document.lot.events[0].responsibleUserId, id);
  assert.equal(document.lot.events[0].locationConfirmedBy, id); assert.equal(document.lot.events[0].occurredAt, now.toISOString());
  assert.equal(document.isDemonstration, true);
});
