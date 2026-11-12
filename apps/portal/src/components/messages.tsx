"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Eye,
  Link2,
  LoaderCircle,
  MessagesSquare,
  RefreshCw,
  Search,
  SendHorizontal,
} from "lucide-react";
import { request, RequestError } from "@/lib/client-api";
import { IdempotencyKeeper } from "@/lib/commands";
import {
  backoffMs,
  counterpartOf,
  isAccessLoss,
  isRetryable,
  mergeMessages,
  organizationTypeLabel,
  parseChats,
  parseMessages,
  sendErrorMessage,
  shortOrg,
  textProblem,
  MAX_TEXT,
  POLL_MS,
  type Chat,
  type ChatMessage,
} from "@/lib/chat";
import type { Audience } from "@/lib/audience";
import { usePortal } from "./portal-provider";
import { Skeleton } from "./ui/skeleton";

/** Dicas de tipo da contraparte vindas do botão "Enviar mensagem" (memória da aba). */
export const chatHints = new Map<string, string>();
type Names = Record<string, { name?: string; type?: string }>;
type Preview = { last: ChatMessage | null; cursor: number };

const hhmm = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const orderHref = (audience: Audience, id: string) =>
  (audience === "producer" ? "/rastreabilidade/" : audience === "cooperative" ? "/remessas/" : "/solicitacoes/") + id;
