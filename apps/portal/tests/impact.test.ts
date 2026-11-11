import test from "node:test";
import assert from "node:assert/strict";
import { RequestError } from "../src/lib/client-api";
import { hasModeData, impactErrorMessage, impactPath, isEmptyImpact, isImpact } from "../src/lib/impact";

const id = "10000000-0000-4000-8000-000000000001";
// Exemplo fictício do contrato (docs/requisitos/api.md).
const sample = {
  schemaVersion: 1, propertyId: id, isDemonstration: true, asOf: "2026-11-11T15:00:00.000Z",
  funnelKg: { registered: 20, published: 10, acceptedNet: 6, pickedUp: 4, received: 3 },
  balancesKg: { availableActive: 3, reservedNow: 2, inTransitNow: 1, expiredAvailable: 1 },
  byModeKg: { VENDA: { published: 6, received: 1 }, DOACAO: { published: 4, received: 2 } },
};
test("aceita o contrato v1 e recusa formatos divergentes", () => {
  assert.equal(isImpact(sample, id), true);
  assert.equal(isImpact({ ...sample, propertyId: "outro" }, id), false);
  assert.equal(isImpact({ ...sample, schemaVersion: 2 }, id), false);
  assert.equal(isImpact({ ...sample, funnelKg: { ...sample.funnelKg, received: null } }, id), false);
  assert.equal(isImpact({ ...sample, byModeKg: { VENDA: sample.byModeKg.VENDA } }, id), false);
  assert.equal(isImpact(null, id), false);
});
test("vazio e divisão por modalidade dependem apenas dos valores recebidos", () => {
  assert.equal(isEmptyImpact(sample), false);
  assert.equal(hasModeData(sample), true);
  const zero = { ...sample, funnelKg: { registered: 0, published: 0, acceptedNet: 0, pickedUp: 0, received: 0 },
    byModeKg: { VENDA: { published: 0, received: 0 }, DOACAO: { published: 0, received: 0 } } };
  assert.equal(isEmptyImpact(zero), true);
  assert.equal(hasModeData(zero), false);
});
test("falhas não viram zero e têm mensagem por causa", () => {
  assert.match(impactErrorMessage(new RequestError(401, "")), /sessão expirou/);
  assert.match(impactErrorMessage(new RequestError(403, "")), /perfil/);
  assert.match(impactErrorMessage(new RequestError(404, "")), /não encontrada/);
  assert.match(impactErrorMessage(new TypeError("fetch failed")), /Nenhum valor foi estimado/);
  assert.equal(impactPath(id), "/properties/" + id + "/excess-impact");
});
