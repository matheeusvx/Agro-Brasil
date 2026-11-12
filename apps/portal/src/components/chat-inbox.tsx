"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { request, RequestError } from "@/lib/client-api";
import {
  backoffMs,
  countUnread,
  isAccessLoss,
  parseChats,
  parseMessages,
  POLL_MS,
  readSeen,
  writeSeen,
  type Chat,
  type ChatMessage,
} from "@/lib/chat";
import { usePortal } from "./portal-provider";

/** Intervalo da caixa de entrada (lista + novidades de cada conversa). */
export const INBOX_MS = 15000;
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

export type Preview = {
  last: ChatMessage | null;
  cursor: number;
  /** Sequências de textos recebidos da outra organização (base das não lidas). */
  incoming: number[];
};
type Inbox = {
  status: "loading" | "ready" | "error";
  error: string;
  chats: Chat[];
  previews: Record<string, Preview>;
  unread: (chatId: string) => number;
  total: number;
  /** Mensagens lidas pelo histórico aberto: evita buscar de novo e atualiza a prévia. */
  ingest: (chatId: string, messages: ChatMessage[], cursor: number) => void;
  markSeen: (chatId: string, sequence: number) => void;
};
const Context = createContext<Inbox | null>(null);
export const useInbox = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Caixa de mensagens ausente");
  return value;
};

/** Lê todas as páginas a partir de `after`, sem sobrepor chamadas. */
export async function readFrom(chatId: string, after: number, signal: AbortSignal) {
  let cursor = after;
  const all: ChatMessage[] = [];
  for (let i = 0; i < 50; i++) {
    const body = await request<unknown>(`/api/agro/chats/${chatId}/messages?limit=100&after=${cursor}`, {}, signal);
    const page = parseMessages(body, chatId, cursor);
    all.push(...page.data);
    cursor = page.pagination.nextAfter;
    if (!page.pagination.hasMore) break;
  }
  return { messages: all, cursor };
}

/**
 * Caixa de mensagens da organização ativa, compartilhada pelo menu lateral e
 * pela aba Mensagens. Remontada a cada troca de organização (key no shell).
 * Não lidas: textos da outra organização com sequência maior que a última
 * vista por esta pessoa nesta organização. O backend ainda não guarda leitura;
 * a marca fica neste navegador (só IDs e números, nunca token ou texto).
 */
export function ChatInboxProvider({ children }: { children: ReactNode }) {
  const { session, handleAccessError, revision } = usePortal();
  const me = session.organizationId;
  const storageKey = `agro:mensagens-lidas:v1:${session.userId}:${me}`;
  const [status, setStatus] = useState<Inbox["status"]>("loading");
  const [error, setError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [seen, setSeen] = useState<Record<string, number>>(() => readSeen(storageKey));
  const previewRef = useRef(previews);
  previewRef.current = previews;

  const ingest = useCallback(
    (chatId: string, messages: ChatMessage[], cursor: number) => {
      if (!messages.length && previewRef.current[chatId]?.cursor === cursor) return;
      setPreviews((p) => {
        const before = p[chatId] ?? { last: null, cursor: 0, incoming: [] };
        if (cursor < before.cursor) return p;
        const known = new Set(before.incoming);
        const incoming = [
          ...before.incoming,
          ...messages.filter((m) => m.kind === "TEXT" && m.senderOrganizationId !== me && !known.has(m.sequence)).map((m) => m.sequence),
        ];
        const last = messages.reduce<ChatMessage | null>((a, m) => (!a || m.sequence > a.sequence ? m : a), before.last);
        return { ...p, [chatId]: { last, cursor: Math.max(cursor, before.cursor), incoming } };
      });
    },
    [me],
  );
  const markSeen = useCallback(
    (chatId: string, sequence: number) => {
      setSeen((s) => {
        if ((s[chatId] ?? 0) >= sequence) return s;
        const next = { ...s, [chatId]: sequence };
        writeSeen(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let first = true;
    async function load() {
      if (hidden()) return schedule(POLL_MS);
      try {
        const list: Chat[] = [];
        for (let offset = 0; offset < 500; offset += 100) {
          const body = await request<unknown>(`/api/agro/chats?limit=100&offset=${offset}`, {}, abort.signal);
          const page = parseChats(body, me);
          list.push(...page.data);
          if (offset + 100 >= page.pagination.total) break;
        }
        if (abort.signal.aborted) return;
        setChats(list);
        setStatus("ready");
        // Novidades: só o que chegou depois do cursor conhecido de cada conversa.
        for (const chat of list.slice(0, 30)) {
          if (abort.signal.aborted) return;
          try {
            const { messages, cursor } = await readFrom(chat.id, previewRef.current[chat.id]?.cursor ?? 0, abort.signal);
            if (!abort.signal.aborted) ingest(chat.id, messages, cursor);
          } catch (e) {
            if (isAccessLoss(e) && !(e instanceof RequestError && e.status === 404)) throw e;
          }
        }
        failures = 0;
        first = false;
        schedule(INBOX_MS);
      } catch (e) {
        if (abort.signal.aborted) return;
        if (isAccessLoss(e)) {
          setChats([]);
          setPreviews({});
          setStatus("error");
          setError(e instanceof Error ? e.message : "");
          handleAccessError(e);
          return;
        }
        failures++;
        if (first) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Conversas indisponíveis.");
        }
        schedule(backoffMs(failures));
      }
    }
    function schedule(ms: number) {
      clearTimeout(timer);
      if (!abort.signal.aborted) timer = setTimeout(load, ms);
    }
    void load();
    const wake = () => !hidden() && schedule(0);
    document.addEventListener("visibilitychange", wake);
    return () => {
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [me, revision, handleAccessError, ingest]);

  const unread = useCallback((chatId: string) => countUnread(previews[chatId]?.incoming ?? [], seen[chatId] ?? 0), [previews, seen]);
  const total = useMemo(() => chats.reduce((sum, c) => sum + unread(c.id), 0), [chats, unread]);
  const value = useMemo(
    () => ({ status, error, chats, previews, unread, total, ingest, markSeen }),
    [status, error, chats, previews, unread, total, ingest, markSeen],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
