import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestError } from "../src/lib/client-api";
import { allowedProxyPath } from "../src/lib/security";
import {
  MAX_ELEMENTS,
  canEdit,
  clampDrag,
  defaultName,
  diffElements,
  farmReducer,
  freeSpot,
  fromScreen,
  initialFarmState,
  isDirty,
  linkProduction,
  loadFarm,
  mergeDraft,
  newId,
  payloadBytes,
  reconcile,
  saveFarm,
  toScreen,
  validateDraft,
  type FarmElement,
  type FarmLayout,
  type FarmOverview,
  type FarmState,
  type Fetcher,
} from "../src/lib/farm";
import { FarmScene } from "../src/components/farm/farm-scene";

const PROP = "11111111-1111-4111-8111-111111111111";
const OTHER_PROP = "22222222-2222-4222-8222-222222222222";
const CROP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CROP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROD_A = "33333333-3333-4333-8333-333333333333";
const PROD_B = "44444444-4444-4444-8444-444444444444";
const catalog = {
  crops: [
    { id: CROP_A, name: "Alface" },
    { id: CROP_B, name: "Tomate" },
  ],
  productions: [
    { id: PROD_A, cropId: CROP_A },
    { id: PROD_B, cropId: CROP_B },
  ],
};
const el = (over: Partial<FarmElement> = {}): FarmElement => ({
  id: newId(),
  name: "Horta Norte",
  type: "VEGETABLE_GARDEN",
  position: { x: 0.3, y: 0.4 },
  productionIds: [],
  cropIds: [],
  ...over,
});
const layoutOf = (version: number, elements: FarmElement[], canEditLayout = true): FarmLayout => ({
  propertyId: PROP,
  schemaVersion: 1,
  version,
  state: version === 0 ? "UNCONFIGURED" : elements.length ? "CONFIGURED" : "EMPTY",
  spatialReference: "ILLUSTRATIVE_NORMALIZED",
  isGeoreferenced: false,
  elements,
  updatedAt: version ? "2026-11-10T12:00:00.000Z" : null,
  canEdit: canEditLayout,
});
const production = (id: string, cropId: string, orders: { status: string; count: number }[] = []) => ({
  id,
  cropId,
  cropName: cropId === CROP_A ? "Alface" : "Tomate",
  seasonLabel: "2026/2",
  harvestedOn: "2026-11-01",
  registeredQuantityKg: 10,
  lot: { id: id.replace(/^3|^4/, "6"), status: "IDENTIFICADO", recentEvents: [] },
  offer: null,
  orderStates: orders.map((o) => ({ ...o, quantityKg: 2 })),
  recentOrders: [],
  actions: {
    viewProduction: true,
    viewLot: true,
    viewOrders: true,
    createOffer: true,
    publishOffer: false,
    acceptOrders: false,
    pickupOrders: false,
  },
});
function overviewOf(layout: FarmLayout, canEditLayout = layout.canEdit): FarmOverview {
  const all = [production(PROD_A, CROP_A, [{ status: "SOLICITADO", count: 1 }]), production(PROD_B, CROP_B)];
  return {
    property: { id: PROP, name: "Sítio Boa Vista" },
    layoutVersion: layout.version,
    layoutState: layout.state,
    isGeoreferenced: false,
    summary: { productionCount: 2, registeredQuantityKg: 20, crops: [], cropsTruncated: false },
    productions: all,
    pagination: { limit: 20, offset: 0, total: 2 },
    elements: layout.elements.map((e) => {
      const rows = all.filter((p) => e.productionIds.includes(p.id));
      return {
        id: e.id,
        scope: "LINKED_PRODUCTIONS" as const,
        productionCount: rows.length,
        missingProductionIds: e.productionIds.filter((id) => !all.some((p) => p.id === id)),
        state: rows.some((p) => p.orderStates.length)
          ? ("ACTION_PENDING" as const)
          : rows.length
            ? ("HAS_LOTS" as const)
            : ("NO_LINKED_PRODUCTIONS" as const),
        productions: rows,
      };
    }),
    canEditLayout,
    isDemonstration: true,
    fetchedAt: "2026-11-10T12:00:00.000Z",
  };
}

