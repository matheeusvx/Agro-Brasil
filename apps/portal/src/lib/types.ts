export type Organization = {
  organizationId: string;
  name: string;
  type: string;
  role: string;
};
export type Session = {
  userId: string;
  organizationId: string;
  memberships: Organization[];
};
export type Property = {
  id: string;
  name: string;
  municipality?: string;
  uf?: string;
};
export type Crop = { id: string; name: string };
export type TraceEvent = {
  id?: string;
  type: string;
  recordedAt: string;
  location?: { municipality?: string; uf?: string };
  responsibleOrganizationId?: string;
};
export type Production = {
  id: string;
  propertyId: string;
  cropId: string;
  cropName: string;
  quantityKg: number;
  seasonLabel: string;
  harvestedOn: string;
  createdAt: string;
  status: string;
  location: { municipality: string; uf: string };
  lot: { id: string; status: string; events?: TraceEvent[] };
};
export type Order = {
  id: string;
  lotId: string;
  status: string;
  quantityKg?: number;
  quantityGrams?: number;
};
export type Pending = {
  id: string;
  lotId: string;
  status: string;
  quantityKg: number;
  cropName: string;
};
export type RecentLot = {
  id: string;
  cropName: string;
  quantityKg: number;
  lastEvent: TraceEvent;
};
export type Weather = {
  status: string;
  temperatureC?: number;
  description?: string;
  observedAt?: string;
  locality?: { municipality?: string; uf?: string; approximate?: boolean };
};
export type Home = {
  userName?: string;
  hasProductions: boolean;
  canWrite: boolean;
  pending: Pending[];
  recentLots: RecentLot[];
  fetchedAt: string;
};
export type Workspace = {
  catalog: { properties: Property[]; crops: Crop[] };
  property: Property;
  home: Home;
  weather: Weather;
  productions: Production[];
  orders: Order[];
};
// Contrato schemaVersion 1 de GET /properties/:id/excess-impact (docs/requisitos/api.md).
// Os valores chegam calculados pela API; o portal apenas apresenta.
export type ExcessImpact = {
  schemaVersion: number;
  propertyId: string;
  isDemonstration: boolean;
  asOf: string;
  funnelKg: {
    registered: number;
    published: number;
    acceptedNet: number;
    pickedUp: number;
    received: number;
  };
  balancesKg: {
    availableActive: number;
    reservedNow: number;
    inTransitNow: number;
    expiredAvailable: number;
  };
  byModeKg: Record<"VENDA" | "DOACAO", { published: number; received: number }>;
};
export const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
export const date = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00" : value,
  ).toLocaleDateString("pt-BR");
export const statusName = (status: string) =>
  ({
    SOLICITADO: "Solicitado",
    ACEITO: "Aguardando retirada",
    RETIRADO: "Em entrega",
    RECEBIDO: "Recebido",
    CANCELADO: "Cancelado",
    REGISTRADA: "Registrada",
    IDENTIFICADO: "Identificado",
  })[status] ?? status;
export const eventName = (type: string) =>
  ({
    ORIGEM_REGISTRADA: "Origem registrada",
    OFERTA_PUBLICADA: "Oferta publicada",
    PEDIDO_SOLICITADO: "Pedido solicitado",
    PEDIDO_ACEITO: "Pedido aceito",
    RETIRADA_REGISTRADA: "Retirada registrada",
    RECEBIMENTO_CONFIRMADO: "Recebimento confirmado",
    PEDIDO_CANCELADO: "Pedido cancelado",
  })[type] ?? type;
