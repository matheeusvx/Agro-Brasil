import { createHash, randomUUID } from 'node:crypto';
import { HttpError, invalid, text, uuid } from './domain.mjs';

export const conflict = message => { throw new HttpError(409, 'CONFLICT', message); };
export const missing = () => { throw new HttpError(404, 'NOT_FOUND', 'Operação não encontrada ou não autorizada.'); };
export function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) invalid('Objeto JSON com campos permitidos é obrigatório.');
}
export function grams(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e9 || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-5) invalid('quantityKg: número positivo, até três casas decimais e máximo 1e9 kg.');
  return Math.round(value * 1000);
}
export function confirmedLocation(body) {
  const location = body.location;
  if (!location || typeof location !== 'object' || Array.isArray(location) || Object.keys(location).some(k => !['municipality', 'uf'].includes(k))) invalid('Informe município e UF da operação.');
  const municipality = text(location.municipality, 'location.municipality', 120);
  if (!'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(location.uf) || body.locationConfirmed !== true) invalid('UF válida e confirmação explícita da localização são obrigatórias.');
  return { municipality, uf: location.uf };
}
export function offerInput(body) {
  fields(body, ['lotId', 'quantityKg', 'availableUntil', 'destinationMode', 'unitPriceCents']);
  const until = body.availableUntil;
  if (typeof until !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(until) || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now()) invalid('availableUntil: horário UTC futuro em ISO-8601.');
  const normalized = new Date(until).toISOString();
  if (until !== normalized && until !== normalized.replace('.000Z', 'Z')) invalid('availableUntil: data inexistente ou horário inválido.');
  if (!['VENDA', 'DOACAO'].includes(body.destinationMode)) invalid('destinationMode: VENDA ou DOACAO.');
  const price = body.unitPriceCents;
  if (body.destinationMode === 'VENDA' ? !Number.isSafeInteger(price) || price <= 0 || price > 1e9 : price !== undefined && price !== 0) invalid('Informe preço inteiro em centavos por kg para venda; doação deve ter valor zero.');
  return { lotId: uuid(body.lotId, 'lotId'), quantityGrams: grams(body.quantityKg), availableUntil: new Date(until).toISOString(), destinationMode: body.destinationMode, unitPriceCents: price || 0 };
}
export function page(query) {
  const { limit = '50', offset = '0' } = query;
  if (typeof limit !== 'string' || !/^\d+$/.test(limit) || +limit < 1 || +limit > 100 || typeof offset !== 'string' || !/^\d+$/.test(offset) || +offset > 100000) invalid('Paginação: limit 1–100; offset 0–100000.');
  return { limit: +limit, offset: +offset };
}
export function publicOffer(o) {
  return { id: o._id, lotId: o.lotId, sellerOrganizationId: o.sellerOrganizationId, sellerName: o.sellerName,
    cropName: o.cropName, territory: o.territory, quantityKg: o.quantityGrams / 1000, availableKg: o.availableGrams / 1000,
    destinationMode: o.destinationMode, unitPriceCents: o.unitPriceCents, availableUntil: o.availableUntil, status: o.status, isDemonstration: o.isDemonstration };
}
export function publicOrder(o) {
  const { _id, createdBy: _privateUser, ...rest } = o;
  if (rest.shipment?.receipt) {
    const { receivedBy: _privateReceiver, ...receipt } = rest.shipment.receipt;
    rest.shipment = { ...rest.shipment, receipt };
  }
  return { id: _id, ...rest, quantityKg: o.quantityGrams / 1000 };
}
export function traceEvent(context, { lotId, orderId, operationId, type, location, quantityGrams }) {
  const now = new Date().toISOString();
  return { _id: randomUUID(), lotId, orderId: orderId || null, operationId, type, occurredAt: now, recordedAt: now,
    responsibleUserId: context.userId, responsibleOrganizationId: context.organizationId,
    location, locationConfirmedBy: context.userId, locationConfirmedAt: now, quantityGrams,
    isDemonstration: context.isDemonstration };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const hash = text => createHash('sha256').update(text).digest('hex');
export function commandIdentity(req) {
  const key = req.get('Idempotency-Key');
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) invalid('Idempotency-Key obrigatório: 8–128 letras, números, _ ou -.');
  return { id: hash(JSON.stringify([req.context.userId, req.context.organizationId, req.method, req.path, key])), fingerprint: hash(JSON.stringify(canonical(req.body))) };
}
