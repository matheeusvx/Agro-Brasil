import test from "node:test";
import assert from "node:assert/strict";
import {
  productionDistribution,
  orderDistribution,
  filterProductions,
} from "../src/lib/operational";
import type { Production } from "../src/lib/types";
const sample = (cropName: string, quantityKg: number, seasonLabel = "2026") =>
  ({
    id: cropName,
    propertyId: "property",
    cropId: cropName,
    cropName,
    quantityKg,
    seasonLabel,
    harvestedOn: "2026-11-01",
    createdAt: "2026-11-01",
    status: "REGISTRADA",
    location: { municipality: "São Paulo", uf: "SP" },
    lot: { id: "lot-" + cropName, status: "IDENTIFICADO" },
  }) as Production;
test("produção agrupa massas, sem confundir contagem e kg", () => {
  assert.deepEqual(
    productionDistribution([
      sample("Alface", 12.5),
      sample("Alface", 2.5),
      sample("Tomate", 8),
    ]),
    [
      { name: "Alface", value: 15 },
      { name: "Tomate", value: 8 },
    ],
  );
});
test("pedidos contam operações por situação, não massa", () => {
  assert.deepEqual(
    orderDistribution([
      { id: "1", lotId: "a", status: "SOLICITADO", quantityKg: 200 },
      { id: "2", lotId: "a", status: "SOLICITADO", quantityKg: 1 },
    ]),
    [{ name: "Solicitado", value: 2 }],
  );
});
test("filtros combinam cultura, safra e pesquisa de lote", () => {
  const rows = [sample("Alface", 2, "Primavera"), sample("Tomate", 3, "Verão")];
  assert.equal(
    filterProductions(rows, "LOT-ALFACE", "Alface", "Primavera").length,
    1,
  );
  assert.equal(filterProductions(rows, "", "Alface", "Verão").length, 0);
  assert.equal(filterProductions(rows, "  tomate  ", "", "").length, 1);
});
test("estado vazio não inventa categorias ou totais", () => {
  assert.deepEqual(productionDistribution([]), []);
  assert.deepEqual(orderDistribution([]), []);
});
