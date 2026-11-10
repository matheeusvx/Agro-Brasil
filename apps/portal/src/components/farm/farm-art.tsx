// Ilustrações originais de Minha Fazenda: dioramas isométricos em SVG, com
// volumes, gradientes e sombras suaves. São representações esquemáticas do
// tipo de setor — não descrevem forma, tamanho ou existência física.
import type { ReactNode } from "react";
import { BOARD, type ElementType } from "@/lib/farm";

// Projeção isométrica local (1 unidade = 1px na horizontal).
const pt = (x: number, y: number, z = 0) =>
  `${(x - y).toFixed(1)},${((x + y) / 2 - z).toFixed(1)}`;
const poly = (points: [number, number, number?][]) =>
  points.map(([x, y, z]) => pt(x, y, z ?? 0)).join(" ");
const sx = (x: number, y: number) => x - y;
const sy = (x: number, y: number, z = 0) => (x + y) / 2 - z;

type Faces = { top: string; left: string; right: string; stroke?: string };
function Box({
  x0,
  y0,
  x1,
  y1,
  z0 = 0,
  z1,
  faces,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0?: number;
  z1: number;
  faces: Faces;
}) {
  const stroke = faces.stroke ?? "rgba(40,30,20,.18)";
  return (
    <g stroke={stroke} strokeWidth={0.6} strokeLinejoin="round">
      <polygon
        fill={faces.left}
        points={poly([
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ])}
      />
      <polygon
        fill={faces.right}
        points={poly([
          [x1, y1, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x1, y1, z1],
        ])}
      />
      <polygon
        fill={faces.top}
        points={poly([
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ])}
      />
    </g>
  );
}
// Laje arredondada (base de cada setor), com espessura.
function Pad({ r = 30, h = 5, top, side, sideDark }: { r?: number; h?: number; top: string; side: string; sideDark: string }) {
  return (
    <Box
      x0={-r}
      y0={-r}
      x1={r}
      y1={r}
      z0={-h}
      z1={0}
      faces={{ top, left: side, right: sideDark, stroke: "rgba(30,40,20,.12)" }}
    />
  );
}
function Shadow({ r = 34 }: { r?: number }) {
  return (
    <ellipse
      cx={0}
      cy={r * 0.62}
      rx={r * 1.55}
      ry={r * 0.62}
      fill="#173f32"
      opacity={0.22}
      filter="url(#fz-blur)"
    />
  );
}
function Sphere({ x, y, z, r, fill = "url(#fz-leaf)" }: { x: number; y: number; z: number; r: number; fill?: string }) {
  return <circle cx={sx(x, y)} cy={sy(x, y, z)} r={r} fill={fill} />;
}

