"use client";
import { useEffect, useRef, useState } from "react";
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
import { ImpactCard } from "./impact-card";
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
  const firstName = home.userName?.trim().split(/\s+/)[0] || "produtor";
  const hasWeather =
    weather.status === "available" &&
    typeof weather.temperatureC === "number" &&
    Number.isFinite(weather.temperatureC);
  return (
    <>
      <div className="ov-hero-grid">
        <section className="ov-hero ag-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="eyebrow">SEU CAMPO, EM DIA</p>
          <h1>Olá, {firstName}.</h1>
          <p>
            {property.name}
            {property.municipality ? ` · ${property.municipality}/${property.uf}` : ""} · atualizado às{" "}
            {new Date(home.fetchedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <button
            type="button"
            className="ov-priority"
            data-attention={first ? true : undefined}
            onClick={() => first && setPending(first)}
            disabled={!first}
          >
            {requested
              ? `${requested} ${requested === 1 ? "solicitação aguarda" : "solicitações aguardam"} sua análise`
              : first
                ? `${first.cropName} · ${number(first.quantityKg)} kg · ${statusName(first.status).toLocaleLowerCase("pt-BR")}`
                : productions.length
                  ? "Tudo em dia por aqui."
                  : "Registre sua primeira colheita para começar."}
          </button>
          <div className="ov-hero-actions">
            <button type="button" className="ag-btn ag-btn-lime" onClick={openCreate} disabled={!canWrite}>
              <Plus size={16} /> Registrar produção
            </button>
          </div>
        </section>
        <section
          className="ov-card ag-rise"
          style={{ "--i": 1 } as React.CSSProperties}
          aria-label="Clima regional"
          aria-live="polite"
        >
          <h2>Clima hoje</h2>
          <div className="ov-weather-main">
            <div>
              <p className="ov-weather-temp">
                {hasWeather ? (
                  <>
                    {Math.round(weather.temperatureC!)}
                    <sup>°C</sup>
                  </>
                ) : (
                  "--"
                )}
              </p>
              <p className="ov-weather-desc">
                {hasWeather
                  ? `${weather.description ?? "Agora"} em ${property.municipality ?? "sua região"}`
                  : "Clima indisponível"}
              </p>
            </div>
            <WeatherArt />
          </div>
          <div className="ov-weather-foot">
            <span>
              {weather.locality?.approximate ? "Referência aproximada do município" : "Dados regionais"}
            </span>
            {hasWeather && (
              <a
                href="https://openweathermap.org/"
                target="_blank"
                rel="noreferrer"
                aria-label="Dados meteorológicos fornecidos pela OpenWeather"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/weather/openweather.png" alt="" width={28} height={14} />
                OpenWeather
              </a>
            )}
          </div>
        </section>
      </div>
      <section className="ov-stats ag-rise" style={{ "--i": 2 } as React.CSSProperties} aria-label="Resumo da propriedade">
        {[
          { label: "Produção registrada", value: total, unit: "kg" },
          { label: "Lotes com origem", value: productions.length, unit: productions.length === 1 ? "lote" : "lotes" },
          { label: "Pedidos em aberto", value: active, unit: active === 1 ? "pedido" : "pedidos" },
        ].map(({ label, value, unit }) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              <CountUp value={value} />
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </section>
      <ImpactCard propertyId={property.id} revision={home.fetchedAt} />
      <OperationalCharts productions={productions} orders={orders} />
      <section className="panel recent-panel ov-timeline ag-rise" style={{ "--i": 7 } as React.CSSProperties}>
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
                <span className="event-dot" aria-hidden="true" />
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

// Contagem animada na primeira exibição; valores novos rolam a partir do anterior.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return <>{number(shown === value ? value : rounded)}</>;
}
function WeatherArt() {
  return (
    <svg className="ov-sun" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <radialGradient id="ov-sun-g" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.6" stopColor="#f9d43a" />
          <stop offset="1" stopColor="#efb21a" />
        </radialGradient>
        <linearGradient id="ov-cloud-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe8ea" />
        </linearGradient>
      </defs>
      <g className="ray">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x="46" y="6" width="4" height="12" rx="2" fill="#f6cf1f" opacity="0.8" transform={`rotate(${i * 36} 48 48)`} />
        ))}
      </g>
      <circle cx="48" cy="48" r="22" fill="url(#ov-sun-g)" />
      <g className="cloud">
        <ellipse cx="56" cy="70" rx="26" ry="11" fill="url(#ov-cloud-g)" />
        <circle cx="46" cy="64" r="11" fill="url(#ov-cloud-g)" />
        <circle cx="60" cy="60" r="13" fill="url(#ov-cloud-g)" />
      </g>
    </svg>
  );
}
