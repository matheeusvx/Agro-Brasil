"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  PLOT_HEIGHT,
  RING,
  arcAt,
  boxFaces,
  easeInOutCubic,
  easeOutExpo,
  layoutBoxes,
  layoutRing,
  sectorPath,
  topWithOthers,
} from "@/lib/chart-geometry";
import { productionDistribution } from "@/lib/operational";
import { number, statusName, type Order, type Production } from "@/lib/types";
import { useClock, useCountTo, useReducedMotion, useSeen, useSmoothLevels } from "./chart-motion";

const pct = (v: number, total: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(total > 0 ? (v / total) * 100 : 0) + "%";

export function OperationalCharts({ productions, orders }: { productions: Production[]; orders: Order[] }) {
  return (
    <div className="charts-grid cx-grid">
      <ProductionBoxes productions={productions} />
      <OrdersRing orders={orders} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="cx-empty">
      <p>{text}</p>
      <small>Os dados aparecerão depois dos primeiros registros.</small>
    </div>
  );
}

// ---------- Produção por cultura: caixas isométricas ----------
const BOXES_AT = 150,
  STAGGER = 80,
  GROW = 900;

function ProductionBoxes({ productions }: { productions: Production[] }) {
  const crops = useMemo(() => topWithOthers(productionDistribution(productions)), [productions]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of productions) map.set(p.cropName, (map.get(p.cropName) ?? 0) + 1);
    return map;
  }, [productions]);
  const total = crops.reduce((n, c) => n + c.value, 0);
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = Math.min(hovered ?? selected, Math.max(0, crops.length - 1));
  const card = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(520);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(120, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const reduced = useReducedMotion();
  const seen = useSeen(card);
  const entranceEnd = BOXES_AT + crops.length * STAGGER + GROW + 200;
  const ms = useClock(seen && !reduced, entranceEnd);
  const done = reduced || ms >= entranceEnd;
  const grown = crops.map((_, i) => (done ? 1 : easeOutExpo(Math.max(0, Math.min(1, (ms - BOXES_AT - i * STAGGER) / GROW)))));
  // A caixa destacada enche de verde depois de subir; as outras ficam em contorno.
  const ready = done || ms > BOXES_AT + active * STAGGER + GROW * 0.45;
  const levels = useSmoothLevels(crops.map((_, i) => (i === active && ready ? 1 : 0)), 120, !reduced);
  const boxes = layoutBoxes(crops.map((c) => c.value), width);
  const current = crops[active];
  const value = useCountTo(seen ? (current?.value ?? 0) : 0, 800);
  const ids = useId().replace(/[^\w-]/g, "");
  const step = (e: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const next = { ArrowRight: from + 1, ArrowLeft: from - 1, Home: 0, End: crops.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(crops.length - 1, next));
    setHovered(null);
    setSelected(i);
    card.current?.querySelector<HTMLButtonElement>(`[data-box="${i}"]`)?.focus();
  };
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    boxes.forEach((b, i) => {
      if (Math.abs(b.x + b.width / 2 - x) < Math.abs(boxes[best].x + boxes[best].width / 2 - x)) best = i;
    });
    return best;
  };

  return (
    <section ref={card} className="panel chart-panel cx-card" aria-label="Produção registrada por cultura">
      <header className="cx-head">
        <h2>O que você produz</h2>
        <span className="cx-tag">kg registrados</span>
      </header>
      {!current ? (
        <Empty text="Nenhuma produção registrada." />
      ) : (
        <div className="cx-boxes">
          <div className="cx-side">
            <div>
              <p className="cx-label">{current.name}</p>
              <p className="cx-value">
                {number(Math.round(value * 10) / 10)}
                <small>kg</small>
              </p>
              <p className="cx-badge-row">
                <span className="cx-badge">{pct(current.value, total)}</span>
                <span>do total registrado</span>
              </p>
            </div>
            <p className="cx-note">
              {current.name === "Outras"
                ? "Soma das demais culturas da propriedade."
                : `Soma de ${counts.get(current.name) ?? 0} ${(counts.get(current.name) ?? 0) === 1 ? "registro" : "registros"} desta cultura.`}{" "}
              Não representa estoque disponível.
            </p>
          </div>
          <div className="cx-plot-wrap">
            <div
              ref={plot}
              className="cx-plot"
              style={{ height: PLOT_HEIGHT }}
              onPointerMove={(e) => e.pointerType === "mouse" && setHovered(pick(e))}
              onPointerLeave={() => setHovered(null)}
              onPointerUp={(e) => {
                if (e.button === 0) setSelected(pick(e));
              }}
            >
              <svg aria-hidden="true" className="cx-svg" width={width} height={PLOT_HEIGHT}>
                <defs>
                  <linearGradient id={`${ids}-l`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2f9d5c" />
                    <stop offset="1" stopColor="#c9ecd3" />
                  </linearGradient>
                  <linearGradient id={`${ids}-r`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#bfe8c9" />
                    <stop offset="1" stopColor="#2f9d5c" />
                  </linearGradient>
                  <linearGradient id={`${ids}-t`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3fb26b" stopOpacity={0.55} />
                    <stop offset="1" stopColor="#2f9d5c" />
                  </linearGradient>
                </defs>
                {boxes.map((box, i) => {
                  const wire = boxFaces(box, grown[i]);
                  const solid = boxFaces(box, grown[i] * levels[i]);
                  return (
                    <g key={crops[i].name} className="cx-box">
                      <g opacity={0.6 * (1 - levels[i])}>
                        <path d={wire.left} fill="#fff" />
                        <path d={wire.right} fill="#fff" />
                        <path d={wire.top} fill="#fff" />
                        {grown[i] > 0.01 &&
                          wire.edges.map(([[x1, y1], [x2, y2]], e) => (
                            <line key={e} x1={x1} y1={y1} x2={x2} y2={y2} className="cx-wire" />
                          ))}
                      </g>
                      <path d={solid.left} fill={`url(#${ids}-l)`} />
                      <path d={solid.right} fill={`url(#${ids}-r)`} />
                      <path d={solid.top} fill={`url(#${ids}-t)`} />
                    </g>
                  );
                })}
              </svg>
              <div role="group" aria-label="Culturas">
                {boxes.map((box, i) => (
                  <button
                    key={crops[i].name}
                    type="button"
                    data-box={i}
                    className="cx-hit"
                    style={{ left: box.x - 6, width: box.width + 12 }}
                    aria-pressed={i === selected}
                    aria-label={`${crops[i].name}: ${number(crops[i].value)} kg, ${pct(crops[i].value, total)} do total`}
                    tabIndex={i === selected ? 0 : -1}
                    onClick={(e) => e.detail === 0 && setSelected(i)}
                    onKeyDown={(e) => step(e, i)}
                  />
                ))}
              </div>
            </div>
            <div className="cx-axis" aria-hidden="true">
              {boxes.map((box, i) => (
                <span
                  key={crops[i].name}
                  style={{ left: box.x + box.width / 2, opacity: grown[i] > 0.2 ? 1 : 0 }}
                  data-active={i === active || undefined}
                >
                  {crops[i].name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Pedidos por situação: anel ----------
const STATUS_COLORS: Record<string, { fill: string; core: string }> = {
  SOLICITADO: { fill: "#f4c64e", core: "#e0a915" },
  ACEITO: { fill: "#f29a4a", core: "#d9731f" },
  RETIRADO: { fill: "#5b9bd5", core: "#2f72b0" },
  RECEBIDO: { fill: "#3fb26b", core: "#22884a" },
  CANCELADO: { fill: "#c3cbc4", core: "#9aa59c" },
};
const ORDER = ["SOLICITADO", "ACEITO", "RETIRADO", "RECEBIDO", "CANCELADO"];
const rank = (status: string) => (ORDER.includes(status) ? ORDER.indexOf(status) : 99);
const SWEEP_AT = 200,
  SWEEP = 1300,
  POP = 5;

function OrdersRing({ orders }: { orders: Order[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return [...map]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
      .map(([status, value]) => ({ status, label: statusName(status), value, color: STATUS_COLORS[status] ?? { fill: "#90ad79", core: "#6f8f58" } }));
  }, [orders]);
  const total = orders.length;
  const arcs = useMemo(() => layoutRing(rows.map((r) => r.value)), [rows]);
  const [pinned, setPinned] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shownKey = preview ?? pinned;
  const shown = rows.find((r) => r.status === shownKey);
  const card = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const seen = useSeen(card);
  const end = SWEEP_AT + SWEEP;
  const ms = useClock(seen && !reduced, end);
  const sweep = reduced || ms >= end ? 360 : easeInOutCubic(Math.max(0, Math.min(1, (ms - SWEEP_AT) / SWEEP))) * 360;
  const totalShown = useCountTo(seen ? total : 0, 900);
  const centerValue = useCountTo(shown ? shown.value : total, 450);
  const ids = useId().replace(/[^\w-]/g, "");
  const c = RING.size / 2;

  const pointAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = RING.size / box.width;
    const i = arcAt(arcs, (e.clientX - box.left) * scale, (e.clientY - box.top) * scale);
    return i >= 0 ? rows[i].status : null;
  };
  const describe = rows.map((r) => `${r.label}: ${r.value} (${pct(r.value, total)})`).join("; ");

  return (
    <section ref={card} className="panel chart-panel cx-card" aria-label="Situação dos pedidos">
      <header className="cx-head">
        <h2>Como estão seus pedidos</h2>
        <span className="cx-tag">situação atual</span>
      </header>
      {!rows.length ? (
        <Empty text="Nenhum pedido vinculado aos lotes." />
      ) : (
        <div className="cx-ring-layout">
          <div className="cx-ring-side">
            <div>
              <p className="cx-label">Pedidos vinculados</p>
              <p className="cx-value">
                {Math.round(totalShown)}
                <small>{total === 1 ? "pedido" : "pedidos"}</small>
              </p>
            </div>
            <div className="cx-rows" role="group" aria-label="Pedidos por situação">
              {rows.map((r, i) => (
                <button
                  key={r.status}
                  type="button"
                  className="cx-row"
                  style={{ animationDelay: `${350 + i * 90}ms` }}
                  aria-pressed={pinned === r.status}
                  data-dim={(shownKey && shownKey !== r.status) || undefined}
                  onClick={() => setPinned(pinned === r.status ? null : r.status)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setPreview(r.status)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setPreview(null)}
                >
                  <span className="cx-dot" style={{ background: r.color.fill, boxShadow: `0 0 0 1px ${r.color.core}` }} />
                  <span className="cx-row-label">{r.label}</span>
                  <strong>{r.value}</strong>
                </button>
              ))}
            </div>
          </div>
          <div
            className="cx-ring"
            role="img"
            aria-label={describe}
            onPointerMove={(e) => setPreview(pointAt(e))}
            onPointerLeave={() => setPreview(null)}
            onPointerUp={(e) => {
              const id = e.button === 0 ? pointAt(e) : null;
              if (id) setPinned(pinned === id ? null : id);
            }}
          >
            <svg viewBox={`0 0 ${RING.size} ${RING.size}`} aria-hidden="true">
              <defs>
                <filter id={`${ids}-core`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation={8} />
                </filter>
                <radialGradient id={`${ids}-shine`} cx="50%" cy="50%" r="50%">
                  <stop offset="0.68" stopColor="#fff" stopOpacity={0} />
                  <stop offset="0.86" stopColor="#fff" stopOpacity={0.28} />
                  <stop offset="1" stopColor="#fff" stopOpacity={0} />
                </radialGradient>
              </defs>
              <circle cx={c} cy={c} r={(RING.outer + RING.inner) / 2} className="cx-track" strokeWidth={RING.outer - RING.inner} />
              {rows.map((r, i) => {
                const a = arcs[i];
                const a1 = Math.min(a.a1, sweep);
                const mid = (a.a0 + a.a1) / 2;
                const on = shownKey === r.status;
                const dx = on ? POP * Math.sin((mid * Math.PI) / 180) : 0;
                const dy = on ? -POP * Math.cos((mid * Math.PI) / 180) : 0;
                const half = ((a1 - a.a0) * 0.86) / 2;
                const m = (a.a0 + a1) / 2;
                return (
                  <g
                    key={r.status}
                    className="cx-seg"
                    data-dim={(shownKey && !on) || undefined}
                    style={{ transform: `translate(${dx}px, ${dy}px)` }}
                  >
                    <path d={sectorPath(RING.inner, RING.outer, a.a0, a1)} fill={r.color.fill} fillRule="evenodd" />
                    <path
                      d={sectorPath(RING.inner + 10, RING.outer - 10, m - half, m + half)}
                      fill={r.color.core}
                      fillRule="evenodd"
                      filter={`url(#${ids}-core)`}
                      opacity={0.55}
                    />
                    <path d={sectorPath(RING.inner, RING.outer, a.a0, a1)} fill={`url(#${ids}-shine)`} fillRule="evenodd" />
                  </g>
                );
              })}
            </svg>
            <div className="cx-center" aria-hidden="true">
              <span>{shown ? shown.label : "Total"}</span>
              <strong>{Math.round(centerValue)}</strong>
              <small>{shown ? `${pct(shown.value, total)} dos pedidos` : total === 1 ? "pedido" : "pedidos"}</small>
            </div>
          </div>
        </div>
      )}
      <p className="chart-source">Contagem de pedidos · situações atuais, sem série histórica</p>
    </section>
  );
}
