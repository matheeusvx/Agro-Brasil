"use client";
import { useEffect, useState } from "react";
import { CalendarClock, Eye, Info, MapPin } from "lucide-react";
import { request } from "@/lib/client-api";
import { canShowWriteActions } from "@/lib/audience";
import { parseOffers, type PublicOffer } from "@/lib/organization-home";
import { number, date } from "@/lib/types";
import { usePortal } from "./portal-provider";
import { HomeError, HomeSkeleton, Pager } from "./organization-home";
import { CommandSheet, type CommandRequest } from "./command-sheet";

const PAGE = 12;
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
type State =
  | { status: "loading" }
  | { status: "ready"; data: PublicOffer[]; pagination: { limit: number; offset: number; total: number } }
  | { status: "error"; message: string };

/**
 * Consulta de ofertas publicadas para a instituição (GET /offers, projeção
 * comercial). A solicitação será habilitada no próximo incremento.
 */
export function AvailableOffers() {
  const { session, member, handleAccessError, revision, refresh } = usePortal();
  const [command, setCommand] = useState<CommandRequest | null>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  // GET /offers não informa canWrite: o papel esconde o controle do LEITOR e a
  // API continuará decidindo na futura solicitação.
  const writer = canShowWriteActions(true, member.role);
  useEffect(() => {
    const abort = new AbortController();
    setState({ status: "loading" });
    request<unknown>(`/api/agro/offers?limit=${PAGE}&offset=${offset}`, {}, abort.signal)
      .then((body) => {
        if (!abort.signal.aborted) setState({ status: "ready", ...parseOffers(body) });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Consulta indisponível." });
        handleAccessError(error);
      });
    return () => abort.abort();
  }, [session.organizationId, offset, revision, retry, handleAccessError]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INSTITUIÇÃO</p>
          <h1>Ofertas disponíveis</h1>
          <p>Excedentes publicados por produtores, com saldo e prazo vigentes.</p>
        </div>
      </div>
      {state.status === "loading" ? (
        <HomeSkeleton />
      ) : state.status === "error" ? (
        <HomeError message={state.message} onRetry={() => setRetry((r) => r + 1)} />
      ) : !state.data.length ? (
        <section className="panel pb-panel">
          <div className="empty-inline">
            {state.pagination.total
              ? "Nenhuma oferta nesta página."
              : "Nenhuma oferta publicada com saldo disponível no momento."}
          </div>
        </section>
      ) : (
        <>
          <ul className="pb-offers" aria-label="Ofertas disponíveis">
            {state.data.map((o) => (
              <li key={o.id} className="panel">
                <div className="pb-offer-top">
                  <span className="pb-mode" data-mode={o.destinationMode}>
                    {o.destinationMode === "DOACAO" ? "Doação" : "Venda"}
                  </span>
                  {o.isDemonstration && <span className="pb-tag">Demonstração</span>}
                </div>
                <h2>{o.cropName}</h2>
                <p className="pb-offer-kg">
                  {number(o.availableKg)} <small>kg disponíveis</small>
                </p>
                <dl>
                  <div>
                    <dt>Valor</dt>
                    <dd>
                      {o.destinationMode === "DOACAO"
                        ? "Sem custo"
                        : o.unitPriceCents !== undefined
                          ? money(o.unitPriceCents) + " / kg"
                          : "Não informado"}
                    </dd>
                  </div>
                  {o.territory?.municipality && (
                    <div>
                      <dt><MapPin size={12} aria-hidden="true" /> Origem</dt>
                      <dd>{o.territory.municipality}{o.territory.uf ? "/" + o.territory.uf : ""}</dd>
                    </div>
                  )}
                  <div>
                    <dt><CalendarClock size={12} aria-hidden="true" /> Disponível até</dt>
                    <dd>{date(o.availableUntil)}</dd>
                  </div>
                  {o.sellerName && (
                    <div>
                      <dt>Ofertante</dt>
                      <dd>{o.sellerName}</dd>
                    </div>
                  )}
                </dl>
                {writer ? (
                  <button
                    type="button"
                    className="pb-action"
                    data-tone="primary"
                    data-write-action="Solicitar"
                    disabled={o.availableKg <= 0}
                    onClick={() =>
                      setCommand({
                        kind: "request",
                        endpoint: "/orders",
                        title: "Solicitar " + o.cropName,
                        summary: `${o.destinationMode === "DOACAO" ? "Doação" : "Venda"} · até ${number(o.availableKg)} kg disponíveis. O produtor analisa e aceita a solicitação; nada é reservado antes disso.`,
                        confirmLabel: "Enviar solicitação",
                        successMessage: "Solicitação enviada ao produtor.",
                        extra: { offerId: o.id },
                        availableKg: o.availableKg,
                      })
                    }
                  >
                    Solicitar
                  </button>
                ) : (
                  <span className="pb-step" data-kind="readonly">
                    <Eye size={13} aria-hidden="true" /> Somente consulta
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Pager pagination={state.pagination} onChange={setOffset} label="ofertas" />
        </>
      )}
      <CommandSheet command={command} onClose={() => setCommand(null)} onDone={refresh} />
      <p className="data-note">
        <Info size={11} aria-hidden="true" className="inline" /> Projeção comercial da API: sem endereço,
        propriedade ou contato do produtor. Necessidades institucionais ainda não fazem parte do sistema.
      </p>
    </>
  );
}
