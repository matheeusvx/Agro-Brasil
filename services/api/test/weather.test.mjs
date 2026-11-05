import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherProvider } from '../src/weather.mjs';
const property = { _id: 'fixture', municipality: 'São Paulo', uf: 'SP', coordinates: { latitude: -23.55, longitude: -46.63 } };
test('sem configuração não chama fonte nem inventa clima', async () => {
  let calls = 0; const get = weatherProvider({ enabled: false, apiKey: 'test-key', fetcher: () => { calls++; } });
  assert.equal((await get(property)).status, 'unavailable'); assert.equal(calls, 0);
});
test('sem coordenadas cadastradas não geocodifica por suposição', async () => {
  const get = weatherProvider({ enabled: true, apiKey: 'test-key', fetcher: () => { throw new Error('Não chamar'); } });
  assert.equal((await get({ ...property, coordinates: undefined })).reason, 'PROPERTY_COORDINATES_REQUIRED');
});
test('usa coordenadas da propriedade, valida resposta e mantém chave no servidor', async () => {
  let calls = 0;
  const get = weatherProvider({ enabled: true, apiKey: 'test-key', fetcher: async url => { calls++; assert.equal(url.hostname, 'api.openweathermap.org'); assert.equal(url.searchParams.get('lat'), '-23.55'); return { ok: true, json: async () => ({ dt: Date.now() / 1000, main: { temp: 22, humidity: 70 }, weather: [{ description: 'Fixture de contrato, não observação real' }] }) }; } });
  const result = await get(property); assert.equal(result.status, 'available'); assert.equal(result.source, 'OpenWeather'); assert.ok(!JSON.stringify(result).includes('test-key'));
  await get(property); assert.equal(calls, 1);
});
test('erro do provedor retorna indisponível sem chave ou URL', async () => {
  const get = weatherProvider({ enabled: true, apiKey: 'test-key', fetcher: async () => { throw new Error('test-key'); } });
  const result = await get(property); assert.equal(result.status, 'unavailable'); assert.ok(!JSON.stringify(result).includes('test-key'));
});
test('dado antigo ou inválido não se apresenta como clima atual', async () => {
  const get = weatherProvider({ enabled: true, apiKey: 'test-key', fetcher: async () => ({ ok: true, json: async () => ({ dt: 1, main: { temp: 22, humidity: 70 }, weather: [{ description: 'fixture' }] }) }) });
  assert.equal((await get(property)).status, 'unavailable');
});