// Servidor em memória que reproduz o contrato: versão otimista, 409, isolamento
// por organização e propriedade, e falhas de rede configuráveis.
function fakeServer(opts: { org?: string; role?: string } = {}) {
  const store = new Map<string, { org: string; version: number; elements: FarmElement[] }>();
  const owners = new Map([
    [PROP, "org-1"],
    [OTHER_PROP, "org-2"],
  ]);
  const ctx = { org: opts.org ?? "org-1", role: opts.role ?? "EDITOR" };
  const calls: string[] = [];
  let failNextPut: "network-before" | "network-after" | null = null;
  let failGet = false;
  let overviewLag = 0;
  const editable = () => ["ADMIN", "EDITOR"].includes(ctx.role);
  const layoutFor = (id: string) => {
    const doc = store.get(id);
    return { ...layoutOf(doc?.version ?? 0, doc?.elements ?? [], editable()), propertyId: id };
  };
  const http = (async (url: string, options: RequestInit = {}) => {
    const method = options.method ?? "GET";
    calls.push(method + " " + url);
    const match = url.match(/^\/api\/agro\/properties\/([^/]+)\/(farm-layout|farm-overview)/);
    if (!match) throw new RequestError(404, "Operação não disponível");
    const [, id, route] = match;
    if (owners.get(id) !== ctx.org) throw new RequestError(404, "Propriedade não encontrada.", "NOT_FOUND");
    if (method === "GET" && failGet) throw new TypeError("Failed to fetch");
    if (route === "farm-overview") {
      const layout = layoutFor(id);
      const ov = overviewOf(layout);
      if (overviewLag > 0) {
        overviewLag--;
        return { data: { ...ov, layoutVersion: layout.version - 1 } };
      }
      return { data: ov };
    }
    if (method === "GET") return { data: layoutFor(id) };
    if (!editable()) throw new RequestError(403, "Sem permissão.", "FORBIDDEN");
    if (failNextPut === "network-before") {
      failNextPut = null;
      throw new TypeError("Failed to fetch");
    }
    const body = JSON.parse(String(options.body)) as { version: number; elements: FarmElement[] };
    const current = store.get(id)?.version ?? 0;
    if (body.version !== current)
      throw new RequestError(409, "Configuração alterada.", "LAYOUT_VERSION_CONFLICT");
    store.set(id, { org: ctx.org, version: current + 1, elements: body.elements });
    if (failNextPut === "network-after") {
      failNextPut = null;
      throw new TypeError("Failed to fetch");
    }
    return { data: layoutFor(id) };
  }) as Fetcher;
  return {
    http,
    calls,
    store,
    ctx,
    failPut: (k: typeof failNextPut) => (failNextPut = k),
    failGets: (v: boolean) => (failGet = v),
    lagOverview: (n: number) => (overviewLag = n),
  };
}
const KEY = "org-1:" + PROP;
function ready(layout: FarmLayout, overview: FarmOverview | null = overviewOf(layout)): FarmState {
  return farmReducer(initialFarmState(KEY), { type: "loaded", key: KEY, layout, overview });
}
const render = (props: Partial<Parameters<typeof FarmScene>[0]>) =>
  renderToStaticMarkup(
    createElement(FarmScene, {
      sectors: [],
      mode: "explore",
      selectedId: null,
      cropName: (id: string) => catalog.crops.find((c) => c.id === id)?.name,
      onSelect: () => {},
      ...props,
    }),
  );

