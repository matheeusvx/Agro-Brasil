// Chave exclusivamente no processo backend; nenhum URL/chave vai para respostas/logs.
export function weatherProvider({ enabled = process.env.WEATHER_ENABLED === 'true', apiKey = process.env.OPENWEATHER_API_KEY, fetcher = fetch, now = () => Date.now() } = {}) {
  const cache = new Map();
  const unavailable = reason => ({ status: 'unavailable', reason, message: 'Clima indisponível' });
  return async property => {
    if (!enabled || !apiKey) return unavailable('NOT_CONFIGURED');
    const { latitude, longitude } = property.coordinates || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return unavailable('PROPERTY_COORDINATES_REQUIRED');
    const scope = `${property._id}:${latitude}:${longitude}`;
    const cached = cache.get(scope); if (cached && cached.until > now()) return cached.value;
    let result;
    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), appid: apiKey, units: 'metric', lang: 'pt_br' }).toString();
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
      if (!response.ok) throw new Error('Provider unavailable');
      const data = await response.json(); const age = now() - data.dt * 1000;
      if (!Number.isFinite(data.main?.temp) || !Number.isFinite(data.main?.humidity) || data.main.humidity < 0 || data.main.humidity > 100 || !Number.isFinite(age) || age < -600000 || age > 7200000 || typeof data.weather?.[0]?.description !== 'string') throw new Error('Invalid observation');
      result = { status: 'available', source: 'OpenWeather', attributionUrl: 'https://openweathermap.org/', temperatureC: data.main.temp, humidityPercent: data.main.humidity,
        description: data.weather[0].description.slice(0, 120), observedAt: new Date(data.dt * 1000).toISOString(), locality: { municipality: property.municipality, uf: property.uf }, limitation: 'Condição meteorológica da localidade; não mede irrigação nem umidade do solo.' };
    } catch { result = unavailable('PROVIDER_UNAVAILABLE'); }
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(scope, { until: now() + (result.status === 'available' ? 600000 : 60000), value: result });
    return result;
  };
}
