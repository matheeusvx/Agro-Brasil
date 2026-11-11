"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Tags,
  LoaderCircle,
  Check,
  RefreshCw,
} from "lucide-react";

import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
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
import { number } from "@/lib/types";

type Offer = {
  id: string;
  lotId: string;
  cropName: string;
  status: string;
  quantityKg: number;
  availableKg: number;
  destinationMode: string;
  unitPriceCents: number;
  availableUntil: string;
  territory: { municipality: string; uf: string };
};
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
// Filtro de prazo da lista (mesma leitura do indicador: oferta publicada com saldo).
export function matchesDeadline(
  o: { status: string; availableKg: number; availableUntil: string },
  deadline: string,
  now = Date.now(),
) {
  if (o.status !== "PUBLICADA" || !(o.availableKg > 0)) return false;
  const expired = Date.parse(o.availableUntil) <= now;
  return deadline === "vencidas" ? expired : deadline === "no-prazo" ? !expired : true;
}
const situation = (value: string) =>
  ({ RASCUNHO: "Rascunho", PUBLICADA: "Publicada" })[value] ?? value;
const time = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
const emptyForm = {
  lotId: "",
  quantity: "",
  mode: "DOACAO",
  price: "",
  until: "",
};
type Command = { path: string; body: string; key: string };

