// Chat interno — contratos de docs/requisitos/api.md (Chat interno — MVP).
// O portal só valida, deduplica e apresenta; a API decide quem conversa.
import { RequestError } from "./client-api";

export type Chat = {
  id: string;
  organizationIds: [string, string];
  createdAt: string;
  /** Campos opcionais: usados se o backend passar a enviá-los (ver contrato sugerido). */
  counterpart?: { id: string; name?: string; type?: string };
  lastMessage?: { kind: "TEXT" | "ORDER_LINK"; text: string | null; createdAt: string; fromSelf?: boolean; sequence?: number };
};
export type ChatMessage = {
  id: string;
  chatId: string;
  sequence: number;
  kind: "TEXT" | "ORDER_LINK";
  senderOrganizationId: string | null;
  text: string | null;
  orderId: string | null;
  createdAt: string;
};
export type MessagePage = {
  data: ChatMessage[];
  pagination: { limit: number; after: number; nextAfter: number; hasMore: boolean };
};

export class ChatContractError extends Error {
  constructor(detail: string) {
    super("As mensagens recebidas não seguem o formato esperado. Nada foi exibido.");
    this.cause = detail;
  }
}
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const time = (v: unknown) => str(v) && !Number.isNaN(Date.parse(v));
const int = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;

/** Lista: só conversas que incluem a organização ativa. */
export function parseChats(body: unknown, organizationId: string) {
  if (!obj(body) || !Array.isArray(body.data) || !obj(body.pagination)) throw new ChatContractError("chats");
  const p = body.pagination;
  if (!int(p.total) || !int(p.limit) || !int(p.offset)) throw new ChatContractError("chats.pagination");
  const data: Chat[] = body.data.map((c, i) => {
    if (!obj(c) || !str(c.id) || !Array.isArray(c.organizationIds) || c.organizationIds.length !== 2 || !c.organizationIds.every(str) || !time(c.createdAt))
      throw new ChatContractError("chats." + i);
    if (!c.organizationIds.includes(organizationId)) throw new ChatContractError("chats." + i + ".organization");
    const chat: Chat = { id: c.id, organizationIds: c.organizationIds as [string, string], createdAt: c.createdAt as string };
    if (obj(c.counterpart) && str(c.counterpart.id))
      chat.counterpart = { id: c.counterpart.id, name: str(c.counterpart.name) ? c.counterpart.name : undefined, type: str(c.counterpart.type) ? c.counterpart.type : undefined };
    if (obj(c.lastMessage) && (c.lastMessage.kind === "TEXT" || c.lastMessage.kind === "ORDER_LINK") && time(c.lastMessage.createdAt))
      chat.lastMessage = {
        kind: c.lastMessage.kind,
        text: typeof c.lastMessage.text === "string" ? c.lastMessage.text : null,
        createdAt: c.lastMessage.createdAt as string,
        fromSelf: typeof c.lastMessage.fromSelf === "boolean" ? c.lastMessage.fromSelf : undefined,
        sequence: int(c.lastMessage.sequence) ? (c.lastMessage.sequence as number) : undefined,
      };
    return chat;
  });
  return { data, pagination: { total: p.total as number, limit: p.limit as number, offset: p.offset as number } };
}
export function parseChat(body: unknown, organizationId: string): Chat {
  if (!obj(body) || !obj(body.data)) throw new ChatContractError("chat");
  return parseChats({ data: [body.data], pagination: { total: 1, limit: 1, offset: 0 } }, organizationId).data[0];
}
function parseMessage(m: unknown, chatId: string, i: number): ChatMessage {
  if (!obj(m) || !str(m.id) || m.chatId !== chatId || !int(m.sequence) || (m.sequence as number) < 1 || !time(m.createdAt))
    throw new ChatContractError("messages." + i);
  if (m.kind === "TEXT") {
    if (typeof m.text !== "string" || !str(m.senderOrganizationId)) throw new ChatContractError("messages." + i + ".text");
  } else if (m.kind === "ORDER_LINK") {
    if (!str(m.orderId)) throw new ChatContractError("messages." + i + ".order");
  } else throw new ChatContractError("messages." + i + ".kind");
  // Projeção explícita: nada além do contrato chega à tela.
  return {
    id: m.id,
    chatId,
    sequence: m.sequence as number,
    kind: m.kind,
    senderOrganizationId: str(m.senderOrganizationId) ? m.senderOrganizationId : null,
    text: m.kind === "TEXT" ? (m.text as string) : null,
    orderId: str(m.orderId) ? m.orderId : null,
    createdAt: m.createdAt as string,
  };
}
export function parseMessages(body: unknown, chatId: string, after: number): MessagePage {
  if (!obj(body) || !Array.isArray(body.data) || !obj(body.pagination)) throw new ChatContractError("messages");
  const p = body.pagination;
  if (!int(p.limit) || !int(p.after) || !int(p.nextAfter) || typeof p.hasMore !== "boolean" || p.after !== after || (p.nextAfter as number) < after)
    throw new ChatContractError("messages.pagination");
  const data = body.data.map((m, i) => parseMessage(m, chatId, i));
  for (let i = 0; i < data.length; i++)
    if (data[i].sequence <= after || (i > 0 && data[i].sequence <= data[i - 1].sequence)) throw new ChatContractError("messages.order");
  return { data, pagination: { limit: p.limit as number, after, nextAfter: p.nextAfter as number, hasMore: p.hasMore } };
}

