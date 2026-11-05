"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Scale,
  Boxes,
  PackageCheck,
  CloudSun,
  MapPin,
  Clock3,
  Check,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { usePortal } from "./portal-provider";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { OperationalCharts } from "./operational-charts";
import { WorkspaceState } from "./workspace-state";
import { number, date, eventName, statusName, type Pending } from "@/lib/types";
export function Overview() {
  const { workspace, loading, error, openCreate } = usePortal();
  const [pending, setPending] = useState<Pending | null>(null);
  if (loading || error || !workspace) return <WorkspaceState />;
  const { home, property, productions, orders, weather } = workspace;
  const total = productions.reduce((s, p) => s + p.quantityKg, 0),
    active = orders.filter((o) =>
      ["SOLICITADO", "ACEITO", "RETIRADO"].includes(o.status),
    ).length;
  const requested = orders.filter((o) => o.status === "SOLICITADO").length;
  const first = home.pending[0];
  const canWrite = home.canWrite;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU CAMPO, EM DIA</p>
          <h1>
            Olá, {home.userName?.trim().split(/\s+/)[0] || "produtor"}
            <span className="heading-period">.</span>
          </h1>
          <div
            className="greeting-weather"
            aria-label="Clima regional"
            aria-live="polite"
          >
            {weather.status === "available" &&
            typeof weather.temperatureC === "number" &&
            Number.isFinite(weather.temperatureC) ? (
              <>
                <span className="greeting-weather-reading">
                  <CloudSun size={15} aria-hidden="true" />
                  {Math.round(weather.temperatureC)} °C em{" "}
                  {property.municipality}
                </span>
                {weather.locality?.approximate && (
                  <small>Referência aproximada do município</small>
                )}
                <a
                  href="https://openweathermap.org/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dados meteorológicos fornecidos pela OpenWeather"
                  className="greeting-weather-credit"
                >
                  <img
                    src="/weather/openweather.png"
                    alt=""
                    width={28}
                    height={14}
                  />
                  OpenWeather
                </a>
              </>
            ) : (
              <span>Clima indisponível</span>
            )}
          </div>
        </div>
        <Button onClick={openCreate} disabled={!canWrite}>
          <Plus size={17} />
          Registrar produção
        </Button>
      </div>
      <div className="overview-context">
        <span>
          <MapPin size={13} />
          {property.name}
        </span>
        {property.municipality && (
          <>
            <span className="context-dot">·</span>
            <span>
              {property.municipality} / {property.uf}
            </span>
          </>
        )}
        <span className="last-update">
          <Clock3 size={12} />
          Atualizado às{" "}
          {new Date(home.fetchedAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="priority-row">
        <section className={"priority-panel" + (!first ? " clear" : "")}>
          <span className="priority-icon">
            {first ? <ClipboardList size={21} /> : <Check size={21} />}
          </span>
          <div>
            <p className="eyebrow">
              {first ? "PRECISA DA SUA ATENÇÃO" : "SUA ROTINA"}
            </p>
            <h2>
              {requested
                ? `${requested} ${requested === 1 ? "solicitação aguarda" : "solicitações aguardam"} sua análise`
                : first
                  ? "Há uma movimentação para acompanhar"
                  : "Tudo em dia por aqui."}
            </h2>
            <p>
              {first
                ? `${first.cropName} · ${number(first.quantityKg)} kg · ${statusName(first.status).toLocaleLowerCase("pt-BR")}`
                : productions.length
                  ? "Nenhuma pendência nesta propriedade."
                  : "Nenhuma pendência no momento. Registre sua primeira colheita."}
            </p>
          </div>
          {first ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPending(first)}
            >
              Consultar pedido
              <ArrowRight size={14} />
            </Button>
          ) : (
            !productions.length && (
              <Button
                variant="outline"
                size="sm"
                disabled={!canWrite}
                onClick={openCreate}
              >
                Começar
                <ArrowRight size={14} />
              </Button>
            )
          )}
        </section>
      </div>
      <div className="metrics-grid">
        {[
          {
            label: "Produção registrada",
            value: number(total),
            unit: "kg",
            note: "Volume registrado na propriedade",
            icon: Scale,
          },
          {
            label: "Lotes com origem",
            value: String(productions.length),
            unit: "lotes",
            note: "Vinculados às suas produções",
            icon: Boxes,
          },
          {
            label: "Pedidos em aberto",
            value: String(active),
            unit: "pedidos",
            note: "Solicitados, aceitos ou em entrega",
            icon: PackageCheck,
          },
        ].map(({ label, value, unit, note, icon: Icon }) => (
          <section className="panel metric" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <p>
              <strong>{value}</strong>
              <span>{unit}</span>
            </p>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <OperationalCharts productions={productions} orders={orders} />
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Últimas movimentações</h2>
            <p>Os registros mais recentes da sua produção</p>
          </div>
          <Link href="/producao" className="text-link">
            Consultar lotes
            <ArrowUpRight size={14} />
          </Link>
        </div>
        {home.recentLots.length ? (
          <div>
            {home.recentLots.map((lot) => (
              <Link
                key={lot.id}
                href={"/producao?lote=" + lot.id}
                className="movement-row"
              >
                <span className="event-dot">
                  <Check size={12} />
                </span>
                <div>
                  <strong>{eventName(lot.lastEvent.type)}</strong>
                  <p>
                    {lot.cropName} <span>·</span> lote de{" "}
                    {number(lot.quantityKg)} kg
                  </p>
                </div>
                <span className="movement-place">
                  {lot.lastEvent.location?.municipality ??
                    property.municipality}
                </span>
                <time>{date(lot.lastEvent.recordedAt)}</time>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Os primeiros registros de origem aparecerão aqui depois de cadastrar
            uma produção.
          </div>
        )}
      </section>
      <p className="data-note">
        Dados da propriedade selecionada. Produção registrada não representa
        estoque disponível. Rastreabilidade por eventos confirmados.
      </p>
      <Sheet
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <SheetContent className="sm:max-w-[480px] p-0">
          <SheetHeader className="drawer-header">
            <p className="eyebrow">PEDIDO VINCULADO AO LOTE</p>
            <SheetTitle>Detalhes da solicitação</SheetTitle>
            <SheetDescription>
              Consulta dos dados operacionais autorizados.
            </SheetDescription>
          </SheetHeader>
          {pending && (
            <div className="drawer-body">
              <span className="status-badge">{statusName(pending.status)}</span>
              <h3 className="text-2xl font-semibold mt-5">
                {pending.cropName}
              </h3>
              <p className="text-3xl mt-2">
                {number(pending.quantityKg)}{" "}
                <small className="text-base">kg solicitados</small>
              </p>
              <dl className="detail-list mt-7">
                <div>
                  <dt>Pedido</dt>
                  <dd className="font-mono text-xs break-all">{pending.id}</dd>
                </div>
                <div>
                  <dt>Lote de origem</dt>
                  <dd className="font-mono text-xs break-all">
                    {pending.lotId}
                  </dd>
                </div>
              </dl>
              <p className="info-note mt-6">
                O tratamento de pedidos será o próximo incremento. Esta consulta
                não altera reservas, retirada ou recebimento.
              </p>
              <Link
                href={"/producao?lote=" + pending.lotId}
                onClick={() => setPending(null)}
                className="text-link mt-6"
              >
                Consultar lote de origem
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