export function Offers() {
  const { workspace, session, loading, error: workspaceError } = usePortal();
  const [offers, setOffers] = useState<Offer[]>([]),
    [loadingOffers, setLoadingOffers] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [mode, setMode] = useState(""),
    [deadline, setDeadline] = useState(""),
    [page, setPage] = useState(0);
  const [create, setCreate] = useState(false),
    [detailOpen, setDetailOpen] = useState(false),
    [detail, setDetail] = useState<Offer | null>(null);
  const [form, setForm] = useState(emptyForm),
    [confirmed, setConfirmed] = useState(false),
    [municipality, setMunicipality] = useState(""),
    [uf, setUf] = useState("");
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [mutationError, setMutationError] = useState(""),
    [success, setSuccess] = useState("");
  const command = useRef<Command | null>(null),
    sending = useRef(false),
    origin = useRef("");
  const propertyId = workspace?.property.id;
  useEffect(() => {
    setOffers([]);
    setQuery("");
    setStatus("");
    setMode("");
    setDeadline("");
    setPage(0);
    setCreate(false);
    setDetailOpen(false);
    setDetail(null);
    setForm(emptyForm);
    setUncertain(false);
    command.current = null;
    setMutationError("");
    setSuccess("");
    origin.current = session.organizationId + ":" + propertyId;
  }, [session.organizationId, propertyId]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const prazo = p.get("prazo");
    if (prazo === "vencidas" || prazo === "no-prazo") {
      setDeadline(prazo);
      setStatus("PUBLICADA");
    }
    const modalidade = p.get("modalidade");
    if (modalidade === "VENDA" || modalidade === "DOACAO") setMode(modalidade);
  }, [propertyId]);
  useEffect(() => {
    if (!workspace || loading) return;
    const abort = new AbortController();
    setLoadingOffers(true);
    setError("");
    allRows<Offer>("/offers?scope=mine", abort.signal)
      .then((rows) => {
        if (!abort.signal.aborted) setOffers(rows);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar ofertas.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingOffers(false);
      });
    return () => abort.abort();
  }, [workspace, loading, revision]);
  useEffect(() => {
    setPage(0);
  }, [query, status, mode]);
  if (loading || workspaceError || !workspace) return <WorkspaceState />;
  const lots = new Set(workspace.productions.map((p) => p.lot.id));
  const own = offers.filter((o) => lots.has(o.lotId));
  const rows = own.filter(
    (o) =>
      (!status || o.status === status) &&
      (!mode || o.destinationMode === mode) &&
      (!deadline || matchesDeadline(o, deadline)) &&
      (!query ||
        `${o.cropName} ${o.lotId}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.trim().toLocaleLowerCase("pt-BR"))),
  );
  const slice = rows.slice(page * 8, page * 8 + 8);
  const writable = workspace.home.canWrite;
  const availableLots = workspace.productions.filter(
    (p) => !offers.some((o) => o.lotId === p.lot.id),
  );
  const selectedLot = availableLots.find((p) => p.lot.id === form.lotId);
  function openDetail(o: Offer) {
    if (uncertain) return;
    setDetail(o);
    setDetailOpen(true);
    setConfirmed(false);
    setMunicipality(o.territory.municipality);
    setUf(o.territory.uf);
    setMutationError("");
    setSuccess("");
  }
  async function mutate(path: string, body: object) {
    if (sending.current || !writable) return;
    const scope = origin.current;
    const serialized = JSON.stringify(body);
    if (!uncertain)
      command.current = { path, body: serialized, key: crypto.randomUUID() };
    const current = command.current;
    if (!current) return;
    sending.current = true;
    setBusy(true);
    setMutationError("");
    try {
      const result = await request<{ data: Offer }>(
        "/api/agro" + current.path,
        {
          method: "POST",
          body: current.body,
          headers: { "Idempotency-Key": current.key },
        },
      );
      if (origin.current !== scope) return;
      setOffers((old) => [
        result.data,
        ...old.filter((o) => o.id !== result.data.id),
      ]);
      setDetail(result.data);
      setMunicipality(result.data.territory.municipality);
      setUf(result.data.territory.uf);
      setCreate(false);
      setDetailOpen(true);
      setUncertain(false);
      command.current = null;
      setConfirmed(false);
      const message = current.path.endsWith("/publish")
        ? "Oferta publicada."
        : "Rascunho criado. Confirme a localização para publicar.";
      setSuccess(message);

      setForm(emptyForm);
      setRevision((v) => v + 1);
    } catch (e) {
      if (origin.current !== scope) return;
      const unknown = !(e instanceof RequestError) || e.status >= 500;
      setUncertain(unknown);
      if (!unknown) command.current = null;
      setMutationError(
        unknown
          ? "Resposta não confirmada. Tente confirmar novamente: a mesma operação e chave serão reutilizadas."
          : e instanceof Error
            ? e.message
            : "Operação indisponível.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uncertain) {
      void mutate("", {});
      return;
    }
    void mutate("/offers", {
      lotId: form.lotId,
      quantityKg: Number(form.quantity),
      destinationMode: form.mode,
      unitPriceCents:
        form.mode === "VENDA" ? Math.round(Number(form.price) * 100) : 0,
      availableUntil: new Date(form.until).toISOString(),
    });
  }
  const feedback = (
    <>
      {mutationError && (
        <p role="alert" className="error-inline offer-feedback">
          {mutationError}
        </p>
      )}
      {success && (
        <p role="status" className="offer-success">
          <Check size={16} />
          {success}
        </p>
      )}
    </>
  );
  return (
    <div className="offers-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DA COLHEITA ÀS CONEXÕES</p>
          <h1>Minhas ofertas</h1>
          <p>Organize o que está disponível para venda ou doação.</p>
        </div>
        <Button
          disabled={!writable || loadingOffers || !!error || uncertain}
          onClick={() => {
            setCreate(true);
            setMutationError("");
            setSuccess("");
          }}
        >
          <Plus size={17} />
          Nova oferta
        </Button>
      </div>
      <div className="list-summary">
        <span>
          <strong>{own.length}</strong> ofertas da propriedade
        </span>
        <span className="summary-property">{workspace.property.name}</span>
      </div>
      <section
        className="panel production-panel offer-panel"
        aria-label="Ofertas da propriedade"
      >
        <div className="list-toolbar">
          <div className="search-input">
            <Search size={17} />
            <Input
              aria-label="Pesquisar ofertas"
              placeholder="Buscar cultura ou lote…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-controls">
            <select
              aria-label="Filtrar situação da oferta"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todas as situações</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="PUBLICADA">Publicada</option>
            </select>
            <select
              aria-label="Filtrar prazo"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            >
              <option value="">Qualquer prazo</option>
              <option value="no-prazo">Disponíveis no prazo</option>
              <option value="vencidas">Vencidas com saldo</option>
            </select>
            <select
              aria-label="Filtrar modalidade"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="">Venda e doação</option>
              <option value="VENDA">Venda</option>
              <option value="DOACAO">Doação</option>
            </select>
          </div>
        </div>
        {loadingOffers ? (
          <div role="status" className="offer-state">
            <LoaderCircle className="animate-spin" size={20} />
            Consultando ofertas…
          </div>
        ) : error ? (
          <div role="alert" className="offer-state">
            <p>{error}</p>
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              <RefreshCw size={15} />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cultura / lote</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Disponível</TableHead>
                  <TableHead>Preço / kg</TableHead>
                  <TableHead>Disponível até</TableHead>
                  <TableHead>
                    <span className="sr-only">Detalhes</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((o) => (
                  <TableRow
                    key={o.id}
                    data-selected={detailOpen && detail?.id === o.id}
                    className="offer-row"
                  >
                    <TableCell>
                      <div className="crop-cell">
                        <span>
                          <Tags size={17} />
                        </span>
                        <div>
                          <strong>{o.cropName}</strong>
                          <small>
                            Lote {o.lotId.slice(0, 8).toUpperCase()}
                          </small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="offer-status"
                        data-published={o.status === "PUBLICADA"}
                      >
                        {situation(o.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {o.destinationMode === "VENDA" ? "Venda" : "Doação"}
                    </TableCell>
                    <TableCell>{number(o.availableKg)} kg</TableCell>
                    <TableCell>
                      {o.destinationMode === "VENDA"
                        ? money(o.unitPriceCents)
                        : "Sem custo"}
                    </TableCell>
                    <TableCell>
                      {time(o.availableUntil)}
                      {Date.parse(o.availableUntil) <= Date.now() && (
                        <small className="block">Prazo encerrado</small>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={uncertain}
                        aria-label={"Detalhes da oferta de " + o.cropName}
                        onClick={() => openDetail(o)}
                      >
                        <ArrowUpRight size={17} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && (
              <div className="offer-state">
                <Tags size={26} />
                <h2>
                  {query || status || mode
                    ? "Nenhuma oferta corresponde aos filtros."
                    : "Sua colheita pode encontrar novos caminhos."}
                </h2>
                <p>
                  {query || status || mode
                    ? "Ajuste a pesquisa ou os filtros."
                    : "Crie um rascunho a partir de um lote desta propriedade."}
                </p>
              </div>
            )}
            <div className="table-footer">
              <span>
                {rows.length
                  ? `${page * 8 + 1}–${Math.min((page + 1) * 8, rows.length)} de ${rows.length} ofertas`
                  : "0 ofertas"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span>Página {page + 1}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * 8 >= rows.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      {uncertain && !create && !detailOpen && (
        <p role="alert" className="info-note mt-4">
          Há uma operação sem confirmação.{" "}
          <Button
            variant="outline"
            onClick={() => {
              if (command.current?.path === "/offers") setCreate(true);
              else setDetailOpen(true);
            }}
          >
            Retomar confirmação
          </Button>
        </p>
      )}
      <Sheet
        open={create}
        onOpenChange={(v) => {
          if (!busy) setCreate(v);
        }}
      >
        <SheetContent
          className="offer-drawer sm:max-w-[580px] w-full p-0 gap-0"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <SheetHeader className="drawer-header">
            <p className="eyebrow">NOVA OFERTA</p>
            <SheetTitle>Prepare sua oferta.</SheetTitle>
            <SheetDescription>
              O rascunho só fica público depois de confirmar a localização.
            </SheetDescription>
          </SheetHeader>
          <form className="offer-form" onSubmit={save}>
            <div className="drawer-body">
              {feedback}
              <fieldset disabled={busy || uncertain} className="space-y-5">
                <label className="field-label">
                  Lote de origem
                  <select
                    required
                    value={form.lotId}
                    onChange={(e) =>
                      setForm({ ...form, lotId: e.target.value })
                    }
                  >
                    <option value="">Selecione um lote</option>
                    {availableLots.map((p) => (
                      <option key={p.lot.id} value={p.lot.id}>
                        {p.cropName} · {number(p.quantityKg)} kg ·{" "}
                        {p.lot.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <small>
                    {selectedLot
                      ? `Lote com ${number(selectedLot.quantityKg)} kg registrados.`
                      : "Uma oferta por lote. Lotes já vinculados não aparecem aqui."}
                  </small>
                </label>
                <label className="field-label">
                  Quantidade ofertada (kg)
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Modalidade
                  <select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  >
                    <option value="DOACAO">Doação</option>
                    <option value="VENDA">Venda</option>
                  </select>
                </label>
                {form.mode === "VENDA" && (
                  <label className="field-label offer-reveal">
                    Preço por kg (R$)
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                    />
                  </label>
                )}
                <label className="field-label">
                  Disponível até
                  <Input
                    type="datetime-local"
                    required
                    value={form.until}
                    onChange={(e) =>
                      setForm({ ...form, until: e.target.value })
                    }
                  />
                  <small>
                    Use a data e o horário locais da sua propriedade.
                  </small>
                </label>
              </fieldset>
            </div>
            <div className="offer-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreate(false)}
              >
                Voltar
              </Button>
              <Button
                disabled={
                  busy || !writable || (!availableLots.length && !uncertain)
                }
                type="submit"
              >
                {busy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                <span>
                  {busy
                    ? "Salvando…"
                    : uncertain
                      ? "Confirmar envio"
                      : "Criar rascunho"}
                </span>
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet
        open={detailOpen}
        onOpenChange={(v) => {
          if (!busy) setDetailOpen(v);
        }}
      >
        <SheetContent
          className="offer-drawer sm:max-w-[560px] w-full p-0 gap-0"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <SheetHeader className="drawer-header">
            <p className="eyebrow">DISPONIBILIDADE E ORIGEM</p>
            <SheetTitle>Detalhes da oferta</SheetTitle>
            <SheetDescription>
              Dados autorizados da propriedade selecionada.
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="drawer-body">
              {feedback}
              <div className="detail-crop">
                <div>
                  <span
                    className="offer-status"
                    key={detail.status}
                    data-published={detail.status === "PUBLICADA"}
                  >
                    {situation(detail.status)}
                  </span>
                  <h2>{detail.cropName}</h2>
                  <p>
                    {detail.destinationMode === "VENDA" ? "Venda" : "Doação"}
                  </p>
                </div>
                <div>
                  <strong>{number(detail.availableKg)}</strong>
                  <span>kg disponíveis</span>
                </div>
              </div>
              <Link
                className="text-link my-4"
                href={"/producao?lote=" + detail.lotId}
              >
                Consultar lote de origem
              </Link>
              <dl className="detail-list">
                <div>
                  <dt>Quantidade ofertada</dt>
                  <dd>{number(detail.quantityKg)} kg</dd>
                </div>
                <div>
                  <dt>Preço por kg</dt>
                  <dd>
                    {detail.destinationMode === "VENDA"
                      ? money(detail.unitPriceCents)
                      : "Doação · sem custo"}
                  </dd>
                </div>
                <div>
                  <dt>Disponível até</dt>
                  <dd>{time(detail.availableUntil)}</dd>
                </div>
                <div>
                  <dt>Município de origem</dt>
                  <dd>
                    {detail.territory.municipality} / {detail.territory.uf}
                  </dd>
                </div>
                <div>
                  <dt>Lote</dt>
                  <dd className="break-all text-xs">{detail.lotId}</dd>
                </div>
              </dl>
              {detail.status === "RASCUNHO" && (
                <form
                  id="offer-publish-form"
                  className="offer-publish mt-7"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate("/offers/" + detail.id + "/publish", {
                      location: {
                        municipality: municipality.trim(),
                        uf: uf.toUpperCase(),
                      },
                      locationConfirmed: confirmed,
                    });
                  }}
                >
                  <h3 className="font-semibold mb-2">
                    Confirme o local da publicação
                  </h3>
                  <p className="text-xs mb-4">
                    A confirmação registra a origem da operação. Nenhum GPS é
                    utilizado.
                  </p>
                  <fieldset
                    disabled={busy || uncertain || !writable}
                    className="space-y-4"
                  >
                    <label className="field-label">
                      Município
                      <Input
                        required
                        maxLength={120}
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
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
                    <label className="confirmation">
                      <input
                        type="checkbox"
                        required
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      Confirmo a localização informada para publicar esta
                      oferta.
                    </label>
                  </fieldset>
                </form>
              )}
            </div>
          )}
          {detail?.status === "RASCUNHO" && (
            <div className="offer-actions">
              {" "}
              <Button
                type="submit"
                form="offer-publish-form"

                disabled={busy || !writable || (!confirmed && !uncertain)}
              >
                {busy && <LoaderCircle className="animate-spin" size={16} />}
                <span>
                  {busy
                    ? "Publicando…"
                    : uncertain
                      ? "Confirmar publicação"
                      : "Publicar oferta"}
                </span>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
