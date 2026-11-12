"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allRows, request, RequestError } from "@/lib/client-api";
import { statusFor } from "@/lib/audience";
import { parseOrganizationHome, type HomeOperation } from "@/lib/organization-home";
import type { FlowEvent, TraceOrder } from "@/lib/trace-flow";
import { number } from "@/lib/types";
import { usePortal } from "./portal-provider";
import { MessageButton } from "./message-button";
import { TraceGraph } from "./trace-page";
import { Button } from "./ui/button";

const config = {
  cooperative: { home: "/cooperative-home", type: "COOPERATIVA", back: "/remessas", backLabel: "Voltar às remessas", noun: "Remessa" },
  institution: { home: "/institution-home", type: "INSTITUICAO", back: "/solicitacoes", backLabel: "Voltar às solicitações", noun: "Solicitação" },
} as const;
const shortId = (id: string) => "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();

/** Localiza a operação na home autorizada (a mesma projeção já usada nas listas). */
async function findOperation(audience: keyof typeof config, organizationId: string, id: string, signal: AbortSignal) {
  for (let offset = 0; offset <= 1000; offset += 100) {
    const body = await request<unknown>(`/api/agro${config[audience].home}?limit=100&offset=${offset}`, {}, signal);
    const { home, pagination } = parseOrganizationHome(body, { organizationId, organizationType: config[audience].type });
    const found = home.operations.find((o) => o.id === id);
    if (found) return found;
    if (offset + pagination.limit >= pagination.total) return null;
  }
  return null;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; op: HomeOperation; events: FlowEvent[]; partial: boolean };

/**
 * Trajetória do pedido para cooperativa e instituição. Reaproveita o
 * TraceGraph do produtor; os eventos vêm de GET /lots/:id/events, que a API
 * já restringe aos pedidos em que a organização participa.
 */
export function OrganizationTrace({ id }: { id: string }) {
  const { audience, session, member, handleAccessError, revision } = usePortal();
  const [state, setState] = useState<State>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (audience === "producer") return;
    const abort = new AbortController();
    setState({ status: "loading" });
    (async () => {
      const op = await findOperation(audience, session.organizationId, id, abort.signal);
      if (!op) throw new Error(`${config[audience].noun} inexistente ou indisponível para esta organização.`);
      try {
        const events = await allRows<FlowEvent>("/lots/" + op.lotId + "/events", abort.signal);
        // Defesa adicional: somente eventos deste lote e sem pedido ou deste pedido.
        const own = events.filter((e) => (!e.lotId || e.lotId === op.lotId) && (!e.orderId || e.orderId === op.id));
        return { op, events: own, partial: false };
      } catch (error) {
        // Sem remessa ainda (solicitação aguardando aceite), a API não abre o
        // lote para a instituição. Mostramos só o que a home já confirma.
        if (error instanceof RequestError && error.status === 404 && !op.shipment)
          return {
            op,
            events: [{ type: "PEDIDO_SOLICITADO", orderId: op.id, lotId: op.lotId, recordedAt: op.createdAt }],
            partial: true,
          };
        throw error;
      }
    })()
      .then((data) => !abort.signal.aborted && setState({ status: "ready", ...data }))
      .catch((error) => {
        if (abort.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Não foi possível consultar a rastreabilidade." });
        handleAccessError(error);
      });
    return () => abort.abort();
  }, [audience, session.organizationId, id, revision, retry, handleAccessError]);
  if (audience === "producer") return null;
  const c = config[audience];
  return (
    <div className="trace-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{audience === "cooperative" ? "COOPERATIVA · RASTREABILIDADE" : "INSTITUIÇÃO · RASTREABILIDADE"}</p>
          <h1>Trajetória do pedido</h1>
          <p>Origem e movimentações confirmadas, em um só caminho.</p>
        </div>
        <Link className="text-link" href={c.back}>
          <ArrowLeft size={16} />
          {c.backLabel}
        </Link>
      </div>
      {state.status === "loading" ? (
        <div className="trace-loading panel p-8" role="status">
          Consultando eventos autorizados…
          <div className="trace-loading-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} />
            ))}
          </div>
        </div>
      ) : state.status === "error" ? (
        <div className="panel p-8" role="alert">
          <p>{state.message}</p>
          <Button className="mt-4" onClick={() => setRetry((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="trace-summary">
            <strong>{number(state.op.quantityKg)} kg</strong>
            <span>Pedido {shortId(state.op.id)}</span>
            <span>Lote {shortId(state.op.lotId)}</span>
            <span>{statusFor(audience, state.op.status)}</span>
            {state.op.status !== "CANCELADO" && <MessageButton orderId={state.op.id} />}
          </div>
          {state.partial && (
            <p className="trace-guide" role="note">
              O histórico do lote fica disponível depois que o produtor aceitar o pedido. Por enquanto, apenas a data da
              solicitação é exibida.
            </p>
          )}
          <TraceGraph
            key={id + session.organizationId}
            order={toTraceOrder(state.op)}
            events={state.events}
            orgName={member.name}
            orgId={session.organizationId}
            fillWithheld
            note="Eventos confirmados e compartilhados com sua organização pela API. Não representa localização GPS em tempo real nem prazos de entrega."
          />
        </>
      )}
    </div>
  );
}
export const toTraceOrder = (op: HomeOperation): TraceOrder => ({
  id: op.id,
  lotId: op.lotId,
  offerId: op.offerId,
  status: op.status,
  quantityKg: op.quantityKg,
  sellerOrganizationId: "",
  createdAt: op.createdAt,
});
