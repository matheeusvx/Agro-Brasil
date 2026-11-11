"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Handshake,
  HeartHandshake,
  Info,
  Sparkles,
  Tags,
} from "lucide-react";
import { usePortal } from "./portal-provider";
import { WorkspaceState } from "./workspace-state";
import { Button } from "./ui/button";
import { useCountTo, useReducedMotion } from "./chart-motion";
import { CompositionChart, JourneyChart } from "./excess-charts";
import { agro } from "@/lib/client-api";
import {
  impactErrorMessage,
  impactPath,
  insights,
  isEmptyImpact,
  isImpact,
  modes,
  percent,
  share,
} from "@/lib/impact";
import { number, type ExcessImpact } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; impact: ExcessImpact };
const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

// Destino dos excedentes: todos os números chegam prontos da API de impacto.
export function ExcessDestination() {
  const { workspace, loading, error } = usePortal();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  const propertyId = workspace?.property.id;
  const fetchedAt = workspace?.home.fetchedAt;
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
    // fetchedAt muda quando o produtor usa o botão de atualizar do topo do portal.
  }, [propertyId, fetchedAt, retry]);

  if (loading || error || !workspace) return <WorkspaceState />;
  const impact = state.kind === "ready" ? state.impact : null;
  return (
    <div className="dx">
      <div className="page-heading ag-rise" style={rise(0)}>
        <div>
          <p className="eyebrow">DO EXCEDENTE AO DESTINATÁRIO</p>
          <h1>Destino dos excedentes</h1>
          <p>
            O que você ofertou em {workspace.property.name} e o que já chegou a quem precisa
            {impact && (
              <>
                {" "}· consulta de{" "}
                {new Date(impact.asOf).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </>
            )}
            .
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <div className="dx-kpis" role="status" aria-label="Consultando o destino dos excedentes">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="dx-kpi dx-skeleton" />
          ))}
        </div>
      )}
      {state.kind === "error" && (
        <section className="panel dx-state ag-rise" style={rise(1)} role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h2>Não foi possível consultar agora</h2>
            <p>{state.message}</p>
          </div>
          <Button variant="outline" onClick={() => setRetry((r) => r + 1)}>
            Tentar novamente
          </Button>
        </section>
      )}
      {impact && isEmptyImpact(impact) && (
        <section className="panel dx-state ag-rise" style={rise(1)}>
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
  const tips = insights(i);
  return (
    <>
      <section className="dx-kpis ag-rise" style={rise(1)} aria-label="Indicadores principais">
        <Kpi label="Ofertado" value={published} note="em ofertas publicadas" />
        <Kpi
          label="Recebido"
          value={i.funnelKg.received}
          note={`${percent(share(i.funnelKg.received, published))} do ofertado, confirmado`}
          tone="good"
        />
        <Kpi
          label="Em andamento"
          value={ongoing}
          note={`${number(i.balancesKg.reservedNow)} kg reservados e ${number(i.balancesKg.inTransitNow)} kg em trânsito`}
        />
        <Kpi
          label="Vencido sem destinação"
          value={i.balancesKg.expiredAvailable}
          note={`${percent(share(i.balancesKg.expiredAvailable, published))} do ofertado`}
          tone={i.balancesKg.expiredAvailable > 0 ? "attention" : undefined}
        />
      </section>

      <div className="dx-stack-col">
        <CompositionChart impact={i} />
      </div>

      <div className="dx-grid">
        <JourneyChart impact={i} />
        <div className="dx-side">
          <Modes impact={i} />
          {tips.length > 0 && (
            <section className="panel dx-panel dx-tips ag-rise" style={rise(6)} aria-labelledby="dx-tips-title">
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
        </div>
      </div>

      <p className="data-note dx-note ag-rise" style={rise(7)}>
        <Info size={13} aria-hidden="true" /> Valores calculados pela plataforma a partir das ofertas publicadas desta
        propriedade. Recebido conta só o que o destinatário confirmou. Saldo vencido não comprova perda.
      </p>
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "good" | "attention";
}) {
  const shown = useCountTo(value);
  return (
    <div className="dx-kpi" data-tone={tone}>
      <p>{label}</p>
      <strong aria-label={`${number(value)} quilos`}>
        {number(Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10)}
        <small>kg</small>
      </strong>
      <span className="dx-kpi-note">{note}</span>
    </div>
  );
}

function Modes({ impact }: { impact: ExcessImpact }) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const grow = reduced || on;
  const list = modes(impact);
  const max = Math.max(...list.map((m) => m.published), 1);
  return (
    <section className="panel dx-panel ag-rise" style={rise(5)} aria-labelledby="dx-modes-title">
      <div className="dx-panel-title">
        <h2 id="dx-modes-title">Venda e doação</h2>
        <p>Ofertado e recebido em cada modalidade.</p>
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
