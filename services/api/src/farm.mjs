import { Router } from 'express';
import { canWriteProduction } from './auth.mjs';
import { HttpError } from './domain.mjs';
import { page } from './commerce-domain.mjs';
import { ownedProperty, propertyView } from './producer-home.mjs';
import { layoutView, validateLayout } from './farm-domain.mjs';

const editable = context => context.organizationType === 'PEQUENO_PRODUTOR_RURAL' && ['ADMIN', 'EDITOR'].includes(context.role);
const stale = () => new HttpError(409, 'LAYOUT_VERSION_CONFLICT', 'Configuração alterada. Recarregue antes de salvar novamente.');
// Acknowledged customizations must reach the journal before returning success.
const durableWrite = { writeConcern: { w: 'majority', j: true } };

export async function saveLayout(db, property, context, input) {
  const filter = { organizationId: context.organizationId, propertyId: property._id };
  const productionIds = [...new Set(input.elements.flatMap(e => e.productionIds))];
  const cropIds = [...new Set(input.elements.flatMap(e => e.cropIds))];
  const [productions, crops] = await Promise.all([
    db.collection('productions').find({ ...filter, _id: { $in: productionIds } }, { projection: { cropId: 1 } }).toArray(),
    db.collection('crops').find({ _id: { $in: cropIds }, status: 'ATIVA' }, { projection: { _id: 1 } }).toArray()
  ]);
  if (productions.length !== productionIds.length || crops.length !== cropIds.length || input.elements.some(e => e.cropIds.length && productions.some(p => e.productionIds.includes(p._id) && !e.cropIds.includes(p.cropId)))) {
    throw new HttpError(400, 'INVALID_REFERENCE', 'Produção ou cultura não disponível ou incompatível com o setor.');
  }
  const document = { _id: property._id, ...filter, schemaVersion: 1, version: input.version + 1, elements: input.elements, updatedAt: new Date().toISOString(), updatedBy: context.userId };
  if (input.version === 0) {
    try { await db.collection('farmLayouts').insertOne(document, durableWrite); }
    catch (error) { if (error.code === 11000) throw stale(); throw error; }
  } else {
    const { _id, ...update } = document;
    const result = await db.collection('farmLayouts').updateOne({ _id, ...filter, version: input.version }, { $set: update }, durableWrite);
    if (!result.matchedCount) throw stale();
  }
  return layoutView(document, property._id, editable(context));
}

