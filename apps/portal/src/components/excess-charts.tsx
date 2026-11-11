"use client";
// Gráficos da página Destino dos excedentes. Baseados em graphic-barra-vertical (trilhos
// com barra brilhante, eixo e etiqueta de valor) e graphic-barra-horizontal (medidor de
// traços por categoria), portados para React + CSS, sem dependências novas.
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "./chart-motion";
import { composition, journey, percent, share, type Slice } from "@/lib/impact";
import { number, type ExcessImpact } from "@/lib/types";

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth || fallback);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

// Liga a animação de entrada no primeiro quadro (sem animação com movimento reduzido).
function useEntered() {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return reduced || on;
}

// ---------- Caminho do excedente: trilhos com barras verdes ----------
const SHORT = ["Registrado", "Ofertado", "Aceito", "Retirado", "Recebido"];

/** Marcas "redondas" do eixo (1, 2, 2,5 ou 5 × 10ⁿ) até cobrir o maior valor. */
export function axisTicks(max: number, count = 5) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function JourneyChart({ impact }: { impact: ExcessImpact }) {
  const steps = journey(impact);
  const entered = useEntered();
  const ticks = axisTicks(Math.max(...steps.map((s) => s.value)));
  const domain = (ticks[ticks.length - 1] || 1) * 1.07;
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: steps.length - 1 }[e.key];
    if (e.key === "Escape") return setSelected(null);
    if (next === undefined) return;
    e.preventDefault();
    rows.current[Math.min(Math.max(next, 0), steps.length - 1)]?.focus();
  };
  return (
    <section className="panel dx-panel ag-rise" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="dx-journey-title">
      <div className="dx-panel-title">
        <h2 id="dx-journey-title">Caminho do excedente</h2>
        <p>Quanto de cada etapa chegou à seguinte. Toque em uma barra para ver o detalhe.</p>
      </div>
      <div className="jx" role="group" aria-label="Caminho do excedente">
        {steps.map((s, i) => {
          const width = Math.min(100, (s.value / domain) * 100);
          const on = i === active;
          const tag = `${number(s.value)} kg${s.fromPrevious !== null ? ` · ${percent(s.fromPrevious)} da etapa anterior` : ""}`;
          return (
            <button
              key={s.label}
              ref={(el) => {
                rows.current[i] = el;
              }}
              type="button"
              className="jx-row"
              data-active={on || undefined}
              data-dim={active !== null && !on ? true : undefined}
              aria-pressed={i === selected}
              aria-label={`${s.label}: ${tag}`}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => setSelected(selected === i ? null : i)}
              onKeyDown={(e) => key(e, i)}
            >
              <span className="jx-label">{SHORT[i]}</span>
              <span className="jx-track">
                <span
                  className="jx-bar"
                  style={{ width: entered ? `${width}%` : 0, transitionDelay: `${450 + i * 90}ms` }}
                >
                  <span className="jx-sheen" data-run={entered || undefined} style={{ animationDelay: `${800 + i * 90}ms` }} />
                </span>
                <span className="jx-tag" data-inside={width > 62 || undefined} style={{ left: width > 62 ? undefined : `calc(${width}% + 8px)` }}>
                  <b>{number(s.value)} kg</b>
                  {s.fromPrevious !== null && <em>{percent(s.fromPrevious)}</em>}
                </span>
              </span>
            </button>
          );
        })}
        <div className="jx-axis" aria-hidden="true">
          {ticks.map((t, n) => (
            <span key={t} style={{ left: n === 0 ? 4 : `${(t / domain) * 100}%` }} data-start={n === 0 || undefined}>
              {compact(t)}
            </span>
          ))}
        </div>
      </div>
      <p className="dx-foot">Em kg. Cada etapa inclui as seguintes; não some os valores.</p>
    </section>
  );
}

