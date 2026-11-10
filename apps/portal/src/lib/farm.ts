// Minha Fazenda — contratos, regras puras e máquina de estados do editor.
// A API (`/properties/:id/farm-layout` e `/farm-overview`) é a autoridade:
// aqui só há conciliação, validação prévia e controle do rascunho local.
import { RequestError, request } from "./client-api";

export const ELEMENT_TYPES = [
  "CULTIVATION",
  "VEGETABLE_GARDEN",
  "ORCHARD",
  "STORAGE",
  "COLLECTION",
  "OTHER",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];
export const MAX_ELEMENTS = 20;
export const MAX_REFERENCES = 10;
export const MAX_NAME = 80;
export const MAX_PAYLOAD_BYTES = 16384;
export const DISCLAIMER = "Organização espacial ilustrativa, não georreferenciada.";

export const TYPE_INFO: Record<
  ElementType,
  { label: string; plural: string; hint: string }
> = {
  CULTIVATION: {
    label: "Área de cultivo",
    plural: "Plantio",
    hint: "Lavoura ou roça",
  },
  VEGETABLE_GARDEN: {
    label: "Horta",
    plural: "Horta",
    hint: "Canteiros de verduras e legumes",
  },
  ORCHARD: { label: "Pomar", plural: "Pomar", hint: "Árvores frutíferas" },
  STORAGE: {
    label: "Armazém",
    plural: "Armazém",
    hint: "Galpão ou depósito",
  },
  COLLECTION: {
    label: "Coleta e expedição",
    plural: "Coleta",
    hint: "Onde os lotes saem para entrega",
  },
  OTHER: { label: "Outra estrutura", plural: "Outra", hint: "Qualquer outro espaço" },
};

export type Position = { x: number; y: number };
export type FarmElement = {
  id: string;
  name: string;
  type: ElementType;
  position: Position;
  productionIds: string[];
  cropIds: string[];
};
export type LayoutState = "UNCONFIGURED" | "EMPTY" | "CONFIGURED";
export type FarmLayout = {
  propertyId: string;
  schemaVersion: number;
  version: number;
  state: LayoutState;
  spatialReference: "ILLUSTRATIVE_NORMALIZED";
  isGeoreferenced: false;
  elements: FarmElement[];
  updatedAt: string | null;
  canEdit: boolean;
};
export type OfferSummary = {
  id: string;
  status: string;
  quantityKg: number;
  availableKg: number;
  reservedKg: number;
  dispatchedKg: number;
  receivedKg: number;
  availableUntil: string;
};
export type RecentOrder = {
  id: string;
  status: string;
  quantityKg: number;
  shipmentId: string | null;
  shipmentStatus: string | null;
  carrierOrganizationId: string | null;
};
export type FarmProduction = {
  id: string;
  cropId: string;
  cropName: string;
  seasonLabel: string;
  harvestedOn: string;
  registeredQuantityKg: number;
  lot: {
    id: string;
    status: string;
    recentEvents: {
      id: string;
      type: string;
      recordedAt: string;
      orderId: string | null;
    }[];
  };
  offer: OfferSummary | null;
  orderStates: { status: string; count: number; quantityKg: number }[];
  recentOrders: RecentOrder[];
  actions: Record<
    | "viewProduction"
    | "viewLot"
    | "viewOrders"
    | "createOffer"
    | "publishOffer"
    | "acceptOrders"
    | "pickupOrders",
    boolean
  >;
};
export type OperationalState =
  | "NO_LINKED_PRODUCTIONS"
  | "HAS_LOTS"
  | "ACTION_PENDING";
