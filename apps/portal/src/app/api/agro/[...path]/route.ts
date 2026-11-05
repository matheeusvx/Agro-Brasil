import { NextRequest } from "next/server";
import {
  localGate,
  currentSession,
  backend,
  routeError,
} from "@/lib/server-session";
import { allowedProxyPath } from "@/lib/security";
export const runtime = "nodejs";
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    localGate(req);
    const session = await currentSession();
    const { path } = await context.params;
    const endpoint = "/" + path.join("/");
    if (!allowedProxyPath(endpoint, req.method))
      return Response.json(
        { error: { message: "Operação não disponível neste incremento." } },
        { status: 404 },
      );
    const text = req.method === "POST" ? await req.text() : undefined;
    if (text && Buffer.byteLength(text) > 16384)
      return Response.json(
        { error: { message: "Solicitação muito grande." } },
        { status: 413 },
      );
    const response = await backend(
      endpoint + new URL(req.url).search,
      session.token,
      session.organizationId,
      text,
    );
    const data = await response.json();
    return Response.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}
export const GET = proxy;
export const POST = proxy;
