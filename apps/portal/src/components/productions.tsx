"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ArrowDownToLine,
  ArrowUpDown,
  ArrowUpRight,
  Sprout,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { ProductionDetails } from "./production-details";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { filterProductions } from "@/lib/operational";
import { date, number, type Production } from "@/lib/types";
function csv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function Productions() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <ProductionList />
    </Suspense>
  );
}
function ProductionList() {
  const { workspace, loading, error, openCreate } = usePortal(),
    params = useSearchParams();
  const [query, setQuery] = useState(""),
    [crop, setCrop] = useState(""),
    [season, setSeason] = useState(""),
    [sort, setSort] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [detail, setDetail] = useState<string | null>(null);
  const propertyId = workspace?.property.id;
  useEffect(() => {
    setQuery("");
    setCrop("");
    setSeason("");
    setPage(0);
    setSelected(new Set());
    setDetail(null);
  }, [propertyId]);
  useEffect(() => {
    const lot = params.get("lote");
    const production = workspace?.productions.find((p) => p.lot.id === lot);
    if (production) setDetail(production.id);
  }, [params, workspace]);
  const rows = useMemo(
    () =>
      filterProductions(workspace?.productions ?? [], query, crop, season).sort(
        (a, b) =>
          sort
            ? a.harvestedOn.localeCompare(b.harvestedOn)
            : b.harvestedOn.localeCompare(a.harvestedOn),
      ),
    [workspace, query, crop, season, sort],
  );
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [query, crop, season]);
  if (loading || error || !workspace) return <WorkspaceState />;
  const slice = rows.slice(page * 8, page * 8 + 8),
    seasons = Array.from(
      new Set(workspace.productions.map((p) => p.seasonLabel)),
    ).sort();
  const quantity = rows.reduce((s, p) => s + p.quantityKg, 0),
    hasFilter = !!(query || crop || season);
  function exportRows() {
    const records = rows.filter((p) => !selected.size || selected.has(p.id));
    const body =
      "\uFEFF" +
      [
        [
          "Cultura",
          "Safra",
          "Quantidade (kg)",
          "Colheita",
          "Lote",
          "Município",
          "UF",
        ],
        ...records.map((p) => [
          p.cropName,
          p.seasonLabel,
          p.quantityKg,
          p.harvestedOn,
          p.lot.id,
          p.location.municipality,
          p.location.uf,
        ]),
      ]
        .map((row) => row.map(csv).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "agro-brasil-producao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function toggle(row: Production) {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }
  return (
    <div className="production-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DA COLHEITA À ORIGEM</p>
          <h1>Minha produção</h1>
          <p>Consulte suas colheitas e acompanhe a origem de cada lote.</p>
        </div>
        <Button onClick={openCreate} disabled={!workspace.home.canWrite}>
          <Plus size={17} />
          Nova produção
        </Button>
      </div>
      <div className="list-summary">
        <span>
          <strong>{workspace.productions.length}</strong> produções registradas
        </span>
        <span className="summary-divider" />
        <span>
          <strong>
            {number(
              workspace.productions.reduce((s, p) => s + p.quantityKg, 0),
            )}{" "}
            kg
          </strong>{" "}
          na propriedade
        </span>
        <span className="summary-property">
          <Sprout size={14} />
          {workspace.property.name}
        </span>
      </div>
      <section className="panel production-panel">
        <div className="list-toolbar">
          <div className="search-input">
            <Search size={17} />
            <Input
              aria-label="Pesquisar produção"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cultura, safra ou lote…"
            />
          </div>
          <div className="filter-controls">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filtrar por cultura"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            >
              <option value="">Todas as culturas</option>
              {workspace.catalog.crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por safra"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              <option value="">Todas as safras</option>
              {seasons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportRows}
              disabled={!rows.length}
            >
              <ArrowDownToLine size={15} />
              {selected.size ? "Exportar seleção" : "Exportar"}
            </Button>
          </div>
        </div>
        {(hasFilter || selected.size > 0) && (
          <div className="filter-summary">
            <span>
              {selected.size
                ? `${selected.size} registros selecionados`
                : `${rows.length} resultados · ${number(quantity)} kg`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setCrop("");
                setSeason("");
                setSelected(new Set());
              }}
            >
              <X size={13} />
              Limpar {selected.size ? "seleção" : "filtros"}
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-6">
                <input
                  type="checkbox"
                  aria-label="Selecionar registros desta página"
                  checked={
                    slice.length > 0 &&
                    slice.every((row) => selected.has(row.id))
                  }
                  onChange={(e) =>
                    setSelected((old) => {
                      const next = new Set(old);
                      slice.forEach((row) =>
                        e.target.checked
                          ? next.add(row.id)
                          : next.delete(row.id),
                      );
                      return next;
                    })
                  }
                />
              </TableHead>
              <TableHead>Cultura / produção</TableHead>
              <TableHead>Safra</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-2"
                  onClick={() => setSort((v) => !v)}
                >
                  Colheita
                  <ArrowUpDown size={12} />
                </button>
              </TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right pr-6">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((p) => (
              <TableRow
                key={p.id}
                data-state={selected.has(p.id) ? "selected" : undefined}
              >
                <TableCell className="pl-6">
                  <input
                    type="checkbox"
                    aria-label={
                      "Selecionar produção de " +
                      p.cropName +
                      " " +
                      p.lot.id.slice(0, 8)
                    }
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p)}
                  />
                </TableCell>
                <TableCell>
                  <button className="crop-cell" onClick={() => setDetail(p.id)}>
                    <span className="crop-icon">
                      <Sprout size={18} />
                    </span>
                    <span>
                      <strong>{p.cropName}</strong>
                      <small>Origem registrada</small>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-[#69766d]">
                  {p.seasonLabel}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {number(p.quantityKg)}{" "}
                  <span className="font-normal text-xs text-[#69766d]">kg</span>
                </TableCell>
                <TableCell className="text-[#69766d] tabular-nums">
                  {date(p.harvestedOn)}
                </TableCell>
                <TableCell>
                  <button
                    className="lot-code"
                    onClick={() => setDetail(p.id)}
                    title={p.lot.id}
                  >
                    {p.lot.id.slice(0, 8).toUpperCase()}
                  </button>
                </TableCell>
                <TableCell className="text-right pr-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      "Ver detalhes de " +
                      p.cropName +
                      " " +
                      p.lot.id.slice(0, 8)
                    }
                    onClick={() => setDetail(p.id)}
                  >
                    <ArrowUpRight size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!slice.length && (
          <div className="state-panel">
            <Sprout size={30} />
            <h2>
              {hasFilter
                ? "Nenhuma produção com esses filtros."
                : "Sua próxima colheita começa aqui."}
            </h2>
            <p>
              {hasFilter
                ? "Experimente outra cultura, safra ou identificação de lote."
                : "Registre uma produção para criar seu primeiro lote com origem confirmada."}
            </p>
            {hasFilter ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCrop("");
                  setSeason("");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button disabled={!workspace.home.canWrite} onClick={openCreate}>
                <Plus size={16} />
                Cadastrar primeira produção
              </Button>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            {rows.length
              ? `${page * 8 + 1}–${Math.min((page + 1) * 8, rows.length)} de ${rows.length} produções`
              : "0 produções"}
            {hasFilter ? " · lista filtrada" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <span>
              Página {page + 1} de {Math.max(1, Math.ceil(rows.length / 8))}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={(page + 1) * 8 >= rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </section>
      <p className="data-note">
        Os registros pertencem à propriedade selecionada. Abra um lote para
        consultar os detalhes e sua linha do tempo.
      </p>
      <ProductionDetails id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
