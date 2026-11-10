// Geometria dos gráficos da Visão geral (caixas isométricas e anel), adaptada
// dos componentes de referência "Average Sales" e "Expenses". Funções puras.
export type Point = [number, number];

// ---------- Caixas isométricas ----------
export const PLOT_HEIGHT = 230;
export const TALLEST = 214; // a maior caixa, com o topo, ocupa quase todo o plot
export const MAX_BOX = 78;
export const GAP_RATIO = 24 / 78;
export const SLOPE = 0.16; // inclinação das faces, proporcional à largura

export type Box = { x: number; width: number; height: number; side: number; back: number };

export function layoutBoxes(values: number[], width: number): Box[] {
  const count = values.length;
  if (!count) return [];
  const fit = width / (count + (count - 1) * GAP_RATIO);
  const boxWidth = Math.min(MAX_BOX, fit);
  const gap = count > 1 ? (width - count * boxWidth) / (count - 1) : 0;
  const max = Math.max(0, ...values);
  const side = boxWidth * SLOPE;
  const back = boxWidth * SLOPE;
  return values.map((value, i) => {
    const total = max > 0 ? (TALLEST * Math.max(0, value)) / max : 0;
    return {
      x: count > 1 ? i * (boxWidth + gap) : (width - boxWidth) / 2,
      width: boxWidth,
      height: Math.max(0, total - side - back),
      side,
      back,
    };
  });
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const polygon = (points: Point[]) => `M ${points.map(([x, y]) => `${r3(x)} ${r3(y)}`).join(" L ")} Z`;

// Faces de uma caixa com `level` (0–1) da altura: frente apoiada na base do plot.
export function boxFaces({ x, width, height, side, back }: Box, level = 1, plotHeight = PLOT_HEIGHT) {
  const h = height * Math.max(0, Math.min(1, level));
  const mid = x + width / 2;
  const right = x + width;
  const y = plotHeight;
  const fb: Point = [mid, y],
    lb: Point = [x, y - side],
    rb: Point = [right, y - side],
    ft: Point = [mid, y - h],
    lt: Point = [x, y - h - side],
    rt: Point = [right, y - h - side],
    bt: Point = [mid, y - h - side - back];
  const empty = h < 0.01 && level < 1;
  return {
    left: empty ? "" : polygon([fb, lb, lt, ft]),
    right: empty ? "" : polygon([fb, rb, rt, ft]),
    top: empty ? "" : polygon([bt, lt, ft, rt]),
    edges: [
      [fb, lb],
      [lb, lt],
      [lt, ft],
      [fb, ft],
      [fb, rb],
      [rb, rt],
      [rt, ft],
      [bt, lt],
      [rt, bt],
    ] as [Point, Point][],
  };
}

// ---------- Anel ----------
export const RING = { size: 260, outer: 128, inner: 88 } as const;
export type Arc = { a0: number; a1: number };
export const GAP_DEG = 1.6;

export function layoutRing(values: number[]): Arc[] {
  const total = values.reduce((n, v) => n + Math.max(0, v), 0);
  let at = 0;
  const single = values.filter((v) => v > 0).length === 1;
  return values.map((v) => {
    const span = total > 0 ? (Math.max(0, v) / total) * 360 : 0;
    const arc = { a0: at, a1: Math.max(at, at + span - (single || !span ? 0 : GAP_DEG)) };
    at += span;
    return arc;
  });
}
const rad = (d: number) => (d * Math.PI) / 180;
const polar = (c: number, r: number, deg: number): Point => [c + r * Math.sin(rad(deg)), c - r * Math.cos(rad(deg))];

// Setor anular entre a0 e a1 (graus, horário a partir das 12h).
export function sectorPath(r0: number, r1: number, a0: number, a1: number, c: number = RING.size / 2) {
  const span = a1 - a0;
  if (!(span > 0.01)) return "";
  if (span >= 359.99) {
    // anel completo: dois semicírculos externos e internos (evenodd)
    const o = [polar(c, r1, 0), polar(c, r1, 180)];
    const i = [polar(c, r0, 0), polar(c, r0, 180)];
    return (
      `M ${r3(o[0][0])} ${r3(o[0][1])} A ${r1} ${r1} 0 1 1 ${r3(o[1][0])} ${r3(o[1][1])} A ${r1} ${r1} 0 1 1 ${r3(o[0][0])} ${r3(o[0][1])} Z ` +
      `M ${r3(i[0][0])} ${r3(i[0][1])} A ${r0} ${r0} 0 1 0 ${r3(i[1][0])} ${r3(i[1][1])} A ${r0} ${r0} 0 1 0 ${r3(i[0][0])} ${r3(i[0][1])} Z`
    );
  }
  const large = span > 180 ? 1 : 0;
  const [ax, ay] = polar(c, r1, a0);
  const [bx, by] = polar(c, r1, a1);
  const [cx, cy] = polar(c, r0, a1);
  const [dx, dy] = polar(c, r0, a0);
  return `M ${r3(ax)} ${r3(ay)} A ${r1} ${r1} 0 ${large} 1 ${r3(bx)} ${r3(by)} L ${r3(cx)} ${r3(cy)} A ${r0} ${r0} 0 ${large} 0 ${r3(dx)} ${r3(dy)} Z`;
}
// Segmento sob o ponteiro, pelo ângulo; null fora do anel.
export function arcAt(arcs: Arc[], x: number, y: number, c: number = RING.size / 2) {
  const dx = x - c,
    dy = y - c;
  const r = Math.hypot(dx, dy);
  if (r < RING.inner - 10 || r > RING.outer + 10) return -1;
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  // o último setor que começa antes do ângulo (a lacuna pertence ao anterior)
  let found = -1;
  arcs.forEach((a, i) => {
    if (a.a1 > a.a0 && angle >= a.a0) found = i;
  });
  return found;
}

// Agrupa culturas além de `limit` em "Outras" (sem perder o total).
export function topWithOthers<T extends { name: string; value: number }>(rows: T[], limit = 6) {
  if (rows.length <= limit) return rows.map(({ name, value }) => ({ name, value }));
  const head = rows.slice(0, limit - 1).map(({ name, value }) => ({ name, value }));
  const rest = rows.slice(limit - 1).reduce((n, r) => n + r.value, 0);
  return [...head, { name: "Outras", value: rest }];
}

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
