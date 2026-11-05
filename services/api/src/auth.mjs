import { createHash } from 'node:crypto';
import { HttpError, uuid } from './domain.mjs';

export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function authenticate(db) {
  return async (req, _res, next) => {
    const header = req.get('authorization') || '';
    if (!/^Bearer [A-Za-z0-9_-]{32,200}$/.test(header)) throw new HttpError(401, 'UNAUTHORIZED', 'Token de demonstração ausente ou inválido.');
    const credential = await db.collection('demoTokens').findOne({ tokenHash: tokenHash(header.slice(7)), expiresAt: { $gt: new Date() } });
    if (!credential || !(await db.collection('users').findOne({ _id: credential.userId, status: 'ATIVO' }))) throw new HttpError(401, 'UNAUTHORIZED', 'Token inválido, expirado ou usuário inativo.');
    req.identity = { userId: credential.userId, isDemonstration: true };
    next();
  };
}
export function authorizeOrganization(db) {
  return async (req, _res, next) => {
    const organizationId = uuid(req.get('x-organization-id'), 'X-Organization-Id');
    const membership = await db.collection('memberships').findOne({ userId: req.identity.userId, organizationId, status: 'ATIVO' });
    const organization = membership && await db.collection('organizations').findOne({ _id: organizationId, status: 'ATIVA' });
    if (!organization) throw new HttpError(403, 'FORBIDDEN', 'Sem vínculo ativo com esta organização.');
    req.context = { ...req.identity, organizationId, role: membership.role, organizationType: organization.type };
    next();
  };
}
export function canWriteProduction(req, _res, next) {
  if (req.context.organizationType !== 'PEQUENO_PRODUTOR_RURAL' || !['ADMIN', 'EDITOR'].includes(req.context.role)) throw new HttpError(403, 'FORBIDDEN', 'Este perfil não pode registrar produção.');
  next();
}