// ---------- Paleta por cultura vinculada (personalização) ----------
const PRODUCE: [RegExp, string][] = [
  [/tomate|morango|ma[çc][ãa]|pimenta|acerola|beterraba|melancia/i, "#e2483d"],
  [/cenoura|ab[óo]bora|laranja|mam[ãa]o|tangerina|manga/i, "#f08a24"],
  [/milho|banana|abacaxi|lim[ãa]o|maracuj[áa]|trigo|soja|arroz/i, "#f4c430"],
  [/uva|berinjela|a[çc]a[íi]|jabuticaba|cebola roxa/i, "#7a3e9d"],
  [/mandioca|aipim|batata|caf[ée]|feij[ãa]o|cacau/i, "#a4703d"],
  [/alface|couve|r[úu]cula|espinafre|br[óo]colis|abacate|chuchu|pepino|ervilha|quiabo|cheiro/i, "#58b34a"],
];
export function produceColors(names: string[]): string[] {
  const colors = names
    .map((n) => PRODUCE.find(([re]) => re.test(n))?.[1])
    .filter((c): c is string => !!c);
  return [...new Set(colors)];
}
export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- Sprites por tipo ----------
function Cultivation({ colors }: { colors: string[] }) {
  const tops = colors.length ? colors : ["#f4c430"];
  const rows: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const y = -22 + i * 11;
    rows.push(
      <polyline
        key={"f" + i}
        points={poly([
          [-26, y + 4, 0.2],
          [26, y + 4, 0.2],
        ])}
        stroke="#6b4426"
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.55}
      />,
    );
    for (let j = 0; j < 6; j++) {
      const x = -23 + j * 9.2;
      const color = tops[(i + j) % tops.length];
      rows.push(
        <g key={i + "-" + j} className="fz-sway" style={{ animationDelay: `${-(i * 0.4 + j * 0.25)}s` }}>
          <path
            d={`M${sx(x, y)} ${sy(x, y)} q-3 -7 -1 -14 M${sx(x, y)} ${sy(x, y)} q3 -6 2 -12`}
            stroke="#3f8a35"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={sx(x, y) - 3.5} cy={sy(x, y) - 6} rx={4} ry={2} fill="#5dae47" transform={`rotate(-35 ${sx(x, y) - 3.5} ${sy(x, y) - 6})`} />
          <ellipse cx={sx(x, y) - 0.8} cy={sy(x, y) - 15.5} rx={2.4} ry={4.2} fill={color} />
          <ellipse cx={sx(x, y) - 1.4} cy={sy(x, y) - 16.8} rx={0.9} ry={1.8} fill="#fff" opacity={0.45} />
        </g>,
      );
    }
  }
  return (
    <>
      <Pad top="url(#fz-soil)" side="#8a5a33" sideDark="#6d4526" />
      {rows}
    </>
  );
}
function Garden({ colors }: { colors: string[] }) {
  const produce = colors.length ? colors : ["#58b34a", "#f08a24", "#e2483d"];
  const beds = [-18, 2, 22].map((y, i) => (
    <g key={y}>
      <Box x0={-25} y0={y - 7} x1={25} y1={y + 5} z1={6} faces={{ top: "#7a4a2a", left: "#c98a4b", right: "#a86c37" }} />
      {[-18, -6, 6, 18].map((x, j) => {
        const c = produce[(i + j) % produce.length];
        const cx = sx(x, y - 1);
        const cy = sy(x, y - 1, 7);
        return c === "#58b34a" ? (
          <g key={x}>
            <circle cx={cx} cy={cy - 1} r={5.6} fill="url(#fz-lettuce)" />
            <path d={`M${cx - 3} ${cy - 1} q3 -4 6 0`} stroke="#c9ec9b" strokeWidth={1} fill="none" />
          </g>
        ) : (
          <g key={x} className="fz-sway" style={{ animationDelay: `${-j * 0.3}s` }}>
            <ellipse cx={cx} cy={cy + 1} rx={3.4} ry={2.4} fill={c} />
            <path d={`M${cx} ${cy} l-3 -8 M${cx} ${cy} l0 -9 M${cx} ${cy} l3 -8`} stroke="#4f9e3d" strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  ));
  return (
    <>
      <Pad top="url(#fz-grass)" side="#6aa23e" sideDark="#4f8530" />
      {beds}
    </>
  );
}
function Orchard({ colors, seed }: { colors: string[]; seed: number }) {
  const fruit = colors.length ? colors : ["#e2483d", "#f08a24"];
  const trees = [
    [-14, -16, 15],
    [16, -10, 14],
    [-12, 14, 14],
    [15, 17, 16],
  ];
  return (
    <>
      <Pad top="url(#fz-grass)" side="#6aa23e" sideDark="#4f8530" />
      {trees.map(([x, y, r], i) => {
        const cx = sx(x, y);
        const base = sy(x, y);
        return (
          <g key={i} className="fz-breathe" style={{ animationDelay: `${-i * 0.7}s` }}>
            <ellipse cx={cx + 4} cy={base + 1} rx={r * 0.9} ry={r * 0.38} fill="#173f32" opacity={0.25} />
            <path d={`M${cx - 2.4} ${base} L${cx - 1.6} ${base - 16} L${cx + 1.6} ${base - 16} L${cx + 2.4} ${base} Z`} fill="url(#fz-trunk)" />
            <Sphere x={x} y={y} z={r + 13} r={r} />
            <circle cx={cx - r * 0.35} cy={base - r - 17} r={r * 0.35} fill="#fff" opacity={0.16} />
            {[0, 1, 2, 3].map((k) => {
              const a = ((seed >> (k * 3)) % 360) * (Math.PI / 180) + k * 1.6;
              return (
                <circle
                  key={k}
                  cx={cx + Math.cos(a) * r * 0.55}
                  cy={base - r - 13 + Math.sin(a) * r * 0.5}
                  r={2.6}
                  fill={fruit[(i + k) % fruit.length]}
                  stroke="rgba(0,0,0,.15)"
                  strokeWidth={0.5}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}
function Barn() {
  const x0 = -20,
    x1 = 20,
    y0 = -24,
    y1 = 18,
    zw = 26,
    zr = 46,
    xm = 0,
    o = 3;
  return (
    <>
      <Pad top="url(#fz-stone)" side="#b9b29f" sideDark="#9d9682" />
      {/* telhado traseiro */}
      <polygon fill="#7d5a49" points={poly([[x0 - o, y0 - o, zw - 2], [x0 - o, y1 + o, zw - 2], [xm, y1 + o, zr], [xm, y0 - o, zr]])} />
      {/* empena frontal */}
      <polygon fill="url(#fz-barn-left)" stroke="rgba(60,20,10,.25)" strokeWidth={0.6}
        points={poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, zw], [xm, y1, zr], [x0, y1, zw]])} />
      {/* parede lateral */}
      <polygon fill="url(#fz-barn-right)" stroke="rgba(60,20,10,.25)" strokeWidth={0.6}
        points={poly([[x1, y1, 0], [x1, y0, 0], [x1, y0, zw], [x1, y1, zw]])} />
      {/* frisos brancos */}
      <polyline fill="none" stroke="#fff7ec" strokeWidth={1.6} points={poly([[x0, y1, 0.5], [x0, y1, zw], [xm, y1, zr], [x1, y1, zw], [x1, y1, 0.5]])} />
      {/* porta em X */}
      <g stroke="#fff7ec" strokeWidth={1.5} fill="#8f2b22">
        <polygon points={poly([[-9, y1 + 0.3, 0], [9, y1 + 0.3, 0], [9, y1 + 0.3, 17], [-9, y1 + 0.3, 17]])} />
        <polyline fill="none" points={poly([[-9, y1 + 0.3, 0], [9, y1 + 0.3, 17]])} />
        <polyline fill="none" points={poly([[9, y1 + 0.3, 0], [-9, y1 + 0.3, 17]])} />
      </g>
      {/* janela da empena */}
      <polygon fill="#fff7ec" points={poly([[-3.5, y1 + 0.3, 30], [3.5, y1 + 0.3, 30], [3.5, y1 + 0.3, 37], [-3.5, y1 + 0.3, 37]])} />
      {/* janelas laterais */}
      {[-14, 2].map((y) => (
        <polygon key={y} fill="#ffe7b0" stroke="#fff7ec" strokeWidth={1}
          points={poly([[x1 + 0.3, y + 8, 11], [x1 + 0.3, y, 11], [x1 + 0.3, y, 18], [x1 + 0.3, y + 8, 18]])} />
      ))}
      {/* telhado frontal */}
      <polygon fill="url(#fz-roof)" stroke="rgba(40,20,10,.3)" strokeWidth={0.6}
        points={poly([[x1 + o, y0 - o, zw - 2], [x1 + o, y1 + o, zw - 2], [xm, y1 + o, zr], [xm, y0 - o, zr]])} />
      <polyline fill="none" stroke="#e8d9c7" strokeWidth={1.4} points={poly([[xm, y0 - o, zr], [xm, y1 + o, zr]])} />
    </>
  );
}
function Collection() {
  const crate = (x: number, y: number, z: number, k: string) => (
    <g key={k}>
      <Box x0={x - 6} y0={y - 6} x1={x + 6} y1={y + 6} z0={z} z1={z + 10} faces={{ top: "#e2b16e", left: "#c98f4b", right: "#a8733a" }} />
      <polyline fill="none" stroke="#8a5a2b" strokeWidth={0.8} points={poly([[x - 6, y + 6, z + 5], [x + 6, y + 6, z + 5], [x + 6, y - 6, z + 5]])} />
    </g>
  );
  return (
    <>
      <Pad top="url(#fz-gravel)" side="#c7ae84" sideDark="#a88f66" />
      {/* faixa de carga */}
      <polygon fill="#f2e3c4" opacity={0.7} points={poly([[-26, 4, 0.2], [26, 4, 0.2], [26, 10, 0.2], [-26, 10, 0.2]])} />
      {crate(-16, -16, 0, "a")}
      {crate(-4, -16, 0, "b")}
      {crate(-16, -4, 0, "c")}
      {crate(-10, -12, 10, "d")}
      {/* caminhonete ilustrativa */}
      <g>
        {[[4, 22], [20, 22], [4, 8], [20, 8]].map(([x, y], i) => (
          <ellipse key={i} cx={sx(x, y)} cy={sy(x, y, 3)} rx={4.2} ry={4.6} fill="#2b2b2b" />
        ))}
        <Box x0={0} y0={8} x1={28} y1={22} z0={3} z1={10} faces={{ top: "#4f9a43", left: "#5fb04f", right: "#3f7f36" }} />
        <Box x0={16} y0={9} x1={27} y1={21} z0={10} z1={19} faces={{ top: "#e9f4e2", left: "#5fb04f", right: "#3f7f36" }} />
        <polygon fill="#bfe4f6" points={poly([[27.2, 19.5, 11.5], [27.2, 10.5, 11.5], [27.2, 10.5, 17.5], [27.2, 19.5, 17.5]])} />
        {crate(8, 15, 10, "e")}
        {[[4, 22], [20, 22]].map(([x, y], i) => (
          <ellipse key={"w" + i} cx={sx(x, y + 0.5)} cy={sy(x, y + 0.5, 3)} rx={3.6} ry={4} fill="#3a3a3a" stroke="#9a9a9a" strokeWidth={1.4} />
        ))}
      </g>
    </>
  );
}
function Other() {
  const x0 = -14,
    x1 = 14,
    y0 = -14,
    y1 = 14,
    zw = 20,
    apex = 38;
  return (
    <>
      <Pad top="url(#fz-grass)" side="#6aa23e" sideDark="#4f8530" />
      <Box x0={x0} y0={y0} x1={x1} y1={y1} z1={zw} faces={{ top: "#f5ead2", left: "#f3e3c1", right: "#d9c49b" }} />
      <polygon fill="#a0743f" points={poly([[-5, y1 + 0.3, 0], [5, y1 + 0.3, 0], [5, y1 + 0.3, 13], [-5, y1 + 0.3, 13]])} />
      <polygon fill="#bfe4f6" stroke="#fff" strokeWidth={1} points={poly([[x1 + 0.3, 6, 8], [x1 + 0.3, -4, 8], [x1 + 0.3, -4, 15], [x1 + 0.3, 6, 15]])} />
      {/* telhado piramidal */}
      <polygon fill="#2f7f8a" points={poly([[x0 - 3, y1 + 3, zw], [x1 + 3, y1 + 3, zw], [0, 0, apex]])} />
      <polygon fill="#246670" points={poly([[x1 + 3, y1 + 3, zw], [x1 + 3, y0 - 3, zw], [0, 0, apex]])} />
      <circle cx={sx(0, 0)} cy={sy(0, 0, apex)} r={2} fill="#f4c430" />
      {/* arbusto */}
      <Sphere x={-20} y={18} z={6} r={7} />
    </>
  );
}

export function SectorSprite({
  type,
  colors = [],
  seed = 0,
}: {
  type: ElementType;
  colors?: string[];
  seed?: number;
}) {
  return (
    <g className="fz-sprite">
      <Shadow />
      {type === "CULTIVATION" && <Cultivation colors={colors} />}
      {type === "VEGETABLE_GARDEN" && <Garden colors={colors} />}
      {type === "ORCHARD" && <Orchard colors={colors} seed={seed} />}
      {type === "STORAGE" && <Barn />}
      {type === "COLLECTION" && <Collection />}
      {type === "OTHER" && <Other />}
    </g>
  );
}
// Miniatura para paleta e painéis.
export function SpriteThumb({ type, colors, size = 56 }: { type: ElementType; colors?: string[]; size?: number }) {
  return (
    <svg viewBox="-48 -62 96 100" width={size} height={size} aria-hidden="true" focusable="false">
      <SectorSprite type={type} colors={colors} />
    </svg>
  );
}

// ---------- Definições compartilhadas ----------
export function FarmDefs() {
  return (
    <defs>
      <filter id="fz-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="fz-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <linearGradient id="fz-island-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a9d86e" />
        <stop offset="0.55" stopColor="#8cc95a" />
        <stop offset="1" stopColor="#74b54a" />
      </linearGradient>
      <linearGradient id="fz-island-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6aa23e" />
        <stop offset="0.18" stopColor="#8b5e3c" />
        <stop offset="1" stopColor="#6e4630" />
      </linearGradient>
      <linearGradient id="fz-island-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a8f34" />
        <stop offset="0.18" stopColor="#734b30" />
        <stop offset="1" stopColor="#583624" />
      </linearGradient>
      <linearGradient id="fz-grass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b5e07a" />
        <stop offset="1" stopColor="#7fbf4f" />
      </linearGradient>
      <linearGradient id="fz-soil" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b77a48" />
        <stop offset="1" stopColor="#8f5a32" />
      </linearGradient>
      <linearGradient id="fz-stone" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ece6d6" />
        <stop offset="1" stopColor="#d3cbb6" />
      </linearGradient>
      <linearGradient id="fz-gravel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#efdcb6" />
        <stop offset="1" stopColor="#d9bf90" />
      </linearGradient>
      <radialGradient id="fz-leaf" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#9be06a" />
        <stop offset="0.6" stopColor="#55a83c" />
        <stop offset="1" stopColor="#2f7a2c" />
      </radialGradient>
      <radialGradient id="fz-lettuce" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#d6f5a3" />
        <stop offset="0.6" stopColor="#77c050" />
        <stop offset="1" stopColor="#3f8a35" />
      </radialGradient>
      <linearGradient id="fz-trunk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#a8703f" />
        <stop offset="1" stopColor="#6e4426" />
      </linearGradient>
      <linearGradient id="fz-barn-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e2573f" />
        <stop offset="1" stopColor="#c43b2c" />
      </linearGradient>
      <linearGradient id="fz-barn-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b93427" />
        <stop offset="1" stopColor="#962a20" />
      </linearGradient>
      <linearGradient id="fz-roof" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a47c63" />
        <stop offset="1" stopColor="#7d5a49" />
      </linearGradient>
      <linearGradient id="fz-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9f3e1" />
        <stop offset="1" stopColor="#f8f4e8" />
      </linearGradient>
    </defs>
  );
}

// ---------- Ilha (cenário genérico de fundo) ----------
const R = 1.09; // borda decorativa além da área utilizável 0..1
const corner = (x: number, y: number) => {
  const cx = BOARD.cx + (x - y) * BOARD.half;
  const cy = BOARD.top + (x + y) * (BOARD.half / 2);
  return [cx, cy] as const;
};
export function Island({ grid }: { grid: boolean }) {
  const a = -(R - 1) / 2,
    b = 1 + (R - 1) / 2;
  const [tx, ty] = corner(a, a);
  const [rx, ry] = corner(b, a);
  const [bx, by] = corner(b, b);
  const [lx, ly] = corner(a, b);
  const depth = 46;
  const lines: ReactNode[] = [];
  if (grid)
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const [x1, y1] = corner(t, 0);
      const [x2, y2] = corner(t, 1);
      const [x3, y3] = corner(0, t);
      const [x4, y4] = corner(1, t);
      lines.push(<line key={"a" + i} x1={x1} y1={y1} x2={x2} y2={y2} />, <line key={"b" + i} x1={x3} y1={y3} x2={x4} y2={y4} />);
    }
  const [ux, uy] = corner(0, 0);
  const [vx, vy] = corner(1, 0);
  const [wx, wy] = corner(1, 1);
  const [zx, zy] = corner(0, 1);
  return (
    <g className="fz-island">
      <ellipse cx={BOARD.cx} cy={by + depth + 6} rx={BOARD.half * 1.05} ry={46} fill="#173f32" opacity={0.18} filter="url(#fz-soft)" />
      <polygon fill="url(#fz-island-left)" points={`${lx},${ly} ${bx},${by} ${bx},${by + depth} ${lx},${ly + depth}`} />
      <polygon fill="url(#fz-island-right)" points={`${bx},${by} ${rx},${ry} ${rx},${ry + depth} ${bx},${by + depth}`} />
      {/* pedras na lateral */}
      {[0.22, 0.48, 0.71].map((t, i) => (
        <ellipse key={i} cx={lx + (bx - lx) * t} cy={ly + (by - ly) * t + depth * (0.55 + (i % 2) * 0.15)} rx={9} ry={4} fill="#5e3b28" opacity={0.6} />
      ))}
      {[0.3, 0.62].map((t, i) => (
        <ellipse key={"r" + i} cx={bx + (rx - bx) * t} cy={by + (ry - by) * t + depth * 0.62} rx={8} ry={3.5} fill="#4a2e1f" opacity={0.6} />
      ))}
      <polygon fill="url(#fz-island-top)" points={`${tx},${ty} ${rx},${ry} ${bx},${by} ${lx},${ly}`} />
      {/* área utilizável */}
      <polygon
        className="fz-buildable"
        points={`${ux},${uy} ${vx},${vy} ${wx},${wy} ${zx},${zy}`}
        fill={grid ? "rgba(255,255,255,.12)" : "none"}
        stroke={grid ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.22)"}
        strokeDasharray={grid ? "6 6" : "2 8"}
        strokeWidth={1.4}
      />
      {grid && (
        <g stroke="rgba(255,255,255,.28)" strokeWidth={1}>
          {lines}
        </g>
      )}
      {/* tufos de grama genéricos */}
      {[
        [0.03, 0.4],
        [0.97, 0.3],
        [0.5, 1.02],
        [1.02, 0.7],
        [0.25, -0.02],
        [0.72, 1.01],
      ].map(([x, y], i) => {
        const [cx, cy] = corner(x, y);
        return (
          <path key={i} d={`M${cx - 6} ${cy} q2 -9 4 0 q2 -12 4 0 q2 -8 4 0`} fill="#5e9e3a" opacity={0.8} />
        );
      })}
    </g>
  );
}
// Árvores decorativas na borda — cenário genérico, fora da área utilizável.
export function BorderTrees() {
  const spots: [number, number, number][] = [
    [-0.02, 0.1, 22],
    [0.1, -0.03, 18],
    [-0.03, 0.26, 15],
    [0.86, -0.03, 17],
    [1.03, 0.12, 14],
  ];
  return (
    <g className="fz-decor" aria-hidden="true">
      {spots.map(([x, y, r], i) => {
        const [cx, cy] = corner(x, y);
        return (
          <g key={i} className="fz-breathe" style={{ animationDelay: `${-i}s` }}>
            <ellipse cx={cx + 6} cy={cy + 2} rx={r} ry={r * 0.4} fill="#173f32" opacity={0.22} />
            <rect x={cx - 2.5} y={cy - 18} width={5} height={18} rx={2} fill="url(#fz-trunk)" />
            <circle cx={cx} cy={cy - 18 - r * 0.8} r={r} fill="url(#fz-leaf)" />
            <circle cx={cx + r * 0.55} cy={cy - 14 - r * 0.5} r={r * 0.62} fill="url(#fz-leaf)" />
          </g>
        );
      })}
    </g>
  );
}
export function Clouds() {
  return (
    <g className="fz-clouds" aria-hidden="true" opacity={0.85}>
      {[
        [140, 70, 1],
        [760, 40, 0.8],
        [880, 150, 0.6],
      ].map(([x, y, s], i) => (
        <g key={i} className="fz-cloud" style={{ animationDelay: `${-i * 9}s` }}>
          <g transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx={0} cy={10} rx={46} ry={14} fill="#fff" />
            <circle cx={-14} cy={2} r={16} fill="#fff" />
            <circle cx={10} cy={-4} r={21} fill="#fff" />
            <circle cx={30} cy={6} r={12} fill="#fff" />
          </g>
        </g>
      ))}
    </g>
  );
}
