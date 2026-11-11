"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  FlaskConical,
  Handshake,
  HeartHandshake,
  Info,
  PackageCheck,
  RefreshCw,
  Sparkles,
  Tags,
  TimerOff,
  Truck,
} from "lucide-react";
import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { Button } from "./ui/button";
import { useCountTo, useReducedMotion } from "./chart-motion";
import { agro } from "@/lib/client-api";
import {
  composition,
  impactErrorMessage,
  impactPath,
  insights,
  isEmptyImpact,
  isImpact,
  journey,
  modes,
  percent,
  share,
} from "@/lib/impact";
import { number, type ExcessImpact } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; impact: ExcessImpact };

// Destino dos excedentes: todos os números chegam prontos da API de impacto.
export function ExcessDestination() {
  const { workspace, loading, error } = usePortal();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const propertyId = workspace?.property.id;
  useEffect(() => {
    if (!propertyId) return;
    const abort = new AbortController();
    setState({ kind: "loading" });
    agro<{ data: unknown }>(impactPath(propertyId), abort.signal)
      .then(({ data }) => {
        if (!isImpact(data, propertyId)) throw new Error("contrato");
        setState({ kind: "ready", impact: data });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setState({ kind: "error", message: impactErrorMessage(e) });
      });
    return () => abort.abort();
  }, [propertyId, revision]);

  if (loading || error || !workspace) return <WorkspaceState />;
  const impact = state.kind === "ready" ? state.impact : null;
  return (
    <div className="dx">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DO EXCEDENTE AO DESTINATÁRIO</p>
          <h1>Destino dos excedentes</h1>
          <p>
            Veja o que você ofertou em {workspace.property.name} e o que já chegou a quem precisa.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRevision((r) => r + 1)} disabled={state.kind === "loading"}>
          <RefreshCw size={15} className={state.kind === "loading" ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {state.kind === "loading" && (
        <div className="dx-kpis" role="status" aria-label="Consultando o destino dos excedentes">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="dx-kpi dx-skeleton" />
          ))}
        </div>
      )}
      {state.kind === "error" && (
        <section className="panel dx-state" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h2>Não foi possível consultar agora</h2>
            <p>{state.message}</p>
          </div>
          <Button variant="outline" onClick={() => setRevision((r) => r + 1)}>
            Tentar novamente
          </Button>
        </section>
      )}
      {impact && isEmptyImpact(impact) && (
        <section className="panel dx-state">
          <Tags size={22} aria-hidden="true" />
          <div>
            <h2>Nenhuma oferta publicada ainda</h2>
            <p>Quando você publicar um excedente, o caminho dele até o destinatário aparece aqui.</p>
          </div>
          <Link href="/ofertas" className="ag-btn ag-btn-lime">
            Criar oferta <ArrowRight size={15} />
          </Link>
        </section>
      )}
      {impact && !isEmptyImpact(impact) && <Dashboard impact={impact} />}
    </div>
  );
}