// ---------- Para onde foi o que você ofertou: medidor de traços ----------
const PITCH = 937 / 108; // distância entre traços (referência: 109 traços em 940 px)
const TICK_W = 3;
const METER_H = 124;
const MARKER = 124; // o primeiro traço de cada parte ocupa a altura toda…
const TICK = 72; // …os demais ficam embaixo
const LABEL_LEFT = 11;
const LABEL_GAP = 8;
const LABEL_MIN = 64; // abaixo disso o nome some do medidor (continua na legenda)

const SHADES: Record<string, string[]> = {
  received: ["#c4e6cf", "#6fc28a", "#2f9e5a"],
  transit: ["#cfe2fb", "#7fb2f2", "#3a86e8"],
  reserved: ["#fbefc0", "#f1cf5e", "#d9a514"],
  available: ["#e4d4fb", "#bf98f3", "#9257ec"],
  expired: ["#fde0c7", "#f6a964", "#e8731f"],
};

/** `count` traços divididos pelas quantidades; uma parte positiva fica com ao menos um traço. */
export function splitTicks(amounts: number[], count: number) {
  const values = amounts.map((a) => Math.max(0, a));
  const total = values.reduce((s, v) => s + v, 0);
  const bounds = [0];
  let sum = 0;
  for (const v of values) {
    sum += v;
    bounds.push(total > 0 ? Math.round((sum / total) * count) : 0);
  }
  bounds[bounds.length - 1] = count;
  if (values.filter((v) => v > 0).length <= count)
    for (let i = 0; i < values.length; i++) {
      if (!(values[i] > 0) || bounds[i + 1] > bounds[i]) continue;
      if (bounds[i + 1] < count) for (let j = i + 1; j < bounds.length - 1 && bounds[j] <= bounds[j - 1]; j++) bounds[j] = bounds[j - 1] + 1;
      else for (let j = i; j > 0 && bounds[j] >= bounds[j + 1]; j--) bounds[j] = bounds[j + 1] - 1;
    }
  return bounds;
}

