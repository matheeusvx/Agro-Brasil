"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ArrowUpRight, Check } from "lucide-react";
import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "./ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { allRows, request, RequestError } from "@/lib/client-api";
import { statusName, number } from "@/lib/types";
type Order = {
  id: string;
  lotId: string;
  offerId: string;
  quantityKg: number;
  status: string;
  createdAt: string;
  sellerOrganizationId: string;
  requesterOrganizationId: string;
  shipment?: {
    id: string;
    status: string;
    carrierOrganizationId: string | null;
  };
};
type Coop = { id: string; name: string };
const labels: Record<string, string> = Object.fromEntries(
  ["SOLICITADO", "ACEITO", "RETIRADO", "RECEBIDO", "CANCELADO"].map((s) => [s, statusName(s)]),
);
export function Orders() {
  const { workspace, session, loading, error: workspaceError } = usePortal();
  const [rows, setRows] = useState<Order[]>([]),
    [coops, setCoops] = useState<Coop[]>([]),
    [coopError, setCoopError] = useState(false),
    [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Order | null>(null),
    [open, setOpen] = useState(false),
    [action, setAction] = useState(""),
    [carrier, setCarrier] = useState(""),
    [city, setCity] = useState(""),
    [uf, setUf] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [feedback, setFeedback] = useState(""),
    [failure, setFailure] = useState("");
  const command = useRef<{ path: string; body: string; key: string } | null>(
      null,
    ),
    lock = useRef(false),
    scope = useRef("");
  const context = session.organizationId + ":" + workspace?.property.id;
  useEffect(() => {
    scope.current = context;
    setRows([]);
    setSelected(null);
    setOpen(false);
    setAction("");
    setUncertain(false);
    command.current = null;
    setQuery("");
    setFilter("");
    setPage(0);
  }, [context]);
  useEffect(() => {
    if (!workspace || loading) return;
    const abort = new AbortController();
    setPending(rows.length === 0);
    setError("");
    allRows<Order>("/orders", abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setRows(data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setPending(false);
      });
    setCoopError(false);
    request<{ data: Coop[] }>("/api/agro/cooperatives", {}, abort.signal)
      .then((r) => setCoops(r.data))
      .catch(() => {
        if (!abort.signal.aborted) {
          setCoops([]);
          setCoopError(true);
        }
      });
    return () => abort.abort();
  }, [workspace, loading, version]);
  useEffect(() => setPage(0), [query, filter]);
  useEffect(() => {
    const situacao = new URLSearchParams(window.location.search).get("situacao");
    if (situacao && situacao in labels) setFilter(situacao);
  }, []);
  if (loading || workspaceError || !workspace) return <WorkspaceState />;
  const lots = new Map(workspace.productions.map((p) => [p.lot.id, p]));
  const own = rows.filter(
    (o) =>
      o.sellerOrganizationId === session.organizationId && lots.has(o.lotId),
  );
  const filtered = own.filter(
    (o) =>
      (!filter || o.status === filter) &&
      `${lots.get(o.lotId)?.cropName} ${o.lotId} ${o.id}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const writable = workspace.home.canWrite;
  function choose(o: Order) {
    if (uncertain) return;
    setSelected(o);
    setOpen(true);
    setAction("");
    setFeedback("");
    setFailure("");
    setCarrier("");
    setConfirmed(false);
    const p = lots.get(o.lotId);
    setCity(p?.location.municipality ?? "");
    setUf(p?.location.uf ?? "");
  }
  async function execute(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || !writable || !selected) return;
    const currentScope = scope.current;
    if (!uncertain) {
      const path =
        action === "pickup"
          ? "/shipments/" + selected.shipment?.id + "/pickup"
          : "/orders/" + selected.id + "/" + action;
      command.current = {
        path,
        body: JSON.stringify({
          location: { municipality: city.trim(), uf: uf.toUpperCase() },
          locationConfirmed: confirmed,
          ...(action === "accept" && carrier
            ? { cooperativeOrganizationId: carrier }
            : {}),
        }),
        key: crypto.randomUUID(),
      };
    }
    const c = command.current;
    if (!c) return;
    lock.current = true;
    setBusy(true);
    setFailure("");
    try {
      const r = await request<{ data: Order }>("/api/agro" + c.path, {
        method: "POST",
        body: c.body,
        headers: { "Idempotency-Key": c.key },
      });
      if (scope.current !== currentScope) return;
      setRows((old) => old.map((o) => (o.id === r.data.id ? r.data : o)));
      setSelected(r.data);
      setFeedback("Operação concluída: " + labels[r.data.status] + ".");
      setUncertain(false);
      command.current = null;
      setAction("");
      setConfirmed(false);
      setVersion((v) => v + 1);
    } catch (e) {
      if (scope.current !== currentScope) return;
      const unknown = !(e instanceof RequestError) || e.status >= 500;
      setUncertain(unknown);
      if (!unknown) command.current = null;
      setFailure(
        unknown
          ? "Resposta não confirmada. Reenvie com a mesma chave para confirmar com segurança."
          : e instanceof Error
            ? e.message
            : "Operação indisponível.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const canAccept = selected?.status === "SOLICITADO",
    canCancel = selected && ["SOLICITADO", "ACEITO"].includes(selected.status),
    canPickup =
      selected?.status === "ACEITO" &&
      selected.shipment?.status === "PLANEJADA";
  return (
    <div className="orders-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SOLICITAÇÕES DA SUA PRODUÇÃO</p>
          <h1>Pedidos recebidos</h1>
          <p>Acompanhe solicitações, aceite e retirada dos seus lotes.</p>
        </div>
      </div>
      <section className="panel production-panel">
        <div className="list-toolbar">
          <Input
            className="list-search"
            aria-label="Pesquisar pedidos"
            placeholder="Buscar cultura, lote ou pedido…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-controls">
            <select
              aria-label="Situação do pedido"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Todas as situações</option>
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pending ? (
          <div className="p-10" role="status">
            <LoaderCircle className="animate-spin" />
            Consultando pedidos…
          </div>
        ) : error ? (
          <div role="alert" className="p-8">
            <p>{error}</p>
            <Button onClick={() => setVersion((v) => v + 1)}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "Cultura / lote",
                    "Quantidade",
                    "Situação",
                    "Data da solicitação",
                    "Detalhes",
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(page * 8, page * 8 + 8).map((o) => (
                  <TableRow
                    key={o.id}
                    data-selected={open && selected?.id === o.id}
                    className="order-row"
                  >
                    <TableCell>
                      <strong>{lots.get(o.lotId)?.cropName}</strong>
                      <small className="block">
                        Lote {o.lotId.slice(0, 8)}
                      </small>
                    </TableCell>
                    <TableCell>{number(o.quantityKg)} kg</TableCell>
                    <TableCell>
                      <span key={o.status} className="order-status">
                        {labels[o.status] ?? o.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(o.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={uncertain}
                        aria-label={"Detalhes do pedido " + o.id.slice(0, 8)}
                        onClick={() => choose(o)}
                      >
                        <ArrowUpRight size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length && (
              <p className="p-10">
                Nenhum pedido encontrado nesta propriedade ou nos filtros
                selecionados.
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
          </>
        )}
      </section>
      {uncertain && !open && (
        <Button onClick={() => setOpen(true)}>
          Retomar confirmação pendente
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <SheetContent className="order-drawer sm:max-w-[560px] w-full p-0 gap-0">
          <SheetHeader className="drawer-header">
            <p className="eyebrow">SOLICITAÇÃO E LOGÍSTICA</p>
            <SheetTitle>Detalhes do pedido</SheetTitle>
            <SheetDescription>
              Operações autorizadas da propriedade selecionada.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="drawer-body">
              <div className="order-detail">
                <span key={selected.status} className="order-status">
                  {labels[selected.status]}
                </span>
                <h2 className="text-2xl font-semibold mt-4">
                  {lots.get(selected.lotId)?.cropName}
                </h2>
                <p className="mt-2">
                  {number(selected.quantityKg)} kg solicitados
                </p>
              </div>
              <dl className="detail-list order-detail">
                <div>
                  <dt>Pedido</dt>
                  <dd className="text-xs break-all">{selected.id}</dd>
                </div>
                <div>
                  <dt>Lote</dt>
                  <dd className="text-xs break-all">{selected.lotId}</dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>
                    {new Date(selected.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </dd>
                </div>
                <div>
                  <dt>Cooperativa</dt>
                  <dd>
                    {selected.shipment?.carrierOrganizationId
                      ? (coops.find(
                          (c) =>
                            c.id === selected.shipment?.carrierOrganizationId,
                        )?.name ?? selected.shipment.carrierOrganizationId)
                      : "Sem cooperativa vinculada"}
                  </dd>
                </div>
              </dl>
              <Link
                className="text-link mt-5"
                href={"/rastreabilidade/" + selected.id}
              >
                Rastrear pedido
              </Link>
              {feedback && (
                <p role="status" className="order-feedback">
                  <Check size={16} />
                  {feedback}
                </p>
              )}
              {failure && (
                <p role="alert" className="error-inline mt-4">
                  {failure}
                </p>
              )}
              {!action && writable && (
                <div className="flex flex-wrap gap-3 mt-6 order-detail">
                  {canAccept && (
                    <Button
                      onClick={() => {
                        setAction("accept");
                        setFeedback("");
                      }}
                    >
                      Aceitar solicitação
                    </Button>
                  )}
                  {canPickup && (
                    <Button
                      onClick={() => {
                        setAction("pickup");
                        setFeedback("");
                      }}
                    >
                      Registrar retirada
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction("cancel");
                        setFeedback("");
                      }}
                    >
                      Cancelar pedido
                    </Button>
                  )}
                </div>
              )}
              {action && (
                <form
                  id="order-operation"
                  className="order-confirm mt-6"
                  onSubmit={execute}
                >
                  <h3 className="font-semibold mb-4">
                    {action === "accept"
                      ? "Confirmar aceite"
                      : action === "cancel"
                        ? "Confirmar cancelamento"
                        : "Confirmar retirada"}
                  </h3>
                  <fieldset disabled={busy || uncertain} className="space-y-4">
                    {action === "accept" && (
                      <label className="field-label">
                        Cooperativa (opcional)
                        <select
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                        >
                          <option value="">Sem cooperativa</option>
                          {coops.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {coopError && (
                          <small>
                            Consulta de cooperativas indisponível; é possível
                            aceitar sem vínculo.
                          </small>
                        )}
                      </label>
                    )}
                    <label className="field-label">
                      Município
                      <Input
                        required
                        maxLength={120}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      UF
                      <Input
                        required
                        minLength={2}
                        maxLength={2}
                        value={uf}
                        onChange={(e) => setUf(e.target.value)}
                      />
                    </label>
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        required
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      Confirmo a localização e a operação indicada.
                    </label>
                  </fieldset>
                </form>
              )}
            </div>
          )}
          {action && (
            <div className="order-actions">
              <Button
                variant="outline"
                disabled={busy || uncertain}
                onClick={() => {
                  setAction("");
                  setConfirmed(false);
                }}
              >
                Voltar
              </Button>
              <Button
                form="order-operation"
                type="submit"
                disabled={busy || !writable || (!confirmed && !uncertain)}
              >
                {busy && <LoaderCircle className="animate-spin" size={16} />}
                <span>
                  {busy
                    ? "Confirmando…"
                    : uncertain
                      ? "Reenviar confirmação"
                      : "Confirmar operação"}
                </span>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
