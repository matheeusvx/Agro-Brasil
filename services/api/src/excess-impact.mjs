import { Router } from 'express';
import { HttpError } from './domain.mjs';
import { ownedProperty } from './producer-home.mjs';

// Convert each production before summing: persisted production quantities are kg.
const integerGrams = value => ({ $toLong: { $round: [{ $multiply: [value, 1000] }, 0] } });
export function impactPipeline(organizationId, propertyId, asOf) {
  const offer = field => ({ $toLong: { $ifNull: [`$offer.${field}`, 0] } });
  const sum = expression => ({ $sum: expression });
  const expired = { $lte: ['$offer.availableUntil', asOf] };
  return [
    { $match: { organizationId, propertyId } },
    { $project: { registered: integerGrams('$quantityKg'), lotId: '$lot.id' } },
    { $lookup: { from: 'offers', localField: 'lotId', foreignField: 'lotId', pipeline: [
      { $match: { sellerOrganizationId: organizationId, status: 'PUBLICADA' } },
      { $project: { quantityGrams: 1, availableGrams: 1, reservedGrams: 1, dispatchedGrams: 1, receivedGrams: 1, availableUntil: 1, destinationMode: 1 } }
    ], as: 'offer' } },
    // offers.lotId is unique; each production and each published offer count once.
    { $unwind: { path: '$offer', preserveNullAndEmptyArrays: true } },
    { $group: { _id: null, registered: sum('$registered'), published: sum(offer('quantityGrams')),
      reservedNow: sum(offer('reservedGrams')), inTransitNow: sum(offer('dispatchedGrams')), received: sum(offer('receivedGrams')),
      availableActive: sum({ $cond: [expired, 0, offer('availableGrams')] }),
      expiredAvailable: sum({ $cond: [expired, offer('availableGrams'), 0] }),
      ...Object.fromEntries(['VENDA', 'DOACAO'].flatMap(mode => ['published', 'received'].map(metric => [
        `${mode}_${metric}`, sum({ $cond: [{ $eq: ['$offer.destinationMode', mode] }, offer(metric === 'published' ? 'quantityGrams' : 'receivedGrams'), 0] })
      ])))
    } }
  ];
}

export function impactView(row = {}, propertyId, isDemonstration, asOf) {
  const g = key => {
    const value = Number(row[key] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) throw new HttpError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
    return value;
  };
  const published = g('published'), received = g('received'), reserved = g('reservedNow'), transit = g('inTransitNow');
  const active = g('availableActive'), expired = g('expiredAvailable');
  const accepted = reserved + transit + received;
  if (!Number.isSafeInteger(active + expired + accepted) || published !== active + expired + accepted) {
    throw new HttpError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
  }
  return { schemaVersion: 1, propertyId, isDemonstration, asOf,
    funnelKg: { registered: g('registered') / 1000, published: published / 1000, acceptedNet: accepted / 1000, pickedUp: (transit + received) / 1000, received: received / 1000 },
    balancesKg: { availableActive: active / 1000, reservedNow: reserved / 1000, inTransitNow: transit / 1000, expiredAvailable: expired / 1000 },
    byModeKg: Object.fromEntries(['VENDA', 'DOACAO'].map(mode => [mode, { published: g(`${mode}_published`) / 1000, received: g(`${mode}_received`) / 1000 }])) };
}

export function excessImpactRouter(db) {
  const router = Router();
  router.get('/properties/:id/excess-impact', async (req, res) => {
    if (req.context.organizationType !== 'PEQUENO_PRODUTOR_RURAL' || !['ADMIN', 'EDITOR', 'LEITOR'].includes(req.context.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'Este perfil não pode consultar o indicador da propriedade.');
    }
    const property = await ownedProperty(db, req);
    const asOf = new Date().toISOString();
    const [row] = await db.collection('productions').aggregate(impactPipeline(req.context.organizationId, property._id, asOf), { readConcern: { level: 'snapshot' } }).toArray();
    res.json({ data: impactView(row, property._id, req.context.isDemonstration, asOf) });
  });
  return router;
}
