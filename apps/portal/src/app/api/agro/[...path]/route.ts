import { NextRequest } from "next/server";
import {
  localGate,
  currentSession,
  backend,
  routeError,
  activeAudience,
} from "@/lib/server-session";
import { allowedProxyPath, allowedProxyQuery } from "@/lib/security";
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
    const audience = activeAudience(session);
    if (
      !allowedProxyPath(endpoint, req.method, audience) ||
      !allowedProxyQuery(new URL(req.url).search, audience)
    )
      return Response.json(
        { error: { message: "Operação não disponível neste incremento." } },
        { status: 404 },
      );
    const key = req.headers.get("Idempotency-Key");
    if (
      req.method === "POST" &&
      endpoint !== "/productions" &&
      (!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key))
    )
      return Response.json(
        { error: { message: "Chave de idempotência válida é obrigatória." } },
        { status: 400 },
      );
    const method = req.method === "PUT" ? "PUT" : req.method === "POST" ? "POST" : "GET";
    const text = method !== "GET" ? await req.text() : undefined;
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
      key ?? undefined,
      method,
    );
    const data = await response.json();
    return Response.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        ...(response.headers.has("Idempotency-Replayed")
          ? {
              "Idempotency-Replayed": response.headers.get(
                "Idempotency-Replayed",
              )!,
            }
          : {}),
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
