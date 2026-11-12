// Contrato schemaVersion 1 de GET /cooperative-home e GET /institution-home
// (docs/requisitos/api.md). O portal só valida e apresenta: nenhum total é
// recalculado e nenhuma falha vira zero.
export const ORDER_STATUSES = [
  "SOLICITADO",
  "ACEITO",
  "RETIRADO",
  "RECEBIDO",
  "CANCELADO",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type HomeOperation = {
  id: string;
  lotId: string;
  offerId: string;
  status: OrderStatus;
  quantityKg: number;
  createdAt: string;
  shipment: { id: string; status: string } | null;
};
export type OrganizationHome = {
  schemaVersion: 1;
  organizationId: string;
  organizationType: "COOPERATIVA" | "INSTITUICAO";
  fetchedAt: string;
  isDemonstration: boolean;
  canWrite: boolean;
  total: number;
  byStatus: Record<OrderStatus, { count: number; quantityKg: number }>;
  pending: HomeOperation[];
  operations: HomeOperation[];
};
export type OrganizationHomePage = {
  home: OrganizationHome;
  pagination: { limit: number; offset: number; total: number };
};

export class ContractError extends Error {
  constructor(detail: string) {
    super(
      "Os dados recebidos não seguem o formato esperado. Nada foi exibido para evitar informações incorretas.",
    );
    this.name = "ContractError";
    this.cause = detail;
  }
}
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const kg = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => typeof v === "string" && v.length > 0;
const instant = (v: unknown) => text(v) && !Number.isNaN(Date.parse(v as string));

function operation(value: unknown, field: string): HomeOperation {
  if (!isObject(value)) throw new ContractError(field);
  const { id, lotId, offerId, status, quantityKg, createdAt, shipment } = value;
  if (
    !text(id) ||
    !text(lotId) ||
    !text(offerId) ||
    !ORDER_STATUSES.includes(status as OrderStatus) ||
    !kg(quantityKg) ||
    (quantityKg as number) <= 0 ||
    !instant(createdAt) ||
    !(shipment === null || (isObject(shipment) && text(shipment.id) && text(shipment.status)))
  )
    throw new ContractError(field);
  // Projeção explícita: campos extras eventualmente presentes não chegam à tela.
  return {
    id: id as string,
    lotId: lotId as string,
    offerId: offerId as string,
    status: status as OrderStatus,
    quantityKg: quantityKg as number,
    createdAt: createdAt as string,
    shipment: shipment
      ? { id: (shipment as { id: string }).id, status: (shipment as { status: string }).status }
      : null,
  };
}

/**
 * Valida a resposta contra a organização ativa. Uma resposta de outra
 * organização (por exemplo, requisição iniciada antes da troca) é recusada.
 */
export function parseOrganizationHome(
  body: unknown,
  expected: { organizationId: string; organizationType: "COOPERATIVA" | "INSTITUICAO" },
): OrganizationHomePage {
  if (!isObject(body) || !isObject(body.data) || !isObject(body.pagination))
    throw new ContractError("envelope");
  const d = body.data;
  if (d.schemaVersion !== 1) throw new ContractError("schemaVersion");
  if (d.organizationId !== expected.organizationId)
    throw new ContractError("organizationId");
  if (d.organizationType !== expected.organizationType)
    throw new ContractError("organizationType");
  if (typeof d.isDemonstration !== "boolean" || typeof d.canWrite !== "boolean")
    throw new ContractError("flags");
  if (!instant(d.fetchedAt) || !count(d.total)) throw new ContractError("total");
  if (!isObject(d.byStatus)) throw new ContractError("byStatus");
  const byStatus = {} as OrganizationHome["byStatus"];
  for (const status of ORDER_STATUSES) {
    const row = d.byStatus[status];
    if (!isObject(row) || !count(row.count) || !kg(row.quantityKg))
      throw new ContractError("byStatus." + status);
    byStatus[status] = { count: row.count as number, quantityKg: row.quantityKg as number };
  }
  if (!Array.isArray(d.pending) || d.pending.length > 3 || !Array.isArray(d.operations))
    throw new ContractError("lists");
  const p = body.pagination;
  if (!count(p.limit) || !count(p.offset) || !count(p.total) || p.total !== d.total)
    throw new ContractError("pagination");
  if (d.operations.length > (p.limit as number)) throw new ContractError("operations");
  return {
    home: {
      schemaVersion: 1,
      organizationId: d.organizationId as string,
      organizationType: d.organizationType as OrganizationHome["organizationType"],
      fetchedAt: d.fetchedAt as string,
      isDemonstration: d.isDemonstration,
      canWrite: d.canWrite,
      total: d.total as number,
      byStatus,
      pending: d.pending.map((o, i) => operation(o, "pending." + i)),
      operations: d.operations.map((o, i) => operation(o, "operations." + i)),
    },
    pagination: { limit: p.limit as number, offset: p.offset as number, total: p.total as number },
  };
}

// Projeção comercial pública de GET /offers (publicOffer na API).
export type PublicOffer = {
  id: string;
  sellerName?: string;
  cropName: string;
  territory?: { municipality?: string; uf?: string } | null;
  availableKg: number;
  destinationMode: "VENDA" | "DOACAO";
  unitPriceCents?: number;
  availableUntil: string;
  isDemonstration?: boolean;
};
export function parseOffers(body: unknown): {
  data: PublicOffer[];
  pagination: { limit: number; offset: number; total: number };
} {
  if (!isObject(body) || !Array.isArray(body.data) || !isObject(body.pagination))
    throw new ContractError("offers");
  const p = body.pagination;
  if (!count(p.limit) || !count(p.offset) || !count(p.total))
    throw new ContractError("offers.pagination");
  const data = body.data.map((o, i) => {
    if (
      !isObject(o) ||
      !text(o.id) ||
      !text(o.cropName) ||
      !kg(o.availableKg) ||
      !["VENDA", "DOACAO"].includes(o.destinationMode as string) ||
      !instant(o.availableUntil) ||
      (o.unitPriceCents !== undefined && o.unitPriceCents !== null && !count(o.unitPriceCents))
    )
      throw new ContractError("offers." + i);
    const territory = isObject(o.territory)
      ? {
          municipality: typeof o.territory.municipality === "string" ? o.territory.municipality : undefined,
          uf: typeof o.territory.uf === "string" ? o.territory.uf : undefined,
        }
      : null;
    // Somente o necessário para a consulta; IDs de organização e lote ficam de fora.
    return {
      id: o.id as string,
      sellerName: typeof o.sellerName === "string" ? o.sellerName : undefined,
      cropName: o.cropName as string,
      territory,
      availableKg: o.availableKg as number,
      destinationMode: o.destinationMode as PublicOffer["destinationMode"],
      unitPriceCents: typeof o.unitPriceCents === "number" ? o.unitPriceCents : undefined,
      availableUntil: o.availableUntil as string,
      isDemonstration: o.isDemonstration === true,
    };
  });
  return { data, pagination: { limit: p.limit as number, offset: p.offset as number, total: p.total as number } };
}
