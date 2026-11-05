import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const invalid = message => { throw new HttpError(400, 'INVALID_INPUT', message); };
export function text(value, field, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(`${field}: texto obrigatório de até ${max} caracteres.`);
  return value.trim();
}
export function uuid(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid(`${field}: UUID inválido.`);
  return value;
}
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function validateProduction(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Envie um objeto JSON.');
  const allowed = ['propertyId', 'cropId', 'seasonLabel', 'quantityKg', 'harvestedOn', 'location', 'locationConfirmed'];
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid('Campo não permitido. Organização e responsável são definidos pelo servidor.');
  if (typeof body.quantityKg !== 'number' || !Number.isFinite(body.quantityKg) || body.quantityKg <= 0 || body.quantityKg > 1e9 || Math.abs(body.quantityKg * 1000 - Math.round(body.quantityKg * 1000)) > 1e-5) invalid('quantityKg: use número positivo em kg, com até três casas decimais.');
  const date = body.harvestedOn;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > now.toISOString().slice(0, 10)) invalid('harvestedOn: data válida YYYY-MM-DD, sem data futura (referência UTC).');
  if (!body.location || typeof body.location !== 'object' || Array.isArray(body.location) || Object.keys(body.location).some(k => !['municipality', 'uf'].includes(k))) invalid('location: informe município e UF.');
  const municipality = text(body.location.municipality, 'location.municipality', 120);
  if (!UFS.has(body.location.uf)) invalid('location.uf: UF brasileira inválida.');
  if (body.locationConfirmed !== true) invalid('Confirme a localização informada.');
  return {
    propertyId: uuid(body.propertyId, 'propertyId'), cropId: uuid(body.cropId, 'cropId'),
    seasonLabel: text(body.seasonLabel, 'seasonLabel', 60), quantityKg: body.quantityKg,
    harvestedOn: date, location: { municipality, uf: body.location.uf }
  };
}
export function productionDocument(input, context, crop, now = new Date()) {
  const id = randomUUID();
  const createdAt = now.toISOString();
  return {
    _id: id, organizationId: context.organizationId, createdBy: context.userId,
    ...input, cropName: crop.name, status: 'REGISTRADA', createdAt,
    isDemonstration: context.isDemonstration,
    lot: {
      id: randomUUID(), productionId: id, ownerOrganizationId: context.organizationId,
      initialQuantityKg: input.quantityKg, status: 'IDENTIFICADO',
      events: [{ id: randomUUID(), type: 'ORIGEM_REGISTRADA', occurredAt: createdAt,
        recordedAt: createdAt, responsibleUserId: context.userId,
        responsibleOrganizationId: context.organizationId, location: input.location,
        locationConfirmedBy: context.userId, locationConfirmedAt: createdAt,
        isDemonstration: context.isDemonstration }]
    }
  };
}
export function publicProduction(document) {
  const { _id, ...rest } = document;
  return { id: _id, ...rest };
}
