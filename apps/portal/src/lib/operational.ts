import type { Production, Order } from "./types";
import { statusName } from "./types";
export type Datum = { name: string; value: number };
export function productionDistribution(rows: Production[]): Datum[] {
  const map = new Map<string, number>();
  for (const row of rows)
    map.set(row.cropName, (map.get(row.cropName) ?? 0) + row.quantityKg);
  return Array.from(map, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );
}
export function orderDistribution(rows: Order[]): Datum[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = statusName(row.status);
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );
}
export function filterProductions(
  rows: Production[],
  search: string,
  crop: string,
  season: string,
) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter(
    (p) =>
      (!crop || p.cropId === crop) &&
      (!season || p.seasonLabel === season) &&
      (!query ||
        [p.cropName, p.seasonLabel, p.lot.id, p.id]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query)),
  );
}
