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
export function buildFlow(order: TraceOrder, events: FlowEvent[]) {
  const actual = flowEvents(order, events);
  const last = actual.at(-1);
  const nodes: {
    key: string;
    type: string;
    title: string;
    event?: FlowEvent;
    future: boolean;
  }[] = actual.map((event, i) => ({
    key: event.id ?? "event-" + i,
    type: event.type,
    title:
      event.type === "PEDIDO_CANCELADO"
        ? "Pedido cancelado"
        : (stages.find((s) => s[0] === event.type)?.[1] ?? event.type),
    event,
    future: false,
  }));
  if (
    order.status !== "CANCELADO" &&
    !actual.some((e) => e.type === "PEDIDO_CANCELADO")
  ) {
    const rank = stages.findIndex((s) => s[0] === last?.type);
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