// ---------- Estados iniciais ----------
test("UNCONFIGURED não desenha setores fictícios e só libera construção a quem edita", () => {
  const s = ready(layoutOf(0, []));
  assert.equal(s.layout!.state, "UNCONFIGURED");
  assert.deepEqual(reconcile(s.layout!.elements, 0, s.overview), []);
  const html = render({ sectors: [] });
  assert.equal((html.match(/class="fz-sector/g) ?? []).length, 0);
  assert.match(html, /Organização espacial ilustrativa, não georreferenciada/);
  const editing = farmReducer(s, { type: "edit" });
  assert.equal(editing.mode, "edit");
  assert.deepEqual(editing.draft, []);
  assert.equal(editing.draftBase!.version, 0);
  const reader = ready(layoutOf(0, [], false));
  assert.equal(farmReducer(reader, { type: "edit" }).mode, "explore");
});
test("EMPTY permite recomeçar e salvar a partir da versão existente", async () => {
  const server = fakeServer();
  server.store.set(PROP, { org: "org-1", version: 3, elements: [] });
  const { layout } = await loadFarm(PROP, undefined, server.http);
  assert.equal(layout.state, "EMPTY");
  let s = farmReducer(ready(layout), { type: "edit" });
  s = farmReducer(s, { type: "add", element: el() });
  const out = await saveFarm(PROP, s.draftBase!.version, s.draft!, server.http);
  assert.equal(out.kind, "saved");
  assert.equal(out.kind === "saved" && out.layout.version, 4);
});

// ---------- Renderização personalizada ----------
test("cena desenha cada setor pelo UUID, tipo, nome, posição e estado operacional", () => {
  const horta = el({ name: "Horta da Dona Rosa", productionIds: [PROD_A], cropIds: [CROP_A] });
  const galpao = el({ name: "Galpão", type: "STORAGE", position: { x: 0.8, y: 0.7 }, productionIds: [PROD_B] });
  const pomar = el({ name: "Pomar", type: "ORCHARD", position: { x: 0.1, y: 0.1 } });
  const layout = layoutOf(2, [horta, galpao, pomar]);
  const sectors = reconcile(layout.elements, 2, overviewOf(layout));
  const html = render({ sectors, selectedId: galpao.id });
  for (const e of [horta, galpao, pomar]) {
    const p = toScreen(e.position);
    assert.match(html, new RegExp(`translate\\(${p.x.toFixed(1)} ${p.y.toFixed(1)}\\)`));
    assert.match(html, new RegExp(`data-id="${e.id}" data-type="${e.type}"`));
  }
  assert.match(html, /data-id="[^"]+" data-type="VEGETABLE_GARDEN" data-state="ACTION_PENDING"/);
  assert.match(html, /data-type="STORAGE" data-state="HAS_LOTS"/);
  assert.match(html, /data-type="ORCHARD" data-state="NO_LINKED_PRODUCTIONS"/);
  assert.match(html, /aria-label="Horta da Dona Rosa\. Horta\. Pedido aguardando ação\. Culturas: Alface"/);
  assert.match(html, /aria-pressed="true"[^>]*aria-label="Galpão/);
  // Ordem de profundidade: o pomar (fundo) vem antes do galpão (frente).
  assert.ok(html.indexOf(pomar.id) < html.indexOf(horta.id));
  assert.ok(html.indexOf(horta.id) < html.indexOf(galpao.id));
  // Modo construção exibe grade da área utilizável.
  assert.match(render({ sectors, mode: "edit", onMove: () => {} }), /stroke-dasharray="6 6"/);
});
test("overview de outra versão não é combinado ao layout", () => {
  const e = el({ productionIds: [PROD_A] });
  const layout = layoutOf(5, [e]);
  const old = { ...overviewOf(layout), layoutVersion: 4 };
  assert.equal(reconcile(layout.elements, 5, old)[0].operations, null);
  const s = ready(layout, old);
  assert.equal(s.overviewStale, true);
  assert.equal(farmReducer(s, { type: "overview", key: KEY, overview: overviewOf(layout) }).overviewStale, false);
});

// ---------- Seleção ----------
test("seleção aceita apenas setores existentes", () => {
  const e = el();
  const s = ready(layoutOf(1, [e]));
  assert.equal(farmReducer(s, { type: "select", id: e.id }).selectedId, e.id);
  assert.equal(farmReducer(s, { type: "select", id: newId() }).selectedId, null);
  assert.equal(farmReducer(farmReducer(s, { type: "select", id: e.id }), { type: "select", id: null }).selectedId, null);
});

// ---------- Criação, edição e reposicionamento ----------
test("criação gera UUID v4, nome único e posição livre, respeitando 20 setores", () => {
  const id = newId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const first = el({ name: "Horta" });
  assert.equal(defaultName("VEGETABLE_GARDEN", [first]), "Horta 2");
  const spot = freeSpot([first, el({ position: { x: 0.5, y: 0.5 } })]);
  assert.ok(Math.hypot(spot.x - 0.5, spot.y - 0.5) >= 0.16);
  let s = farmReducer(ready(layoutOf(0, [])), { type: "edit" });
  for (let i = 0; i < MAX_ELEMENTS + 2; i++) s = farmReducer(s, { type: "add", element: el({ name: "S" + i }) });
  assert.equal(s.draft!.length, MAX_ELEMENTS);
  assert.equal(s.selectedId, s.draft![MAX_ELEMENTS - 1].id);
});
test("mover e renomear preservam o UUID e mantêm coordenadas normalizadas", () => {
  const e = el();
  let s = farmReducer(ready(layoutOf(1, [e])), { type: "edit" });
  s = farmReducer(s, { type: "move", id: e.id, position: { x: 1.7, y: -0.4 } });
  s = farmReducer(s, { type: "update", id: e.id, patch: { name: "Horta Sul", type: "ORCHARD" } });
  const moved = s.draft![0];
  assert.equal(moved.id, e.id);
  assert.equal(moved.name, "Horta Sul");
  assert.equal(moved.type, "ORCHARD");
  assert.ok(moved.position.x <= 1 && moved.position.y >= 0);
  assert.equal(isDirty(s), true);
  assert.deepEqual(s.layout!.elements[0], e, "layout salvo intacto até confirmação");
  // Projeção isométrica é inversível (arraste converte ponteiro → x/y).
  const p = { x: 0.37, y: 0.81 };
  const back = fromScreen(toScreen(p).x, toScreen(p).y);
  assert.ok(Math.abs(back.x - p.x) < 1e-9 && Math.abs(back.y - p.y) < 1e-9);
  assert.deepEqual(clampDrag({ x: 0, y: 1 }), { x: 0.06, y: 0.94 });
});
test("remover tira o setor apenas da representação e descartar restaura o salvo", () => {
  const a = el(),
    b = el({ name: "Galpão", type: "STORAGE", productionIds: [PROD_A] });
  let s = farmReducer(ready(layoutOf(1, [a, b])), { type: "edit" });
  s = farmReducer(farmReducer(s, { type: "select", id: b.id }), { type: "remove", id: b.id });
  assert.deepEqual(s.draft!.map((e) => e.id), [a.id]);
  assert.equal(s.selectedId, null);
  assert.deepEqual(diffElements(s.draftBase!.elements, s.draft!).removed, ["Galpão"]);
  s = farmReducer(s, { type: "discard" });
  assert.equal(s.mode, "explore");
  assert.equal(s.layout!.elements.length, 2);
});

// ---------- Vínculos ----------
test("vincular produção inclui a cultura quando o setor restringe culturas", () => {
  const e = el({ cropIds: [CROP_A] });
  const linked = linkProduction(e, catalog.productions[1]);
  assert.deepEqual(linked.productionIds, [PROD_B]);
  assert.deepEqual(linked.cropIds, [CROP_A, CROP_B]);
  const free = linkProduction(el(), catalog.productions[1]);
  assert.deepEqual(free.cropIds, [], "lista vazia aceita qualquer cultura");
  assert.equal(linkProduction(linked, catalog.productions[1]), linked);
});
test("validação antecipa regras da API: cultura incompatível, limites e payload", () => {
  const incompatible = el({ cropIds: [CROP_A], productionIds: [PROD_B] });
  assert.match(validateDraft([incompatible], 1, catalog)[0].message, /cultura de uma produção/);
  const many = el({ productionIds: Array.from({ length: 11 }, newId) });
  assert.ok(validateDraft([many], 1).some((i) => /até 10 produções/.test(i.message)));
  assert.ok(validateDraft([el({ name: "   " })], 1).some((i) => /nome/.test(i.message)));
  const heavy = Array.from({ length: 20 }, () =>
    el({ name: "x".repeat(80), productionIds: Array.from({ length: 10 }, newId), cropIds: Array.from({ length: 10 }, newId) }),
  );
  assert.ok(payloadBytes(1, heavy) > 16384);
  assert.ok(validateDraft(heavy, 1).some((i) => /grande demais/.test(i.message)));
  assert.deepEqual(validateDraft([el({ cropIds: [CROP_A], productionIds: [PROD_A] })], 1, catalog), []);
});

// ---------- Persistência e integração ----------
test("salvar e recarregar devolve exatamente a configuração confirmada", async () => {
  const server = fakeServer();
  let s = ready((await loadFarm(PROP, undefined, server.http)).layout);
  s = farmReducer(s, { type: "edit" });
  const horta = el({ name: "  Horta Norte  ", productionIds: [PROD_A], cropIds: [CROP_A] });
  s = farmReducer(s, { type: "add", element: horta });
  const out = await saveFarm(PROP, s.draftBase!.version, s.draft!, server.http);
  assert.equal(out.kind, "saved");
  if (out.kind !== "saved") return;
  s = farmReducer(s, { type: "saved", key: KEY, layout: out.layout });
  assert.equal(s.mode, "explore");
  assert.equal(s.layout!.version, 1);
  const again = await loadFarm(PROP, undefined, server.http);
  assert.equal(again.layout.state, "CONFIGURED");
  assert.deepEqual(again.layout.elements[0], { ...horta, name: "Horta Norte" });
  assert.equal(again.overview!.layoutVersion, again.layout.version);
  assert.ok(server.calls.includes("PUT /api/agro/properties/" + PROP + "/farm-layout"));
});
test("overview defasado é relido antes de combinar; persistindo, fica marcado", async () => {
  const server = fakeServer();
  server.store.set(PROP, { org: "org-1", version: 2, elements: [el()] });
  server.lagOverview(1);
  const ok = await loadFarm(PROP, undefined, server.http);
  assert.equal(ok.overview!.layoutVersion, 2);
  server.lagOverview(5);
  const stale = await loadFarm(PROP, undefined, server.http);
  assert.equal(ready(stale.layout, stale.overview).overviewStale, true);
});

// ---------- Troca de propriedade e isolamento ----------
test("respostas da propriedade anterior são descartadas após a troca", () => {
  const s = ready(layoutOf(1, [el()]));
  const switched = farmReducer(s, { type: "load", key: "org-1:" + OTHER_PROP });
  assert.equal(switched.layout, null);
  assert.equal(switched.status, "loading");
  const late = farmReducer(switched, { type: "loaded", key: KEY, layout: layoutOf(1, [el()]), overview: null });
  assert.equal(late, switched, "resposta antiga ignorada");
  const lateSave = farmReducer(switched, { type: "saved", key: KEY, layout: layoutOf(2, []) });
  assert.equal(lateSave, switched);
});
test("outra organização não lê nem grava a fazenda e não há fallback", async () => {
  const intruder = fakeServer({ org: "org-2" });
  await assert.rejects(loadFarm(PROP, undefined, intruder.http), (e: unknown) => e instanceof RequestError && e.status === 404);
  const out = await saveFarm(PROP, 0, [el()], intruder.http);
  assert.equal(out.kind, "error");
  assert.equal(intruder.store.size, 0);
  const mismatch = (async () => ({ data: { ...layoutOf(0, []), propertyId: OTHER_PROP } })) as unknown as Fetcher;
  await assert.rejects(loadFarm(PROP, undefined, mismatch), /não corresponde/);
});

// ---------- LEITOR ----------
test("LEITOR explora, vê estados, mas não entra em edição nem salva", async () => {
  const server = fakeServer({ role: "LEITOR" });
  server.store.set(PROP, { org: "org-1", version: 1, elements: [el({ productionIds: [PROD_A] })] });
  const { layout, overview } = await loadFarm(PROP, undefined, server.http);
  const s = ready(layout, overview);
  assert.equal(canEdit(s), false);
  assert.equal(farmReducer(s, { type: "edit" }), s);
  assert.equal(reconcile(layout.elements, layout.version, overview)[0].operations!.state, "ACTION_PENDING");
  const out = await saveFarm(PROP, 1, layout.elements, server.http);
  assert.equal(out.kind, "error");
  // Permissão revogada durante a edição encerra o rascunho.
  const editing = farmReducer(ready(layoutOf(1, [])), { type: "edit" });
  const revoked = farmReducer(editing, { type: "loaded", key: KEY, layout: layoutOf(1, [], false), overview: null });
  assert.equal(revoked.mode, "explore");
  assert.equal(revoked.draft, null);
});

// ---------- Concorrência ----------
test("HTTP 409 preserva o rascunho e só junta versões por escolha explícita", async () => {
  const server = fakeServer();
  const shared = el({ name: "Horta" });
  server.store.set(PROP, { org: "org-1", version: 1, elements: [shared] });
  let s = ready((await loadFarm(PROP, undefined, server.http)).layout);
  s = farmReducer(s, { type: "edit" });
  const mine = el({ name: "Galpão", type: "STORAGE" });
  s = farmReducer(s, { type: "add", element: mine });
  s = farmReducer(s, { type: "move", id: shared.id, position: { x: 0.7, y: 0.7 } });
  // Outra sessão salva antes, adicionando um pomar.
  const theirs = el({ name: "Pomar", type: "ORCHARD" });
  server.store.set(PROP, { org: "org-1", version: 2, elements: [shared, theirs] });
  const draftBefore = s.draft;
  const out = await saveFarm(PROP, s.draftBase!.version, s.draft!, server.http);
  assert.equal(out.kind, "conflict");
  if (out.kind !== "conflict") return;
  s = farmReducer(s, { type: "conflict", key: KEY, remote: out.remote, message: out.message });
  assert.equal(s.draft, draftBefore, "rascunho intacto");
  assert.equal(server.store.get(PROP)!.version, 2, "nada sobrescrito");
  assert.equal(s.layout!.version, 1);
  s = farmReducer(s, { type: "rebase", key: KEY, remote: out.remote! });
  assert.deepEqual(new Set(s.draft!.map((e) => e.name)), new Set(["Horta", "Galpão", "Pomar"]));
  assert.deepEqual(s.draft!.find((e) => e.id === shared.id)!.position, { x: 0.7, y: 0.7 });
  assert.equal(s.draftBase!.version, 2);
  const retry = await saveFarm(PROP, s.draftBase!.version, s.draft!, server.http);
  assert.equal(retry.kind, "saved");
  // Descartar também é explícito.
  const discarded = farmReducer(farmReducer(ready(layoutOf(1, [])), { type: "edit" }), { type: "discard" });
  assert.equal(discarded.draft, null);
});
test("mergeDraft respeita remoções locais e mudanças só remotas", () => {
  const a = el({ name: "A" }),
    b = el({ name: "B" }),
    c = el({ name: "C" });
  const remote = [{ ...a, name: "A remoto" }, b, c];
  const merged = mergeDraft([a, b], [a], remote);
  assert.deepEqual(merged.map((e) => e.name), ["A remoto", "C"]);
});

// ---------- Rede ----------
test("falha de rede após PUT consulta o layout antes de nova tentativa", async () => {
  const server = fakeServer();
  const draft = [el({ name: "Horta" })];
  server.failPut("network-after");
  const applied = await saveFarm(PROP, 0, draft, server.http);
  assert.equal(applied.kind, "saved", "gravação confirmada no banco é reconhecida");
  assert.equal(server.calls.filter((c) => c.startsWith("PUT")).length, 1, "sem PUT duplicado");
  server.failPut("network-before");
  const notApplied = await saveFarm(PROP, 1, [...draft, el({ name: "Pomar" })], server.http);
  assert.equal(notApplied.kind, "error");
  assert.match(notApplied.kind === "error" ? notApplied.message : "", /nada foi salvo/);
  server.failPut("network-before");
  server.failGets(true);
  const unknown = await saveFarm(PROP, 1, draft, server.http);
  assert.match(unknown.kind === "error" ? unknown.message : "", /Não conseguimos confirmar/);
  // O reducer mantém o rascunho em erro.
  let s = farmReducer(ready(layoutOf(1, draft)), { type: "edit" });
  s = farmReducer(s, { type: "add", element: el() });
  const kept = s.draft;
  s = farmReducer(s, { type: "save_failed", key: KEY, message: "x" });
  assert.equal(s.draft, kept);
  assert.equal(s.save.kind, "error");
});
test("erros de carregamento: overview indisponível degrada; 401/403/404 não usam fallback", async () => {
  const server = fakeServer();
  const flaky = (async (url: string, o?: RequestInit, sig?: AbortSignal) => {
    if (url.includes("farm-overview")) throw new RequestError(500, "Falha");
    return server.http(url, o, sig);
  }) as Fetcher;
  const partial = await loadFarm(PROP, undefined, flaky);
  assert.equal(partial.overview, null);
  const denied = (async () => {
    throw new RequestError(403, "Sem acesso");
  }) as unknown as Fetcher;
  await assert.rejects(loadFarm(PROP, undefined, denied), (e: unknown) => (e as RequestError).status === 403);
  const failed = farmReducer(initialFarmState(KEY), { type: "failed", key: KEY, message: "Sem conexão" });
  assert.equal(failed.status, "error");
  const keeps = farmReducer(ready(layoutOf(1, [el()])), { type: "failed", key: KEY, message: "Sem conexão" });
  assert.equal(keeps.status, "ready");
  assert.equal(keeps.layout!.elements.length, 1);
});

// ---------- Compatibilidade com o portal ----------
test("proxy libera somente as rotas de Minha Fazenda e PUT apenas no layout", () => {
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-layout", "GET"), true);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-overview", "GET"), true);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-layout", "PUT"), true);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-overview", "PUT"), false);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-layout", "POST"), false);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/farm-layout", "DELETE"), false);
  assert.equal(allowedProxyPath("/properties/nao-uuid/farm-layout", "PUT"), false);
  assert.equal(allowedProxyPath("/productions", "PUT"), false);
  assert.equal(allowedProxyPath("/properties/" + PROP + "/weather", "GET"), true);
});
