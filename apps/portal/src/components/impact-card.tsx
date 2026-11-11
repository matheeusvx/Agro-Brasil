"use client";
import { useEffect, useState } from "react";
import { FlaskConical, Handshake, HeartHandshake, LoaderCircle, RotateCw } from "lucide-react";
import { agro } from "@/lib/client-api";
import {
  balanceSteps,
  funnelSteps,
  hasModeData,
  impactErrorMessage,
  impactPath,
  isEmptyImpact,
  isImpact,
} from "@/lib/impact";
import { number, type ExcessImpact } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; impact: ExcessImpact };

// Card compacto do destino dos excedentes. Valores vêm prontos da API.
export function ImpactCard({ propertyId, revision }: { propertyId: string; revision: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setState({ kind: "loading" });
    agro<{ data: unknown }>(impactPath(propertyId), abort.signal)
      .then(({ data }) => {
        if (!isImpact(data, propertyId)) throw new Error("contrato");
        setState({ kind: "ready", impact: data });
      })
      .catch((error) => {
        if (!abort.signal.aborted) setState({ kind: "error", message: impactErrorMessage(error) });
      });
    return () => abort.abort();
  }, [propertyId, revision, retry]);

  return (
    <section className="ov-card ov-impact ag-rise" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="impact-title" aria-live="polite" aria-busy={state.kind === "loading"}>
      <div className="ov-impact-head">
        <h2 id="impact-title">Destino dos excedentes</h2>
        {state.kind === "ready" && state.impact.isDemonstration && (
          <span className="ov-impact-demo">
            <FlaskConical size={13} aria-hidden="true" /> Dados demonstrativos
          </span>
        )}
      </div>
      {state.kind === "loading" && (
        <p className="ov-impact-msg" role="status">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Consultando o indicador…
        </p>
      )}
      {state.kind === "error" && (
        <div className="ov-impact-msg" role="alert">
          <p>{state.message}</p>
          <button type="button" className="text-link" onClick={() => setRetry((r) => r + 1)}>
            <RotateCw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}
      {state.kind === "ready" && <ImpactBody impact={state.impact} />}
    </section>
  );
}

function ImpactBody({ impact }: { impact: ExcessImpact }) {
  const asOf = new Date(impact.asOf).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isEmptyImpact(impact))
    return (
      <p className="ov-impact-msg">
        Ainda não há ofertas publicadas nesta propriedade. Publique um excedente para acompanhar o destino.
      </p>
    );
  const main = [
    { label: "Ofertado", value: impact.funnelKg.published },
    { label: "Recebido", value: impact.funnelKg.received, hint: "confirmado pelo destinatário" },
    { label: "Vencido sem destinação", value: impact.balancesKg.expiredAvailable },
  ];
  return (
    <>
      <dl className="ov-impact-main">
        {main.map(({ label, value, hint }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {number(value)} <small>kg</small>
            </dd>
            {hint && <dd className="ov-impact-hint">{hint}</dd>}
          </div>
        ))}
      </dl>
      {hasModeData(impact) && (
        <ul className="ov-impact-modes" aria-label="Venda e doação">
          <li>
            <Handshake size={15} aria-hidden="true" /> Venda: {number(impact.byModeKg.VENDA.published)} kg ofertados ·{" "}
            {number(impact.byModeKg.VENDA.received)} kg recebidos
          </li>
          <li>
            <HeartHandshake size={15} aria-hidden="true" /> Doação: {number(impact.byModeKg.DOACAO.published)} kg ofertados ·{" "}
            {number(impact.byModeKg.DOACAO.received)} kg recebidos
          </li>
        </ul>
      )}
      <details className="ov-impact-more">
        <summary>Ver todas as etapas</summary>
        <h3>Caminho do excedente</h3>
        <dl>
          {funnelSteps(impact).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{number(value)} kg</dd>
            </div>
          ))}
        </dl>
        <h3>Saldos das ofertas agora</h3>
        <dl>
          {balanceSteps(impact).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{number(value)} kg</dd>
            </div>
          ))}
        </dl>
        <p>
          As etapas se sobrepõem e não devem ser somadas. Produção registrada não é excedente. Saldo vencido não
          comprova perda.
        </p>
      </details>
      <p className="ov-impact-foot">Consulta de {asOf}</p>
    </>
  );
}
