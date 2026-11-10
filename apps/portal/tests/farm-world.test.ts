import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  activityFeed,
  fromScreen,
  isoRoute,
  toScreen,
  reconcile,
  sectorLinks,
  stateCounts,
  validateDraft,
  type FarmElement,
} from "../src/lib/farm";
import { DEMO_PROPERTY_ID, demoFarm, overviewFor } from "../src/lib/farm-demo";
import { FarmScene } from "../src/components/farm/farm-scene";

const el = (id: string, productionIds: string[], over: Partial<FarmElement> = {}): FarmElement => ({
  id,
  name: "Setor " + id,
  type: "VEGETABLE_GARDEN",
  position: { x: 0.3, y: 0.3 },
  productionIds,
  cropIds: [],
  ...over,
});

test("ligações só existem entre setores que compartilham produção real", () => {
  const links = sectorLinks([el("a", ["p1", "p2"]), el("b", ["p2"]), el("c", ["p3"]), el("d", ["p1", "p2"])]);
  assert.deepEqual(links, [
    { a: "a", b: "b", shared: 1 },
    { a: "a", b: "d", shared: 2 },
    { a: "b", b: "d", shared: 1 },
  ]);
  assert.deepEqual(sectorLinks([el("x", []), el("y", [])]), []);
});

test("atividade usa eventos confirmados, sem duplicar o mesmo evento entre setores", () => {
  const { layout, overview } = demoFarm(new Date("2026-11-10T12:00:00Z"));
  const sectors = reconcile(layout.elements, layout.version, overview);
  const feed = activityFeed(sectors, 50);
  const ids = feed.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (let i = 1; i < feed.length; i++) assert.ok(feed[i - 1].recordedAt >= feed[i].recordedAt);
  // O mesmo lote vinculado à estufa, ao galpão e à coleta aparece uma vez, citando os três.
  const tomato = feed.find((f) => f.cropName === "Tomate" && f.type === "RETIRADA_REGISTRADA")!;
  assert.equal(tomato.sectorIds.length, 3);
  assert.equal(activityFeed([{ id: "s", operations: null }]).length, 0);
});

test("contagem por estado não soma volumes e trata dados ausentes", () => {
  const { layout, overview } = demoFarm();
  const counts = stateCounts(reconcile(layout.elements, layout.version, overview));
  assert.equal(counts.ACTION_PENDING + counts.HAS_LOTS + counts.NO_LINKED_PRODUCTIONS, layout.elements.length);
  assert.ok(counts.ACTION_PENDING >= 1 && counts.NO_LINKED_PRODUCTIONS >= 1);
  assert.equal(stateCounts([{ operations: null }]).UNKNOWN, 1);
});




test("fazenda de exemplo é completa, válida e sempre marcada como simulada", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const demo = demoFarm(now);
  assert.equal(demo.layout.propertyId, DEMO_PROPERTY_ID);
  assert.equal(demo.overview.isDemonstration, true);
  assert.match(demo.overview.property.name, /exemplo/i);
  assert.equal(new Set(demo.layout.elements.map((e) => e.type)).size, 6, "todos os tipos representados");
  assert.deepEqual(
    validateDraft(demo.layout.elements, 1, {
      crops: demo.crops,
      productions: demo.productions.map((p) => ({ id: p.id, cropId: p.cropId })),
    }),
    [],
  );
  for (const a of demo.layout.elements)
    for (const b of demo.layout.elements)
      if (a !== b) assert.ok(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) >= 0.16);
  // Ofertas publicadas vigentes e saldo coerente com reservas/expedição.
  for (const p of demo.productions)
    if (p.offer) assert.equal(p.offer.availableKg, p.offer.quantityKg - p.offer.reservedKg - p.offer.dispatchedKg);
  assert.ok(demo.productions.some((p) => p.offer?.status === "PUBLICADA" && new Date(p.offer.availableUntil) > now));
  // Recalcular para um rascunho novo mantém os estados derivados.
  const next = overviewFor([...demo.layout.elements.slice(0, 2)], 2, demo.productions);
  assert.equal(next.layoutVersion, 2);
  assert.equal(next.elements.length, 2);
});

test("cena desenha trilhas entre setores ligados e arcos do setor selecionado", () => {
  const { layout, overview } = demoFarm();
  const sectors = reconcile(layout.elements, layout.version, overview);
  const links = sectorLinks(layout.elements);
  const props = {
    sectors,
    mode: "explore" as const,
    selectedId: null as string | null,
    cropName: () => undefined,
    onSelect: () => {},
    links,
  };
  const idle = renderToStaticMarkup(createElement(FarmScene, props));
  assert.equal((idle.match(/class="fz-path"/g) ?? []).length, links.length);
  assert.equal((idle.match(/class="fz-arc"/g) ?? []).length, 0);
  const galpao = layout.elements.find((e) => e.type === "STORAGE")!;
  const chosen = renderToStaticMarkup(createElement(FarmScene, { ...props, selectedId: galpao.id }));
  const expected = links.filter((l) => l.a === galpao.id || l.b === galpao.id).length;
  assert.equal((chosen.match(/class="fz-arc"/g) ?? []).length, expected);
  assert.doesNotMatch(chosen, /em comum/);
});


test("trilhas seguem os eixos isométricos entre os setores", () => {
  const from = toScreen({ x: 0.2, y: 0.3 });
  const to = toScreen({ x: 0.7, y: 0.6 });
  const [a, corner, b] = isoRoute(from, to).map((p) => fromScreen(p.x, p.y));
  assert.ok(Math.abs(corner.y - a.y) < 1e-9 && Math.abs(corner.x - b.x) < 1e-9);
});

test("cena limpa: sem personagens e pendência como ponto discreto na etiqueta", () => {
  const { layout, overview } = demoFarm();
  const sectors = reconcile(layout.elements, layout.version, overview);
  const html = renderToStaticMarkup(
    createElement(FarmScene, { sectors, mode: "explore", selectedId: null, cropName: () => undefined, onSelect: () => {} }),
  );
  assert.doesNotMatch(html, /fz-workers|fz-farmer|fz-bubble|fz-badge|fz-bird/);
  const pending = sectors.filter((s) => s.operations?.state === "ACTION_PENDING").length;
  assert.ok(pending > 0);
  assert.equal((html.match(/class="fz-flag" data-tone="attention"/g) ?? []).length, pending);
});