const shortOrder = (id: string) => "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/** Lê todas as páginas a partir de `after`, sem sobrepor chamadas. */
async function readFrom(chatId: string, after: number, signal: AbortSignal) {
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

export function Messages() {
  const { session, member, audience, handleAccessError, revision } = usePortal();
  const me = session.organizationId;
  const writer = member.role === "ADMIN" || member.role === "EDITOR";
  const [list, setList] = useState<{ status: "loading" | "ready" | "error"; chats: Chat[]; error?: string }>({ status: "loading", chats: [] });
  const [names, setNames] = useState<Names>({});
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const previewRef = useRef(previews);
  previewRef.current = previews;

  // Conversa indicada na URL (botão "Enviar mensagem").
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversa");
    if (id) setSelected(id);
  }, []);
  const select = useCallback((id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("conversa", id);
    else url.searchParams.delete("conversa");
    window.history.replaceState(null, "", url);
  }, []);

  // Nomes: vínculos da própria sessão e catálogo público de cooperativas.
  useEffect(() => {
    const abort = new AbortController();
    const own: Names = Object.fromEntries(session.memberships.map((m) => [m.organizationId, { name: m.name, type: m.type }]));
    setNames(own);
    request<{ data?: { id: string; name: string }[] }>("/api/agro/cooperatives", {}, abort.signal)
      .then((body) => {
        if (abort.signal.aborted || !Array.isArray(body.data)) return;
        setNames((n) => ({ ...Object.fromEntries(body.data!.filter((c) => typeof c.id === "string" && typeof c.name === "string").map((c) => [c.id, { name: c.name, type: "COOPERATIVA" }])), ...n }));
      })
      .catch(() => {});
    return () => abort.abort();
  }, [session.memberships]);

  // Lista de conversas + prévia incremental (cursor por conversa), a cada 20 s visível.
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let first = true;
    async function load() {
      if (hidden()) return schedule(POLL_MS);
      try {
        const chats: Chat[] = [];
        for (let offset = 0; offset < 500; offset += 100) {
          const body = await request<unknown>(`/api/agro/chats?limit=100&offset=${offset}`, {}, abort.signal);
          const page = parseChats(body, me);
          chats.push(...page.data);
          if (offset + 100 >= page.pagination.total) break;
        }
        if (abort.signal.aborted) return;
        setList({ status: "ready", chats });
        // Prévias: só o que chegou depois do último cursor conhecido.
        for (const chat of chats.slice(0, 30)) {
          if (abort.signal.aborted) return;
          const before = previewRef.current[chat.id];
          try {
            const { messages, cursor } = await readFrom(chat.id, before?.cursor ?? 0, abort.signal);
            const last = messages.at(-1) ?? before?.last ?? null;
            setPreviews((p) => ({ ...p, [chat.id]: { last, cursor } }));
            if (!before) setSeen((s) => (chat.id in s ? s : { ...s, [chat.id]: last?.sequence ?? 0 }));
          } catch (e) {
            if (isAccessLoss(e) && !(e instanceof RequestError && e.status === 404)) throw e;
          }
        }
        failures = 0;
        first = false;
        schedule(20000);
      } catch (e) {
        if (abort.signal.aborted) return;
        if (isAccessLoss(e)) {
          setList({ status: "error", chats: [], error: e instanceof Error ? e.message : "" });
          handleAccessError(e);
          return;
        }
        failures++;
        if (first) setList({ status: "error", chats: [], error: e instanceof Error ? e.message : "Conversas indisponíveis." });
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
  }, [me, revision, handleAccessError]);

  const label = useCallback(
    (chat: Chat) => {
      const id = counterpartOf(chat, me);
      const info = { ...names[id], ...(chat.counterpart?.name ? { name: chat.counterpart.name } : {}), ...(chat.counterpart?.type ? { type: chat.counterpart.type } : {}) };
      const type = info.type ?? chatHints.get(chat.id);
      return { id, name: info.name ?? `${organizationTypeLabel(type)} ${shortOrg(id)}`, type: organizationTypeLabel(type), known: Boolean(info.name) };
    },
    [names, me],
  );
  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return list.chats
      .map((c) => ({ chat: c, label: label(c), preview: previews[c.id] }))
      .filter(({ label: l, preview }) => !q || `${l.name} ${l.type} ${preview?.last?.text ?? ""}`.toLocaleLowerCase("pt-BR").includes(q))
      .sort((a, b) => Date.parse(b.preview?.last?.createdAt ?? b.chat.createdAt) - Date.parse(a.preview?.last?.createdAt ?? a.chat.createdAt));
  }, [list.chats, label, previews, query]);
  const active = list.chats.find((c) => c.id === selected) ?? null;
  const markSeen = useCallback((chatId: string, last: ChatMessage | null, cursor: number) => {
    setSeen((s) => ({ ...s, [chatId]: last?.sequence ?? s[chatId] ?? 0 }));
    if (last) setPreviews((p) => ({ ...p, [chatId]: { last, cursor: Math.max(cursor, p[chatId]?.cursor ?? 0) } }));
  }, []);

  return (
    <div className="chat-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMUNICAÇÃO ENTRE PARCEIROS</p>
          <h1>Mensagens</h1>
          <p>Uma conversa por organização parceira, com os pedidos que vocês compartilham.</p>
        </div>
      </div>
      <div className="chat-layout panel" data-view={selected ? "thread" : "list"}>
        <aside className="chat-list" aria-label="Conversas">
          <label className="chat-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Pesquisar conversas</span>
            <input type="search" placeholder="Pesquisar conversas" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {list.status === "loading" ? (
            <div role="status" aria-label="Carregando conversas" className="chat-skeleton">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : list.status === "error" ? (
            <div className="chat-empty" role="alert">
              <AlertCircle size={20} />
              <p>{list.error || "Não foi possível carregar as conversas."}</p>
            </div>
          ) : !sorted.length ? (
            <div className="chat-empty">
              <MessagesSquare size={22} aria-hidden="true" />
              <p>
                {query
                  ? "Nenhuma conversa encontrada."
                  : writer
                    ? "Nenhuma conversa ainda. Use “Enviar mensagem” em um pedido para falar com a outra organização."
                    : "Nenhuma conversa disponível para sua organização."}
              </p>
            </div>
          ) : (
            <ul>
              {sorted.map(({ chat, label: l, preview }, i) => {
                const last = preview?.last;
                const unread = last && last.sequence > (seen[chat.id] ?? last.sequence) && selected !== chat.id;
                return (
                  <li key={chat.id} className="chat-item" style={{ "--i": Math.min(i, 6) } as CSSProperties}>
                    <button type="button" aria-current={selected === chat.id ? "true" : undefined} onClick={() => select(chat.id)}>
                      <span className="chat-avatar" aria-hidden="true">{l.name.charAt(0).toUpperCase()}</span>
                      <span className="chat-item-body">
                        <span className="chat-item-top">
                          <strong>{l.name}</strong>
                          {last && <time dateTime={last.createdAt}>{hhmm(last.createdAt)}</time>}
                        </span>
                        <span className="chat-item-type">{l.type}</span>
                        <span className="chat-item-last">
                          {!last
                            ? preview
                              ? "Sem mensagens ainda"
                              : "Carregando…"
                            : last.kind === "ORDER_LINK"
                              ? `Pedido ${shortOrder(last.orderId!)} associado`
                              : (last.senderOrganizationId === me ? "Você: " : "") + last.text}
                        </span>
                      </span>
                      {unread && <span className="chat-unread" aria-label="Mensagens novas nesta sessão" title="Novas desde que você abriu o portal" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
        <section className="chat-main" aria-label="Conversa selecionada">
          {selected && list.status !== "loading" && !active ? (
            <div className="chat-empty" role="alert">
              <AlertCircle size={20} />
              <p>Conversa indisponível para esta organização.</p>
              <button type="button" className="ag-btn chat-back-btn" onClick={() => select(null)}>
                Voltar às conversas
              </button>
            </div>
          ) : active ? (
            <Thread
              key={active.id}
              chat={active}
              title={label(active)}
              writer={writer}
              onBack={() => select(null)}
              onSeen={markSeen}
            />
          ) : (
            <div className="chat-empty chat-placeholder">
              <MessagesSquare size={28} aria-hidden="true" />
              <p>Selecione uma conversa para ver o histórico.</p>
            </div>
          )}
        </section>
      </div>
      <p className="data-note">
        Mensagens em texto simples entre organizações com pedido em comum. Atualização automática a cada 3 segundos na conversa aberta.
        O indicador de novas considera apenas esta sessão; não há confirmação de leitura.
      </p>
    </div>
  );
}

type Pending = { localId: string; text: string; state: "sending" | "failed"; error?: string };

function Thread({
  chat,
  title,
  writer,
  onBack,
  onSeen,
}: {
  chat: Chat;
  title: { name: string; type: string };
  writer: boolean;
  onBack: () => void;
  onSeen: (chatId: string, last: ChatMessage | null, cursor: number) => void;
}) {
  const { session, audience, handleAccessError } = usePortal();
  const me = session.organizationId;
  const [status, setStatus] = useState<"loading" | "ready" | "lost" | "error">("loading");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [below, setBelow] = useState(0);
  const [offline, setOffline] = useState(false);
  const cursor = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const forceBottom = useRef(true);
  const keeper = useRef(new IdempotencyKeeper());
  const abortRef = useRef<AbortController | null>(null);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  const lose = useCallback(
    (e: unknown) => {
      abortRef.current?.abort();
      messagesRef.current = [];
      setMessages([]);
      setPending([]);
      setStatus("lost");
      setError(e instanceof RequestError && e.status === 404 ? "Esta conversa não está mais disponível para sua organização." : "Acesso à conversa encerrado.");
      handleAccessError(e);
    },
    [handleAccessError],
  );
  const apply = useCallback(
    (incoming: ChatMessage[], initial = false) => {
      // Mescla fora do updater do React: atualizar o componente pai (Messages)
      // dentro de um updater de estado do Thread gera aviso de setState em render.
      const { messages: next, added } = mergeMessages(messagesRef.current, incoming);
      if (!added.length) return;
      messagesRef.current = next;
      setMessages(next);
      if (!initial) {
        setFresh((f) => new Set([...f, ...added.map((m) => m.id)]));
        if (!pinned.current) setBelow((b) => b + added.length);
      }
      onSeenRef.current(chat.id, next.at(-1) ?? null, cursor.current);
    },
    [chat.id],
  );

  // Histórico completo e polling a cada 3 s, sem sobreposição; pausa em aba oculta.
  useEffect(() => {
    const abort = new AbortController();
    abortRef.current = abort;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let initial = true;
    async function tick() {
      if (hidden()) return schedule(POLL_MS);
      try {
        const page = await readFrom(chat.id, cursor.current, abort.signal);
        if (abort.signal.aborted) return;
        cursor.current = page.cursor;
        apply(page.messages, initial);
        if (initial) onSeenRef.current(chat.id, page.messages.at(-1) ?? null, page.cursor);
        initial = false;
        failures = 0;
        setOffline(false);
        setStatus("ready");
        schedule(POLL_MS);
      } catch (e) {
        if (abort.signal.aborted) return;
        if (isAccessLoss(e)) return lose(e);
        if (!isRetryable(e)) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Histórico indisponível.");
          return;
        }
        failures++;
        setOffline(true);
        if (initial) {
          setStatus("error");
          setError("Não foi possível carregar o histórico. Tentando novamente…");
        }
        schedule(backoffMs(failures));
      }
    }
    function schedule(ms: number) {
      clearTimeout(timer);
      if (!abort.signal.aborted) timer = setTimeout(tick, ms);
    }
    void tick();
    const wake = () => !hidden() && schedule(0);
    document.addEventListener("visibilitychange", wake);
    return () => {
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [chat.id, apply, lose]);

  // Rolagem: acompanha o fim só se a pessoa já estava no fim (ou acabou de enviar).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (forceBottom.current || pinned.current) {
      el.scrollTop = el.scrollHeight;
      forceBottom.current = false;
      setBelow(0);
    }
  }, [messages, pending]);
  const onScroll = () => {
    const el = scroller.current!;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (pinned.current) setBelow(0);
  };

  async function send(text: string, localId: string) {
    const signature = chat.id + "\n" + text;
    const key = keeper.current.keyFor(signature);
    setPending((p) => p.map((m) => (m.localId === localId ? { ...m, state: "sending", error: undefined } : m)));
    forceBottom.current = true;
    try {
      const body = await request<{ data: unknown }>(`/api/agro/chats/${chat.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Idempotency-Key": key },
      });
      keeper.current.settle();
      const sent = parseMessages({ data: [body.data], pagination: { limit: 1, after: 0, nextAfter: 0, hasMore: false } }, chat.id, 0).data[0];
      setPending((p) => p.filter((m) => m.localId !== localId));
      forceBottom.current = true;
      apply([sent]);
    } catch (e) {
      keeper.current.settle(e);
      if (isAccessLoss(e)) return lose(e);
      setPending((p) => p.map((m) => (m.localId === localId ? { ...m, state: "failed", error: sendErrorMessage(e) } : m)));
    }
  }
  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const problem = textProblem(draft);
    if (problem) return setDraftError(problem);
    if (pending.some((p) => p.state === "sending")) return;
    const text = draft.trim();
    const localId = crypto.randomUUID();
    setPending((p) => [...p, { localId, text, state: "sending" }]);
    setDraft("");
    setDraftError("");
    void send(text, localId);
  }

  return (
    <div className="chat-thread">
      <header className="chat-thread-head">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Voltar às conversas">
          <ArrowLeft size={18} />
        </button>
        <span className="chat-avatar" aria-hidden="true">{title.name.charAt(0).toUpperCase()}</span>
        <div>
          <h2>{title.name}</h2>
          <p>{title.type}</p>
        </div>
        {offline && (
          <span className="chat-offline" role="status">
            <RefreshCw size={13} aria-hidden="true" /> Reconectando…
          </span>
        )}
      </header>
      <div className="chat-scroll" ref={scroller} onScroll={onScroll} aria-live="polite" aria-relevant="additions" role="log" aria-label={"Histórico com " + title.name}>
        {status === "loading" ? (
          <div className="chat-empty" role="status">
            <LoaderCircle className="animate-spin" size={18} /> Carregando histórico…
          </div>
        ) : status === "lost" || (status === "error" && !messages.length) ? (
          <div className="chat-empty" role="alert">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        ) : !messages.length && !pending.length ? (
          <div className="chat-empty">
            <p>Nenhuma mensagem ainda.</p>
          </div>
        ) : (
          <ol className="chat-messages">
            {messages.map((m) =>
              m.kind === "ORDER_LINK" ? (
                <li key={m.id} className="chat-system" data-new={fresh.has(m.id) || undefined}>
                  <Link2 size={13} aria-hidden="true" />
                  <span>
                    Pedido associado à conversa ·{" "}
                    <Link href={orderHref(audience, m.orderId!)}>{shortOrder(m.orderId!)}</Link>
                  </span>
                  <time dateTime={m.createdAt}>{hhmm(m.createdAt)}</time>
                </li>
              ) : (
                <li
                  key={m.id}
                  className="chat-bubble"
                  data-mine={m.senderOrganizationId === me || undefined}
                  data-new={fresh.has(m.id) || undefined}
                >
                  <span className="sr-only">{m.senderOrganizationId === me ? "Sua organização" : title.name}: </span>
                  <p>{m.text}</p>
                  <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                </li>
              ),
            )}
            {pending.map((p) => (
              <li key={p.localId} className="chat-bubble" data-mine data-state={p.state} data-new>
                <p>{p.text}</p>
                {p.state === "sending" ? (
                  <span className="chat-meta">
                    <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> Enviando…
                  </span>
                ) : (
                  <span className="chat-meta chat-failed" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {p.error}{" "}
                    <button type="button" onClick={() => void send(p.text, p.localId)}>
                      Tentar de novo
                    </button>
                    <button type="button" onClick={() => setPending((all) => all.filter((x) => x.localId !== p.localId))}>
                      Descartar
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      {below > 0 && (
        <button
          type="button"
          className="chat-new-pill"
          onClick={() => {
            forceBottom.current = true;
            setBelow(0);
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
          }}
        >
          <ArrowDown size={14} aria-hidden="true" /> {below === 1 ? "1 nova mensagem" : `${below} novas mensagens`}
        </button>
      )}
      {status !== "lost" &&
        (writer ? (
          <form className="chat-composer" onSubmit={submit}>
            <label htmlFor="chat-draft" className="sr-only">
              Mensagem para {title.name}
            </label>
            <textarea
              id="chat-draft"
              rows={1}
              value={draft}
              maxLength={MAX_TEXT + 50}
              placeholder="Escreva uma mensagem"
              aria-invalid={Boolean(draftError) || undefined}
              aria-describedby={draftError ? "chat-draft-error" : undefined}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button type="submit" className="chat-send" aria-label="Enviar mensagem" disabled={pending.some((p) => p.state === "sending")}>
              <SendHorizontal size={18} />
            </button>
            {draftError && (
              <p id="chat-draft-error" className="chat-draft-error" role="alert">
                {draftError}
              </p>
            )}
          </form>
        ) : (
          <p className="chat-readonly">
            <Eye size={14} aria-hidden="true" /> Seu perfil é de consulta: você acompanha a conversa, mas não envia mensagens.
          </p>
        ))}
    </div>
  );
}
