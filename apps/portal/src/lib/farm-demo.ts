// Fazenda de exemplo — DADOS SIMULADOS, apenas para visualizar a experiência.
// Nunca é enviada à API, não se mistura com registros reais e é sempre
// identificada na interface como exemplo.
import type { Crop, Production } from "./types";
import type {
  ElementOperations,
  FarmElement,
  FarmLayout,
  FarmOverview,
  FarmProduction,
} from "./farm";

export const DEMO_PROPERTY_ID = "00000000-0000-4000-8000-00000000d3e0";
export const DEMO_NAME = "Sítio Esperança (exemplo)";
const id = (n: number, kind: string) =>
  `00000000-0000-4000-8${kind}-${String(n).padStart(12, "0")}`;

const CROPS: Crop[] = [
  { id: id(1, "c00"), name: "Alface" },
  { id: id(2, "c00"), name: "Couve" },
  { id: id(3, "c00"), name: "Tomate" },
  { id: id(4, "c00"), name: "Cenoura" },
  { id: id(5, "c00"), name: "Milho" },
  { id: id(6, "c00"), name: "Mandioca" },
  { id: id(7, "c00"), name: "Laranja" },
  { id: id(8, "c00"), name: "Banana" },
];
const crop = (name: string) => CROPS.find((c) => c.name === name)!;

type Seed = {
  n: number;
  crop: string;
  kg: number;
  daysAgo: number;
  offer?: { status: "RASCUNHO" | "PUBLICADA"; kg: number; reserved?: number; dispatched?: number; received?: number; days: number };
  orders?: { status: string; kg: number; shipment?: string }[];
};
const SEEDS: Seed[] = [
  { n: 1, crop: "Alface", kg: 120, daysAgo: 2, offer: { status: "PUBLICADA", kg: 100, days: 5 }, orders: [{ status: "SOLICITADO", kg: 30 }] },
  { n: 2, crop: "Couve", kg: 80, daysAgo: 4 },
  { n: 3, crop: "Tomate", kg: 350, daysAgo: 3, offer: { status: "PUBLICADA", kg: 300, reserved: 60, dispatched: 80, days: 7 }, orders: [{ status: "ACEITO", kg: 60, shipment: "PLANEJADA" }, { status: "RETIRADO", kg: 80, shipment: "RETIRADA" }] },
  { n: 4, crop: "Cenoura", kg: 140, daysAgo: 6, offer: { status: "RASCUNHO", kg: 100, days: 6 } },
  { n: 5, crop: "Milho", kg: 900, daysAgo: 12 },
  { n: 6, crop: "Mandioca", kg: 600, daysAgo: 9, offer: { status: "PUBLICADA", kg: 400, received: 150, dispatched: 150, days: 10 }, orders: [{ status: "RECEBIDO", kg: 150, shipment: "RECEBIDA" }] },
  { n: 7, crop: "Laranja", kg: 480, daysAgo: 5, offer: { status: "PUBLICADA", kg: 400, reserved: 120, days: 8 }, orders: [{ status: "ACEITO", kg: 120, shipment: "PLANEJADA" }] },
  { n: 8, crop: "Banana", kg: 260, daysAgo: 7 },
];

