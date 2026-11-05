"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Leaf,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { request, loadWorkspace, RequestError } from "@/lib/client-api";
import type { Session, Workspace } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalShell } from "./portal-shell";
import { ProductionCreate } from "./production-create";

type PortalState = {
  session: Session;
  workspace: Workspace | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  changeProperty: (id: string) => void;
  changeOrganization: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  openCreate: () => void;
};
const Context = createContext<PortalState | null>(null);
export function usePortal() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace ausente");
  return context;
}
export function PortalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [property, setProperty] = useState(""),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    request<Session>("/api/session", {}, abort.signal)
      .then(setSession)
      .catch(() => {})
      .finally(() => setReady(true));
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!session) return;
    const abort = new AbortController();
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setWorkspace(null);
    loadWorkspace(property, abort.signal)
      .then((data) => {
        if (current === generation.current) setWorkspace(data);
      })
      .catch((error) => {
        if (abort.signal.aborted || current !== generation.current) return;
        if (error instanceof RequestError && error.status === 401) {
          setSession(null);
          setProperty("");
        } else
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o espaço de trabalho.",
          );
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => abort.abort();
  }, [session, property, revision]);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  async function logout() {
    await request("/api/session", { method: "DELETE" });
    generation.current++;
    setWorkspace(null);
    setSession(null);
    setProperty("");
    setCreating(false);
  }
  async function changeOrganization(id: string) {
    setLoading(true);
    setError("");
    setWorkspace(null);
    setCreating(false);
    generation.current++;
    try {
      const next = await request<Session>("/api/session", {
        method: "POST",
        body: JSON.stringify({ organizationId: id }),
      });
      setProperty("");
      setSession(next);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a organização.",
      );
      setLoading(false);
    }
  }
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center" role="status">
        <LoaderCircle
          className="animate-spin"
          aria-label="Verificando sessão"
        />
      </div>
    );
  if (!session) return <Access onLogin={setSession} />;
  return (
    <Context.Provider
      value={{
        session,
        workspace,
        loading,
        error,
        refresh,
        changeProperty: setProperty,
        changeOrganization,
        logout,
        openCreate: () => setCreating(true),
      }}
    >
      <PortalShell>{children}</PortalShell>
      <ProductionCreate
        key={session.organizationId + ":" + (workspace?.property.id ?? "")}
        open={creating}
        onOpenChange={setCreating}
      />
    </Context.Provider>
  );
}
function Access({ onLogin }: { onLogin: (session: Session) => void }) {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="access-page">
      <section className="access-story">
        <div className="brand">
          <Leaf size={28} />
          <span>
            Agro<span className="brand-plus">+</span> Brasil
          </span>
        </div>
        <div>
          <p className="eyebrow text-[#c4d6b7]">DO CAMPO PARA NOVAS CONEXÕES</p>
          <h1>
            Sua produção.
            <br />
            Novos caminhos.
          </h1>
          <p>
            Organize sua colheita, acompanhe suas operações e mantenha a origem
            de cada lote sempre por perto.
          </p>
          <div className="field-lines" aria-hidden="true" />
        </div>
        <small>Uma gestão mais próxima de quem produz.</small>
      </section>
      <section className="access-form">
        <div className="max-w-[390px] w-full">
          <span className="rounded-full bg-[#edf2e8] px-3 py-1 text-xs font-semibold">
            PORTAL DO PRODUTOR
          </span>
          <h2 className="text-3xl tracking-tight font-semibold mt-6">
            Bem-vindo ao seu campo.
          </h2>
          <p className="text-[#69766d] mt-3 mb-7">
            Acesse seu espaço de trabalho para cuidar da rotina e das próximas
            colheitas.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const next = await request<Session>("/api/session", {
                  method: "POST",
                  body: JSON.stringify({ token }),
                });
                setToken("");
                onLogin(next);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Serviço indisponível.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="token" className="field-label">
              Acesso temporário
            </label>
            <Input
              id="token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              minLength={32}
              maxLength={200}
              placeholder="Cole seu token de demonstração"
              className="h-11"
            />
            {error && (
              <p role="alert" className="error-inline">
                <AlertCircle size={16} />
                {error}
              </p>
            )}
            <Button className="w-full h-11 mt-5" disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <>
                  Entrar no portal
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
          <div className="mt-8 border-t pt-5 flex gap-3 text-xs text-[#69766d]">
            <ShieldCheck size={20} className="shrink-0 text-[#47715b]" />
            <p>
              Demonstração local com participantes fictícios. O acesso fica
              somente na sessão; nenhum token é salvo no navegador.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
