import { resolveWeatherLocation } from './weather-location.mjs';
// Chave somente no backend. Nunca registrar erros/URLs autenticados do fetch.
export function weatherProvider({ enabled = process.env.WEATHER_ENABLED === 'true', apiKey = process.env.OPENWEATHER_API_KEY, fetcher = fetch, now = () => Date.now(), locationStore, requestsPerMinute = 50, timeoutMs = 4000 } = {}) {
  const cache = new Map(); const pending = new Map();
  let windowStart = now(); let requests = 0; let blockedUntil = 0;
  const unavailable = reason => ({ status: 'unavailable', reason, message: 'Clima indisponível' });
  async function request(path, parameters) {
    if (now() < blockedUntil) throw new Error('RATE_LIMITED');
    if (now() - windowStart >= 60000) { windowStart = now(); requests = 0; }
    if (requests >= requestsPerMinute) throw new Error('RATE_LIMITED');
    requests++;
    const url = new URL(path, 'https://api.openweathermap.org');
    url.search = new URLSearchParams({ ...parameters, appid: apiKey }).toString();
    const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (response.status === 429) { blockedUntil = now() + 60000; throw new Error('RATE_LIMITED'); }
    if (!response.ok) { if (response.status === 401 || response.status === 403) blockedUntil = now() + 60000; throw new Error('PROVIDER_UNAVAILABLE'); }
    return response.json();
  }
  async function load(property, scope) {
    let result;
    try {
      const location = await resolveWeatherLocation(property, { request, store: locationStore, now });
      const data = await request('/data/2.5/weather', { lat: String(location.latitude), lon: String(location.longitude), units: 'metric', lang: 'pt_br' });
      const age = now() - data?.dt * 1000;
      if (!Number.isFinite(data?.main?.temp) || data.main.temp < -100 || data.main.temp > 70 || !Number.isFinite(data.main.humidity) || data.main.humidity < 0 || data.main.humidity > 100 || !Number.isFinite(age) || age < -600000 || age > 7200000 || typeof data.weather?.[0]?.description !== 'string' || !data.weather[0].description.trim() || (data.sys?.country && data.sys.country !== 'BR')) throw new Error('INVALID_OBSERVATION');
      result = { status: 'available', source: 'OpenWeather', attributionUrl: 'https://openweathermap.org/', temperatureC: data.main.temp, humidityPercent: data.main.humidity,
        description: data.weather[0].description.slice(0,120), observedAt: new Date(data.dt * 1000).toISOString(), fetchedAt: new Date(now()).toISOString(), cached: false,
        locality: { municipality: property.municipality, uf: property.uf, source: location.source, precision: location.precision, approximate: location.approximate },
        limitation: 'Condição meteorológica de referência; não mede solo, irrigação ou risco hídrico individual.' };
    } catch (error) {
      const allowed = ['AMBIGUOUS_LOCALITY','LOCALITY_NOT_FOUND','INVALID_GEOCODING_RESPONSE','PROPERTY_LOCALITY_REQUIRED','INVALID_PROPERTY_COORDINATES','RATE_LIMITED','INVALID_OBSERVATION'];
      result = unavailable(allowed.includes(error.message) ? error.message : error.name === 'TimeoutError' || error.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE');
    }
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    const observationDeadline = result.status === 'available' ? Date.parse(result.observedAt) + 7200000 : Infinity;
    cache.set(scope, { until: Math.min(now() + (result.status === 'available' ? 600000 : 60000), observationDeadline), value: result });
    return result;
  }
  return async property => {
    if (!enabled || !apiKey?.trim()) return unavailable('NOT_CONFIGURED');
    const scope = JSON.stringify([property._id, property.organizationId, property.municipality, property.uf, property.coordinates]);
    const cached = cache.get(scope);
    if (cached && cached.until > now()) return { ...cached.value, ...(cached.value.status === 'available' ? { cached: true } : {}) };
    if (pending.has(scope)) return pending.get(scope);
    const promise = load(property, scope); pending.set(scope, promise);
    try { return await promise; } finally { pending.delete(scope); }
  };
}