const iso = (now: Date, days: number, hour = 9) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
function production(seed: Seed, now: Date): FarmProduction {
  const pid = id(seed.n, "a00"),
    lot = id(seed.n, "b00");
  const harvested = iso(now, -seed.daysAgo).slice(0, 10);
  const events = [{ id: id(seed.n * 10, "e00"), type: "ORIGEM_REGISTRADA", recordedAt: iso(now, -seed.daysAgo, 11), orderId: null as string | null }];
  if (seed.offer?.status === "PUBLICADA")
    events.unshift({ id: id(seed.n * 10 + 1, "e00"), type: "OFERTA_PUBLICADA", recordedAt: iso(now, -seed.daysAgo + 1, 14), orderId: null });
  const orders = (seed.orders ?? []).map((o, k) => ({ ...o, id: id(seed.n * 10 + k, "d00") }));
  orders.forEach((o, k) => {
    const type = { SOLICITADO: "PEDIDO_SOLICITADO", ACEITO: "PEDIDO_ACEITO", RETIRADO: "RETIRADA_REGISTRADA", RECEBIDO: "RECEBIMENTO_CONFIRMADO" }[o.status];
    if (type) events.unshift({ id: id(seed.n * 10 + 5 + k, "e00"), type, recordedAt: iso(now, -1, 8 + k * 3 + seed.n), orderId: o.id });
  });
  events.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const states = new Map<string, { status: string; count: number; quantityKg: number }>();
  for (const o of orders) {
    const s = states.get(o.status) ?? { status: o.status, count: 0, quantityKg: 0 };
    s.count++;
    s.quantityKg += o.kg;
    states.set(o.status, s);
  }
  const offer = seed.offer
    ? {
        id: id(seed.n, "f00"),
        status: seed.offer.status,
        quantityKg: seed.offer.kg,
        availableKg: seed.offer.kg - (seed.offer.reserved ?? 0) - (seed.offer.dispatched ?? 0),
        reservedKg: seed.offer.reserved ?? 0,
        dispatchedKg: seed.offer.dispatched ?? 0,
        receivedKg: seed.offer.received ?? 0,
        availableUntil: iso(now, seed.offer.days),
      }
    : null;
  const orderStates = [...states.values()];
  return {
    id: pid,
    cropId: crop(seed.crop).id,
    cropName: seed.crop,
    seasonLabel: "2026/2",
    harvestedOn: harvested,
    registeredQuantityKg: seed.kg,
    lot: { id: lot, status: "IDENTIFICADO", recentEvents: events.slice(0, 3) },
    offer,
    orderStates,
    recentOrders: orders.slice(0, 3).map((o) => ({
      id: o.id,
      status: o.status,
      quantityKg: o.kg,
      shipmentId: o.shipment ? id(seed.n, "9a0") : null,
      shipmentStatus: o.shipment ?? null,
      carrierOrganizationId: null,
    })),
    actions: {
      viewProduction: true,
      viewLot: true,
      viewOrders: true,
      createOffer: !offer,
      publishOffer: offer?.status === "RASCUNHO",
      acceptOrders: orderStates.some((o) => o.status === "SOLICITADO"),
      pickupOrders: orderStates.some((o) => o.status === "ACEITO"),
    },
  };
}

const P = (n: number) => id(n, "a00");
const C = (...names: string[]) => names.map((n) => crop(n).id);
export const DEMO_ELEMENTS: FarmElement[] = [
  { id: id(1, "e10"), name: "Horta Norte", type: "VEGETABLE_GARDEN", position: { x: 0.22, y: 0.3 }, productionIds: [P(1), P(2)], cropIds: C("Alface", "Couve") },
  { id: id(2, "e10"), name: "Estufa de tomates", type: "VEGETABLE_GARDEN", position: { x: 0.42, y: 0.16 }, productionIds: [P(3)], cropIds: C("Tomate") },
  { id: id(3, "e10"), name: "Canteiro de cenouras", type: "VEGETABLE_GARDEN", position: { x: 0.16, y: 0.56 }, productionIds: [P(4)], cropIds: C("Cenoura") },
  { id: id(4, "e10"), name: "Milharal", type: "CULTIVATION", position: { x: 0.64, y: 0.2 }, productionIds: [P(5)], cropIds: C("Milho") },
  { id: id(5, "e10"), name: "Roça de mandioca", type: "CULTIVATION", position: { x: 0.84, y: 0.36 }, productionIds: [P(6)], cropIds: C("Mandioca") },
  { id: id(6, "e10"), name: "Pomar de laranjas", type: "ORCHARD", position: { x: 0.3, y: 0.8 }, productionIds: [P(7)], cropIds: C("Laranja") },
  { id: id(7, "e10"), name: "Bananal", type: "ORCHARD", position: { x: 0.52, y: 0.88 }, productionIds: [P(8)], cropIds: C("Banana") },
  { id: id(8, "e10"), name: "Galpão de embalagem", type: "STORAGE", position: { x: 0.6, y: 0.55 }, productionIds: [P(1), P(3), P(7)], cropIds: [] },
  { id: id(9, "e10"), name: "Ponto de coleta", type: "COLLECTION", position: { x: 0.84, y: 0.72 }, productionIds: [P(3), P(6), P(7)], cropIds: [] },
  { id: id(10, "e10"), name: "Casa de sementes", type: "OTHER", position: { x: 0.4, y: 0.5 }, productionIds: [], cropIds: [] },
];

