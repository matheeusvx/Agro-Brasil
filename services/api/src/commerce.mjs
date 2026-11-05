import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpError, uuid } from './domain.mjs';
import { fields, grams, offerInput, confirmedLocation, page, publicOffer, publicOrder, traceEvent, commandIdentity, conflict, missing } from './commerce-domain.mjs';

const partyFilter = organizationId => ({ $or: [{ sellerOrganizationId: organizationId }, { requesterOrganizationId: organizationId }, { 'shipment.carrierOrganizationId': organizationId }] });
const editable = context => { if (!['ADMIN', 'EDITOR'].includes(context.role)) throw new HttpError(403, 'FORBIDDEN', 'Perfil sem permissão de alteração.'); };
const seller = context => { editable(context); if (context.organizationType !== 'PEQUENO_PRODUTOR_RURAL') throw new HttpError(403, 'FORBIDDEN', 'Somente pequeno produtor rural pode publicar/aceitar.'); };

// Nenhum fallback: escritos entre coleções só são permitidos com transações reais.
export async function assertTransactions(db) {
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Operação exige MongoDB replica set. Reinicie com npm run db:local; nenhum dado foi alterado.');
}
export function commerceRouter(db) {
  const router = Router();
  async function command(req, res, work) {
    editable(req.context);
    const { id, fingerprint } = commandIdentity(req);
    await assertTransactions(db);
    const session = db.client.startSession();
    let replayed = false;
    const replay = entry => {
      if (entry.fingerprint !== fingerprint) conflict('Esta chave de idempotência já foi usada com outro conteúdo.');
      replayed = true; return entry.result;
    };
    let result;
    try {
      result = await session.withTransaction(async () => {
        replayed = false;
        const previous = await db.collection('commands').findOne({ _id: id }, { session });
        if (previous) return replay(previous);
        const response = await work(session);
        await db.collection('commands').insertOne({ _id: id, fingerprint, result: response, createdAt: new Date().toISOString() }, { session });
        return response;
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 10000 });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Corrida da mesma chave: o vencedor já confirmou; perdedor não grava parcialmente.
      const previous = await db.collection('commands').findOne({ _id: id });
      if (!previous) conflict('Já existe oferta para este lote ou operação equivalente.');
      result = replay(previous);
    } finally { await session.endSession(); }
    res.set('Idempotency-Replayed', String(replayed)).status(result.status).json(result.body);
  }
  const response = (data, status = 200) => ({ status, body: { data } });
  async function append(session, context, values) { await db.collection('traceEvents').insertOne(traceEvent(context, values), { session }); }
  async function orderFor(req, session, byShipment = false) {
    const id = uuid(req.params.id, 'id');
    const order = await db.collection('orders').findOne({ ...(byShipment ? { 'shipment.id': id } : { _id: id }), ...partyFilter(req.context.organizationId) }, { session });
    if (!order) missing();
    return order;
  }
  router.get('/cooperatives', async (_req, res) => {
    const rows = await db.collection('organizations').find({ type: 'COOPERATIVA', status: 'ATIVA' }, { projection: { _id: 1, name: 1 } }).limit(100).toArray();
    res.json({ data: rows.map(o => ({ id: o._id, name: o.name })) });
  });
  router.post('/offers', async (req, res) => {
    seller(req.context); const input = offerInput(req.body);
    await command(req, res, async session => {
      const production = await db.collection('productions').findOne({ 'lot.id': input.lotId, organizationId: req.context.organizationId }, { session });
      if (!production) missing();
      if (input.quantityGrams > grams(production.quantityKg)) conflict('Oferta ultrapassa a quantidade do lote.');
      const organization = await db.collection('organizations').findOne({ _id: req.context.organizationId }, { session });
      const offer = { _id: randomUUID(), ...input, availableGrams: input.quantityGrams, reservedGrams: 0, dispatchedGrams: 0, receivedGrams: 0,
        sellerOrganizationId: req.context.organizationId, sellerName: organization.name, cropName: production.cropName,
        territory: production.location, status: 'RASCUNHO', createdAt: new Date().toISOString(), isDemonstration: req.context.isDemonstration };
      await db.collection('offers').insertOne(offer, { session });
      return response(publicOffer(offer), 201);
    });
  });
  router.post('/offers/:id/publish', async (req, res) => {
    seller(req.context); fields(req.body, ['location', 'locationConfirmed']); const location = confirmedLocation(req.body);
    const id = uuid(req.params.id, 'id');
    await command(req, res, async session => {
      const offer = await db.collection('offers').findOne({ _id: id, sellerOrganizationId: req.context.organizationId }, { session });
      if (!offer) missing();
      if (offer.status !== 'RASCUNHO' || offer.availableUntil <= new Date().toISOString()) conflict('Oferta não pode ser publicada neste estado ou prazo.');
      await db.collection('offers').updateOne({ _id: id }, { $set: { status: 'PUBLICADA' } }, { session });
      await append(session, req.context, { lotId: offer.lotId, operationId: id, type: 'OFERTA_PUBLICADA', location, quantityGrams: offer.quantityGrams });
      return response(publicOffer({ ...offer, status: 'PUBLICADA' }));
    });
  });
  router.get('/offers', async (req, res) => {
    const pagination = page(req.query);
    if (req.query.scope !== undefined && req.query.scope !== 'mine') throw new HttpError(400, 'INVALID_INPUT', 'scope permitido: mine.');
    const filter = req.query.scope === 'mine' ? { sellerOrganizationId: req.context.organizationId } : { status: 'PUBLICADA', availableUntil: { $gt: new Date().toISOString() }, availableGrams: { $gt: 0 } };
    const rows = await db.collection('offers').find(filter).sort({ createdAt: -1, _id: -1 }).skip(pagination.offset).limit(pagination.limit).toArray();
    res.json({ data: rows.map(publicOffer), pagination: { ...pagination, total: await db.collection('offers').countDocuments(filter) } });
  });
  router.post('/orders', async (req, res) => {
    if (!['INSTITUICAO', 'COMPRADOR_LOCAL'].includes(req.context.organizationType)) throw new HttpError(403, 'FORBIDDEN', 'A solicitação deve partir de instituição ou comprador local.');
    fields(req.body, ['offerId', 'quantityKg', 'location', 'locationConfirmed']);
    const offerId = uuid(req.body.offerId, 'offerId'); const quantityGrams = grams(req.body.quantityKg); const location = confirmedLocation(req.body);
    await command(req, res, async session => {
      const offer = await db.collection('offers').findOne({ _id: offerId, status: 'PUBLICADA', availableUntil: { $gt: new Date().toISOString() } }, { session });
      if (!offer) missing();
      if (offer.sellerOrganizationId === req.context.organizationId || quantityGrams > offer.availableGrams) conflict('Quantidade solicitada indisponível.');
      const order = { _id: randomUUID(), offerId, lotId: offer.lotId, sellerOrganizationId: offer.sellerOrganizationId,
        requesterOrganizationId: req.context.organizationId, createdBy: req.context.userId, quantityGrams,
        status: 'SOLICITADO', createdAt: new Date().toISOString(), isDemonstration: req.context.isDemonstration };
      await db.collection('orders').insertOne(order, { session });
      await append(session, req.context, { lotId: order.lotId, orderId: order._id, operationId: order._id, type: 'PEDIDO_SOLICITADO', location, quantityGrams });
      return response(publicOrder(order), 201);
    });
  });
  router.get('/orders', async (req, res) => {
    const pagination = page(req.query); const filter = partyFilter(req.context.organizationId);
    const rows = await db.collection('orders').find(filter).sort({ createdAt: -1, _id: -1 }).skip(pagination.offset).limit(pagination.limit).toArray();
    res.json({ data: rows.map(publicOrder), pagination: { ...pagination, total: await db.collection('orders').countDocuments(filter) } });
  });
  router.post('/orders/:id/accept', async (req, res) => {
    seller(req.context); fields(req.body, ['cooperativeOrganizationId', 'location', 'locationConfirmed']);
    const location = confirmedLocation(req.body);
    const carrier = req.body.cooperativeOrganizationId === undefined || req.body.cooperativeOrganizationId === null ? null : uuid(req.body.cooperativeOrganizationId, 'cooperativeOrganizationId');
    await command(req, res, async session => {
      const order = await orderFor(req, session);
      if (order.sellerOrganizationId !== req.context.organizationId) missing();
      if (order.status !== 'SOLICITADO') conflict('Apenas pedido solicitado pode ser aceito.');
      if (carrier && !await db.collection('organizations').findOne({ _id: carrier, type: 'COOPERATIVA', status: 'ATIVA' }, { session })) throw new HttpError(400, 'INVALID_REFERENCE', 'Cooperativa não disponível.');
      const offer = await db.collection('offers').findOneAndUpdate({ _id: order.offerId, status: 'PUBLICADA', availableUntil: { $gt: new Date().toISOString() }, availableGrams: { $gte: order.quantityGrams } },
        { $inc: { availableGrams: -order.quantityGrams, reservedGrams: order.quantityGrams } }, { session, returnDocument: 'after' });
      if (!offer) conflict('Não há saldo disponível para aceitar este pedido.');
      const shipment = { id: randomUUID(), status: 'PLANEJADA', carrierOrganizationId: carrier };
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { status: 'ACEITO', shipment } }, { session });
      await append(session, req.context, { lotId: order.lotId, orderId: order._id, operationId: order._id, type: 'PEDIDO_ACEITO', location, quantityGrams: order.quantityGrams });
      return response(publicOrder({ ...order, status: 'ACEITO', shipment }));
    });
  });
  router.post('/orders/:id/cancel', async (req, res) => {
    fields(req.body, ['location', 'locationConfirmed']); const location = confirmedLocation(req.body);
    await command(req, res, async session => {
      const order = await orderFor(req, session);
      if (![order.sellerOrganizationId, order.requesterOrganizationId].includes(req.context.organizationId)) missing();
      if (!['SOLICITADO', 'ACEITO'].includes(order.status)) conflict('Cancelamento permitido apenas antes da retirada.');
      if (order.status === 'ACEITO') {
        const result = await db.collection('offers').updateOne({ _id: order.offerId, reservedGrams: { $gte: order.quantityGrams } }, { $inc: { availableGrams: order.quantityGrams, reservedGrams: -order.quantityGrams } }, { session });
        if (!result.modifiedCount) conflict('Saldo inconsistente; operação cancelada.');
      }
      const shipment = order.shipment ? { ...order.shipment, status: 'CANCELADA' } : undefined;
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { status: 'CANCELADO', ...(shipment ? { shipment } : {}) } }, { session });
      await append(session, req.context, { lotId: order.lotId, orderId: order._id, operationId: order._id, type: 'PEDIDO_CANCELADO', location, quantityGrams: order.quantityGrams });
      return response(publicOrder({ ...order, status: 'CANCELADO', ...(shipment ? { shipment } : {}) }));
    });
  });
  router.post('/shipments/:id/pickup', async (req, res) => {
    fields(req.body, ['location', 'locationConfirmed']); const location = confirmedLocation(req.body);
    await command(req, res, async session => {
      const order = await orderFor(req, session, true);
      if (![order.sellerOrganizationId, order.shipment.carrierOrganizationId].includes(req.context.organizationId)) missing();
      if (order.status !== 'ACEITO' || order.shipment.status !== 'PLANEJADA') conflict('A retirada exige pedido aceito e remessa planejada.');
      const balance = await db.collection('offers').updateOne({ _id: order.offerId, reservedGrams: { $gte: order.quantityGrams } }, { $inc: { reservedGrams: -order.quantityGrams, dispatchedGrams: order.quantityGrams } }, { session });
      if (!balance.modifiedCount) conflict('Saldo inconsistente; retirada cancelada.');
      const shipment = { ...order.shipment, status: 'RETIRADA', pickedUpAt: new Date().toISOString() };
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { status: 'RETIRADO', shipment } }, { session });
      await append(session, req.context, { lotId: order.lotId, orderId: order._id, operationId: order.shipment.id, type: 'RETIRADA_REGISTRADA', location, quantityGrams: order.quantityGrams });
      return response(publicOrder({ ...order, status: 'RETIRADO', shipment }));
    });
  });
  router.post('/shipments/:id/receipts', async (req, res) => {
    fields(req.body, ['quantityAcceptedKg', 'location', 'locationConfirmed']); const location = confirmedLocation(req.body); const accepted = grams(req.body.quantityAcceptedKg);
    await command(req, res, async session => {
      const order = await orderFor(req, session, true);
      if (order.requesterOrganizationId !== req.context.organizationId) missing();
      if (order.status !== 'RETIRADO' || order.shipment.status !== 'RETIRADA') conflict('Recebimento exige retirada registrada.');
      if (accepted !== order.quantityGrams) conflict('Este incremento aceita apenas recebimento integral, sem divergência.');
      const balance = await db.collection('offers').updateOne({ _id: order.offerId, dispatchedGrams: { $gte: accepted } }, { $inc: { dispatchedGrams: -accepted, receivedGrams: accepted } }, { session });
      if (!balance.modifiedCount) conflict('Saldo inconsistente; recebimento cancelado.');
      const receipt = { id: randomUUID(), quantityAcceptedGrams: accepted, receivedAt: new Date().toISOString(), receiverOrganizationId: req.context.organizationId, receivedBy: req.context.userId, location };
      const shipment = { ...order.shipment, status: 'RECEBIDA', receipt };
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { status: 'RECEBIDO', shipment } }, { session });
      await append(session, req.context, { lotId: order.lotId, orderId: order._id, operationId: order.shipment.id, type: 'RECEBIMENTO_CONFIRMADO', location, quantityGrams: accepted });
      return response(publicOrder({ ...order, status: 'RECEBIDO', shipment }), 201);
    });
  });
  return router;
}