// Bounded, batched reads: production page plus at most 200 explicitly linked productions.
export async function farmOverview(db, property, context, layout, pagination) {
  const filter = { organizationId: context.organizationId, propertyId: property._id };
  const projection = { cropId: 1, cropName: 1, seasonLabel: 1, harvestedOn: 1, quantityKg: 1, 'lot.id': 1, 'lot.status': 1, 'lot.events': 1 };
  const [summaryRows, paged, linked] = await Promise.all([
    db.collection('productions').aggregate([{ $match: filter }, { $facet: {
      totals: [{ $group: { _id: null, productionCount: { $sum: 1 }, registeredQuantityKg: { $sum: '$quantityKg' } } }],
      crops: [{ $group: { _id: '$cropId', name: { $first: '$cropName' }, productionCount: { $sum: 1 }, registeredQuantityKg: { $sum: '$quantityKg' } } }, { $sort: { _id: 1 } }, { $limit: 101 }]
    } }]).toArray(),
    db.collection('productions').find(filter, { projection }).sort({ createdAt: -1, _id: -1 }).skip(pagination.offset).limit(pagination.limit).toArray(),
    db.collection('productions').find({ ...filter, _id: { $in: [...new Set(layout.elements.flatMap(e => e.productionIds))] } }, { projection }).toArray()
  ]);
  const productions = [...new Map([...paged, ...linked].map(p => [p._id, p])).values()];
  const lotIds = productions.map(p => p.lot.id);
  const [offers, orders, events, recentOrders] = await Promise.all([
    db.collection('offers').find({ sellerOrganizationId: context.organizationId, lotId: { $in: lotIds } }, { projection: { lotId: 1, status: 1, quantityGrams: 1, availableGrams: 1, reservedGrams: 1, dispatchedGrams: 1, receivedGrams: 1, availableUntil: 1 } }).toArray(),
    db.collection('orders').aggregate([{ $match: { sellerOrganizationId: context.organizationId, lotId: { $in: lotIds } } },
      { $group: { _id: { lotId: '$lotId', status: '$status' }, count: { $sum: 1 }, quantityGrams: { $sum: '$quantityGrams' } } }]).toArray(),
    db.collection('traceEvents').aggregate([{ $match: { lotId: { $in: lotIds } } },
      { $group: { _id: '$lotId', recent: { $topN: { n: 3, sortBy: { recordedAt: -1, _id: -1 }, output: { id: '$_id', type: '$type', recordedAt: '$recordedAt', orderId: '$orderId' } } } } }]).toArray(),
    db.collection('orders').aggregate([{ $match: { sellerOrganizationId: context.organizationId, lotId: { $in: lotIds } } },
      { $group: { _id: '$lotId', recent: { $topN: { n: 3, sortBy: { createdAt: -1, _id: -1 }, output: {
        id: '$_id', status: '$status', quantityKg: { $divide: ['$quantityGrams', 1000] },
        shipmentId: { $ifNull: ['$shipment.id', null] }, shipmentStatus: { $ifNull: ['$shipment.status', null] }, carrierOrganizationId: { $ifNull: ['$shipment.carrierOrganizationId', null] }
      } } } } }]).toArray()
  ]);
  const offerMap = new Map(offers.map(o => [o.lotId, o]));
  const eventMap = new Map(events.map(e => [e._id, e.recent]));
  const recentOrderMap = new Map(recentOrders.map(o => [o._id, o.recent]));
  const orderMap = new Map();
  for (const o of orders) { const rows = orderMap.get(o._id.lotId) || []; rows.push({ status: o._id.status, count: o.count, quantityKg: o.quantityGrams / 1000 }); orderMap.set(o._id.lotId, rows); }
  const operations = new Map(productions.map(p => {
    const offer = offerMap.get(p.lot.id);
    const orderStates = orderMap.get(p.lot.id) || [];
    const writable = editable(context);
    return [p._id, { id: p._id, cropId: p.cropId, cropName: p.cropName, seasonLabel: p.seasonLabel, harvestedOn: p.harvestedOn, registeredQuantityKg: p.quantityKg,
      lot: { id: p.lot.id, status: p.lot.status, recentEvents: eventMap.get(p.lot.id) || p.lot.events.slice(0, 1).map(e => ({ id: e.id, type: e.type, recordedAt: e.recordedAt, orderId: null })) },
      offer: offer ? { id: offer._id, status: offer.status, quantityKg: offer.quantityGrams / 1000, availableKg: offer.availableGrams / 1000, reservedKg: offer.reservedGrams / 1000, dispatchedKg: offer.dispatchedGrams / 1000, receivedKg: offer.receivedGrams / 1000, availableUntil: offer.availableUntil } : null,
      orderStates, recentOrders: recentOrderMap.get(p.lot.id) || [], actions: { viewProduction: true, viewLot: true, viewOrders: true, createOffer: writable && !offer,
        publishOffer: writable && offer?.status === 'RASCUNHO' && offer.availableUntil > new Date().toISOString(),
        acceptOrders: writable && orderStates.some(o => o.status === 'SOLICITADO'), pickupOrders: writable && orderStates.some(o => o.status === 'ACEITO') } }];
  }));
  const totals = summaryRows[0].totals[0] || { productionCount: 0, registeredQuantityKg: 0 };
  const { _id, ...summary } = totals;
  return { property: propertyView(property), layoutVersion: layout.version, layoutState: layout.state, isGeoreferenced: false,
    summary: { ...summary, crops: summaryRows[0].crops.slice(0, 100).map(({ _id, ...c }) => ({ cropId: _id, ...c })), cropsTruncated: summaryRows[0].crops.length > 100 },
    productions: paged.map(p => operations.get(p._id)), pagination: { ...pagination, total: summary.productionCount },
    elements: layout.elements.map(e => { const rows = e.productionIds.map(id => operations.get(id)).filter(Boolean); return {
      id: e.id, scope: 'LINKED_PRODUCTIONS', productionCount: rows.length, missingProductionIds: e.productionIds.filter(id => !operations.has(id)),
      state: rows.some(p => p.orderStates.some(o => ['SOLICITADO', 'ACEITO'].includes(o.status))) ? 'ACTION_PENDING' : rows.length ? 'HAS_LOTS' : 'NO_LINKED_PRODUCTIONS', productions: rows
    }; }), canEditLayout: editable(context), isDemonstration: context.isDemonstration, fetchedAt: new Date().toISOString() };
}

export function farmRouter(db) {
  const router = Router();
  const load = (property, context) => db.collection('farmLayouts').findOne({ _id: property._id, organizationId: context.organizationId });
  router.get('/properties/:id/farm-layout', async (req, res) => {
    const property = await ownedProperty(db, req);
    res.json({ data: layoutView(await load(property, req.context), property._id, editable(req.context)) });
  });
  router.put('/properties/:id/farm-layout', canWriteProduction, async (req, res) => {
    const property = await ownedProperty(db, req);
    res.json({ data: await saveLayout(db, property, req.context, validateLayout(req.body)) });
  });
  router.get('/properties/:id/farm-overview', async (req, res) => {
    const property = await ownedProperty(db, req);
    const pagination = page(req.query);
    const layout = layoutView(await load(property, req.context), property._id, editable(req.context));
    res.json({ data: await farmOverview(db, property, req.context, layout, pagination) });
  });
  return router;
}