/** Junta páginas/polling sem duplicar (id ou sequência) e em ordem crescente. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const ids = new Set(current.map((m) => m.id));
  const seqs = new Set(current.map((m) => m.sequence));
  const fresh = incoming.filter((m) => !ids.has(m.id) && !seqs.has(m.sequence));
  if (!fresh.length) return { messages: current, added: [] as ChatMessage[] };
  return { messages: [...current, ...fresh].sort((a, b) => a.sequence - b.sequence), added: fresh };
}

/** Polling a cada 3 s; rede/5xx aplicam 6/12/24/30 s. */
export const POLL_MS = 3000;
export function backoffMs(failures: number) {
  return failures <= 0 ? POLL_MS : [6000, 12000, 24000, 30000][Math.min(failures, 4) - 1];
}
export const isAccessLoss = (e: unknown) => e instanceof RequestError && [401, 403, 404].includes(e.status);
export const isRetryable = (e: unknown) => !(e instanceof RequestError) || e.status >= 500;

export function sendErrorMessage(e: unknown) {
  if (!(e instanceof RequestError)) return "Sem conexão. A mensagem não foi confirmada; tente de novo sem risco de duplicar.";
  switch (e.status) {
    case 400:
    case 413:
      return "Mensagem inválida: use texto simples de até 2000 caracteres.";
    case 403:
      return "Seu perfil não pode enviar mensagens nesta organização.";
    case 404:
      return "Esta conversa não está mais disponível para sua organização.";
    case 409:
      return "Conflito no envio. Revise o texto e envie novamente.";
    case 429:
      return "Limite de mensagens por minuto atingido. Aguarde o próximo minuto e tente de novo.";
    default:
      return "O serviço não confirmou o envio. Tente de novo sem risco de duplicar.";
  }
}

export const MAX_TEXT = 2000;
/** Mesmo limite do backend: unidades UTF-16 após trim. */
export const textProblem = (text: string) =>
  !text.trim() ? "Escreva uma mensagem." : text.trim().length > MAX_TEXT ? `Use no máximo ${MAX_TEXT} caracteres.` : "";

export const organizationTypeLabel = (type?: string) =>
  ({ PEQUENO_PRODUTOR_RURAL: "Produtor rural", COOPERATIVA: "Cooperativa", INSTITUICAO: "Instituição", COMPRADOR_LOCAL: "Comprador local" })[type ?? ""] ?? "Organização parceira";
export const counterpartOf = (chat: Chat, organizationId: string) =>
  chat.counterpart?.id ?? chat.organizationIds.find((id) => id !== organizationId) ?? chat.organizationIds[0];
export const shortOrg = (id: string) => "#" + id.replace(/-/g, "").slice(0, 6).toUpperCase();
