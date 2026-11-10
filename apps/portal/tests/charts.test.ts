import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GAP_DEG,
  PLOT_HEIGHT,
  RING,
  TALLEST,
  arcAt,
  boxFaces,
  layoutBoxes,
  layoutRing,
  sectorPath,
  topWithOthers,
} from "../src/lib/chart-geometry";
import { OperationalCharts } from "../src/components/operational-charts";
import type { Order, Production } from "../src/lib/types";

test("caixas: altura proporcional ao maior valor e todas dentro do plot", () => {
  const boxes = layoutBoxes([100, 50, 0], 400);
  assert.equal(boxes.length, 3);
  const full = (b: (typeof boxes)[number]) => b.height + b.side + b.back;
  assert.ok(Math.abs(full(boxes[0]) - TALLEST) < 1e-9);
  assert.ok(Math.abs(full(boxes[1]) - TALLEST / 2) < 1e-6);
  assert.equal(boxes[2].height, 0);
  const last = boxes[2];
  assert.ok(last.x + last.width <= 400 + 1e-9);
  assert.ok(boxes.every((b) => b.width <= 78));
  assert.deepEqual(layoutBoxes([], 400), []);
  // uma cultura só fica centralizada
  const [single] = layoutBoxes([10], 400);
  assert.ok(Math.abs(single.x + single.width / 2 - 200) < 1e-9);
});

test("caixas: nível 0 não desenha preenchimento e o topo fica acima da frente", () => {
  const [box] = layoutBoxes([80], 300);
  assert.equal(boxFaces(box, 0).left, "");
  const faces = boxFaces(box, 1);
  assert.match(faces.left, /^M /);
  assert.equal(faces.edges.length, 9);
  const ys = faces.edges.flat().map(([, y]) => y);
  assert.ok(Math.max(...ys) <= PLOT_HEIGHT && Math.min(...ys) >= 0);
});

test("anel: setores proporcionais, sem lacuna quando há uma só situação", () => {
  const arcs = layoutRing([1, 3]);
  assert.equal(arcs[0].a0, 0);
  assert.ok(Math.abs(arcs[0].a1 - (90 - GAP_DEG)) < 1e-9);
  assert.ok(Math.abs(arcs[1].a0 - 90) < 1e-9);
  const [only] = layoutRing([2]);
  assert.deepEqual(only, { a0: 0, a1: 360 });
  assert.match(sectorPath(RING.inner, RING.outer, 0, 360), /Z M/); // anel completo com furo
  assert.equal(sectorPath(RING.inner, RING.outer, 10, 10), "");
  // ponteiro: às 3h está no segundo setor; no centro, em nenhum
  const c = RING.size / 2;
  assert.equal(arcAt(arcs, c + (RING.inner + RING.outer) / 2, c), 1);
  assert.equal(arcAt(arcs, c, c), -1);
});

test("culturas além do limite viram 'Outras' sem perder o total", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ name: "C" + i, value: 10 - i }));
  const top = topWithOthers(rows, 6);
  assert.equal(top.length, 6);
  assert.equal(top[5].name, "Outras");
  assert.equal(top.reduce((n, r) => n + r.value, 0), rows.reduce((n, r) => n + r.value, 0));
});

const prod = (cropName: string, quantityKg: number, i: number): Production => ({
  id: "p" + i,
  propertyId: "x",
  cropId: cropName,
  cropName,
  quantityKg,
  seasonLabel: "2026/2",
  harvestedOn: "2026-11-01",
  createdAt: "2026-11-01T00:00:00Z",
  status: "REGISTRADA",
  location: { municipality: "M", uf: "SP" },
  lot: { id: "l" + i, status: "IDENTIFICADO" },
});

test("gráficos renderizam dados reais e estados vazios", () => {
  const productions = [prod("Tomate", 100, 1), prod("Alface", 12.5, 2)];
  const orders: Order[] = [
    { id: "o1", lotId: "l1", status: "RECEBIDO" },
    { id: "o2", lotId: "l1", status: "RECEBIDO" },
    { id: "o3", lotId: "l2", status: "SOLICITADO" },
  ];
  const html = renderToStaticMarkup(createElement(OperationalCharts, { productions, orders }));
  assert.match(html, /aria-label="Tomate: 100 kg, 88,9% do total"/);
  assert.match(html, /aria-label="Alface: 12,5 kg, 11,1% do total"/);
  assert.match(html, /Soma de 1 registro desta cultura/);
  assert.match(html, /aria-label="Solicitado: 1 \(33,3%\); Recebido: 2 \(66,7%\)"/);
  assert.match(html, /não representa estoque disponível/i);
  const empty = renderToStaticMarkup(createElement(OperationalCharts, { productions: [], orders: [] }));
  assert.match(empty, /Nenhuma produção registrada/);
  assert.match(empty, /Nenhum pedido vinculado aos lotes/);
});
