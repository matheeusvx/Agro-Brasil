import test from "node:test";
import assert from "node:assert/strict";
import {
  backoffMs,
  ChatContractError,
  counterpartOf,
  isAccessLoss,
  isRetryable,
  mergeMessages,
  parseChats,
  parseMessages,
  sendErrorMessage,
  textProblem,
  type ChatMessage,
} from "../src/lib/chat";
import { RequestError } from "../src/lib/client-api";
import { allowedProxyPath, allowedProxyQuery } from "../src/lib/security";
import { pageAllowed } from "../src/lib/audience";

const me = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const chatId = "30000000-0000-4000-8000-000000000003";
const msg = (sequence: number, more: Partial<ChatMessage> = {}) => ({
  id: "m" + sequence,
  chatId,
  sequence,
  kind: "TEXT",
  senderOrganizationId: other,
  text: "Olá " + sequence,
  orderId: null,
  createdAt: "2026-11-12T15:00:00.000Z",
  ...more,
});

test("lista de conversas: valida par e organização ativa", () => {
  const ok = parseChats({ data: [{ id: chatId, organizationIds: [me, other], createdAt: "2026-11-12T15:00:00.000Z" }], pagination: { total: 1, limit: 50, offset: 0 } }, me);
  assert.equal(counterpartOf(ok.data[0], me), other);
  assert.throws(() => parseChats({ data: [{ id: chatId, organizationIds: [other, "x"], createdAt: "2026-11-12T15:00:00.000Z" }], pagination: { total: 1, limit: 50, offset: 0 } }, me), ChatContractError);
  assert.throws(() => parseChats({ error: {} }, me), ChatContractError);
  // Campos opcionais do contrato sugerido são aproveitados quando existirem.
  const rich = parseChats({ data: [{ id: chatId, organizationIds: [me, other], createdAt: "2026-11-12T15:00:00.000Z", counterpart: { id: other, name: "Coop", type: "COOPERATIVA" } }], pagination: { total: 1, limit: 50, offset: 0 } }, me);
  assert.equal(rich.data[0].counterpart?.name, "Coop");
});

test("histórico: ordem crescente, cursor coerente e projeção explícita", () => {
  const page = parseMessages({ data: [msg(1, { kind: "ORDER_LINK", text: null, senderOrganizationId: null, orderId: "o1" }), { ...msg(2), authorUserId: "privado" }], pagination: { limit: 50, after: 0, nextAfter: 2, hasMore: false } }, chatId, 0);
  assert.equal(page.data.length, 2);
  assert.equal("authorUserId" in page.data[1], false);
  for (const bad of [
    { data: [msg(2), msg(1)], pagination: { limit: 50, after: 0, nextAfter: 2, hasMore: false } },
    { data: [msg(1)], pagination: { limit: 50, after: 1, nextAfter: 1, hasMore: false } },
    { data: [{ ...msg(1), chatId: "outro" }], pagination: { limit: 50, after: 0, nextAfter: 1, hasMore: false } },
    { data: [{ ...msg(1), kind: "HTML" }], pagination: { limit: 50, after: 0, nextAfter: 1, hasMore: false } },
    { data: [msg(1, { kind: "ORDER_LINK", orderId: null })], pagination: { limit: 50, after: 0, nextAfter: 1, hasMore: false } },
  ])
    assert.throws(() => parseMessages(bad, chatId, bad.pagination.after), ChatContractError);
});

test("polling deduplica por id e sequência", () => {
  const a = parseMessages({ data: [msg(1), msg(2)], pagination: { limit: 50, after: 0, nextAfter: 2, hasMore: false } }, chatId, 0).data;
  const r1 = mergeMessages([], a);
  const r2 = mergeMessages(r1.messages, [a[1], { ...a[1], id: "outro-id" }, { ...msg(3) } as ChatMessage]);
  assert.deepEqual(r2.messages.map((m) => m.sequence), [1, 2, 3]);
  assert.equal(r2.added.length, 1);
  assert.equal(mergeMessages(r2.messages, a).messages, r2.messages, "sem novidades mantém a mesma referência");
});

test("backoff 3 s → 6/12/24/30 s e classificação de erros", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(backoffMs), [3000, 6000, 12000, 24000, 30000, 30000]);
  assert.equal(isRetryable(new TypeError("rede")), true);
  assert.equal(isRetryable(new RequestError(503, "x")), true);
  assert.equal(isRetryable(new RequestError(429, "x")), false);
  for (const s of [401, 403, 404]) assert.equal(isAccessLoss(new RequestError(s, "x")), true);
  assert.equal(isAccessLoss(new RequestError(409, "x")), false);
  assert.match(sendErrorMessage(new RequestError(429, "x")), /próximo minuto/);
  assert.match(sendErrorMessage(new TypeError("x")), /sem risco de duplicar/);
});

test("texto: vazio e acima de 2000 recusados no cliente", () => {
  assert.notEqual(textProblem("   "), "");
  assert.equal(textProblem("Bom dia"), "");
  assert.notEqual(textProblem("a".repeat(2001)), "");
  assert.equal(textProblem(" " + "a".repeat(2000) + " "), "");
});

test("proxy: rotas de chat para os três públicos; LEITOR só lê", () => {
  const messages = "/chats/" + chatId + "/messages";
  for (const a of ["producer", "cooperative", "institution"] as const) {
    assert.equal(allowedProxyPath("/chats", "GET", a, "LEITOR"), true);
    assert.equal(allowedProxyPath(messages, "GET", a, "LEITOR"), true);
    assert.equal(allowedProxyPath(messages, "POST", a, "LEITOR"), false);
    assert.equal(allowedProxyPath("/chats/open", "POST", a, "LEITOR"), false);
    assert.equal(allowedProxyPath(messages, "POST", a, "EDITOR"), true);
    assert.equal(allowedProxyPath("/chats/open", "POST", a, "ADMIN"), true);
    assert.equal(allowedProxyPath("/chats/abc/messages", "GET", a), false);
    assert.equal(allowedProxyPath("/chats/" + chatId, "GET", a), false);
    assert.equal(allowedProxyPath("/chats", "POST", a), false);
    assert.equal(pageAllowed("/mensagens", a), true);
  }
  assert.equal(allowedProxyQuery("?limit=100&after=12", "cooperative"), true);
  assert.equal(allowedProxyQuery("?after=-1", "institution"), false);
});
