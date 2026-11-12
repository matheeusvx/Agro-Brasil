import test from "node:test";
import assert from "node:assert/strict";
import {
  audienceOf,
  canShowWriteActions,
  defaultMembership,
  nextStep,
  pageAllowed,
  portalMemberships,
} from "../src/lib/audience";
import { allowedProxyPath, allowedProxyQuery } from "../src/lib/security";
import {
  ContractError,
  parseOffers,
  parseOrganizationHome,
} from "../src/lib/organization-home";

const coop = "10000000-0000-4000-8000-000000000001";
const inst = "20000000-0000-4000-8000-000000000002";
const uuid = "30000000-0000-4000-8000-000000000003";
const memberships = [
  { organizationId: inst, name: "Instituição", type: "INSTITUICAO", role: "LEITOR" },
  { organizationId: "c", name: "Comprador", type: "COMPRADOR_LOCAL", role: "ADMIN" },
  { organizationId: coop, name: "Cooperativa", type: "COOPERATIVA", role: "EDITOR" },
];
const op = (status: string, id = uuid) => ({
  id, lotId: uuid, offerId: uuid, status, quantityKg: 1.25,
  createdAt: "2026-11-12T10:00:00.000Z", shipment: { id: uuid, status: "PENDENTE" },
});
const homeBody = (overrides: Record<string, unknown> = {}, pagination = { limit: 5, offset: 0, total: 2 }) => ({
  data: {
    schemaVersion: 1, organizationId: coop, organizationType: "COOPERATIVA",
    fetchedAt: "2026-11-12T15:00:00.000Z", isDemonstration: true, canWrite: true, total: 2,
    byStatus: {
      SOLICITADO: { count: 0, quantityKg: 0 }, ACEITO: { count: 1, quantityKg: 1.25 },
      RETIRADO: { count: 1, quantityKg: 1.25 }, RECEBIDO: { count: 0, quantityKg: 0 },
      CANCELADO: { count: 0, quantityKg: 0 },
    },
    pending: [op("ACEITO")], operations: [op("ACEITO"), op("RETIRADO")],
    ...overrides,
  },
  pagination,
});
const expected = { organizationId: coop, organizationType: "COOPERATIVA" as const };

test("sessão: apenas públicos atendidos e produtor como vínculo padrão", () => {
  assert.equal(audienceOf("COMPRADOR_LOCAL"), null);
  assert.deepEqual(portalMemberships(memberships).map((m) => m.type), ["INSTITUICAO", "COOPERATIVA"]);
  assert.equal(defaultMembership(memberships)?.type, "COOPERATIVA");
  assert.equal(
    defaultMembership([...memberships, { organizationId: "p", name: "P", type: "PEQUENO_PRODUTOR_RURAL", role: "LEITOR" }])?.type,
    "PEQUENO_PRODUTOR_RURAL",
  );
  assert.equal(defaultMembership([memberships[1]]), undefined);
});

test("permissões de página por público", () => {
  for (const path of ["/producao", "/ofertas", "/pedidos", "/minha-fazenda", "/destino", "/rastreabilidade/x"]) {
    assert.equal(pageAllowed(path, "producer"), true, path);
    assert.equal(pageAllowed(path, "cooperative"), false, path);
    assert.equal(pageAllowed(path, "institution"), false, path);
  }
  assert.equal(pageAllowed("/remessas", "cooperative"), true);
  assert.equal(pageAllowed("/remessas", "institution"), false);
  assert.equal(pageAllowed("/solicitacoes", "institution"), true);
  assert.equal(pageAllowed("/ofertas-disponiveis", "institution"), true);
  assert.equal(pageAllowed("/ofertas-disponiveis", "cooperative"), false);
  assert.equal(pageAllowed("/remessas", "producer"), false);
  for (const a of ["producer", "cooperative", "institution"] as const) {
    assert.equal(pageAllowed("/visao-geral", a), true);
    assert.equal(pageAllowed("/perfil", a), true);
  }
});