// Origem preservada no documento legado; novos eventos são append-only e separados.
export async function lotView(db, id, context, query = {}) {
  const lotId = uuid(id, 'id'); const pagination = page(query);
  const production = await db.collection('productions').findOne({ 'lot.id': lotId });
  if (!production) missing();
  const owner = production.organizationId === context.organizationId;
  const orders = owner ? [] : await db.collection('orders').find({ lotId, ...partyFilter(context.organizationId) }, { projection: { _id: 1, shipment: 1 } }).toArray();
  if (!owner && !orders.some(o => o.shipment)) missing();
  const filter = owner ? { lotId } : { lotId, orderId: { $in: orders.map(o => o._id) } };
  const count = await db.collection('traceEvents').countDocuments(filter);
  const events = await db.collection('traceEvents').find(filter).sort({ recordedAt: 1, _id: 1 }).skip(Math.max(0, pagination.offset - 1)).limit(pagination.limit - (pagination.offset === 0 ? 1 : 0) || 1).toArray();
  let rows = events.map(({ _id, ...event }) => ({ id: _id, ...event }));
  if (pagination.offset === 0) rows = [production.lot.events[0], ...rows].slice(0, pagination.limit);
  if (!owner) rows = rows.map(e => ({ id: e.id, lotId, orderId: e.orderId || null, type: e.type, occurredAt: e.occurredAt, recordedAt: e.recordedAt, responsibleOrganizationId: e.responsibleOrganizationId, location: e.location, locationConfirmedAt: e.locationConfirmedAt, quantityGrams: e.quantityGrams, isDemonstration: e.isDemonstration }));
  const data = owner ? { ...production.lot, events: rows } : { id: lotId, events: rows };
  return { data, pagination: { ...pagination, total: count + 1 } };
}
