"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduced(!!media?.matches);
    const listen = () => setReduced(!!media?.matches);
    media?.addEventListener?.("change", listen);
    return () => media?.removeEventListener?.("change", listen);
  }, []);
  return reduced;
}

// Verdadeiro a partir da primeira vez que o elemento aparece na tela.
export function useSeen(ref: RefObject<Element | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

// Milissegundos desde que `running` ficou verdadeiro, até `until`.
export function useClock(running: boolean, until: number) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(until, now - t0);
      setMs(t);
      if (t < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, until]);
  return ms;
}

// Número que rola do valor anterior até o novo.
export function useCountTo(value: number, duration = 700, enabled = true) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (!enabled || reduced || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      setShown(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, enabled, reduced]);
  return shown;
}

// Níveis (0–1) que se aproximam suavemente do alvo de cada item.
export function useSmoothLevels(targets: number[], halfLife = 110, enabled = true) {
  const [levels, setLevels] = useState(targets);
  const current = useRef(targets);
  const key = targets.join(",");
  useEffect(() => {
    if (!enabled) {
      current.current = targets;
      setLevels(targets);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const k = 1 - Math.pow(0.5, (now - last) / halfLife);
      last = now;
      let done = true;
      current.current = targets.map((t, i) => {
        const c = current.current[i] ?? 0;
        const next = c + (t - c) * k;
        if (Math.abs(t - next) > 0.002) done = false;
        return Math.abs(t - next) > 0.002 ? next : t;
      });
      setLevels(current.current);
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, halfLife]);
  return levels;
}