export type ElementOperations = {
  id: string;
  scope: "LINKED_PRODUCTIONS";
  productionCount: number;
  missingProductionIds: string[];
  state: OperationalState;
  productions: FarmProduction[];
};
export type FarmOverview = {
  property: { id: string; name: string; municipality?: string; uf?: string };
  layoutVersion: number;
  layoutState: LayoutState;
  isGeoreferenced: false;
  summary: {
    productionCount: number;
    registeredQuantityKg: number;
    crops: {
      cropId: string;
      name: string;
      productionCount: number;
      registeredQuantityKg: number;
    }[];
    cropsTruncated: boolean;
  };
  productions: FarmProduction[];
  pagination: { limit: number; offset: number; total: number };
  elements: ElementOperations[];
  canEditLayout: boolean;
  isDemonstration: boolean;
  fetchedAt: string;
};

export const STATE_INFO: Record<OperationalState, { label: string; tone: string }> = {
  ACTION_PENDING: { label: "Pedido aguardando ação", tone: "attention" },
  HAS_LOTS: { label: "Lotes vinculados", tone: "ok" },
  NO_LINKED_PRODUCTIONS: { label: "Sem produções vinculadas", tone: "muted" },
};
export const shipmentName = (status: string | null) =>
  status
    ? (({
        PLANEJADA: "Retirada planejada",
        RETIRADA: "Retirada registrada",
        RECEBIDA: "Recebimento confirmado",
        CANCELADA: "Remessa cancelada",
      }) as Record<string, string>)[status] ?? status
    : "Sem remessa";

// ---------- Geometria ----------
export const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
// Margem visual para o arraste: o contrato aceita 0..1, mas sprites na borda
// ficariam fora da ilha. Posições salvas fora da margem continuam válidas.
export const DRAG_MIN = 0.06;
export const DRAG_MAX = 0.94;
export const clampDrag = (p: Position): Position => ({
  x: round(Math.min(DRAG_MAX, Math.max(DRAG_MIN, p.x))),
  y: round(Math.min(DRAG_MAX, Math.max(DRAG_MIN, p.y))),
});
const round = (value: number) => Math.round(value * 10000) / 10000;

