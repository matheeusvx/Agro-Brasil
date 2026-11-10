"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { STATE_INFO, TYPE_INFO, type SceneSector } from "@/lib/farm";

// Lista compacta de setores: fechada por padrão, abre sob demanda.
// É também a alternativa textual acessível à cena.
export function SectorMenu({
  sectors,
  selectedId,
  onSelect,
}: {
  sectors: SceneSector[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const pending = sectors.filter((s) => s.operations?.state === "ACTION_PENDING").length;
  return (
    <div className="fz-menu" ref={box}>
      <button type="button" className="fz-menu-button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Setores <span>{sectors.length}</span>
        {pending > 0 && <i className="fz-flag-dot" aria-label={`${pending} com pedido aguardando ação`} />}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <ul className="fz-menu-list">
          {sectors.length === 0 && <li className="fz-menu-empty">Nenhum setor ainda</li>}
          {sectors.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === selectedId ? "true" : undefined}
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {TYPE_INFO[s.type].label}
                    {s.operations?.state === "ACTION_PENDING" && " · " + STATE_INFO.ACTION_PENDING.label}
                  </small>
                </span>
                {s.operations?.state === "ACTION_PENDING" && <i className="fz-flag-dot" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
