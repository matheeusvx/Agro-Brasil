import { Router } from 'express';
import { HttpError, uuid } from './domain.mjs';

export async function ownedProperty(db, req) {
  const id = uuid(req.params.id || req.query.propertyId, 'propertyId');
  const property = await db.collection('properties').findOne({ _id: id, organizationId: req.context.organizationId, status: 'ATIVA' });
  if (!property) throw new HttpError(404, 'NOT_FOUND', 'Propriedade não encontrada.');
  return property;
}
export function propertyView(p) { return { id: p._id, name: p.name, municipality: p.municipality || null, uf: p.uf || null }; }
export function producerHomeRouter(db, weather) {
  const router = Router();
  router.get('/producer-home', async (req, res) => {
    if (req.context.organizationType !== 'PEQUENO_PRODUTOR_RURAL') throw new HttpError(403, 'FORBIDDEN', 'Esta experiência é do pequeno produtor rural.');
    const property = await ownedProperty(db, req);
    const productions = await db.collection('productions').find({ organizationId: req.context.organizationId, propertyId: property._id }, { projection: { lot: 1, cropName: 1, quantityKg: 1, createdAt: 1 } }).toArray();
    const lotIds = productions.map(p => p.lot.id);
    const pending = await db.collection('orders').aggregate([
      { $match: { sellerOrganizationId: req.context.organizationId, lotId: { $in: lotIds }, status: { $in: ['SOLICITADO', 'ACEITO', 'RETIRADO'] } } },
      { $addFields: { priority: { $switch: { branches: [{ case: { $eq: ['$status', 'SOLICITADO'] }, then: 0 }, { case: { $eq: ['$status', 'ACEITO'] }, then: 1 }], default: 2 } } } },
      { $sort: { priority: 1, createdAt: 1, _id: 1 } }, { $limit: 2 }
    ]).toArray();
    const movements = await db.collection('traceEvents').aggregate([
      { $match: { lotId: { $in: lotIds } } }, { $sort: { recordedAt: -1, _id: -1 } },
      { $group: { _id: '$lotId', event: { $first: '$$ROOT' } } }, { $sort: { 'event.recordedAt': -1 } }, { $limit: 2 }
    ]).toArray();
    const candidates = [...productions.map(p => ({ lotId: p.lot.id, event: p.lot.events[0] })), ...movements.map(m => ({ lotId: m._id, event: m.event }))];
    candidates.sort((a, b) => b.event.recordedAt.localeCompare(a.event.recordedAt));
    const recent = [];
    for (const item of candidates) {
      if (recent.some(r => r.id === item.lotId)) continue;
      const p = productions.find(p => p.lot.id === item.lotId);
      recent.push({ id: item.lotId, cropName: p.cropName, quantityKg: p.quantityKg, lastEvent: { type: item.event.type, recordedAt: item.event.recordedAt, location: item.event.location } });
      if (recent.length === 2) break;
    }
    res.json({ property: propertyView(property), hasProductions: productions.length > 0,
      pending: pending.map(o => ({ id: o._id, lotId: o.lotId, status: o.status, quantityKg: o.quantityGrams / 1000, cropName: productions.find(p => p.lot.id === o.lotId)?.cropName, shipmentId: o.shipment?.id || null, carrierOrganizationId: o.shipment?.carrierOrganizationId || null })),
      recentLots: recent, canWrite: ['ADMIN', 'EDITOR'].includes(req.context.role), isDemonstration: req.context.isDemonstration, fetchedAt: new Date().toISOString() });
  });
  router.get('/properties/:id/weather', async (req, res) => {
    const property = await ownedProperty(db, req);
    res.json(await weather(property));
  });
  return router;
}