function Dashboard({ impact: i }: { impact: ExcessImpact }) {
  const published = i.funnelKg.published;
  const ongoing = i.balancesKg.reservedNow + i.balancesKg.inTransitNow;
  const asOf = new Date(i.asOf).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const tips = insights(i);
  return (
    <>
      <div className="dx-meta">
        {i.isDemonstration && (
          <span className="dx-demo">
            <FlaskConical size={13} aria-hidden="true" /> Dados demonstrativos
          </span>
        )}
        <span>Consulta de {asOf}</span>
      </div>

      <section className="dx-kpis" aria-label="Indicadores principais">
        <Kpi icon={Tags} label="Ofertado" value={published} note="em ofertas publicadas" />
        <Kpi
          icon={PackageCheck}
          label="Recebido"
          value={i.funnelKg.received}
          note={`${percent(share(i.funnelKg.received, published))} do ofertado · confirmado`}
          tone="good"
        />
        <Kpi
          icon={Truck}
          label="Em andamento"
          value={ongoing}
          note={`${number(i.balancesKg.reservedNow)} kg reservados · ${number(i.balancesKg.inTransitNow)} kg em trânsito`}
        />
        <Kpi
          icon={TimerOff}
          label="Vencido sem destinação"
          value={i.balancesKg.expiredAvailable}
          note={`${percent(share(i.balancesKg.expiredAvailable, published))} do ofertado`}
          tone={i.balancesKg.expiredAvailable > 0 ? "attention" : undefined}
        />
      </section>

      <div className="dx-grid">
        <Composition impact={i} />
        {tips.length > 0 && (
          <section className="panel dx-panel dx-tips" aria-labelledby="dx-tips-title">
            <h2 id="dx-tips-title">
              <Sparkles size={16} aria-hidden="true" /> O que fazer agora
            </h2>
            <ul>
              {tips.map((t) => (
                <li key={t.text} data-tone={t.tone}>
                  <p>{t.text}</p>
                  {t.href && (
                    <Link href={t.href} className="text-link">
                      {t.action} <ArrowRight size={13} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Journey impact={i} />
        <Modes impact={i} />
      </div>

      <p className="data-note dx-note">
        <Info size={13} aria-hidden="true" /> Valores calculados pela plataforma a partir das ofertas publicadas desta
        propriedade. Recebido conta só o que o destinatário confirmou. Saldo vencido não comprova perda.
      </p>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Tags;
  label: string;
  value: number;
  note: string;
  tone?: "good" | "attention";
}) {
  const shown = useCountTo(value);
  return (
    <div className="dx-kpi" data-tone={tone}>
      <span className="dx-kpi-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <p>{label}</p>
      <strong aria-label={`${number(value)} quilos`}>
        {number(Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10)}
        <small>kg</small>
      </strong>
      <span className="dx-kpi-note">{note}</span>
    </div>
  );
}

// Animação de entrada das barras (respeita movimento reduzido).
function useGrow() {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return reduced || on;
}

function Composition({ impact }: { impact: ExcessImpact }) {
  const grow = useGrow();
  const parts = composition(impact);
  const total = impact.funnelKg.published;
  return (
    <section className="panel dx-panel dx-wide" aria-labelledby="dx-comp-title">
      <div className="dx-panel-head">
        <h2 id="dx-comp-title">Para onde foi o que você ofertou</h2>
        <span>{number(total)} kg ofertados</span>
      </div>
      <div
        className="dx-stack"
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${number(p.value)} kg (${percent(share(p.value, total))})`).join("; ")}
      >
        {parts.map((p) =>
          p.value > 0 ? (
            <span
              key={p.key}
              data-tone={p.tone}
              style={{ width: grow ? `${share(p.value, total)}%` : 0 }}
              title={`${p.label}: ${number(p.value)} kg`}
            />
          ) : null,
        )}
      </div>
      <ul className="dx-legend">
        {parts.map((p) => (
          <li key={p.key} data-empty={p.value === 0 || undefined}>
            <i data-tone={p.tone} aria-hidden="true" />
            <div>
              <strong>{p.label}</strong>
              <small>{p.hint}</small>
            </div>
            <span>
              {number(p.value)} kg <em>{percent(share(p.value, total))}</em>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Journey({ impact }: { impact: ExcessImpact }) {
  const grow = useGrow();
  const steps = journey(impact);
  return (
    <section className="panel dx-panel" aria-labelledby="dx-journey-title">
      <div className="dx-panel-head">
        <h2 id="dx-journey-title">Caminho do excedente</h2>
        <span>acumulado</span>
      </div>
      <ol className="dx-journey">
        {steps.map((s) => (
          <li key={s.label}>
            <div className="dx-journey-row">
              <strong>{s.label}</strong>
              <span>
                {number(s.value)} kg
                {s.fromPrevious !== null && <em> · {percent(s.fromPrevious)} da etapa anterior</em>}
              </span>
            </div>
            <div className="dx-track" aria-hidden="true">
              <span style={{ width: grow ? `${Math.max(s.width, s.value > 0 ? 1.5 : 0)}%` : 0 }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="dx-foot">Cada etapa inclui as seguintes; não some os valores.</p>
    </section>
  );
}

function Modes({ impact }: { impact: ExcessImpact }) {
  const grow = useGrow();
  const list = modes(impact);
  const max = Math.max(...list.map((m) => m.published), 1);
  return (
    <section className="panel dx-panel" aria-labelledby="dx-modes-title">
      <div className="dx-panel-head">
        <h2 id="dx-modes-title">Venda e doação</h2>
        <span>ofertado × recebido</span>
      </div>
      <div className="dx-modes">
        {list.map((m) => {
          const Icon = m.key === "VENDA" ? Handshake : HeartHandshake;
          return (
            <div key={m.key} className="dx-mode">
              <div className="dx-mode-head">
                <span className="dx-mode-icon" data-mode={m.key} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <strong>{m.label}</strong>
                <span className="dx-rate">{m.published > 0 ? `${percent(m.rate)} recebido` : "sem ofertas"}</span>
              </div>
              <div
                className="dx-bullet"
                role="img"
                aria-label={`${m.label}: ${number(m.published)} kg ofertados, ${number(m.received)} kg recebidos`}
              >
                <span className="dx-bullet-base" style={{ width: grow ? `${share(m.published, max)}%` : 0 }}>
                  <span className="dx-bullet-fill" data-mode={m.key} style={{ width: `${m.rate}%` }} />
                </span>
              </div>
              <p>
                <b>{number(m.received)} kg</b> recebidos de {number(m.published)} kg ofertados
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
