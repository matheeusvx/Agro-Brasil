"use client";
import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  Sprout,
  Tags,
  ClipboardList,
  Check,
  Truck,
  PackageCheck,
  X,
  ArrowLeft,
  ArrowUpRight,
} from "lucide-react";
import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "./ui/table";
import { allRows, agro } from "@/lib/client-api";
import {
  buildFlow,
  stages,
  type FlowEvent,
  type TraceOrder,
} from "@/lib/trace-flow";
import { number, statusName } from "@/lib/types";
const icons: Record<string, typeof Sprout> = {
  ORIGEM_REGISTRADA: Sprout,
  OFERTA_PUBLICADA: Tags,
  PEDIDO_SOLICITADO: ClipboardList,
  PEDIDO_ACEITO: Check,
  RETIRADA_REGISTRADA: Truck,
  RECEBIMENTO_CONFIRMADO: PackageCheck,
  PEDIDO_CANCELADO: X,
};
export function TracePage({ id }: { id?: string }) {
  const { workspace, session, loading, error: contextError } = usePortal();
  const [orders, setOrders] = useState<TraceOrder[]>([]),
    [events, setEvents] = useState<FlowEvent[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    setQuery(
      !id
        ? (new URLSearchParams(window.location.search).get("lote") ?? "")
        : "",
    );
    setStatus("");
    setPage(0);
  }, [session.organizationId, workspace?.property.id]);
  useEffect(() => {
    if (!workspace || loading) return;
    const abort = new AbortController();
    setBusy(true);
    setError("");
    setOrders([]);
    setEvents([]);
    async function load() {
      try {
        const rows = await allRows<TraceOrder>("/orders", abort.signal);
        const authorized = rows.filter(
          (o) =>
            o.sellerOrganizationId === session.organizationId &&
            workspace!.productions.some((p) => p.lot.id === o.lotId),
        );
        if (id) {
          const order = authorized.find((o) => o.id === id);
          if (!order)
            throw new Error(
              "Pedido inexistente ou indisponível na organização e propriedade selecionadas.",
            );
          const lot = await agro<{ data: { id: string } }>(
            "/lots/" + order.lotId,
            abort.signal,
          );
          if (lot.data.id !== order.lotId)
            throw new Error("Lote indisponível.");
          const data = await allRows<FlowEvent>(
            "/lots/" + order.lotId + "/events",
            abort.signal,
          );
          if (!abort.signal.aborted) setEvents(data);
        }
        if (!abort.signal.aborted) setOrders(authorized);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar a rastreabilidade.",
          );
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => abort.abort();
  }, [workspace, loading, session.organizationId, id, revision]);
  useEffect(() => setPage(0), [query, status]);
  if (loading || contextError || !workspace) return <WorkspaceState />;
  const order = orders.find((o) => o.id === id),
    production = workspace.productions.find((p) => p.lot.id === order?.lotId);
  const filtered = orders.filter(
    (o) =>
      (!status || o.status === status) &&
      `${o.id} ${o.lotId} ${workspace.productions.find((p) => p.lot.id === o.lotId)?.cropName}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="trace-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DO CAMPO AO DESTINO</p>
          <h1>{id ? "Trajetória do pedido" : "Rastreabilidade"}</h1>
          <p>
            {id
              ? "Origem e movimentações confirmadas, em um só caminho."
              : "Selecione um pedido para conhecer o caminho da sua produção."}
          </p>
        </div>
        {id && (
          <Link className="text-link" href="/rastreabilidade">
            <ArrowLeft size={16} />
            Voltar aos pedidos
          </Link>
        )}
      </div>
      {busy ? (
        <div className="trace-loading panel p-8" role="status">
          Consultando pedidos e eventos autorizados…
          {id && (
            <div className="trace-loading-grid" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} />
              ))}
            </div>
          )}
        </div>
      ) : error ? (
        <div className="panel p-8" role="alert">
          <p>{error}</p>
          <Button className="mt-4" onClick={() => setRevision((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : id && order ? (
        <>
          <div className="trace-summary">
            <strong>
              {production?.cropName} · {number(order.quantityKg)} kg
            </strong>
            <span>Pedido {order.id.slice(0, 8)}</span>
            <span>Lote {order.lotId.slice(0, 8)}</span>
            <span>{statusName(order.status)}</span>
          </div>
          <TraceGraph
            key={id + session.organizationId + workspace.property.id}
            order={order}
            events={events}
            orgName={
              session.memberships.find(
                (m) => m.organizationId === session.organizationId,
              )?.name ?? ""
            }
            orgId={session.organizationId}
          />
        </>
      ) : (
        <section className="panel production-panel">
          <div className="list-toolbar">
            <Input
              className="list-search"
              aria-label="Buscar rastreabilidade"
              placeholder="Pedido, lote ou cultura…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="filter-controls">
              <select
                aria-label="Filtrar situação"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todas as situações</option>
                {[
                  "SOLICITADO",
                  "ACEITO",
                  "RETIRADO",
                  "RECEBIDO",
                  "CANCELADO",
                ].map((s) => (
                  <option key={s} value={s}>
                    {statusName(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Cultura / quantidade",
                  "Pedido",
                  "Lote",
                  "Situação",
                  "Trajetória",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(page * 8, page * 8 + 8).map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <strong>
                      {
                        workspace.productions.find((p) => p.lot.id === o.lotId)
                          ?.cropName
                      }
                    </strong>
                    <small className="block">{number(o.quantityKg)} kg</small>
                  </TableCell>
                  <TableCell>
                    <code>{o.id.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell>
                    <code>{o.lotId.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell>{statusName(o.status)}</TableCell>
                  <TableCell>
                    <Link
                      className="text-link"
                      href={"/rastreabilidade/" + o.id}
                    >
                      Visualizar rastreabilidade
                      <ArrowUpRight size={15} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && (
            <p className="p-8">
              Nenhum pedido rastreável encontrado neste contexto.
            </p>
          )}
          <div className="table-footer">
            <span>
              {filtered.length} pedidos · Página {page + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={(page + 1) * 8 >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
export function TraceGraph({
  order,
  events,
  orgName,
  orgId,
  fillWithheld = false,
  note = "Consulta de eventos confirmados. Não representa localização GPS em tempo real. Ações de negócio são realizadas no módulo Pedidos.",
}: {
  order: TraceOrder;
  events: FlowEvent[];
  orgName: string;
  orgId: string;
  /** Cooperativa/instituição: etapas anteriores não compartilhadas pela API. */
  fillWithheld?: boolean;
  note?: string;
}) {
  const { nodes, current } = buildFlow(order, events, { fillWithheld });
  const [selected, setSelected] = useState(current ?? nodes[0]?.key),
    [paths, setPaths] = useState<
      { d: string; future: boolean; cancel: boolean }[]
    >([]);
  const canvas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    function measure() {
      const parent = { left: 0, top: 0 };
      const boxes = Array.from(
        el!.querySelectorAll<HTMLButtonElement>(".trace-node"),
      ).map((n) => ({
        left: n.offsetLeft,
        top: n.offsetTop,
        right: n.offsetLeft + n.offsetWidth,
        bottom: n.offsetTop + n.offsetHeight,
        width: n.offsetWidth,
        height: n.offsetHeight,
      }));
      setPaths(
        boxes.slice(1).map((b, i) => {
          const a = boxes[i];
          const horizontal =
            Math.abs(a.top - b.top) < 80 && Math.abs(a.left - b.left) > 20;
          let x1 = horizontal
              ? b.left > a.left
                ? a.right
                : a.left
              : a.left + a.width / 2,
            y1 = horizontal ? a.top + a.height / 2 : a.bottom,
            x2 = horizontal
              ? b.left > a.left
                ? b.left
                : b.right
              : b.left + b.width / 2,
            y2 = horizontal ? b.top + b.height / 2 : b.top;
          x1 -= parent.left;
          x2 -= parent.left;
          y1 -= parent.top;
          y2 -= parent.top;
          const d = horizontal
            ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
            : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
          return {
            d,
            future: nodes[i + 1].future,
            cancel: nodes[i + 1].type === "PEDIDO_CANCELADO",
          };
        }),
      );
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll(".trace-node").forEach((n) => observer.observe(n));
    measure();
    return () => observer.disconnect();
  }, [order.id, events]);
  const node = nodes.find((n) => n.key === selected),
    event = node?.event;
  return (
    <>
      <p className="trace-guide">
        Selecione uma etapa para consultar seus registros. Etapas futuras são
        possibilidades, sem movimentação confirmada.
      </p>
      <div className="trace-workspace">
        <div
          className="trace-canvas"
          ref={canvas}
          aria-label="Fluxo de rastreabilidade"
        >
          <svg className="trace-edges" aria-hidden="true">
            <defs>
              <marker
                id="trace-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#70916c" />
              </marker>
            </defs>
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                markerEnd="url(#trace-arrow)"
                data-future={p.future}
                data-cancel={p.cancel}
                pathLength={1}
                style={{ "--step": i } as CSSProperties}
              />
            ))}
          </svg>
          <div className="trace-grid">
            {nodes.map((n, i) => {
              const Icon = icons[n.type] ?? ClipboardList;
              const row = Math.floor(i / 3),
                col = row % 2 ? 3 - (i % 3) : (i % 3) + 1;
              return (
                <button
                  key={n.key}
                  className="trace-node"
                  style={
                    {
                      "--step": i,
                      "--col": col,
                      "--row": row + 1,
                    } as CSSProperties
                  }
                  data-future={n.future}
                  data-withheld={n.withheld || undefined}
                  data-current={n.key === current}
                  data-selected={selected === n.key}
                  data-cancel={n.type === "PEDIDO_CANCELADO"}
                  aria-pressed={selected === n.key}
                  onClick={() => setSelected(n.key)}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowRight",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowUp",
                        "Home",
                        "End",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? nodes.length - 1
                            : Math.max(
                                0,
                                Math.min(
                                  nodes.length - 1,
                                  i +
                                    (e.key === "ArrowRight" ||
                                    e.key === "ArrowDown"
                                      ? 1
                                      : -1),
                                ),
                              );
                      setSelected(nodes[next].key);
                      canvas.current
                        ?.querySelectorAll<HTMLButtonElement>(".trace-node")
                        [next]?.focus();
                    }
                  }}
                >
                  <span className="trace-node-head">
                    <Icon size={18} />
                    <span>
                      {n.future
                        ? "Etapa possível"
                        : n.key === current
                          ? "Etapa atual"
                          : "Confirmada"}
                    </span>
                  </span>
                  <strong>{n.title}</strong>
                  <small>
                    {n.future
                      ? "Ainda não realizada"
                      : !n.event
                        ? "Data não compartilhada"
                        : new Date(n.event.recordedAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                  </small>
                  <span className="trace-port trace-port-in" />
                  <span className="trace-port trace-port-out" />
                </button>
              );
            })}
          </div>
        </div>
        <aside className="panel trace-detail" aria-live="polite">
          <div key={selected} className="trace-detail-content">
            <p className="eyebrow">DETALHES DA ETAPA</p>
            <h2>{node?.title ?? "Nenhum evento registrado"}</h2>
            {event ? (
              <dl>
                <dt>Registrado em</dt>
                <dd>{new Date(event.recordedAt).toLocaleString("pt-BR")}</dd>
                <dt>Município / UF</dt>
                <dd>
                  {event.location
                    ? `${event.location.municipality} / ${event.location.uf}`
                    : "Não informado no evento"}
                </dd>
                {event.responsibleOrganizationId && (
                  <>
                    <dt>Organização responsável</dt>
                    <dd>
                      {event.responsibleOrganizationId === orgId
                        ? orgName
                        : "Outro participante da operação"}
                    </dd>
                  </>
                )}
                {typeof event.quantityGrams === "number" && (
                  <>
                    <dt>Quantidade do evento</dt>
                    <dd>{number(event.quantityGrams / 1000)} kg</dd>
                  </>
                )}
                {event.id && (
                  <>
                    <dt>Identificador do evento</dt>
                    <dd>
                      <code>{event.id}</code>
                    </dd>
                  </>
                )}
                <dt>Pedido consultado</dt>
                <dd>
                  <code>{order.id}</code>
                </dd>
              </dl>
            ) : (
              <p>
                {node?.withheld
                  ? "Etapa concluída antes do seu pedido. A data e o local deste registro não são compartilhados com o seu perfil; nada foi estimado."
                  : node
                  ? "Esta etapa ainda não possui evento confirmado. Nenhuma data ou localização foi estimada."
                  : "A situação do pedido não substitui registros de movimentação."}
              </p>
            )}
          </div>
        </aside>
      </div>
      <p className="data-note">{note}</p>
    </>
  );
}