test("LEITOR e canWrite=false nunca recebem ações de escrita", () => {
  assert.equal(canShowWriteActions(true, "LEITOR"), false);
  assert.equal(canShowWriteActions(false, "ADMIN"), false);
  assert.equal(canShowWriteActions(true, "EDITOR"), true);
  assert.equal(canShowWriteActions(true, "OUTRO"), false);
  assert.equal(nextStep("cooperative", "ACEITO")?.kind, "write");
  assert.equal(nextStep("cooperative", "SOLICITADO"), null);
  assert.equal(nextStep("institution", "RETIRADO")?.kind, "write");
  assert.equal(nextStep("institution", "ACEITO")?.kind, "follow");
  assert.equal(nextStep("institution", "RECEBIDO"), null);
});

test("proxy: cada público recebe somente suas leituras", () => {
  assert.equal(allowedProxyPath("/cooperative-home", "GET", "cooperative"), true);
  assert.equal(allowedProxyPath("/institution-home", "GET", "cooperative"), false);
  assert.equal(allowedProxyPath("/offers", "GET", "cooperative"), false);
  assert.equal(allowedProxyPath("/institution-home", "GET", "institution"), true);
  assert.equal(allowedProxyPath("/offers", "GET", "institution"), true);
  for (const audience of ["cooperative", "institution"] as const) {
    for (const path of ["/producer-home", "/catalog", "/productions", "/orders", "/lots/" + uuid, "/properties/" + uuid + "/weather"])
      assert.equal(allowedProxyPath(path, "GET", audience), false, audience + path);
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      assert.equal(allowedProxyPath("/orders", method, audience), false);
      assert.equal(allowedProxyPath("/shipments/" + uuid + "/pickup", method, audience), false);
    }
    assert.equal(allowedProxyPath("/cooperative-home/x", "GET", audience), false);
  }
  // Produtor não acessa as novas homes; rotas originais preservadas.
  assert.equal(allowedProxyPath("/cooperative-home", "GET", "producer"), false);
  assert.equal(allowedProxyPath("/institution-home", "GET"), false);
  assert.equal(allowedProxyPath("/producer-home", "GET"), true);
  assert.equal(allowedProxyQuery("?limit=5&offset=0", "cooperative"), true);
  assert.equal(allowedProxyQuery("?scope=mine", "institution"), false);
  assert.equal(allowedProxyQuery("?limit=5&limit=6", "institution"), false);
  assert.equal(allowedProxyQuery("?limit=-1", "institution"), false);
  assert.equal(allowedProxyQuery("?scope=mine", "producer"), true);
});

test("contrato: resposta válida é projetada sem campos extras", () => {
  const body = homeBody();
  (body.data.operations[0] as Record<string, unknown>).requesterOrganizationId = "privado";
  const { home, pagination } = parseOrganizationHome(body, expected);
  assert.equal(home.total, 2);
  assert.equal(pagination.total, 2);
  assert.equal("requesterOrganizationId" in home.operations[0], false);
  assert.deepEqual(home.byStatus.ACEITO, { count: 1, quantityKg: 1.25 });
});

test("contrato: troca de organização e respostas inválidas são recusadas", () => {
  const cases: [string, unknown][] = [
    ["outra organização", homeBody({ organizationId: inst })],
    ["outro tipo", homeBody({ organizationType: "INSTITUICAO" })],
    ["versão", homeBody({ schemaVersion: 2 })],
    ["estado ausente", homeBody({ byStatus: { ACEITO: { count: 1, quantityKg: 1 } } })],
    ["contagem negativa", homeBody({ total: -1 })],
    ["kg inválido", homeBody({ pending: [{ ...op("ACEITO"), quantityKg: "1" }] })],
    ["prioridades demais", homeBody({ pending: [op("ACEITO"), op("ACEITO"), op("ACEITO"), op("ACEITO")] })],
    ["estado desconhecido", homeBody({ operations: [op("PERDIDO")] })],
    ["total divergente", homeBody({}, { limit: 5, offset: 0, total: 9 })],
    ["canWrite ausente", homeBody({ canWrite: undefined })],
    ["envelope de erro", { error: { message: "x" } }],
    ["nulo", null],
  ];
  for (const [name, body] of cases)
    assert.throws(() => parseOrganizationHome(body, expected), ContractError, name);
});