// Projeção isométrica 2:1 da ilha (viewBox 1000×640).
export const BOARD = { cx: 500, top: 92, half: 400 } as const;
export function toScreen(p: Position) {
  return {
    x: BOARD.cx + (p.x - p.y) * BOARD.half,
    y: BOARD.top + (p.x + p.y) * (BOARD.half / 2),
  };
}
export function fromScreen(sx: number, sy: number): Position {
  const u = (sx - BOARD.cx) / BOARD.half;
  const v = (sy - BOARD.top) / (BOARD.half / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}
// Posição livre para um novo setor: espiral a partir do centro, longe dos demais.
export function freeSpot(elements: FarmElement[]): Position {
  const candidates: Position[] = [];
  for (let ring = 0; ring <= 4; ring++)
    for (let i = -ring; i <= ring; i++)
      for (let j = -ring; j <= ring; j++)
        if (Math.max(Math.abs(i), Math.abs(j)) === ring)
          candidates.push({ x: 0.5 + i * 0.18, y: 0.5 + j * 0.18 });
  const inside = candidates.filter(
    (c) => c.x >= DRAG_MIN && c.x <= DRAG_MAX && c.y >= DRAG_MIN && c.y <= DRAG_MAX,
  );
  const distance = (c: Position) =>
    Math.min(
      Infinity,
      ...elements.map((e) => Math.hypot(e.position.x - c.x, e.position.y - c.y)),
    );
  const free = inside.find((c) => distance(c) >= 0.16);
  if (free) return clampDrag(free);
  return clampDrag(inside.reduce((a, b) => (distance(b) > distance(a) ? b : a)));
}
// Trilha em "L" seguindo os eixos isométricos entre dois pontos da cena.
export function isoRoute(from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = fromScreen(from.x, from.y);
  const b = fromScreen(to.x, to.y);
  return [from, toScreen({ x: b.x, y: a.y }), to];
}
export const depthSort = <T extends { position: Position; id: string }>(rows: T[]) =>
  [...rows].sort(
    (a, b) =>
      a.position.x + a.position.y - (b.position.x + b.position.y) ||
      a.id.localeCompare(b.id),
  );

// ---------- Identificadores ----------
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function defaultName(type: ElementType, elements: FarmElement[]) {
  const base = TYPE_INFO[type].label;
  const used = new Set(elements.map((e) => e.name.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++)
    if (!used.has((base + " " + n).toLowerCase())) return base + " " + n;
}

// ---------- Validação local (antecipa as regras da API) ----------
export type CatalogInfo = {
  crops: { id: string; name: string }[];
  productions: { id: string; cropId: string }[];
};
export type Issue = { elementId?: string; message: string };
export function payload(version: number, elements: FarmElement[]) {
  return {
    version,
    elements: elements.map((e) => ({
      id: e.id,
      name: e.name.trim(),
      type: e.type,
      position: { x: e.position.x, y: e.position.y },
      productionIds: e.productionIds,
      cropIds: e.cropIds,
    })),
  };
}
export const payloadBytes = (version: number, elements: FarmElement[]) =>
  new TextEncoder().encode(JSON.stringify(payload(version, elements))).length;

export function validateDraft(
  elements: FarmElement[],
  version: number,
  catalog?: CatalogInfo,
): Issue[] {
  const issues: Issue[] = [];
  if (elements.length > MAX_ELEMENTS)
    issues.push({ message: `A fazenda aceita até ${MAX_ELEMENTS} setores.` });
  const ids = new Set<string>();
  const productionCrop = new Map(catalog?.productions.map((p) => [p.id, p.cropId]));
  const crops = new Set(catalog?.crops.map((c) => c.id));
  for (const e of elements) {
    const at = (message: string) => issues.push({ elementId: e.id, message });
    if (ids.has(e.id.toLowerCase())) at("Identificador repetido.");
    ids.add(e.id.toLowerCase());
    const name = e.name.trim();
    if (!name) at("Dê um nome ao setor.");
    if (name.length > MAX_NAME) at(`Use até ${MAX_NAME} caracteres no nome.`);
    if (!ELEMENT_TYPES.includes(e.type)) at("Tipo de setor inválido.");
    for (const v of [e.position.x, e.position.y])
      if (!Number.isFinite(v) || v < 0 || v > 1) at("Posição fora da fazenda.");
    if (e.productionIds.length > MAX_REFERENCES)
      at(`Vincule até ${MAX_REFERENCES} produções por setor.`);
    if (e.cropIds.length > MAX_REFERENCES)
      at(`Vincule até ${MAX_REFERENCES} culturas por setor.`);
    if (new Set(e.productionIds).size !== e.productionIds.length)
      at("Produção repetida no setor.");
    if (new Set(e.cropIds).size !== e.cropIds.length) at("Cultura repetida no setor.");
    if (catalog) {
      if (e.cropIds.some((id) => !crops.has(id)))
        at("Há uma cultura que não está mais disponível.");
      if (e.cropIds.length)
        for (const pid of e.productionIds) {
          const crop = productionCrop.get(pid);
          if (crop && !e.cropIds.includes(crop))
            at("A cultura de uma produção vinculada precisa estar na lista do setor.");
        }
    }
  }
  if (payloadBytes(version, elements) > MAX_PAYLOAD_BYTES)
    issues.push({
      message: "A configuração ficou grande demais. Encurte nomes ou reduza vínculos.",
    });
  return [...new Map(issues.map((i) => [(i.elementId ?? "") + i.message, i])).values()];
}

// ---------- Comparação e conciliação ----------
const canonical = (e: FarmElement) =>
  JSON.stringify([
    e.id.toLowerCase(),
    e.name.trim(),
    e.type,
    e.position.x,
    e.position.y,
    [...e.productionIds].sort(),
    [...e.cropIds].sort(),
  ]);
export function sameElements(a: FarmElement[], b: FarmElement[]) {
  if (a.length !== b.length) return false;
  const left = a.map(canonical).sort();
  const right = b.map(canonical).sort();
  return left.every((v, i) => v === right[i]);
}
export type LayoutDiff = { added: string[]; removed: string[]; changed: string[] };
export function diffElements(base: FarmElement[], next: FarmElement[]): LayoutDiff {
  const before = new Map(base.map((e) => [e.id, e]));
  const after = new Map(next.map((e) => [e.id, e]));
  return {
    added: next.filter((e) => !before.has(e.id)).map((e) => e.name),
    removed: base.filter((e) => !after.has(e.id)).map((e) => e.name),
    changed: next
      .filter((e) => before.has(e.id) && canonical(before.get(e.id)!) !== canonical(e))
      .map((e) => e.name),
  };
}
export const diffCount = (d: LayoutDiff) =>
  d.added.length + d.removed.length + d.changed.length;

export type SceneSector = FarmElement & {
  operations: ElementOperations | null;
};
// Concilia layout e overview pelo UUID estável. Dados operacionais só são
// usados quando o overview foi calculado sobre a mesma versão do layout.
export function reconcile(
  elements: FarmElement[],
  layoutVersion: number,
  overview: FarmOverview | null,
): SceneSector[] {
  const usable = overview && overview.layoutVersion === layoutVersion ? overview : null;
  const ops = new Map(usable?.elements.map((e) => [e.id, e]));
  return elements.map((e) => ({ ...e, operations: ops.get(e.id) ?? null }));
}

// Reaplica as alterações locais (base → rascunho) sobre a versão remota mais
// recente. Mudanças feitas só na outra sessão são mantidas; o produtor revisa
// o resultado e salva explicitamente.
export function mergeDraft(
  base: FarmElement[],
  draft: FarmElement[],
  remote: FarmElement[],
): FarmElement[] {
  const before = new Map(base.map((e) => [e.id, e]));
  const mine = new Set(draft.map((e) => e.id));
  const result = new Map(remote.map((e) => [e.id, e]));
  for (const e of base) if (!mine.has(e.id)) result.delete(e.id);
  for (const e of draft) {
    const original = before.get(e.id);
    if (!original || canonical(original) !== canonical(e)) result.set(e.id, e);
  }
  return [...result.values()];
}

// Resultado de um PUT cuja resposta se perdeu: só o GET posterior decide.
export function resolveUncertainSave(
  draft: FarmElement[],
  baseVersion: number,
  remote: FarmLayout,
): "applied" | "not_applied" | "conflict" {
  if (remote.version === baseVersion) return "not_applied";
  if (remote.version === baseVersion + 1 && sameElements(remote.elements, draft))
    return "applied";
  return "conflict";
}

// ---------- Rascunho: operações de edição ----------
export function linkProduction(
  element: FarmElement,
  production: { id: string; cropId: string },
): FarmElement {
  if (element.productionIds.includes(production.id)) return element;
  const cropIds =
    element.cropIds.length && !element.cropIds.includes(production.cropId)
      ? [...element.cropIds, production.cropId]
      : element.cropIds;
  return {
    ...element,
    productionIds: [...element.productionIds, production.id],
    cropIds,
  };
}

// ---------- Estado da página ----------
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "checking" }
  | { kind: "conflict"; remote: FarmLayout | null; message: string };
export type FarmState = {
  key: string;
  status: "loading" | "ready" | "error";
  error: string;
  layout: FarmLayout | null;
  overview: FarmOverview | null;
  overviewStale: boolean;
  mode: "explore" | "edit";
  draft: FarmElement[] | null;
  draftBase: { version: number; elements: FarmElement[] } | null;
  selectedId: string | null;
  save: SaveStatus;
};
export const initialFarmState = (key = ""): FarmState => ({
  key,
  status: "loading",
  error: "",
  layout: null,
  overview: null,
  overviewStale: false,
  mode: "explore",
  draft: null,
  draftBase: null,
  selectedId: null,
  save: { kind: "idle" },
});
export type FarmAction =
  | { type: "load"; key: string }
  | {
      type: "loaded";
      key: string;
      layout: FarmLayout;
      overview: FarmOverview | null;
    }
  | { type: "overview"; key: string; overview: FarmOverview }
  | { type: "failed"; key: string; message: string }
  | { type: "select"; id: string | null }
  | { type: "edit" }
  | { type: "add"; element: FarmElement }
  | { type: "move"; id: string; position: Position }
  | { type: "update"; id: string; patch: Partial<Omit<FarmElement, "id">> }
  | { type: "remove"; id: string }
  | { type: "discard" }
  | { type: "saving"; key: string }
  | { type: "saved"; key: string; layout: FarmLayout }
  | { type: "save_failed"; key: string; message: string }
  | { type: "checking"; key: string }
  | { type: "conflict"; key: string; remote: FarmLayout | null; message: string }
  | { type: "rebase"; key: string; remote: FarmLayout };


const workingElements = (s: FarmState) => s.draft ?? s.layout?.elements ?? [];
export const isDirty = (s: FarmState) =>
  !!s.draft && !!s.draftBase && !sameElements(s.draft, s.draftBase.elements);
export const canEdit = (s: FarmState) =>
  !!s.layout?.canEdit && (s.overview ? s.overview.canEditLayout : true);

export function farmReducer(state: FarmState, action: FarmAction): FarmState {
  // Respostas de outra propriedade/organização são descartadas.
  if ("key" in action && action.type !== "load" && action.key !== state.key)
    return state;
  const editing = state.mode === "edit" && state.draft;
  switch (action.type) {
    case "load":
      return action.key === state.key && state.status !== "error"
        ? { ...state, status: state.layout ? "ready" : "loading", error: "" }
        : initialFarmState(action.key);
    case "loaded": {
      const consistent =
        !!action.overview && action.overview.layoutVersion === action.layout.version;
      const selected =
        state.selectedId &&
        workingElements({ ...state, layout: action.layout }).some(
          (e) => e.id === state.selectedId,
        )
          ? state.selectedId
          : null;
      return {
        ...state,
        status: "ready",
        error: "",
        layout: action.layout,
        overview: action.overview,
        overviewStale: !consistent,
        selectedId: selected,
        mode: action.layout.canEdit ? state.mode : "explore",
        draft: action.layout.canEdit ? state.draft : null,
        draftBase: action.layout.canEdit ? state.draftBase : null,
      };
    }
    case "overview":
      if (!state.layout) return state;
      return {
        ...state,
        overview: action.overview,
        overviewStale: action.overview.layoutVersion !== state.layout.version,
      };
    case "failed":
      return state.layout
        ? { ...state, status: "ready", overviewStale: true, error: action.message }
        : { ...state, status: "error", error: action.message };
    case "select":
      return {
        ...state,
        selectedId:
          action.id && workingElements(state).some((e) => e.id === action.id)
            ? action.id
            : null,
      };
    case "edit":
      if (!state.layout || !canEdit(state) || state.mode === "edit") return state;
      return {
        ...state,
        mode: "edit",
        draft: state.layout.elements.map((e) => ({ ...e })),
        draftBase: { version: state.layout.version, elements: state.layout.elements },
        save: { kind: "idle" },
      };
    case "add":
      if (!editing || state.draft!.length >= MAX_ELEMENTS) return state;
      return {
        ...state,
        draft: [...state.draft!, action.element],
        selectedId: action.element.id,
      };
    case "move":
      if (!editing) return state;
      return {
        ...state,
        draft: state.draft!.map((e) =>
          e.id === action.id ? { ...e, position: clampDrag(action.position) } : e,
        ),
      };
    case "update":
      if (!editing) return state;
      return {
        ...state,
        draft: state.draft!.map((e) =>
          e.id === action.id ? { ...e, ...action.patch, id: e.id } : e,
        ),
      };
    case "remove":
      if (!editing) return state;
      return {
        ...state,
        draft: state.draft!.filter((e) => e.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    case "discard":
      return {
        ...state,
        mode: "explore",
        draft: null,
        draftBase: null,
        save: { kind: "idle" },
        selectedId:
          state.selectedId &&
          state.layout?.elements.some((e) => e.id === state.selectedId)
            ? state.selectedId
            : null,
      };
    case "saving":
      return { ...state, save: { kind: "saving" } };
    case "checking":
      return { ...state, save: { kind: "checking" } };
    case "saved":
      // Layout local só é substituído após confirmação da API.
      return {
        ...state,
        layout: action.layout,
        overviewStale: true,
        mode: "explore",
        draft: null,
        draftBase: null,
        save: { kind: "idle" },
        selectedId:
          state.selectedId &&
          action.layout.elements.some((e) => e.id === state.selectedId)
            ? state.selectedId
            : null,
      };
    case "save_failed":
      return { ...state, save: { kind: "error", message: action.message } };
    case "conflict":
      // O rascunho permanece intacto; nada é sobrescrito automaticamente.
      return {
        ...state,
        save: { kind: "conflict", remote: action.remote, message: action.message },
      };
    case "rebase":
      // Escolha explícita do produtor: reaplicar suas alterações sobre a
      // versão atual. Nada é gravado até um novo "Salvar".
      if (!state.draft || !state.draftBase) return state;
      return {
        ...state,
        layout: action.remote,
        overviewStale: true,
        draft: mergeDraft(state.draftBase.elements, state.draft, action.remote.elements),
        draftBase: { version: action.remote.version, elements: action.remote.elements },
        save: { kind: "idle" },
      };
  }
}

// ---------- Integração HTTP (proxy /api/agro) ----------
type Envelope<T> = { data: T };
const base = (propertyId: string) =>
  "/api/agro/properties/" + encodeURIComponent(propertyId);
export type Fetcher = typeof request;

export async function fetchLayout(
  propertyId: string,
  signal?: AbortSignal,
  http: Fetcher = request,
) {
  return (await http<Envelope<FarmLayout>>(base(propertyId) + "/farm-layout", {}, signal))
    .data;
}
export async function fetchOverview(
  propertyId: string,
  offset = 0,
  signal?: AbortSignal,
  http: Fetcher = request,
) {
  return (
    await http<Envelope<FarmOverview>>(
      base(propertyId) + "/farm-overview?limit=20&offset=" + offset,
      {},
      signal,
    )
  ).data;
}
// Busca layout e overview e confere `layoutVersion` × `version`. Em divergência,
// repete a leitura algumas vezes; persistindo, devolve o overview marcado como
// desatualizado para que a interface não misture versões.
export async function loadFarm(
  propertyId: string,
  signal?: AbortSignal,
  http: Fetcher = request,
  offset = 0,
) {
  let last: { layout: FarmLayout; overview: FarmOverview | null } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const [layout, overview] = await Promise.all([
      fetchLayout(propertyId, signal, http),
      fetchOverview(propertyId, offset, signal, http).catch((error) => {
        if (error instanceof RequestError && [401, 403, 404].includes(error.status))
          throw error;
        return null;
      }),
    ]);
    if (layout.propertyId !== propertyId)
      throw new Error("Resposta não corresponde à propriedade selecionada.");
    last = { layout, overview };
    if (!overview || overview.layoutVersion === layout.version) return last;
  }
  return last!;
}
export async function putLayout(
  propertyId: string,
  version: number,
  elements: FarmElement[],
  http: Fetcher = request,
) {
  return (
    await http<Envelope<FarmLayout>>(base(propertyId) + "/farm-layout", {
      method: "PUT",
      body: JSON.stringify(payload(version, elements)),
    })
  ).data;
}
export type SaveOutcome =
  | { kind: "saved"; layout: FarmLayout }
  | { kind: "conflict"; remote: FarmLayout | null; message: string }
  | { kind: "error"; message: string };
const uncertain = (error: unknown) =>
  !(error instanceof RequestError) || error.status >= 500;
// Salva o rascunho inteiro. 409 nunca sobrescreve; falha incerta consulta o
// layout antes de qualquer nova tentativa, pois a gravação pode ter ocorrido.
export async function saveFarm(
  propertyId: string,
  baseVersion: number,
  draft: FarmElement[],
  http: Fetcher = request,
  onChecking?: () => void,
): Promise<SaveOutcome> {
  try {
    return { kind: "saved", layout: await putLayout(propertyId, baseVersion, draft, http) };
  } catch (error) {
    if (error instanceof RequestError && error.status === 409) {
      const remote = await fetchLayout(propertyId, undefined, http).catch(() => null);
      return {
        kind: "conflict",
        remote,
        message: "Sua fazenda foi alterada em outra sessão.",
      };
    }
    if (!uncertain(error))
      return {
        kind: "error",
        message:
          error instanceof Error ? error.message : "Não foi possível salvar.",
      };
    onChecking?.();
    let remote: FarmLayout;
    try {
      remote = await fetchLayout(propertyId, undefined, http);
    } catch {
      return {
        kind: "error",
        message:
          "Não conseguimos confirmar se a fazenda foi salva. Suas alterações continuam aqui; verifique a conexão e tente novamente.",
      };
    }
    const result = resolveUncertainSave(draft, baseVersion, remote);
    if (result === "applied") return { kind: "saved", layout: remote };
    if (result === "conflict")
      return {
        kind: "conflict",
        remote,
        message: "A fazenda mudou enquanto salvávamos.",
      };
    return {
      kind: "error",
      message: "A conexão falhou e nada foi salvo. Suas alterações continuam aqui.",
    };
  }
}

// ---------- Leitura operacional ----------
export const activeOffer = (offer: OfferSummary | null, now = new Date()) =>
  !!offer && offer.status === "PUBLICADA" && new Date(offer.availableUntil) > now;
export const pendingOrders = (p: FarmProduction) =>
  p.orderStates
    .filter((o) => o.status === "SOLICITADO" || o.status === "ACEITO")
    .reduce((n, o) => n + o.count, 0);
// Soma dentro de um único setor: cada produção aparece uma vez na lista dele.
export const sectorRegisteredKg = (ops: ElementOperations | null) =>
  ops ? ops.productions.reduce((n, p) => n + p.registeredQuantityKg, 0) : 0;

// ---------- Ligações e atividade (derivadas, nunca inventadas) ----------
export type SectorLink = { a: string; b: string; shared: number };
// Setores ligados quando compartilham ao menos uma produção (mesmo lote visto
// em lugares diferentes, ex.: horta → armazém → coleta).
export function sectorLinks(elements: FarmElement[]): SectorLink[] {
  const links: SectorLink[] = [];
  for (let i = 0; i < elements.length; i++)
    for (let j = i + 1; j < elements.length; j++) {
      const b = new Set(elements[j].productionIds);
      const shared = elements[i].productionIds.filter((id) => b.has(id)).length;
      if (shared) links.push({ a: elements[i].id, b: elements[j].id, shared });
    }
  return links;
}
export type ActivityItem = {
  id: string;
  type: string;
  recordedAt: string;
  cropName: string;
  lotId: string;
  sectorIds: string[];
};
// Eventos recentes confirmados pela API, sem duplicar o mesmo evento.
export function activityFeed(
  sectors: { id: string; operations: ElementOperations | null }[],
  limit = 6,
): ActivityItem[] {
  const map = new Map<string, ActivityItem>();
  for (const s of sectors)
    for (const p of s.operations?.productions ?? [])
      for (const e of p.lot.recentEvents) {
        const item = map.get(e.id) ?? {
          id: e.id,
          type: e.type,
          recordedAt: e.recordedAt,
          cropName: p.cropName,
          lotId: p.lot.id,
          sectorIds: [],
        };
        if (!item.sectorIds.includes(s.id)) item.sectorIds.push(s.id);
        map.set(e.id, item);
      }
  return [...map.values()]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
export function stateCounts(sectors: { operations: ElementOperations | null }[]) {
  const counts = { ACTION_PENDING: 0, HAS_LOTS: 0, NO_LINKED_PRODUCTIONS: 0, UNKNOWN: 0 };
  for (const s of sectors) counts[s.operations?.state ?? "UNKNOWN"]++;
  return counts;
}
