import { createHash } from 'node:crypto';
const normalize = value => typeof value === 'string' ? value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
const stateNames = ['Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'];
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const states = Object.fromEntries(ufs.map((uf, i) => [uf, normalize(stateNames[i])]));
export const validCoordinates = c => c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180;
export function selectMunicipality(results, municipality, uf) {
  if (!Array.isArray(results)) throw new Error('INVALID_GEOCODING_RESPONSE');
  const matching = results.filter(r => r && r.country === 'BR' && [normalize(uf), states[uf]].includes(normalize(r.state)) && [r.name, r.local_names?.pt].some(n => normalize(n) === normalize(municipality)) && validCoordinates({ latitude: r.lat, longitude: r.lon }));
  const distinct = [...new Map(matching.map(r => [`${r.lat}:${r.lon}`, r])).values()];
  if (distinct.length !== 1) throw new Error(distinct.length > 1 ? 'AMBIGUOUS_LOCALITY' : 'LOCALITY_NOT_FOUND');
  return { latitude: distinct[0].lat, longitude: distinct[0].lon, source: 'OpenWeather Geocoding', precision: 'municipality', approximate: true };
}
export function locationIdentity(property) {
  return createHash('sha256').update(JSON.stringify([property._id, property.organizationId, normalize(property.municipality), property.uf])).digest('hex');
}
export async function resolveWeatherLocation(property, { request, store, now }) {
  // Não inferir verificação/consentimento de uma simples latitude/longitude legada.
  if (property.coordinates?.verified === true && property.coordinates?.consent === true) {
    if (!validCoordinates(property.coordinates)) throw new Error('INVALID_PROPERTY_COORDINATES');
    return { latitude: property.coordinates.latitude, longitude: property.coordinates.longitude, source: 'property', precision: 'property', approximate: false };
  }
  if (!normalize(property.municipality) || !states[property.uf]) throw new Error('PROPERTY_LOCALITY_REQUIRED');
  const id = locationIdentity(property);
  const cached = await store?.findOne({ _id: id });
  if (cached?.expiresAt > now()) {
    if (cached.reason) throw new Error(cached.reason);
    if (validCoordinates(cached.location) && cached.location.approximate === true && cached.location.source === 'OpenWeather Geocoding') return cached.location;
  }
  let location;
  try {
    const results = await request('/geo/1.0/direct', { q: `${property.municipality.trim()},BR`, limit: '5' });
    location = selectMunicipality(results, property.municipality, property.uf);
  } catch (error) {
    if (['AMBIGUOUS_LOCALITY','LOCALITY_NOT_FOUND'].includes(error.message)) await store?.updateOne({ _id: id }, { $set: { reason: error.message, expiresAt: now() + 86400000 }, $unset: { location: '' } }, { upsert: true });
    throw error;
  }
  await store?.updateOne({ _id: id }, { $set: { location, municipality: property.municipality, uf: property.uf, resolvedAt: new Date(now()).toISOString(), expiresAt: now() + 30 * 86400000 }, $unset: { reason: '' } }, { upsert: true });
  return location;
}
