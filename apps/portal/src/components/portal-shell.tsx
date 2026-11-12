"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  LayoutDashboard,
  Sprout,
  Tags,
  PackageCheck,
  Route,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  LogOut,
  ChevronRight,
  LockKeyhole,
  Tractor,
  HandHeart,
  Truck,
  ClipboardList,
  Store,
  ShieldAlert,
  MessagesSquare,
} from "lucide-react";
import {
  audienceLabel,
  audienceOf,
  pageAllowed,
  type Audience,
} from "@/lib/audience";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { usePortal } from "./portal-provider";
import { ChatInboxProvider, useInbox } from "./chat-inbox";
export function PortalShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();
  const {
    session,
    member,
    audience,
    switching,
    workspace,
    loading,
    refresh,
    changeProperty,
    changeOrganization,
    logout,
  } = usePortal();
  const firstName =
    (audience === "producer" &&
      workspace?.home.userName?.trim().split(/\s+/)[0]) ||
    member.name.split(/\s+/)[0] ||
    audienceLabel[audience];
  const groups = audience === "producer" ? [
    {
      title: "ESPAÇO DO PRODUTOR",
      links: [
        { href: "/visao-geral", label: "Visão geral", icon: LayoutDashboard },
        { href: "/minha-fazenda", label: "Minha Fazenda", icon: Tractor },
        { href: "/producao", label: "Produção", icon: Sprout },
      ],
    },
    {
      title: "LOGÍSTICA",
      links: [
        { href: "/ofertas", label: "Ofertas", icon: Tags },
        { href: "/pedidos", label: "Pedidos", icon: PackageCheck },
        { href: "/destino", label: "Excedentes", icon: HandHeart },
        { href: "/rastreabilidade", label: "Rastreabilidade", icon: Route },
        { href: "/mensagens", label: "Mensagens", icon: MessagesSquare },
      ],
    },
  ] : navigation[audience];
  const allowed = pageAllowed(path, audience);
  const current =
    groups.flatMap((g) => g.links).find((l) => path.startsWith(l.href))
      ?.label ?? (path === "/perfil" ? "Perfil" : "Visão geral");
  return (
    // Caixa de mensagens por organização: a troca de vínculo descarta tudo.
    <ChatInboxProvider key={session.organizationId}>
    <div className={"portal-frame " + (collapsed ? "is-collapsed" : "")}>
      <a href="#main" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="portal-sidebar">
        <Link
          href="/visao-geral"
          className="brand"
          aria-label="Agro+ Brasil, visão geral"
        >
          {!collapsed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="brand-logo"
              src="/brand/agro-mais-brasil.webp"
              alt=""
              width={130}
              height={36}
            />
          )}
          <span
            className={"brand-mark-v3" + (collapsed ? "" : " only-compact")}
            aria-hidden="true"
          >
            +
          </span>
        </Link>
        {groups.map((group) => (
          <div key={group.title} className="sidebar-group">
            {collapsed ? (
              <hr className="sidebar-divider" aria-hidden="true" />
            ) : (
              <p className="sidebar-section" id={"nav-" + group.title}>
                {group.title}
              </p>
            )}
            <nav aria-label={group.aria ?? (group.title === "LOGÍSTICA" ? "Logística" : "Espaço do produtor")}>
              {group.links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  aria-label={href === "/mensagens" ? undefined : label}
                  aria-current={path === href ? "page" : undefined}
                  className={"nav-item " + (path === href ? "active" : "")}
                >
                  <Icon size={19} />
                  {href === "/mensagens" ? (
                    <MessagesNavLabel label={label} collapsed={collapsed} active={path === href} />
                  ) : (
                    !collapsed && (
                      <>
                        <span>{label}</span>
                        {path === href && <span className="nav-active-dot" />}
                      </>
                    )
                  )}
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-footer">
          <Link
            href="/perfil"
            aria-label="Perfil e configurações"
            title="Perfil e configurações"
            className={"nav-item " + (path === "/perfil" ? "active" : "")}
          >
            <Settings2 size={18} />
            {!collapsed && <span>Perfil e configurações</span>}
          </Link>

          <button
            className="nav-item"
            onClick={() =>
              logout().catch(() =>
                toast.error(
                  "Não foi possível encerrar a sessão. Tente novamente.",
                ),
              )
            }
            aria-label="Sair do portal"
            title="Sair do portal"
          >
            <LogOut size={17} />
            {!collapsed && <span>Sair do portal</span>}
          </button>
        </div>
      </aside>
      <div className="portal-workspace">
        <header className="workspace-header">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={
                collapsed ? "Expandir menu lateral" : "Recolher menu lateral"
              }
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </Button>
            <div className="breadcrumb">
              <span>Espaço de trabalho</span>
              <ChevronRight size={13} />
              <strong>{current}</strong>
            </div>
          </div>
          <div className="context-controls">
            <label>
              <span>Organização ativa</span>
              <select
                aria-label="Organização ativa"
                value={session.organizationId}
                disabled={loading}
                onChange={(event) => {
                  void changeOrganization(event.target.value);
                }}
              >
                {(["producer", "cooperative", "institution"] as Audience[]).map(
                  (kind) => {
                    const items = session.memberships.filter(
                      (m) => audienceOf(m.type) === kind,
                    );
                    return items.length ? (
                      <optgroup key={kind} label={audienceLabel[kind]}>
                        {items.map((m) => (
                          <option key={m.organizationId} value={m.organizationId}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  },
                )}
              </select>
            </label>
            {audience === "producer" && <div className="context-divider" />}
            {audience === "producer" && <label>
              <span>Propriedade</span>
              <select
                aria-label="Propriedade"
                value={workspace?.property.id ?? ""}
                disabled={loading || !workspace}
                onChange={(event) => changeProperty(event.target.value)}
              >
                {!workspace && (
                  <option value="">
                    {loading ? "Carregando…" : "Indisponível"}
                  </option>
                )}
                {workspace?.catalog.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>}
            <Button
              variant="ghost"
              size="icon"
              disabled={loading}
              onClick={refresh}
              aria-label="Atualizar dados"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </Button>
            <div className="user-chip">
              <span className="user-chip-avatar" aria-hidden="true">
                {firstName.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{firstName}</strong>
                <small>
                  {member.role === "LEITOR"
                    ? "Consulta"
                    : audience === "producer"
                      ? "Produtor"
                      : audienceLabel[audience]}
                </small>
              </div>
            </div>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="main-content"
          data-audience={audience}
        >
          {switching ? (
            <div role="status" aria-label="Trocando de organização" className="space-y-5">
              <div className="h-12 w-72 max-w-full rounded-xl bg-[#e3e9de] animate-pulse" />
              <div className="h-64 rounded-[22px] bg-[#e3e9de] animate-pulse" />
            </div>
          ) : allowed ? (
            // Remonta a página a cada troca de organização: nenhum estado local sobrevive.
            <div
              key={session.organizationId + path}
              className="ag-page"
              data-path={path.startsWith("/rastreabilidade") ? "/rastreabilidade" : path}
            >
              {children}
            </div>
          ) : (
            <AreaUnavailable audience={audience} />
          )}
        </main>
      </div>
    </div>
    </ChatInboxProvider>
  );
}

type NavGroup = {
  title: string;
  aria?: string;
  links: { href: string; label: string; icon: typeof LayoutDashboard }[];
};
const navigation: Record<Exclude<Audience, "producer">, NavGroup[]> = {
  cooperative: [
    {
      title: "ESPAÇO DA COOPERATIVA",
      aria: "Espaço da cooperativa",
      links: [
        { href: "/visao-geral", label: "Visão geral", icon: LayoutDashboard },
        { href: "/remessas", label: "Remessas", icon: Truck },
        { href: "/mensagens", label: "Mensagens", icon: MessagesSquare },
      ],
    },
  ],
  institution: [
    {
      title: "ESPAÇO DA INSTITUIÇÃO",
      aria: "Espaço da instituição",
      links: [
        { href: "/visao-geral", label: "Visão geral", icon: LayoutDashboard },
        { href: "/solicitacoes", label: "Solicitações", icon: ClipboardList },
        { href: "/ofertas-disponiveis", label: "Ofertas disponíveis", icon: Store },
        { href: "/mensagens", label: "Mensagens", icon: MessagesSquare },
      ],
    },
  ],
};
/** Proteção de interface: a página de outro público nem chega a montar. */
function AreaUnavailable({ audience }: { audience: Audience }) {
  return (
    <section className="state-panel" role="alert">
      <ShieldAlert size={26} />
      <h2>Esta área não faz parte do perfil ativo.</h2>
      <p>
        O vínculo selecionado é de {audienceLabel[audience].toLocaleLowerCase("pt-BR")}.
        Troque a organização no cabeçalho ou volte para a visão geral.
      </p>
      <Link href="/visao-geral" className="ag-btn ag-btn-dark">
        Ir para a visão geral
      </Link>
    </section>
  );
}

/** Rótulo de Mensagens com contador de não lidas (texto acessível no próprio link). */
function MessagesNavLabel({ label, collapsed, active }: { label: string; collapsed: boolean; active: boolean }) {
  const { total } = useInbox();
  const text = total > 99 ? "99+" : String(total);
  const spoken = total === 1 ? "1 mensagem não lida" : `${total} mensagens não lidas`;
  return (
    <>
      <span className={collapsed ? "sr-only" : undefined}>
        {label}
        {total > 0 && <span className="sr-only">, {spoken}</span>}
      </span>
      {total > 0 ? (
        <span className={"nav-unread" + (collapsed ? " is-dot" : "")} aria-hidden="true">
          {collapsed ? "" : text}
        </span>
      ) : (
        !collapsed && active && <span className="nav-active-dot" />
      )}
    </>
  );
}
