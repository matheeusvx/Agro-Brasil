"use client";
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Route,
  Sprout,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import {
  ELEMENT_TYPES,
  MAX_NAME,
  MAX_REFERENCES,
  STATE_INFO,
  TYPE_INFO,
  activeOffer,
  linkProduction,
  pendingOrders,
  sectorRegisteredKg,
  shipmentName,
  type FarmElement,
  type FarmOverview,
  type FarmProduction,
  type Issue,
  type SceneSector,
} from "@/lib/farm";
import { date, eventName, number, statusName, type Crop, type Production } from "@/lib/types";
import { SpriteThumb, produceColors } from "./farm-art";
import { Button } from "../ui/button";

const stateChip = (s: SceneSector) =>
  s.operations ? (
    <span className="fz-chip" data-tone={STATE_INFO[s.operations.state].tone}>
      {STATE_INFO[s.operations.state].label}
    </span>
  ) : (
    <span className="fz-chip" data-tone="muted">
      Atualizando informações
    </span>
  );

// ---------- Lista acessível de setores ----------
export function SectorList({
  sectors,
  selectedId,
  onSelect,
  mode,
}: {
  sectors: SceneSector[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: "explore" | "edit";
}) {
  return (
    <section className="fz-card fz-list" aria-labelledby="fz-list-title">
      <div className="fz-card-head">
        <h2 id="fz-list-title">Setores da fazenda</h2>
        <span className="fz-count">{sectors.length}/20</span>
      </div>
      {sectors.length === 0 ? (
        <p className="fz-muted">
          {mode === "edit"
            ? "Escolha um tipo de setor acima para colocá-lo na fazenda."
            : "Nenhum setor montado ainda."}
        </p>
      ) : (
        <ul>
          {sectors.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="fz-list-item"
                aria-current={s.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(s.id)}
              >
                <SpriteThumb type={s.type} size={40} />
                <span className="fz-list-text">
                  <strong>{s.name}</strong>
                  <small>{TYPE_INFO[s.type].label}</small>
                </span>
                {s.operations?.state === "ACTION_PENDING" && (
                  <span className="fz-dot" aria-label="Pedido aguardando ação" />
                )}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Exploração: dados reais do setor ----------
function OfferLine({ p }: { p: FarmProduction }) {
  if (!p.offer) return <span className="fz-muted">Sem oferta</span>;
  if (activeOffer(p.offer))
    return (
      <span>
        Oferta publicada · <strong>{number(p.offer.availableKg)} kg</strong> disponíveis até{" "}
        {date(p.offer.availableUntil)}
      </span>
    );
  return (
    <span>
      Oferta {p.offer.status === "RASCUNHO" ? "em rascunho" : "com prazo encerrado"}
    </span>
  );
}
function ProductionCard({ p, emphasis, demo }: { p: FarmProduction; emphasis: "lots" | "orders" | "crops"; demo?: boolean }) {
  const pending = pendingOrders(p);
  const last = p.lot.recentEvents[0];
  return (
    <li className="fz-prod">
      <div className="fz-prod-head">
        <strong>{p.cropName}</strong>
        <span>Safra {p.seasonLabel}</span>
      </div>
      <dl>
        <div>
          <dt>Registrado</dt>
          <dd>{number(p.registeredQuantityKg)} kg</dd>
        </div>
        <div>
          <dt>Colheita</dt>
          <dd>{date(p.harvestedOn)}</dd>
        </div>
        <div>
          <dt>Lote</dt>
          <dd>
            …{p.lot.id.slice(-6)} · {statusName(p.lot.status)}
          </dd>
        </div>
      </dl>
      <p className="fz-prod-line">
        <Tags size={13} aria-hidden="true" />
        <OfferLine p={p} />
      </p>
      {p.orderStates.length > 0 && (
        <ul className="fz-orders" aria-label="Pedidos deste lote">
          {p.orderStates.map((o) => (
            <li key={o.status} data-status={o.status}>
              {o.count} {statusName(o.status).toLowerCase()} · {number(o.quantityKg)} kg
            </li>
          ))}
        </ul>
      )}
      {emphasis === "orders" && p.recentOrders.length > 0 && (
        <ul className="fz-shipments" aria-label="Pedidos recentes e remessas">
          {p.recentOrders.map((o) => (
            <li key={o.id}>
              <PackageCheck size={13} aria-hidden="true" />
              <span>
                Pedido …{o.id.slice(-6)}: {statusName(o.status)} · {number(o.quantityKg)} kg
              </span>
              <small>{shipmentName(o.shipmentStatus)}</small>
            </li>
          ))}
        </ul>
      )}
      {last && (
        <p className="fz-muted fz-prod-event">
          Último registro: {eventName(last.type)} em {date(last.recordedAt)}
        </p>
      )}
      {demo ? (
        <p className="fz-note fz-demo-note">Exemplo: na sua fazenda, aqui ficam os atalhos para lote, rastreabilidade, oferta e pedidos.</p>
      ) : (
      <div className="fz-links">
        <Link href={"/producao?lote=" + p.lot.id}>
          <Sprout size={13} /> Produção
        </Link>
        <Link href={"/rastreabilidade?lote=" + p.lot.id}>
          <Route size={13} /> Rastreabilidade
        </Link>
        {(p.offer || p.actions.createOffer) && (
          <Link href="/ofertas">
            <Tags size={13} /> {p.offer ? "Oferta" : "Criar oferta"}
          </Link>
        )}
        {p.orderStates.length > 0 && (
          <Link href="/pedidos" data-attention={pending > 0 || undefined}>
            <PackageCheck size={13} /> Pedidos
          </Link>
        )}
      </div>
      )}
    </li>
  );
}

export function SectorDetails({
  sector,
  cropName,
  canEdit,
  onBack,
  onEdit,
  demo,
}: {
  sector: SceneSector;
  cropName: (id: string) => string | undefined;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  demo?: boolean;
}) {
  const ops = sector.operations;
  const emphasis =
    sector.type === "STORAGE" ? "lots" : sector.type === "COLLECTION" ? "orders" : "crops";
  const crops = sector.cropIds.map((id) => cropName(id) ?? "Cultura indisponível");
  const title =
    emphasis === "lots"
      ? "Lotes vinculados"
      : emphasis === "orders"
        ? "Pedidos e expedição dos lotes vinculados"
        : "Produções vinculadas";
  return (
    <section className="fz-card fz-detail" aria-labelledby="fz-detail-title">
      <header className="fz-card-hero fz-detail-hero" data-tone={ops ? STATE_INFO[ops.state].tone : "muted"}>
        <button type="button" className="fz-back fz-back-light" onClick={onBack} aria-label="Voltar para todos os setores">
          <ArrowLeft size={15} /> Setores
        </button>
        <span className="fz-detail-thumb">
          <SpriteThumb
            type={sector.type}
            size={84}
            colors={produceColors([...crops, ...(ops?.productions.map((p) => p.cropName) ?? [])])}
          />
        </span>
        <p>{TYPE_INFO[sector.type].label}</p>
        <h2 id="fz-detail-title">{sector.name}</h2>
        {stateChip(sector)}
      </header>
      {ops?.state === "ACTION_PENDING" && (
        <div className="fz-callout" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Há pedidos aguardando sua ação.</strong>
            <span>Pedidos solicitados ou aceitos ainda não são vendas concluídas.</span>
            {!demo && (
              <Link href="/pedidos" className="text-link">
                Abrir pedidos <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        </div>
      )}
      {crops.length > 0 && (
        <div className="fz-block">
          <h3>Culturas indicadas</h3>
          <ul className="fz-tags">
            {crops.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="fz-block">
        <h3>{title}</h3>
        {emphasis === "lots" && (
          <p className="fz-note">
            Vínculo de organização: não representa estoque físico guardado neste local.
          </p>
        )}
        {!ops ? (
          <p className="fz-muted">Informações operacionais em atualização.</p>
        ) : ops.productions.length === 0 ? (
          <div className="fz-empty-block">
            <p>Nenhuma produção vinculada a este setor.</p>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Vincular produções
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="fz-sum">
              {ops.productionCount} {ops.productionCount === 1 ? "produção" : "produções"} ·{" "}
              {number(sectorRegisteredKg(ops))} kg registrados neste setor
            </p>
            <ul className="fz-prods">
              {ops.productions.map((p) => (
                <ProductionCard key={p.id} p={p} emphasis={emphasis} demo={demo} />
              ))}
            </ul>
          </>
        )}
        {!!ops?.missingProductionIds.length && (
          <p className="fz-warn">
            {ops.missingProductionIds.length === 1
              ? "1 registro vinculado não está mais disponível."
              : `${ops.missingProductionIds.length} registros vinculados não estão mais disponíveis.`}{" "}
            {canEdit ? "Revise no modo Construir." : ""}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- Edição: nome, tipo e vínculos ----------
export function SectorEditor({
  element,
  operations,
  all,
  crops,
  productions,
  issues,
  onChange,
  onRemove,
  onBack,
}: {
  element: FarmElement;
  operations: SceneSector["operations"];
  all: FarmElement[];
  crops: Crop[];
  productions: Production[];
  issues: Issue[];
  onChange: (patch: Partial<Omit<FarmElement, "id">>) => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [cropToAdd, setCropToAdd] = useState("");
  const cropName = (id: string) => crops.find((c) => c.id === id)?.name ?? "Cultura indisponível";
  const known = new Set(productions.map((p) => p.id));
  const missing = element.productionIds.filter((id) => !known.has(id));
  const elsewhere = (id: string) =>
    all.filter((e) => e.id !== element.id && e.productionIds.includes(id)).map((e) => e.name);
  const mine = issues.filter((i) => i.elementId === element.id);
  const nameId = "fz-name-" + element.id;
  return (
    <section className="fz-card fz-editor" aria-labelledby="fz-editor-title">
      <button type="button" className="fz-back" onClick={onBack}>
        <ArrowLeft size={15} /> Todos os setores
      </button>
      <h2 id="fz-editor-title" className="sr-only">
        Editar {element.name || "setor"}
      </h2>
      <label htmlFor={nameId} className="field-label">
        Nome do setor
      </label>
      <input
        id={nameId}
        className="fz-input"
        value={element.name}
        maxLength={MAX_NAME}
        aria-invalid={!element.name.trim() || undefined}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Ex.: Horta da frente"
      />
      <fieldset className="fz-types">
        <legend className="field-label">Tipo</legend>
        {ELEMENT_TYPES.map((t) => (
          <label key={t} className="fz-type-option" data-checked={element.type === t || undefined}>
            <input
              type="radio"
              name={"type-" + element.id}
              value={t}
              checked={element.type === t}
              onChange={() => onChange({ type: t })}
            />
            <SpriteThumb type={t} size={44} />
            <span>{TYPE_INFO[t].plural}</span>
          </label>
        ))}
      </fieldset>

      <div className="fz-block">
        <h3>
          Culturas <small>{element.cropIds.length}/{MAX_REFERENCES}</small>
        </h3>
        <p className="fz-note">Opcional. Sem culturas, o setor aceita produções de qualquer cultura.</p>
        {element.cropIds.length > 0 && (
          <ul className="fz-tags">
            {element.cropIds.map((id) => (
              <li key={id}>
                {cropName(id)}
                <button
                  type="button"
                  aria-label={"Remover cultura " + cropName(id)}
                  onClick={() => onChange({ cropIds: element.cropIds.filter((c) => c !== id) })}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="fz-inline">
          <select
            aria-label="Cultura para adicionar"
            value={cropToAdd}
            onChange={(e) => setCropToAdd(e.target.value)}
            disabled={element.cropIds.length >= MAX_REFERENCES}
          >
            <option value="">Escolha uma cultura…</option>
            {crops
              .filter((c) => !element.cropIds.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!cropToAdd || element.cropIds.length >= MAX_REFERENCES}
            onClick={() => {
              onChange({ cropIds: [...element.cropIds, cropToAdd] });
              setCropToAdd("");
            }}
          >
            Adicionar
          </Button>
        </div>
      </div>

      <div className="fz-block">
        <h3>
          Produções desta propriedade <small>{element.productionIds.length}/{MAX_REFERENCES}</small>
        </h3>
        {productions.length === 0 ? (
          <p className="fz-muted">Nenhuma produção registrada nesta propriedade ainda.</p>
        ) : (
          <ul className="fz-picks">
            {productions.map((p) => {
              const checked = element.productionIds.includes(p.id);
              const others = elsewhere(p.id);
              return (
                <li key={p.id}>
                  <label data-checked={checked || undefined}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && element.productionIds.length >= MAX_REFERENCES}
                      onChange={() =>
                        onChange(
                          checked
                            ? { productionIds: element.productionIds.filter((id) => id !== p.id) }
                            : (({ productionIds, cropIds }) => ({ productionIds, cropIds }))(
                                linkProduction(element, p),
                              ),
                        )
                      }
                    />
                    <span>
                      <strong>{p.cropName}</strong> · Safra {p.seasonLabel} · {number(p.quantityKg)} kg
                      <small>
                        Colhida em {date(p.harvestedOn)}
                        {others.length > 0 && " · também em " + others.join(", ")}
                      </small>
                    </span>
                    {checked && <Check size={15} aria-hidden="true" />}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {missing.length > 0 && (
          <div className="fz-warn">
            <p>
              {missing.length === 1
                ? "1 vínculo aponta para um registro indisponível."
                : `${missing.length} vínculos apontam para registros indisponíveis.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ productionIds: element.productionIds.filter((id) => known.has(id)) })
              }
            >
              Remover vínculos indisponíveis
            </Button>
          </div>
        )}
        {operations && operations.state === "ACTION_PENDING" && (
          <p className="fz-note">Este setor tem pedidos aguardando ação.</p>
        )}
      </div>

      {mine.length > 0 && (
        <ul className="fz-issues" role="alert">
          {mine.map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
        </ul>
      )}
      <p className="fz-note">Dica: arraste o setor na cena ou use as setas do teclado.</p>
      <div className="fz-remove">
        {confirm ? (
          <>
            <p>Remover da representação? Produções, lotes, ofertas e pedidos não são apagados.</p>
            <div className="fz-inline">
              <Button variant="destructive" size="sm" onClick={onRemove}>
                <Trash2 size={14} /> Remover
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="fz-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={14} /> Remover setor
          </Button>
        )}
      </div>
    </section>
  );
}

// ---------- Produções da propriedade (lista paginada do overview) ----------
export function PropertyRecords({
  overview,
  elements,
  onPage,
  busy,
}: {
  overview: FarmOverview;
  elements: FarmElement[];
  onPage: (offset: number) => void;
  busy: boolean;
}) {
  const { limit, offset, total } = overview.pagination;
  const sectorsOf = (id: string) =>
    elements.filter((e) => e.productionIds.includes(id)).map((e) => e.name);
  return (
    <details className="fz-records">
      <summary>Ver produções da propriedade ({total})</summary>
      {overview.productions.length === 0 ? (
        <p className="fz-muted">Nenhuma produção registrada nesta propriedade.</p>
      ) : (
        <ul>
          {overview.productions.map((p) => {
            const names = sectorsOf(p.id);
            return (
              <li key={p.id}>
                <span>
                  <strong>{p.cropName}</strong> · Safra {p.seasonLabel} · {number(p.registeredQuantityKg)} kg
                </span>
                <small>{names.length ? "Setores: " + names.join(", ") : "Sem setor na fazenda"}</small>
                <Link href={"/producao?lote=" + p.lot.id} className="text-link">
                  Lote <ArrowUpRight size={12} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > limit && (
        <nav className="fz-pager" aria-label="Páginas de produções">
          <Button variant="outline" size="sm" disabled={busy || offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
            <ChevronLeft size={14} /> Anteriores
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </span>
          <Button variant="outline" size="sm" disabled={busy || offset + limit >= total} onClick={() => onPage(offset + limit)}>
            Próximas <ChevronRight size={14} />
          </Button>
        </nav>
      )}
    </details>
  );
}
