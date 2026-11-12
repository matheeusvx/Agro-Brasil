import { NextRequest } from "next/server";
import {
  localGate,
  currentSession,
  backend,
  routeError,
  activeAudience,
} from "@/lib/server-session";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Order = {
  id: string;
  status: string;
  sellerOrganizationId?: string;
  requesterOrganizationId?: string;
  shipment?: { carrierOrganizationId?: string | null } | null;
};
/**
 * Resolve, no servidor, com quem a organização ativa pode conversar sobre um
 * pedido. Consulta GET /orders (já restrito pela API às participações da
 * organização) e devolve ao navegador somente os IDs das outras partes e seus
 * papéis — nenhum outro dado do pedido. A abertura da conversa continua sendo
 * validada pela API em POST /chats/open.
 */
export async function GET(req: NextRequest) {
  try {
    localGate(req);
    const session = await currentSession();
    activeAudience(session);
    const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
    if (!UUID.test(orderId))
      return Response.json({ error: { message: "Pedido inválido." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
    for (let offset = 0; offset <= 1000; offset += 100) {
      const response = await backend(`/orders?limit=100&offset=${offset}`, session.token, session.organizationId);
      const body = await response.json();
      if (!response.ok)
        return Response.json({ error: { message: body?.error?.message ?? "Consulta indisponível." } }, { status: response.status, headers: { "Cache-Control": "no-store" } });
      const rows = (body.data ?? []) as Order[];
      const order = rows.find((o) => o.id === orderId);
      if (order) {
        const me = session.organizationId;
        const parties = [
          ["PRODUTOR", order.sellerOrganizationId],
          ["SOLICITANTE", order.requesterOrganizationId],
          ["COOPERATIVA", order.shipment?.carrierOrganizationId ?? null],
        ] as const;
        if (!parties.some(([, id]) => id === me))
          return Response.json({ error: { message: "Pedido indisponível." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
        const participants = parties
          .filter(([, id]) => id && id !== me)
          .map(([role, id]) => ({ organizationId: id as string, role }));
        return Response.json({ data: { orderId, cancelled: order.status === "CANCELADO", participants } }, { headers: { "Cache-Control": "no-store" } });
      }
      if (rows.length < 100) break;
    }
    return Response.json({ error: { message: "Pedido indisponível para esta organização." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
