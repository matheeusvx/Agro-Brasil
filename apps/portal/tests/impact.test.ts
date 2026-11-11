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
import { composition, insights, journey, modes, share } from "../src/lib/impact";
test("composição soma exatamente o ofertado e percentuais são só leitura", () => {
  const parts = composition(sample);
  assert.equal(Math.round(parts.reduce((s, p) => s + p.value, 0) * 1000), Math.round(sample.funnelKg.published * 1000));
  assert.equal(share(3, 10), 30);
  assert.equal(share(1, 0), 0);
  assert.deepEqual(journey(sample).map((s) => s.width), [100, 50, 30, 20, 15]);
  assert.equal(journey(sample)[4].fromPrevious, 75);
  assert.deepEqual(modes(sample).map((m) => m.rate), [16.7, 50]);
});
test("sugestões vêm dos saldos e não falam em desperdício", () => {
  const list = insights(sample);
  assert.equal(list[0].tone, "attention");
  assert.equal(list.length, 4);
  assert.ok(list.every((i) => !/desperd|perd/i.test(i.text)));
  assert.deepEqual(insights({ ...sample, balancesKg: { availableActive: 0, reservedNow: 0, inTransitNow: 0, expiredAvailable: 0 } }), []);
});
import { matchesDeadline } from "../src/components/offers";
test("filtro de prazo das ofertas segue a leitura do indicador", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  const o = (status: string, availableKg: number, until: string) => ({ status, availableKg, availableUntil: until });
  assert.equal(matchesDeadline(o("PUBLICADA", 4, "2026-11-10T00:00:00Z"), "vencidas", now), true);
  assert.equal(matchesDeadline(o("PUBLICADA", 4, "2026-11-11T12:00:00Z"), "vencidas", now), true, "igualdade já é vencida");
  assert.equal(matchesDeadline(o("PUBLICADA", 0, "2026-11-10T00:00:00Z"), "vencidas", now), false, "sem saldo não conta");
  assert.equal(matchesDeadline(o("RASCUNHO", 4, "2026-11-10T00:00:00Z"), "vencidas", now), false);
  assert.equal(matchesDeadline(o("PUBLICADA", 9, "2026-11-20T00:00:00Z"), "no-prazo", now), true);
  assert.equal(matchesDeadline(o("PUBLICADA", 9, "2026-11-20T00:00:00Z"), "vencidas", now), false);
});
