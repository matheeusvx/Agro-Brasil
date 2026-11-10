import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateLayout, layoutView, elementTypes } from '../src/farm-domain.mjs';
import { saveLayout } from '../src/farm.mjs';

const element = () => ({ id: randomUUID(), name: ' Horta Norte ', type: 'VEGETABLE_GARDEN', position: { x: 0, y: 1 }, productionIds: [], cropIds: [] });
test('layout inicial e vazio não fabricam estruturas', () => {
  assert.equal(layoutView(null, 'property', false).state, 'UNCONFIGURED');
  assert.deepEqual(layoutView(null, 'property', false).elements, []);
  assert.equal(layoutView({ version: 2, elements: [] }, 'property', true).state, 'EMPTY');
});
test('tipos, coordenadas de borda e normalização do nome', () => {
  for (const type of elementTypes) assert.equal(validateLayout({ version: 0, elements: [{ ...element(), type }] }).elements[0].name, 'Horta Norte');
});
test('validação estrita de versão, IDs, tamanho, posição e campos', () => {
  const good = { version: 0, elements: [element()] };
  const bad = [null, [], {}, { ...good, version: -1 }, { ...good, version: 1.5 }, { ...good, version: Number.MAX_SAFE_INTEGER }, { ...good, organizationId: randomUUID() },
    { ...good, elements: Array.from({ length: 21 }, element) }, { ...good, elements: [good.elements[0], good.elements[0]] }];
  for (const patch of [{ id: 'bad' }, { name: ' ' }, { name: 'x'.repeat(81) }, { type: 'HOUSE' }, { propertyId: randomUUID() },
    { position: { x: -1, y: 0 } }, { position: { x: 0, y: 1.1 } }, { position: { x: '0', y: 0 } }, { position: { x: NaN, y: 0 } },
    { position: { x: 0, y: 0, lat: 12 } }, { productionIds: ['bad'] }, { cropIds: [randomUUID(), 'bad'] }, { productionIds: null }, { cropIds: Array.from({ length: 11 }, randomUUID) }]) bad.push({ ...good, elements: [{ ...element(), ...patch }] });
  for (const body of bad) assert.throws(() => validateLayout(body), { code: 'INVALID_INPUT' });
});
test('falha de persistência é propagada sem falso sucesso; somente duplicidade vira conflito', async () => {
  const failure = new Error('database unavailable');
  const db = { collection: name => name === 'farmLayouts' ? { insertOne: async () => { throw failure; }, updateOne: async () => { throw failure; } } : { find: () => ({ toArray: async () => [] }) } };
  const context = { organizationId: randomUUID() }; const property = { _id: randomUUID() };
  for (const version of [0, 1]) await assert.rejects(saveLayout(db, property, context, { version, elements: [] }), error => error === failure);
  failure.code = 11000;
  await assert.rejects(saveLayout(db, property, context, { version: 0, elements: [] }), { code: 'LAYOUT_VERSION_CONFLICT' });
});
