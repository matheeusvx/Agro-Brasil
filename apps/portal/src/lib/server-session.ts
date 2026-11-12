import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isLoopback } from "./security";
import { audienceOf, defaultMembership, portalMemberships } from "./audience";

export type Membership = {
  organizationId: string;
  name: string;
  type: string;
  role: string;
};
type Session = {
  token: string;
  organizationId: string;
  userId: string;
  memberships: Membership[];
  expires: number;
};
const registry = globalThis as typeof globalThis & {
  agroPortalSessions?: Map<string, Session>;
};
const sessions = (registry.agroPortalSessions ??= new Map<string, Session>());
export const cookieName = "agro_portal_session";
const local = isLoopback;
export function localGate(req: NextRequest) {
  const publicUrl = new URL(req.url);
  publicUrl.host = req.headers.get("host") ?? publicUrl.host;
  if (process.env.PORTAL_DEMO_ENABLED !== "true" || !local(publicUrl.hostname))
    throw new Error("LOCAL_ONLY");
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded && !local(new URL("http://" + forwarded).hostname))
    throw new Error("LOCAL_ONLY");
  if (req.method !== "GET" && req.headers.get("origin") !== publicUrl.origin)
    throw new Error("ORIGIN");
}
export function apiBase() {
  const url = new URL(process.env.AGRO_API_URL ?? "http://127.0.0.1:3000");
  if (
    url.protocol !== "http:" ||
    !local(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("LOCAL_ONLY");
  return url.origin;
}
export async function backend(
  path: string,
  token: string,
  organization?: string,
  body?: string,
  idempotencyKey?: string,
  method: "GET" | "POST" | "PUT" = body === undefined ? "GET" : "POST",
) {
  return fetch(apiBase() + "/api/v1" + path, {
    method,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: "Bearer " + token,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(organization ? { "X-Organization-Id": organization } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
}
export async function identity(token: string) {
  const response = await backend("/me", token);
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return (await response.json()) as {
    userId: string;
    memberships: Membership[];
  };
}
export async function createSession(token: string) {
  const me = await identity(token);
  const first = defaultMembership(me.memberships);
  if (!first) throw new Error("PROFILE");
  for (const [key, s] of sessions)
    if (s.expires < Date.now()) sessions.delete(key);
  if (sessions.size >= 1000) throw new Error("CAPACITY");
  const id = randomBytes(32).toString("base64url");
  const session = {
    token,
    organizationId: first.organizationId,
    userId: me.userId,
    memberships: me.memberships,
    expires: Date.now() + 8 * 3600000,
  };
  sessions.set(id, session);
  return { id, session };
}
export async function currentSession() {
  const id = (await cookies()).get(cookieName)?.value;
  const session = id ? sessions.get(id) : undefined;
  if (!session || session.expires < Date.now()) {
    if (id) sessions.delete(id);
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
export async function destroySession() {
  const id = (await cookies()).get(cookieName)?.value;
  if (id) sessions.delete(id);
}
export function sessionView(session: Session) {
  return {
    userId: session.userId,
    organizationId: session.organizationId,
    memberships: portalMemberships(session.memberships),
  };
}
/** Público do vínculo ativo; sem vínculo atendido, a sessão deixa de valer. */
export function activeAudience(session: Session) {
  const member = session.memberships.find(
    (m) => m.organizationId === session.organizationId,
  );
  const audience = audienceOf(member?.type);
  if (!audience) throw new Error("UNAUTHORIZED");
  return audience;
}
export function routeError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const [status, message] =
    code === "UNAUTHORIZED"
      ? [401, "Sessão expirada ou acesso inválido. Entre novamente."]
      : code === "PROFILE"
        ? [403, "Este portal atende pequeno produtor rural, cooperativa e instituição."]
        : code === "LOCAL_ONLY"
          ? [403, "Demonstração disponível somente no ambiente local."]
          : code === "ORIGIN"
            ? [403, "Origem da solicitação não autorizada."]
            : [503, "Não foi possível acessar o serviço. Tente novamente."];
  return Response.json(
    { error: { message } },
    { status: Number(status), headers: { "Cache-Control": "no-store" } },
  );
}
