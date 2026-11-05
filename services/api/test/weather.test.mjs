import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherProvider } from '../src/weather.mjs';
const property = { _id: 'fixture', municipality: 'São Paulo', uf: 'SP', coordinates: { latitude: -23.55, longitude: -46.63, verified: true, consent: true } };
test('sem configuração não chama fonte nem inventa clima', async () => {
  let calls = 0; const get = weatherProvider({ enabled: false, apiKey: 'test-key', fetcher: () => { calls++; } });
  assert.equal((await get(property)).status, 'unavailable'); assert.equal(calls, 0);
});
test('sem coordenadas ou município não inventa localização', async () => {
  const get = weatherProvider({ enabled: true, apiKey: 'test-key', fetcher: () => { throw new Error('Não chamar'); } });
  assert.equal((await get({ ...property, coordinates: undefined, municipality: undefined })).reason, 'PROPERTY_LOCALITY_REQUIRED');
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

// Respostas abaixo são fixtures de contrato, não consultas reais à OpenWeather.
class LocationStore {
  rows = new Map();
  async findOne({ _id }) { return this.rows.get(_id); }
  async updateOne({ _id }, update) { const row = { ...this.rows.get(_id), ...update.$set }; for (const field of Object.keys(update.$unset || {})) delete row[field]; this.rows.set(_id, row); }
}
const city = { _id: 'city-fixture', organizationId: 'org-fixture', municipality: 'São Paulo', uf: 'SP' };
const geo = [{ name: 'São Paulo', state: 'São Paulo', country: 'BR', lat: -23.55, lon: -46.63 }];
const observation = () => ({ dt: Math.floor(Date.now()/1000), main: { temp: 22, humidity: 70 }, weather: [{ description: 'fixture meteorológica de teste' }], sys: { country: 'BR' } });
const jsonResponse = value => ({ ok: true, json: async () => value });
test('geocodifica município/UF/BR, persiste aproximação e reutiliza em outra instância', async () => {
  const store = new LocationStore(); let geoCalls = 0;
  const fetcher = async url => { if(url.pathname.includes('/geo/')) { geoCalls++; assert.equal(url.searchParams.get('q'), 'São Paulo,BR'); return jsonResponse(geo); } return jsonResponse(observation()); };
  const options = { enabled: true, apiKey: 'fixture-key', locationStore: store, fetcher };
  const first = await weatherProvider(options)(city); assert.equal(first.status, 'available'); assert.equal(first.locality.approximate, true); assert.equal(first.locality.precision, 'municipality');
  await weatherProvider(options)(city); assert.equal(geoCalls, 1); assert.equal(store.rows.size, 1);
});
test('geocodificação ambígua é recusada e a falha é armazenada', async () => {
  const store = new LocationStore(); let calls = 0;
  const fetcher = async () => { calls++; return jsonResponse([...geo, { ...geo[0], lat: -23.7 }]); };
  const options = { enabled: true, apiKey: 'fixture-key', locationStore: store, fetcher };
  assert.equal((await weatherProvider(options)(city)).reason, 'AMBIGUOUS_LOCALITY');
  assert.equal((await weatherProvider(options)(city)).reason, 'AMBIGUOUS_LOCALITY'); assert.equal(calls, 1);
});
test('não aceita cidade homônima de outro estado ou país, nem resultado sem estado', async () => {
  for(const patch of [{ state:'Paraná' }, { country:'PT' }, { state:undefined }, { name:'Outra cidade' }, { lat:'-23.55' }]) {
    const get=weatherProvider({ enabled:true, apiKey:'fixture-key', fetcher:async()=>jsonResponse([{...geo[0],...patch}]) });
    assert.equal((await get(city)).status,'unavailable');
  }
});
test('troca de município muda a consulta, o cache e a localidade retornada', async () => {
  const calls=[];
  const fetcher=async url=>{ calls.push(url); if(url.pathname.includes('/geo/')) return jsonResponse(url.searchParams.get('q').startsWith('Campinas') ? [{ name:'Campinas', state:'São Paulo',country:'BR',lat:-22.9,lon:-47.06 }] : geo); return jsonResponse(observation()); };
  const get=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher,locationStore:new LocationStore()});
  const first=await get(city); const second=await get({...city,municipality:'Campinas'});
  assert.equal(first.locality.municipality,'São Paulo'); assert.equal(second.locality.municipality,'Campinas');
  assert.equal(calls.filter(u=>u.pathname.includes('/geo/')).length,2);
});
test('coordenadas verificadas e consentidas têm precedência; coordenada inválida é recusada', async () => {
  const calls=[];
  const get=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher:async url=>{calls.push(url);return jsonResponse(observation());}});
  assert.equal((await get(property)).locality.precision,'property'); assert.ok(calls.every(u=>!u.pathname.includes('/geo/')));
  assert.equal((await get({...property,coordinates:{...property.coordinates,latitude:100}})).reason,'INVALID_PROPERTY_COORDINATES');
});
test('sem consentimento/verificação usa apenas a referência municipal, sem GPS automático', async () => {
  let geocoded=false;
  const get=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher:async url=> { if(url.pathname.includes('/geo/')){geocoded=true;return jsonResponse(geo);}return jsonResponse(observation());}});
  const result=await get({...property,coordinates:{latitude:0,longitude:0}}); assert.equal(result.locality.approximate,true); assert.equal(geocoded,true);
});
test('timeout e rate limit têm falhas sanitizadas e cooldown', async () => {
  const timeout=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher:async()=>{throw new DOMException('fixture','TimeoutError');}});
  assert.equal((await timeout(property)).reason,'TIMEOUT');
  let calls=0; const limited=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher:async()=>{calls++;return {ok:false,status:429};}});
  assert.equal((await limited(property)).reason,'RATE_LIMITED');
  assert.equal((await limited({...property,_id:'other'})).reason,'RATE_LIMITED'); assert.equal(calls,1);
});
test('limite local impede consumo acima do orçamento por minuto', async()=>{
  let calls=0; const get=weatherProvider({enabled:true,apiKey:'fixture-key',requestsPerMinute:1,fetcher:async()=>{calls++;return jsonResponse(observation());}});
  assert.equal((await get(property)).status,'available'); assert.equal((await get({...property,_id:'other'})).reason,'RATE_LIMITED'); assert.equal(calls,1);
});
test('cache não mantém observação expirada e deduplica chamadas simultâneas', async()=>{
  let time=Date.now(); let calls=0; const dt=(time-7199000)/1000;
  const get=weatherProvider({enabled:true,apiKey:'fixture-key',now:()=>time,fetcher:async()=>{calls++; await Promise.resolve(); return jsonResponse({...observation(),dt});}});
  await Promise.all([get(property),get(property)]); assert.equal(calls,1);
  time+=2000; assert.equal((await get(property)).reason,'INVALID_OBSERVATION'); assert.equal(calls,2);
});
test('resposta meteorológica inválida não gera observação', async()=>{
  for(const body of [null,{}, {...observation(),main:{temp:NaN,humidity:50}}, {...observation(),main:{temp:22,humidity:101}}, {...observation(),sys:{country:'ES'}}, {...observation(),weather:[{description:''}]}]) {
    const get=weatherProvider({enabled:true,apiKey:'fixture-key',fetcher:async()=>jsonResponse(body)}); assert.equal((await get(property)).status,'unavailable');
  }
});

test('habilitado sem chave não consulta o provedor', async () => {
  const get = weatherProvider({ enabled: true, apiKey: '', fetcher: async () => { throw new Error('não deve executar'); } });
  assert.equal((await get(property)).reason, 'NOT_CONFIGURED');
});
test('timeout cancela efetivamente o fetch pelo AbortSignal', async () => {
  let aborted = false;
  const get = weatherProvider({enabled:true,apiKey:'fixture-key',timeoutMs:5,fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{
    const keepAlive=setTimeout(()=>resolve(jsonResponse(observation())),100);
    signal.addEventListener('abort',()=>{aborted=true;clearTimeout(keepAlive);reject(signal.reason);},{once:true});
  })});
  assert.equal((await get(property)).reason,'TIMEOUT'); assert.equal(aborted,true);
});