export function CompositionChart({ impact }: { impact: ExcessImpact }) {
  const parts = composition(impact);
  const total = impact.funnelKg.published;
  const [ref, width] = useWidth<HTMLDivElement>(900);
  const entered = useEntered();
  const count = Math.max(2, Math.round((width - TICK_W) / PITCH) + 1);
  const pitch = (width - TICK_W) / (count - 1);
  const bounds = splitTicks(parts.map((p) => p.value), count);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const lit = hover ?? pinned;
  const visible = parts.map((p, i) => i).filter((i) => bounds[i + 1] > bounds[i]);
  const resting = pinned ?? visible[0] ?? 0;

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = Math.min(count - 1, Math.max(0, Math.round((e.clientX - box.left - TICK_W / 2) / pitch)));
    return Math.max(0, parts.findIndex((_, i) => t >= bounds[i] && t < bounds[i + 1]));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = visible.indexOf(hover ?? resting);
    const map: Record<string, number> = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: visible.length - 1 };
    if (e.key === "Escape") return (setHover(null), setPinned(null));
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const i = hover ?? resting;
      return setPinned(pinned === i ? null : i);
    }
    if (!(e.key in map)) return;
    e.preventDefault();
    setHover(visible[Math.min(visible.length - 1, Math.max(0, map[e.key]))]);
  };
  const describe = (p: Slice) => `${p.label}: ${number(p.value)} kg, ${percent(share(p.value, total))} do ofertado`;

  const ticks = [] as { x: number; part: number; shade: string; marker: boolean; index: number }[];
  parts.forEach((p, c) => {
    const [start, end] = [bounds[c], bounds[c + 1]];
    const thirds = splitTicks([1, 1, 1], end - start);
    for (let t = start; t < end; t++) {
      const third = thirds.findIndex((b, k) => k < 3 && t - start >= b && t - start < thirds[k + 1]);
      ticks.push({ x: Math.round(t * pitch * 1000) / 1000, part: c, shade: SHADES[p.tone][Math.max(0, third)], marker: t === start, index: t });
    }
  });
  const tip = lit !== null ? parts[lit] : null;
  const tipCenter = lit !== null ? ((bounds[lit] + bounds[lit + 1] - 1) / 2) * pitch : 0;

  return (
    <section className="panel dx-panel dx-wide ag-rise" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="dx-comp-title">
      <div className="dx-panel-title dx-panel-row">
        <div>
          <h2 id="dx-comp-title">Para onde foi o que você ofertou</h2>
          <p>Passe o dedo ou o mouse sobre o medidor para ver cada parte.</p>
        </div>
        <div className="mx-total">
          <span>Total ofertado</span>
          <strong>
            {number(total)} <small>kg</small>
          </strong>
        </div>
      </div>
      <div className="mx-divider" aria-hidden="true" />
      <div
        ref={ref}
        className="mx"
        role="slider"
        tabIndex={0}
        aria-label="Destino do que foi ofertado"
        aria-orientation="horizontal"
        aria-valuemin={1}
        aria-valuemax={parts.length}
        aria-valuenow={(hover ?? resting) + 1}
        aria-valuetext={describe(parts[hover ?? resting])}
        style={{ height: METER_H }}
        onPointerMove={(e) => setHover(at(e))}
        onPointerLeave={() => setHover(null)}
        onPointerUp={(e) => {
          const i = at(e);
          setPinned(pinned === i ? null : i);
        }}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        <svg aria-hidden="true" className="mx-svg">
          {ticks.map((t) => {
            const h = t.marker ? MARKER : TICK;
            return (
              <g
                key={t.index}
                className="mx-tick"
                data-lift={lit === t.part && !t.marker ? true : undefined}
                data-dim={lit !== null && lit !== t.part ? true : undefined}
                data-in={entered || undefined}
                style={{ animationDelay: `${300 + t.index * 6}ms` }}
              >
                <rect x={t.x - 1} y={METER_H - h - 1} width={TICK_W + 2} height={h + 2} rx={(TICK_W + 2) / 2} fill={t.shade} />
                <rect x={t.x} y={METER_H - h} width={TICK_W} height={h} rx={TICK_W / 2} fill="#fff" fillOpacity={0.19} />
              </g>
            );
          })}
        </svg>
        {parts.map((p, i) => {
          const left = Math.round(bounds[i] * pitch + LABEL_LEFT);
          const next = i < parts.length - 1 ? bounds[i + 1] * pitch : width + LABEL_GAP;
          const maxWidth = Math.max(0, Math.floor(next - LABEL_GAP - left));
          const hidden = bounds[i + 1] <= bounds[i] || maxWidth < LABEL_MIN;
          return (
            <span
              key={p.key}
              aria-hidden="true"
              className="mx-label"
              data-hidden={hidden || undefined}
              data-dim={lit !== null && lit !== i ? true : undefined}
              style={{ left, maxWidth, animationDelay: `${420 + bounds[i] * 6}ms` }}
            >
              <span>{p.label}</span>
              <b>
                {number(p.value)} kg <em>{percent(share(p.value, total))}</em>
              </b>
            </span>
          );
        })}
        {tip && (
          <div className="mx-tip" aria-hidden="true" style={{ left: Math.min(Math.max(tipCenter - 90, 0), Math.max(0, width - 180)) }}>
            <span>{tip.label}</span>
            <b>{number(tip.value)} kg</b>
            <small>
              {percent(share(tip.value, total))} do ofertado · {tip.hint}
            </small>
          </div>
        )}
      </div>
      <ul className="mx-legend">
        {parts.map((p, i) => (
          <li key={p.key} data-dim={lit !== null && lit !== i ? true : undefined} data-empty={p.value === 0 || undefined}>
            <Link href={p.href} aria-label={`${describe(p)}. Ver itens`}>
              <i style={{ background: SHADES[p.tone][2] }} aria-hidden="true" />
              <span>{p.label}</span>
              <b>{number(p.value)} kg</b>
              <em>{percent(share(p.value, total))}</em>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
