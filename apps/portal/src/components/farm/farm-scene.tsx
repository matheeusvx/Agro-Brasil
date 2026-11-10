"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Minus, Plus, LocateFixed, Info } from "lucide-react";
import {
  DISCLAIMER,
  STATE_INFO,
  TYPE_INFO,
  depthSort,
  fromScreen,
  toScreen,
  type Position,
  type SceneSector,
  type SectorLink,
  isoRoute,
} from "@/lib/farm";
import { BorderTrees, Clouds, FarmDefs, Island, SectorSprite, hash, produceColors } from "./farm-art";

type Camera = { s: number; tx: number; ty: number };
const VIEW = { w: 1000, h: 640 };
const ZOOMS = [1, 1.35, 1.75];
const STEP = 0.02;
const short = (text: string, max = 22) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

export function sectorLabel(s: SceneSector, cropName: (id: string) => string | undefined) {
  const state = s.operations ? STATE_INFO[s.operations.state].label : "Informações operacionais indisponíveis";
  const crops = s.cropIds.map(cropName).filter(Boolean);
  return [
    s.name,
    TYPE_INFO[s.type].label,
    state,
    crops.length ? "Culturas: " + crops.join(", ") : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export function FarmScene({
  sectors,
  mode,
  selectedId,
  cropName,
  onSelect,
  onMove,
  overlay,
  hud,
  links = [],
  focusOnSelect = false,
}: {
  sectors: SceneSector[];
  mode: "explore" | "edit";
  selectedId: string | null;
  cropName: (id: string) => string | undefined;
  onSelect: (id: string | null) => void;
  onMove?: (id: string, position: Position) => void;
  overlay?: ReactNode;
  hud?: ReactNode;
  links?: SectorLink[];
  focusOnSelect?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [camera, setCamera] = useState<Camera>({ s: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const gesture = useRef<{
    kind: "sector" | "pan";
    id?: string;
    startX: number;
    startY: number;
    camera: Camera;
    offset: Position;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const editing = mode === "edit" && !!onMove;

  // Converte coordenadas do ponteiro para o viewBox e desfaz a câmera.
  function toWorld(clientX: number, clientY: number, cam = camera) {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: (p.x - cam.tx) / cam.s, y: (p.y - cam.ty) / cam.s };
  }
  function clampCamera(c: Camera): Camera {
    const limitX = ((c.s - 1) * VIEW.w) / 2 + 120;
    const limitY = ((c.s - 1) * VIEW.h) / 2 + 80;
    const cx = (VIEW.w * (1 - c.s)) / 2;
    const cy = (VIEW.h * (1 - c.s)) / 2;
    return {
      s: c.s,
      tx: Math.min(cx + limitX, Math.max(cx - limitX, c.tx)),
      ty: Math.min(cy + limitY, Math.max(cy - limitY, c.ty)),
    };
  }
  function zoomTo(s: number, focus?: { x: number; y: number }) {
    setCamera((c) => {
      const f = focus ?? { x: (VIEW.w / 2 - c.tx) / c.s, y: (VIEW.h / 2 - c.ty) / c.s };
      return clampCamera({ s, tx: VIEW.w / 2 - f.x * s, ty: VIEW.h / 2 - f.y * s });
    });
  }
  const zoomIndex = ZOOMS.findIndex((z) => Math.abs(z - camera.s) < 0.01);

  // A câmera aproxima o setor escolhido (exploração) e volta ao todo ao soltar.
  useEffect(() => {
    if (dragging) return;
    const sector = selectedId ? sectors.find((s) => s.id === selectedId) : undefined;
    if (!sector) {
      if (focusOnSelect) setCamera({ s: 1, tx: 0, ty: 0 });
      return;
    }
    if (!focusOnSelect && camera.s === 1) return;
    const p = toScreen(sector.position);
    setCamera((c) => {
      const s = focusOnSelect ? Math.max(c.s, ZOOMS[1]) : c.s;
      return clampCamera({ s, tx: VIEW.w * 0.42 - p.x * s, ty: VIEW.h / 2 - (p.y - 24) * s });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusOnSelect]);

  function down(event: PointerEvent<SVGElement>, id?: string) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const sector = id ? sectors.find((s) => s.id === id) : undefined;
    let offset = { x: 0, y: 0 };
    if (sector && editing) {
      const w = toWorld(event.clientX, event.clientY);
      const p = toScreen(sector.position);
      if (w) offset = { x: w.x - p.x, y: w.y - p.y };
    }
    gesture.current = {
      kind: id ? "sector" : "pan",
      id,
      startX: event.clientX,
      startY: event.clientY,
      camera,
      offset,
      moved: false,
      pointerId: event.pointerId,
    };
    if (id) event.stopPropagation();
    svg.current?.setPointerCapture?.(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const dx = event.clientX - g.startX,
      dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    g.moved = true;
    if (g.kind === "sector" && editing && g.id) {
      if (dragging !== g.id) {
        setDragging(g.id);
        onSelect(g.id);
      }
      const w = toWorld(event.clientX, event.clientY);
      if (w) onMove!(g.id, fromScreen(w.x - g.offset.x, w.y - g.offset.y));
    } else if (g.kind === "pan" || !editing) {
      const ctm = svg.current?.getScreenCTM();
      const k = ctm ? 1 / ctm.a : 1;
      setCamera(clampCamera({ s: g.camera.s, tx: g.camera.tx + dx * k, ty: g.camera.ty + dy * k }));
    }
  }
  function up(event: PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(null);
    svg.current?.releasePointerCapture?.(event.pointerId);
    if (!g.moved) onSelect(g.kind === "sector" ? g.id! : null);
  }
  function key(event: KeyboardEvent<SVGGElement>, sector: SceneSector) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(sector.id);
      return;
    }
    if (!editing) return;
    const d = event.shiftKey ? STEP * 3 : STEP;
    const delta: Record<string, Position> = {
      ArrowRight: { x: d, y: -d },
      ArrowLeft: { x: -d, y: d },
      ArrowUp: { x: -d, y: -d },
      ArrowDown: { x: d, y: d },
    };
    const v = delta[event.key];
    if (!v) return;
    event.preventDefault();
    onSelect(sector.id);
    onMove!(sector.id, { x: sector.position.x + v.x, y: sector.position.y + v.y });
  }

  const ordered = depthSort(sectors);
  return (
    <div className={"fz-stage" + (editing ? " is-editing" : "") + (dragging ? " is-dragging" : "")}>
      <svg
        ref={svg}
        className="fz-svg"
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="group"
        aria-label={`Cena ilustrativa da fazenda com ${sectors.length} ${sectors.length === 1 ? "setor" : "setores"}`}
        aria-describedby="fz-scene-help"
        onPointerDown={(e) => down(e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <FarmDefs />
        <Clouds />
        <g
          className="fz-camera"
          style={{ transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.s})` }}
        >
          <Island grid={editing} />
          <BorderTrees />
          <g className="fz-paths" aria-hidden="true">
            {links.map((l) => {
              const a = sectors.find((s) => s.id === l.a);
              const b = sectors.find((s) => s.id === l.b);
              if (!a || !b) return null;
              const route = isoRoute(toScreen(a.position), toScreen(b.position));
              const d = "M" + route.map((r) => `${r.x.toFixed(1)} ${r.y.toFixed(1)}`).join(" L");
              return (
                <g key={l.a + l.b}>
                  <path d={d} className="fz-path-edge" />
                  <path d={d} className="fz-path" />
                </g>
              );
            })}
          </g>
          {ordered.map((s) => {
            const p = toScreen(s.position);
            const selected = s.id === selectedId;
            const ops = s.operations;
            const names = [
              ...s.cropIds.map(cropName),
              ...(ops?.productions.map((x) => x.cropName) ?? []),
            ].filter((n): n is string => !!n);
            const label = short(s.name);
            const flag =
              ops?.state === "ACTION_PENDING" ? "attention" : ops?.missingProductionIds.length ? "missing" : null;
            const width = Math.max(56, label.length * 6.3 + 22 + (flag ? 12 : 0));
            return (
              <g key={s.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                <g
                  className={"fz-sector" + (selected ? " is-selected" : "") + (dragging === s.id ? " is-lifted" : "")}
                  data-id={s.id}
                  data-type={s.type}
                  data-state={ops?.state ?? "UNKNOWN"}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={sectorLabel(s, cropName)}
                  onPointerDown={(e) => down(e, s.id)}
                  onKeyDown={(e) => key(e, s)}
                >
                  {/* área de toque ampla */}
                  <ellipse cx={0} cy={-8} rx={62} ry={48} fill="transparent" />
                  <polygon className="fz-ring" points="0,-38 76,0 0,38 -76,0" />
                  <g className="fz-lift">
                    <SectorSprite type={s.type} colors={produceColors(names)} seed={hash(s.id)} />
                  </g>

                  <g className="fz-name" transform="translate(0 44)">
                    <rect x={-width / 2} y={-11} width={width} height={22} rx={11} />
                    {flag && <circle className="fz-flag" data-tone={flag} cx={-width / 2 + 12} cy={0} r={4} />}
                    <text x={flag ? 6 : 0} y={4} textAnchor="middle">
                      {label}
                    </text>
                  </g>
                </g>
              </g>
            );
          })}
          <g className="fz-arcs" aria-hidden="true">
            {selectedId &&
              links
                .filter((l) => l.a === selectedId || l.b === selectedId)
                .map((l) => {
                  const a = sectors.find((s) => s.id === l.a);
                  const b = sectors.find((s) => s.id === l.b);
                  if (!a || !b) return null;
                  const pa = toScreen(a.position),
                    pb = toScreen(b.position);
                  const lift = 70 + Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.18;
                  const mx = (pa.x + pb.x) / 2,
                    my = Math.min(pa.y, pb.y) - lift;
                  const d = `M${pa.x} ${pa.y - 30} Q${mx} ${my} ${pb.x} ${pb.y - 30}`;
                  return (
                    <g key={l.a + l.b} className="fz-arc">
                      <path d={d} className="fz-arc-line" />
                      <circle cx={pb.x} cy={pb.y - 30} r={3.5} className="fz-arc-end" />
                      <circle cx={pa.x} cy={pa.y - 30} r={3.5} className="fz-arc-end" />
                    </g>
                  );
                })}
          </g>
        </g>
      </svg>
      <p id="fz-scene-help" className="sr-only">
        {editing
          ? "Arraste um setor para reposicionar. Pelo teclado, selecione o setor e use as setas; Shift acelera."
          : "Selecione um setor para ver suas produções, lotes e pedidos. Arraste o fundo para mover a visão."}
      </p>
      {hud}
      <div className="fz-zoom" role="group" aria-label="Aproximação da cena">
        <button type="button" aria-label="Aproximar" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => zoomTo(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])}>
          <Plus size={16} />
        </button>
        <button type="button" aria-label="Afastar" disabled={zoomIndex <= 0} onClick={() => zoomTo(ZOOMS[Math.max(0, zoomIndex - 1)])}>
          <Minus size={16} />
        </button>
        <button type="button" aria-label="Centralizar fazenda" onClick={() => setCamera({ s: 1, tx: 0, ty: 0 })}>
          <LocateFixed size={16} />
        </button>
      </div>
      <p className="fz-disclaimer">
        <Info size={13} aria-hidden="true" />
        {DISCLAIMER}
      </p>
      {overlay}
    </div>
  );
}
