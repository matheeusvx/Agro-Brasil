import { Router } from 'express';
import { HttpError } from './domain.mjs';
import { page } from './commerce-domain.mjs';

// Allowlist independent of the stored document: never serialize participant data.
export const homeOperation = o => ({ id: o._id, lotId: o.lotId, offerId: o.offerId,
  status: o.status, quantityKg: o.quantityGrams / 1000, createdAt: o.createdAt,
  shipment: o.shipment ? { id: o.shipment.id, status: o.shipment.status } : null });

export function homePipeline(type, organizationId, pagination) {
  const cooperative = type === 'COOPERATIVA';
  const priorities = cooperative ? ['ACEITO', 'RETIRADO'] : ['RETIRADO', 'ACEITO', 'SOLICITADO'];
  return [
    { $match: cooperative ? { 'shipment.carrierOrganizationId': organizationId } : { requesterOrganizationId: organizationId } },
    { $facet: {
      totals: [{ $group: { _id: '$status', count: { $sum: 1 }, grams: { $sum: '$quantityGrams' } } }],
      operations: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: pagination.offset }, { $limit: pagination.limit },
        { $project: { lotId: 1, offerId: 1, status: 1, quantityGrams: 1, createdAt: 1, 'shipment.id': 1, 'shipment.status': 1 } }],
      pending: [{ $match: { status: { $in: priorities } } },
        { $addFields: { priority: { $indexOfArray: [priorities, '$status'] } } },
        { $sort: { priority: 1, createdAt: 1, _id: 1 } }, { $limit: 3 },
        { $project: { lotId: 1, offerId: 1, status: 1, quantityGrams: 1, createdAt: 1, 'shipment.id': 1, 'shipment.status': 1 } }]
    } }
  ];
}

export function organizationHomeRouter(db) {
  const router = Router();
  for (const [route, type] of [['cooperative-home', 'COOPERATIVA'], ['institution-home', 'INSTITUICAO']]) {
    router.get('/' + route, async (req, res) => {
      if (req.context.organizationType !== type || !['ADMIN', 'EDITOR', 'LEITOR'].includes(req.context.role)) {
        throw new HttpError(403, 'FORBIDDEN', 'Esta experiência não está disponível para este perfil.');
      }
      const pagination = page(req.query);
      const fetchedAt = new Date().toISOString();
      const [result] = await db.collection('orders').aggregate(homePipeline(type, req.context.organizationId, pagination), { readConcern: { level: 'snapshot' } }).toArray();
      if (!result) throw new Error('Consulta sem resultado agregado.');
      const byStatus = Object.fromEntries(['SOLICITADO', 'ACEITO', 'RETIRADO', 'RECEBIDO', 'CANCELADO'].map(status => [status, { count: 0, quantityKg: 0 }]));
      let total = 0;
      for (const row of result.totals) {
        if (!byStatus[row._id] || !Number.isSafeInteger(row.grams) || row.grams < 0) throw new Error('Estado ou quantidade inválida.');
        byStatus[row._id] = { count: row.count, quantityKg: row.grams / 1000 }; total += row.count;
      }
      res.json({ data: { schemaVersion: 1, organizationId: req.context.organizationId, organizationType: type,
        fetchedAt, isDemonstration: req.context.isDemonstration, canWrite: ['ADMIN', 'EDITOR'].includes(req.context.role),
        total, byStatus, pending: result.pending.map(homeOperation), operations: result.operations.map(homeOperation) },
      pagination: { ...pagination, total } });
    });
  }
  return router;
}
