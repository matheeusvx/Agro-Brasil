import { NextRequest, NextResponse } from "next/server";
import { audienceOf } from "@/lib/audience";
import {
  localGate,
  createSession,
  currentSession,
  destroySession,
  identity,
  cookieName,
  sessionView,
  routeError,
} from "@/lib/server-session";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    localGate(req);
    const session = await currentSession();
    const me = await identity(session.token);
    session.memberships = me.memberships;
    if (
      !me.memberships.some(
        (m) =>
          m.organizationId === session.organizationId &&
          audienceOf(m.type) !== null,
      )
    )
      throw new Error("UNAUTHORIZED");
    return NextResponse.json(sessionView(session), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    localGate(req);
    const text = await req.text();
    if (text.length > 1024)
      return Response.json(
        { error: { message: "Solicitação inválida." } },
        { status: 413 },
      );
    const body = JSON.parse(text);
    if (
      typeof body.token === "string" &&
      /^[A-Za-z0-9_-]{32,200}$/.test(body.token)
    ) {
      await destroySession();
      const { id, session } = await createSession(body.token);
      const response = NextResponse.json(sessionView(session));
      response.cookies.set(cookieName, id, {
        httpOnly: true,
        sameSite: "strict",
        secure: new URL(req.url).protocol === "https:",
        path: "/",
        maxAge: 8 * 3600,
      });
      return response;
    }
    if (typeof body.organizationId === "string" &&
      body.organizationId.length <= 64) {
      const session = await currentSession();
      const me = await identity(session.token);
      if (
        !me.memberships.some(
          (m) =>
            m.organizationId === body.organizationId &&
            audienceOf(m.type) !== null,
        )
      )
        return Response.json(
          {
            error: {
              message:
                "Organização não autorizada para este espaço de trabalho.",
            },
          },
          { status: 403 },
        );
      session.organizationId = body.organizationId;
      session.memberships = me.memberships;
      return NextResponse.json(sessionView(session));
    }
    return Response.json(
      { error: { message: "Informe um acesso demonstrativo válido." } },
      { status: 400 },
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    localGate(req);
    await destroySession();
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(cookieName);
    return response;
  } catch (error) {
    return routeError(error);
  }
}