test("estados: home vazia continua válida e não vira erro", () => {
  const empty = homeBody(
    {
      total: 0, pending: [], operations: [],
      byStatus: Object.fromEntries(["SOLICITADO", "ACEITO", "RETIRADO", "RECEBIDO", "CANCELADO"].map((s) => [s, { count: 0, quantityKg: 0 }])),
    },
    { limit: 5, offset: 0, total: 0 },
  );
  const { home } = parseOrganizationHome(empty, expected);
  assert.equal(home.operations.length, 0);
  assert.equal(home.byStatus.RECEBIDO.count, 0);
});

test("ofertas: projeção comercial validada e sem IDs de organização", () => {
  const offer = {
    id: uuid, lotId: uuid, sellerOrganizationId: "privado", sellerName: "Produtor", cropName: "Alface",
    territory: { municipality: "São Paulo", uf: "SP" }, quantityKg: 10, availableKg: 4,
    destinationMode: "DOACAO", unitPriceCents: 0, availableUntil: "2026-12-01T00:00:00.000Z",
    status: "PUBLICADA", isDemonstration: true,
  };
  const parsed = parseOffers({ data: [offer], pagination: { limit: 12, offset: 0, total: 1 } });
  assert.equal(parsed.data[0].availableKg, 4);
  assert.equal("sellerOrganizationId" in parsed.data[0], false);
  assert.equal("lotId" in parsed.data[0], false);
  assert.throws(() => parseOffers({ data: [{ ...offer, availableKg: -1 }], pagination: { limit: 1, offset: 0, total: 1 } }), ContractError);
  assert.throws(() => parseOffers({ data: [{ ...offer, destinationMode: "TROCA" }], pagination: { limit: 1, offset: 0, total: 1 } }), ContractError);
});

import {
  IdempotencyKeeper,
  commandMessage,
  locationProblem,
  operationActions,
  quantityProblem,
} from "../src/lib/commands";
import { RequestError } from "../src/lib/client-api";

test("proxy de escrita: cada público só seus comandos; LEITOR nunca", () => {
  const pickup = "/shipments/" + uuid + "/pickup";
  const receipt = "/shipments/" + uuid + "/receipts";
  const cancel = "/orders/" + uuid + "/cancel";
  assert.equal(allowedProxyPath(pickup, "POST", "cooperative", "EDITOR"), true);
  for (const p of ["/orders", receipt, cancel, "/orders/" + uuid + "/accept", "/productions", "/offers"])
    assert.equal(allowedProxyPath(p, "POST", "cooperative", "ADMIN"), false, p);
  for (const p of ["/orders", receipt, cancel])
    assert.equal(allowedProxyPath(p, "POST", "institution", "ADMIN"), true, p);
  for (const p of [pickup, "/orders/" + uuid + "/accept", "/productions", "/offers", "/offers/" + uuid + "/publish"])
    assert.equal(allowedProxyPath(p, "POST", "institution", "EDITOR"), false, p);
  for (const a of ["producer", "cooperative", "institution"] as const)
    for (const p of [pickup, "/orders", receipt, cancel, "/productions"])
      assert.equal(allowedProxyPath(p, "POST", a, "LEITOR"), false, a + p);
  assert.equal(allowedProxyPath("/cooperative-home", "GET", "cooperative", "LEITOR"), true);
  assert.equal(allowedProxyPath("/orders/abc/cancel", "POST", "institution", "ADMIN"), false);
  // Produtor preserva seus comandos.
  assert.equal(allowedProxyPath(pickup, "POST", "producer", "ADMIN"), true);
  assert.equal(allowedProxyPath(receipt, "POST", "producer", "ADMIN"), false);
});

