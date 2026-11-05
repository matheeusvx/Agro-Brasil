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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { usePortal } from "./portal-provider";
export function PortalShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();
  const {
    session,
    workspace,
    loading,
    refresh,
    changeProperty,
    changeOrganization,
    logout,
  } = usePortal();
  const member = session.memberships.find(
    (m) => m.organizationId === session.organizationId,
  )!;
  const links = [
    { href: "/visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { href: "/producao", label: "Produção", icon: Sprout },
  ];
  return (
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
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          {!collapsed && (
            <span>
              Agro<span className="brand-plus">+</span> Brasil
            </span>
          )}
        </Link>
        {!collapsed && <p className="sidebar-section">ESPAÇO DO PRODUTOR</p>}
        <nav aria-label="Navegação principal">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              aria-current={path === href ? "page" : undefined}
              className={"nav-item " + (path === href ? "active" : "")}
            >
              <Icon size={19} />
              {!collapsed && (
                <>
                  <span>{label}</span>
                  {path === href && <span className="nav-active-dot" />}
                </>
              )}
            </Link>
          ))}
          {!collapsed && (
            <p className="sidebar-section mt-7">PRÓXIMOS ESPAÇOS</p>
          )}
          {[
            { label: "Ofertas", icon: Tags },
            { label: "Pedidos", icon: PackageCheck },
            { label: "Rastreabilidade", icon: Route },
          ].map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="nav-item future"
              title={label + " · próximo incremento"}
            >
              <Icon size={18} />
              {!collapsed && (
                <>
                  <span>{label}</span>
                  <LockKeyhole size={12} />
                </>
              )}
            </div>
          ))}
        </nav>
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
              <strong>
                {path === "/producao"
                  ? "Produção"
                  : path === "/perfil"
                    ? "Perfil"
                    : "Visão geral"}
              </strong>
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
                {session.memberships
                  .filter((m) => m.type === "PEQUENO_PRODUTOR_RURAL")
                  .map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="context-divider" />
            <label>
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
            </label>
            <Button
              variant="ghost"
              size="icon"
              disabled={loading}
              onClick={refresh}
              aria-label="Atualizar dados"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="main-content">
          {children}
        </main>
        
      </div>
    </div>
  );
}
