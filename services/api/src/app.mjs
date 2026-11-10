import express from 'express';
import { fileURLToPath } from 'node:url';
import { authenticate, authorizeOrganization, canWriteProduction } from './auth.mjs';
import { HttpError, uuid, validateProduction, productionDocument, publicProduction } from './domain.mjs';
import { commerceRouter, lotView } from './commerce.mjs';
import { producerHomeRouter, propertyView } from './producer-home.mjs';
import { weatherProvider } from './weather.mjs';
import { farmRouter } from './farm.mjs';

export function createApp(db, { demoAuthEnabled = false, weather = weatherProvider({ locationStore: db.collection('weatherLocations') }) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({ status: 'ok', database: 'mongodb', authentication: demoAuthEnabled ? 'DEMONSTRACAO_LOCAL' : 'DESABILITADA' });
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!demoAuthEnabled) throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'Identidade não configurada. Habilite apenas a demonstração local conforme README.');
    next();
  }, authenticate(db));
  app.get('/api/v1/me', async (req, res) => {
    const memberships = await db.collection('memberships').find({ userId: req.identity.userId, status: 'ATIVO' }).toArray();
    const organizations = await db.collection('organizations').find({ _id: { $in: memberships.map(m => m.organizationId) }, status: 'ATIVA' }).toArray();
    res.json({ userId: req.identity.userId, isDemonstration: true, memberships: organizations.map(o => ({ organizationId: o._id, name: o.name, type: o.type, role: memberships.find(m => m.organizationId === o._id).role })) });
  });
  app.use('/api/v1', authorizeOrganization(db));
  app.use('/api/v1', commerceRouter(db));
  app.use('/api/v1', producerHomeRouter(db, weather));
  app.use('/api/v1', farmRouter(db));
  app.get('/api/v1/catalog', async (req, res) => {
    const [properties, crops] = await Promise.all([
      db.collection('properties').find({ organizationId: req.context.organizationId, status: 'ATIVA' }).toArray(),
      db.collection('crops').find({ status: 'ATIVA' }).toArray()
    ]);
    res.json({ properties: properties.map(propertyView), crops: crops.map(c => ({ id: c._id, name: c.name })) });
  });
  app.post('/api/v1/productions', canWriteProduction, async (req, res) => {
    const input = validateProduction(req.body);
    const [property, crop] = await Promise.all([
      db.collection('properties').findOne({ _id: input.propertyId, organizationId: req.context.organizationId, status: 'ATIVA' }),
      db.collection('crops').findOne({ _id: input.cropId, status: 'ATIVA' })
    ]);
    if (!property || !crop) throw new HttpError(400, 'INVALID_REFERENCE', 'Propriedade ou cultura não disponível para esta operação.');
    const document = productionDocument(input, req.context, crop);
    // Produção, lote e origem em uma única gravação atômica MongoDB.
    await db.collection('productions').insertOne(document);
    res.status(201).location(`/api/v1/productions/${document._id}`).json({ data: publicProduction(document) });
  });
  app.get('/api/v1/productions', async (req, res) => {
    const { limit = '50', offset = '0' } = req.query;
    if (typeof limit !== 'string' || !/^\d+$/.test(limit) || +limit < 1 || +limit > 100 || typeof offset !== 'string' || !/^\d+$/.test(offset) || !Number.isSafeInteger(+offset) || +offset > 100000) throw new HttpError(400, 'INVALID_PAGINATION', 'limit: 1–100; offset: 0–100000.');
    const filter = { organizationId: req.context.organizationId };
    const [documents, total] = await Promise.all([
      db.collection('productions').find(filter).sort({ createdAt: -1, _id: -1 }).skip(+offset).limit(+limit).toArray(),
      db.collection('productions').countDocuments(filter)
    ]);
    res.json({ data: documents.map(publicProduction), pagination: { total, limit: +limit, offset: +offset } });
  });
  app.get('/api/v1/productions/indicators', async (req, res) => {
    const distribution = await db.collection('productions').aggregate([
      { $match: { organizationId: req.context.organizationId } },
      { $group: { _id: '$cropId', cropName: { $first: '$cropName' }, count: { $sum: 1 }, quantityKg: { $sum: '$quantityKg' } } },
      { $sort: { cropName: 1 } }
    ]).toArray();
    res.json({ total: distribution.reduce((sum, row) => sum + row.count, 0), distribution: distribution.map(({ _id, ...row }) => ({ cropId: _id, ...row })) });
  });
  app.get('/api/v1/productions/:id', async (req, res) => {
    const document = await db.collection('productions').findOne({ _id: uuid(req.params.id, 'id'), organizationId: req.context.organizationId });
    if (!document) throw new HttpError(404, 'NOT_FOUND', 'Produção não encontrada.');
    res.json({ data: publicProduction(document) });
  });
  app.get('/api/v1/lots/:id', async (req, res) => {
    res.json(await lotView(db, req.params.id, req.context, req.query));
  });
  app.get('/api/v1/lots/:id/events', async (req, res) => {
    const result = await lotView(db, req.params.id, req.context, req.query);
    res.json({ data: result.data.events, pagination: result.pagination });
  });
  // Flutter web compilado usa /api na mesma origem; não abre CORS nem expõe tokens.
  app.use('/mobile', (_req, res, next) => {
    // CanvasKit precisa de WebAssembly e estilos gerados pelo Flutter, só nesta rota.
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  }, express.static(fileURLToPath(new URL('../../../apps/mobile/build/web/', import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('../../../apps/web/', import.meta.url))));
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Rota não encontrada.')));
  app.use((error, _req, res, _next) => {
    const status = error.status === 413 ? 413 : error.type === 'entity.parse.failed' ? 400 : error instanceof HttpError ? error.status : 500;
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : error.type === 'entity.parse.failed' ? 'INVALID_JSON' : error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
    res.status(status).json({ error: { code, message: error instanceof HttpError ? error.message : status === 400 ? 'JSON inválido.' : status === 413 ? 'Corpo excede 16kb.' : 'Não foi possível concluir a operação.' } });
  });
  return app;
}