test("ações por estado: somente as que o backend aceita", () => {
  const ship = (status: string) => ({ id: uuid, status });
  const kinds = (a: "cooperative" | "institution", status: string, s: string | null) =>
    operationActions(a, { id: uuid, status: status as never, shipment: s ? ship(s) : null }).map((x) => x.kind);
  assert.deepEqual(kinds("cooperative", "ACEITO", "PLANEJADA"), ["pickup"]);
  assert.deepEqual(kinds("cooperative", "RETIRADO", "RETIRADA"), []);
  assert.deepEqual(kinds("cooperative", "ACEITO", "CANCELADA"), []);
  assert.deepEqual(kinds("institution", "SOLICITADO", null), ["cancel"]);
  assert.deepEqual(kinds("institution", "ACEITO", "PLANEJADA"), ["cancel"]);
  assert.deepEqual(kinds("institution", "RETIRADO", "RETIRADA"), ["receipt"]);
  assert.deepEqual(kinds("institution", "RECEBIDO", "RECEBIDA"), []);
  assert.deepEqual(kinds("institution", "CANCELADO", null), []);
  const [r] = operationActions("institution", { id: uuid, status: "RETIRADO", shipment: ship("RETIRADA") });
  assert.equal(r.endpoint, "/shipments/" + uuid + "/receipts");
});

test("formulário: quantidade limitada ao saldo e local confirmado", () => {
  assert.equal(quantityProblem("10", 10), "");
  assert.equal(quantityProblem("2,5", 10), "");
  assert.notEqual(quantityProblem("10.001", 10), "");
  assert.notEqual(quantityProblem("0", 10), "");
  assert.notEqual(quantityProblem("1.2345", 10), "");
  assert.notEqual(quantityProblem("-1", 10), "");
  assert.notEqual(quantityProblem("abc", 10), "");
  assert.equal(locationProblem({ municipality: "Campinas", uf: "SP", confirmed: true }), "");
  assert.notEqual(locationProblem({ municipality: "Campinas", uf: "SP", confirmed: false }), "");
  assert.notEqual(locationProblem({ municipality: " ", uf: "SP", confirmed: true }), "");
  assert.notEqual(locationProblem({ municipality: "Campinas", uf: "XX", confirmed: true }), "");
});

test("Idempotency-Key estável em falha transitória e nova após resposta definitiva", () => {
  let n = 0;
  const keeper = new IdempotencyKeeper(() => "k" + ++n);
  const k1 = keeper.keyFor("a");
  keeper.settle(new TypeError("rede"));
  assert.equal(keeper.keyFor("a"), k1);
  keeper.settle(new RequestError(503, "x"));
  assert.equal(keeper.keyFor("a"), k1);
  assert.notEqual(keeper.keyFor("b"), k1, "dados alterados: nova tentativa");
  keeper.settle(new RequestError(409, "conflito"));
  const k3 = keeper.keyFor("b");
  assert.notEqual(k3, "k2");
  keeper.settle();
  assert.notEqual(keeper.keyFor("b"), k3);
});

test("mensagens de erro por status, sem sucesso presumido", () => {
  for (const status of [400, 401, 403, 404, 409, 500])
    assert.ok(commandMessage(new RequestError(status, "Detalhe.")).length > 10);
  assert.match(commandMessage(new RequestError(409, "Apenas pedido solicitado.")), /Apenas pedido solicitado/);
  assert.match(commandMessage(new TypeError("fetch failed")), /mesma tentativa/);
});

test("rastreabilidade: eventos do lote liberados só como GET para coop/inst", () => {
  const events = "/lots/" + uuid + "/events";
  for (const a of ["cooperative", "institution"] as const) {
    assert.equal(allowedProxyPath(events, "GET", a, "LEITOR"), true);
    assert.equal(allowedProxyPath(events, "POST", a, "ADMIN"), false);
    assert.equal(allowedProxyPath("/lots/" + uuid, "GET", a), false);
    assert.equal(allowedProxyPath("/lots/abc/events", "GET", a), false);
  }
  assert.equal(pageAllowed("/remessas/" + uuid, "cooperative"), true);
  assert.equal(pageAllowed("/solicitacoes/" + uuid, "institution"), true);
  assert.equal(pageAllowed("/solicitacoes/" + uuid, "cooperative"), false);
  assert.equal(pageAllowed("/remessas/" + uuid, "institution"), false);
  assert.equal(pageAllowed("/remessas/a/b", "cooperative"), false);
});
