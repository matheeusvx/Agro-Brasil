export type FlowEvent = {
  id?: string;
  lotId?: string;
  orderId?: string | null;
  operationId?: string;
  type: string;
  recordedAt: string;
  occurredAt?: string;
  location?: { municipality: string; uf: string };
  responsibleOrganizationId?: string;
  quantityGrams?: number;
};
export type TraceOrder = {
  id: string;
  lotId: string;
  offerId: string;
  status: string;
  quantityKg: number;
  sellerOrganizationId: string;
  createdAt: string;
};
export const stages = [
  ["ORIGEM_REGISTRADA", "Origem registrada"],
  ["OFERTA_PUBLICADA", "Oferta publicada"],
  ["PEDIDO_SOLICITADO", "Solicitação recebida"],
  ["PEDIDO_ACEITO", "Pedido aceito"],
  ["RETIRADA_REGISTRADA", "Retirada registrada"],
  ["RECEBIMENTO_CONFIRMADO", "Recebimento confirmado"],
] as const;
export function flowEvents(order: TraceOrder, events: FlowEvent[]) {
  return events
    .filter(
      (e) =>
        (!e.lotId || e.lotId === order.lotId) &&
        ((e.type === "ORIGEM_REGISTRADA" && !e.orderId) ||
          (e.type === "OFERTA_PUBLICADA" &&
            !e.orderId &&
            e.operationId === order.offerId) ||
          (e.orderId === order.id &&
            [...stages.map((s) => s[0]), "PEDIDO_CANCELADO"].includes(e.type))),
    )
    .sort(
      (a, b) =>
        Date.parse(a.recordedAt) - Date.parse(b.recordedAt) ||
        stages.findIndex((s) => s[0] === a.type) -
          stages.findIndex((s) => s[0] === b.type),
    );
}
export type FlowNode = {
  key: string;
  type: string;
  title: string;
  event?: FlowEvent;
  future: boolean;
  /** Etapa necessariamente concluída, mas cujo evento a API não compartilha com este perfil. */
  withheld?: boolean;
};
/**
 * `fillWithheld`: para cooperativa/instituição a API omite eventos sem vínculo
 * com o pedido (ex.: Oferta publicada). Etapas anteriores à última confirmada
 * aparecem como concluídas, sem data nem local inventados.
 */
export function buildFlow(
  order: TraceOrder,
  events: FlowEvent[],
  { fillWithheld = false }: { fillWithheld?: boolean } = {},
) {
  const actual = flowEvents(order, events);
  const last = actual.at(-1);
  const toNode = (event: FlowEvent, i: number): FlowNode => ({
    key: event.id ?? "event-" + i,
    type: event.type,
    title:
      event.type === "PEDIDO_CANCELADO"
        ? "Pedido cancelado"
        : (stages.find((s) => s[0] === event.type)?.[1] ?? event.type),
    event,
    future: false,
  });
  let nodes: FlowNode[] = actual.map(toNode);
  if (fillWithheld) {
    const lastRank = Math.max(
      -1,
      ...actual.map((e) => stages.findIndex((s) => s[0] === e.type)),
    );
    nodes = [
      ...stages.slice(0, lastRank + 1).map(([type, title]) => {
        const i = actual.findIndex((e) => e.type === type);
        return i >= 0
          ? toNode(actual[i], i)
          : { key: "withheld-" + type, type, title, future: false, withheld: true };
      }),
      ...actual
        .map((e, i) => [e, i] as const)
        .filter(([e]) => e.type === "PEDIDO_CANCELADO")
        .map(([e, i]) => toNode(e, i)),
    ];
  }
  if (
    order.status !== "CANCELADO" &&
    !actual.some((e) => e.type === "PEDIDO_CANCELADO")
  ) {
    const rank = Math.max(
      -1,
      ...actual.map((e) => stages.findIndex((s) => s[0] === e.type)),
    );
    stages.slice(rank + 1).forEach(([type, title]) =>
      nodes.push({
        key: "future-" + type,
        type,
        title,
        event: undefined,
        future: true,
      }),
    );
  }
  return {
    nodes,
    current: last?.id ?? (last ? "event-" + (actual.length - 1) : null),
  };
}