export function overviewFor(
  elements: FarmElement[],
  version: number,
  productions: FarmProduction[],
): FarmOverview {
  const byId = new Map(productions.map((p) => [p.id, p]));
  const ops: ElementOperations[] = elements.map((e) => {
    const rows = e.productionIds.map((pid) => byId.get(pid)).filter((p): p is FarmProduction => !!p);
    return {
      id: e.id,
      scope: "LINKED_PRODUCTIONS",
      productionCount: rows.length,
      missingProductionIds: e.productionIds.filter((pid) => !byId.has(pid)),
      state: rows.some((p) => p.orderStates.some((o) => o.status === "SOLICITADO" || o.status === "ACEITO"))
        ? "ACTION_PENDING"
        : rows.length
          ? "HAS_LOTS"
          : "NO_LINKED_PRODUCTIONS",
      productions: rows,
    };
  });
  const crops = new Map<string, { cropId: string; name: string; productionCount: number; registeredQuantityKg: number }>();
  for (const p of productions) {
    const c = crops.get(p.cropId) ?? { cropId: p.cropId, name: p.cropName, productionCount: 0, registeredQuantityKg: 0 };
    c.productionCount++;
    c.registeredQuantityKg += p.registeredQuantityKg;
    crops.set(p.cropId, c);
  }
  return {
    property: { id: DEMO_PROPERTY_ID, name: DEMO_NAME, municipality: "Exemplo", uf: "BR" },
    layoutVersion: version,
    layoutState: elements.length ? "CONFIGURED" : "EMPTY",
    isGeoreferenced: false,
    summary: {
      productionCount: productions.length,
      registeredQuantityKg: productions.reduce((n, p) => n + p.registeredQuantityKg, 0),
      crops: [...crops.values()],
      cropsTruncated: false,
    },
    productions,
    pagination: { limit: 20, offset: 0, total: productions.length },
    elements: ops,
    canEditLayout: true,
    isDemonstration: true,
    fetchedAt: new Date().toISOString(),
  };
}

export function demoFarm(now = new Date()) {
  const productions = SEEDS.map((s) => production(s, now));
  const layout: FarmLayout = {
    propertyId: DEMO_PROPERTY_ID,
    schemaVersion: 1,
    version: 1,
    state: "CONFIGURED",
    spatialReference: "ILLUSTRATIVE_NORMALIZED",
    isGeoreferenced: false,
    elements: DEMO_ELEMENTS,
    updatedAt: now.toISOString(),
    canEdit: true,
  };
  const editorProductions: Production[] = productions.map((p, i) => ({
    id: p.id,
    propertyId: DEMO_PROPERTY_ID,
    cropId: p.cropId,
    cropName: p.cropName,
    quantityKg: p.registeredQuantityKg,
    seasonLabel: p.seasonLabel,
    harvestedOn: p.harvestedOn,
    createdAt: iso(now, -SEEDS[i].daysAgo, 11),
    status: "REGISTRADA",
    location: { municipality: "Exemplo", uf: "BR" },
    lot: { id: p.lot.id, status: p.lot.status },
  }));
  return { layout, productions, overview: overviewFor(DEMO_ELEMENTS, 1, productions), crops: CROPS, editorProductions };
}
