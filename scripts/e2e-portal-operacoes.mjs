// E2E das operações de cooperativa e instituição pelo portal Next.js real,
// com API real e MongoDB descartável (MongoMemoryReplSet). Nunca usa o banco
// local existente, .env, seed ou tokens de .data/demo-sessions*.json.
// Pré-requisito: `npm run build` em apps/portal. Uso: node scripts/e2e-portal-operacoes.mjs
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { chromium } from "playwright-core";
import { createApp } from "../services/api/src/app.mjs";
import { connectDatabase } from "../services/api/src/database.mjs";
import { tokenHash } from "../services/api/src/auth.mjs";

const out = resolve("docs/design/publicos-web/operacoes");
await mkdir(out, { recursive: true });
const report = { mode: "BANCO_DESCARTAVEL_API_REAL", startedAt: new Date().toISOString(), checks: [], screenshots: [], animation: {} };
const pageErrors = [];
let mongo, connection, api, portal, browser, dbPath;
const ok = (name, detail) => { report.checks.push({ name, ok: true, ...(detail ? { detail } : {}) }); console.log("ok", name); };

try {
  dbPath = resolve(".data/portal-operacoes-" + randomUUID());
  await mkdir(dbPath, { recursive: true });
  mongo = await MongoMemoryReplSet.create({
    binary: { version: "8.0.16", downloadDir: resolve(".cache/mongodb-binaries") },
    instanceOpts: [{ dbPath }],
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  connection = await connectDatabase({ uri: mongo.getUri(), name: "portal_operacoes" });
  const db = connection.db;

  // ---------- Fixtures fictícias ----------
  const org = (name, type) => ({ _id: randomUUID(), name, type, status: "ATIVA", isDemonstration: true });
  const orgs = {
    producer: org("Sítio Teste", "PEQUENO_PRODUTOR_RURAL"),
    coop: org("Cooperativa Teste", "COOPERATIVA"),
    inst: org("Instituição Teste", "INSTITUICAO"),
    otherCoop: org("Outra Cooperativa", "COOPERATIVA"),
  };
  await db.collection("organizations").insertMany(Object.values(orgs));
  const people = {
    producer: [["producer", "ADMIN"]],
    coopEditor: [["coop", "EDITOR"]],
    coopReader: [["coop", "LEITOR"]],
    instEditor: [["inst", "EDITOR"]],
    instReader: [["inst", "LEITOR"]],
    multi: [["coop", "ADMIN"], ["inst", "ADMIN"]],
    otherCoop: [["otherCoop", "ADMIN"]],
  };
  const tokens = {};
  for (const [who, links] of Object.entries(people)) {
    const userId = randomUUID();
    tokens[who] = randomBytes(32).toString("base64url");
    await db.collection("users").insertOne({ _id: userId, displayName: "Pessoa fictícia " + who, status: "ATIVO", isDemonstration: true });
    for (const [o, role] of links)
      await db.collection("memberships").insertOne({ _id: randomUUID(), userId, organizationId: orgs[o]._id, role, status: "ATIVO" });
    await db.collection("demoTokens").insertOne({ userId, tokenHash: tokenHash(tokens[who]), expiresAt: new Date(Date.now() + 3600000) });
  }
  const property = randomUUID();
  await db.collection("properties").insertOne({ _id: property, organizationId: orgs.producer._id, name: "Sítio Teste", municipality: "Campinas", uf: "SP", status: "ATIVA" });
  const crops = ["Alface", "Tomate", "Couve"].map((name) => ({ _id: randomUUID(), name, status: "ATIVA" }));
  await db.collection("crops").insertMany(crops);

  api = createApp(db, { demoAuthEnabled: true, weather: async () => ({ status: "unavailable" }) }).listen(0, "127.0.0.1");
  await once(api, "listening");
  const apiBase = "http://127.0.0.1:" + api.address().port;
  const location = { location: { municipality: "Campinas", uf: "SP" }, locationConfirmed: true };
  async function as(who, orgKey, path, body) {
    const r = await fetch(apiBase + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + tokens[who], "X-Organization-Id": orgs[orgKey]._id, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const v = await r.json();
    assert.ok(r.ok, path + " " + JSON.stringify(v));
    return v.data ?? v;
  }
  const offers = {};
  for (const [i, [crop, kg, mode, price]] of [["Alface", 100, "DOACAO"], ["Tomate", 50, "VENDA", 450], ["Couve", 40, "DOACAO"]].entries()) {
    const p = await as("producer", "producer", "/productions", { propertyId: property, cropId: crops[i]._id, quantityKg: kg, seasonLabel: "Primavera 2026", harvestedOn: "2026-11-0" + (i + 1), ...location });
    const o = await as("producer", "producer", "/offers", { lotId: p.lot.id, quantityKg: kg, destinationMode: mode, ...(price ? { unitPriceCents: price } : {}), availableUntil: new Date(Date.now() + 5 * 86400000).toISOString() });
    await as("producer", "producer", "/offers/" + o.id + "/publish", location);
    offers[crop] = o;
  }

  // ---------- Portal (build de produção) ----------
  const port = Number(process.env.PORTAL_TEST_PORT ?? 3131);
  const base = "http://127.0.0.1:" + port;
  portal = spawn(process.execPath, [resolve("apps/portal/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: resolve("apps/portal"), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORTAL_DEMO_ENABLED: "true", AGRO_API_URL: apiBase, NEXT_TELEMETRY_DISABLED: "1" },
  });
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + "/api/session")).status) break; } catch {}
    if (i > 80) throw new Error("Portal não iniciou.");
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  async function open(who, { reducedMotion = "reduce", width = 1440 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(who + ": " + e.message));
    await page.goto(base + "/visao-geral");
    await page.getByLabel("Acesso temporário").fill(tokens[who]);
    await page.getByRole("button", { name: "Entrar no portal" }).click();
    await page.locator(".portal-frame").waitFor();
    return { context, page };
  }
  const shot = async (page, name, fullPage = true) => {
    await page.screenshot({ path: resolve(out, name + ".png"), fullPage });
    report.screenshots.push(name + ".png");
  };
  const fillLocation = async (page, { confirm = true } = {}) => {
    const sheet = page.locator(".cmd-sheet");
    await sheet.getByLabel("Município", { exact: true }).fill("Campinas");
    await sheet.getByLabel("UF", { exact: true }).selectOption("SP");
    if (confirm) await sheet.getByLabel(/Confirmo que o município/).check();
    return sheet;
  };
  const stat = (page, label) =>
    page.locator(".pb-stats > div").filter({ hasText: label }).locator("strong").innerText().then((t) => Number(t.replace(/\D+.*$/s, "")));
  const order = (filter) => db.collection("orders").findOne(filter, { sort: { createdAt: -1 } });
  const shortId = (id) => "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();

  // 1. Instituição EDITOR solicita (saldo validado na interface) e cancela.
  {
    const { context, page } = await open("instEditor");
    await page.getByRole("link", { name: "Ofertas disponíveis" }).first().click();
    const alface = page.locator(".pb-offers > li").filter({ hasText: "Alface" });
    await alface.waitFor();
    await shot(page, "instituicao-ofertas-1440");
    await alface.getByRole("button", { name: "Solicitar" }).click();
    const sheet = await fillLocation(page);
    await sheet.getByLabel("Quantidade (kg)").fill("150");
    await sheet.getByRole("button", { name: "Enviar solicitação" }).click();
    await sheet.getByText("não pode ultrapassar o saldo").waitFor();
    assert.equal(await db.collection("orders").countDocuments(), 0, "nada enviado acima do saldo");
    await sheet.getByLabel("Quantidade (kg)").fill("30");
    await shot(page, "instituicao-solicitar-formulario", false);
    await sheet.getByRole("button", { name: "Enviar solicitação" }).click();
    await page.getByText("Solicitação enviada ao produtor.").waitFor();
    const requested = await order({ offerId: offers.Alface.id });
    assert.equal(requested.status, "SOLICITADO");
    assert.equal(requested.quantityGrams, 30000);
    ok("instituição solicita oferta com quantidade ≤ saldo", { quantityKg: 30 });

    await page.locator(".pb-offers > li").filter({ hasText: "Tomate" }).getByRole("button", { name: "Solicitar" }).click();
    const s2 = await fillLocation(page);
    await s2.getByLabel("Quantidade (kg)").fill("10");
    await s2.getByRole("button", { name: "Enviar solicitação" }).click();
    await page.locator(".cmd-sheet").waitFor({ state: "detached" });
    const tomato = await order({ offerId: offers.Tomate.id });
    assert.ok(tomato, "segunda solicitação registrada");
    await page.getByRole("link", { name: "Solicitações", exact: true }).click();
    const row = page.locator(".pb-ops li").filter({ hasText: shortId(tomato._id) });
    await row.getByRole("button", { name: "Cancelar solicitação" }).click();
    await page.getByText("será cancelada. Esta ação não pode ser desfeita.").waitFor();
    await shot(page, "instituicao-cancelar-confirmacao", false);
    await fillLocation(page);
    await page.locator(".cmd-sheet").getByRole("button", { name: "Cancelar solicitação" }).click();
    await page.getByText("Solicitação cancelada.").waitFor();
    await row.getByText("Cancelado").waitFor();
    assert.equal((await order({ _id: tomato._id })).status, "CANCELADO");
    ok("instituição cancela solicitação com confirmação");
    await page.getByRole("link", { name: "Visão geral", exact: true }).click();
    await page.locator(".pb-home").waitFor();
    assert.equal(await stat(page, "Solicitações enviadas"), 2);
    assert.equal(await stat(page, "Aguardando aceite"), 1);
    await shot(page, "instituicao-home-apos-solicitar");
    await context.close();
  }

  // 2. Produtor aceita designando a cooperativa (API).
  const alfaceOrder = await order({ offerId: offers.Alface.id });
  await as("producer", "producer", "/orders/" + alfaceOrder._id + "/accept", { cooperativeOrganizationId: orgs.coop._id, ...location });

  // 3. Cooperativa EDITOR registra retirada; falha de rede repete a mesma chave.
  {
    const { context, page } = await open("coopEditor");
    await page.locator(".pb-home").waitFor();
    assert.equal(await stat(page, "Retiradas pendentes"), 1);
    await shot(page, "cooperativa-home-antes");
    await page.locator(".pb-priorities").getByRole("button", { name: "Registrar retirada" }).click();
    const sheet = await fillLocation(page, { confirm: false });
    await sheet.getByRole("button", { name: "Confirmar retirada" }).click();
    await sheet.getByText("Confirme que o local informado está correto.").waitFor();
    await sheet.getByLabel(/Confirmo que o município/).check();
    await shot(page, "cooperativa-retirada-formulario", false);
    const keys = [];
    let dropped = false;
    await page.route("**/api/agro/shipments/*/pickup", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (!dropped) { dropped = true; return route.abort("connectionreset"); }
      return route.continue();
    });
    await sheet.getByRole("button", { name: "Confirmar retirada" }).click();
    await sheet.getByText("a mesma tentativa será reenviada").waitFor();
    assert.equal((await order({ _id: alfaceOrder._id })).status, "ACEITO", "sem sucesso presumido");
    await sheet.getByRole("button", { name: "Confirmar retirada" }).click();
    await page.getByText("Retirada registrada.").waitFor();
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1], "mesma Idempotency-Key na nova tentativa");
    assert.equal((await order({ _id: alfaceOrder._id })).status, "RETIRADO");
    await page.waitForFunction(() => !document.querySelector(".pb-priorities [data-write-action]"));
    assert.equal(await stat(page, "Retiradas pendentes"), 0);
    assert.equal(await stat(page, "Aguardando destinatário"), 1);
    await shot(page, "cooperativa-home-apos-retirada");
    ok("cooperativa registra retirada; indicadores atualizados; chave estável após falha de rede", { tentativas: keys.length });
    await context.close();
  }

  // 4. Instituição confirma recebimento integral.
  {
    const { context, page } = await open("instEditor");
    await page.locator(".pb-priorities").getByRole("button", { name: "Confirmar recebimento" }).click();
    await page.getByText("recebimento integral de 30 kg").waitFor();
    await fillLocation(page);
    await page.locator(".cmd-sheet").getByRole("button", { name: "Confirmar recebimento" }).click();
    await page.getByText("Recebimento confirmado.").first().waitFor();
    assert.equal((await order({ _id: alfaceOrder._id })).status, "RECEBIDO");
    await page.waitForFunction(() => !document.querySelector(".pb-priorities [data-write-action]"));
    assert.equal(await stat(page, "Recebimentos concluídos"), 1);
    await shot(page, "instituicao-home-apos-recebimento");
    ok("instituição confirma recebimento integral");
    await context.close();
  }

  // 4b. Rastreabilidade visual reaproveitada (cooperativa e instituição).
  {
    const foreignIds = [orgs.producer._id, orgs.otherCoop._id];
    for (const [who, list, foreign] of [["coopEditor", "/remessas", [...foreignIds, orgs.inst._id]], ["instEditor", "/solicitacoes", [...foreignIds, orgs.coop._id]]]) {
      const { context, page } = await open(who, { reducedMotion: "no-preference" });
      await page.goto(base + list);
      await page.getByRole("link", { name: new RegExp("Ver trajetória do pedido " + shortId(alfaceOrder._id)) }).click();
      await page.waitForURL("**" + list + "/" + alfaceOrder._id);
      await page.getByRole("heading", { name: "Trajetória do pedido" }).waitFor();
      const nodes = page.locator(".trace-node");
      await nodes.nth(5).waitFor();
      const titles = await nodes.locator("strong").allTextContents();
      assert.deepEqual(titles, ["Origem registrada", "Oferta publicada", "Solicitação recebida", "Pedido aceito", "Retirada registrada", "Recebimento confirmado"]);
      assert.equal(await page.locator(".trace-node[data-current='true'] strong").textContent(), "Recebimento confirmado");
      assert.equal(await page.locator(".trace-node[data-withheld]").count(), 1, "oferta não compartilhada");
      const animation = await nodes.first().evaluate((n) => getComputedStyle(n).animationName);
      assert.equal(animation, "trace-enter");
      await page.waitForTimeout(900);
      const text = await page.locator("main").innerText();
      for (const id of foreign) assert.ok(!text.includes(id), who + " expõe ID de outra organização");
      await page.locator(".trace-node").filter({ hasText: "Retirada registrada" }).click();
      await page.locator(".trace-detail").getByText("Campinas / SP").waitFor();
      const responsible = await page.locator(".trace-detail dd").allTextContents();
      assert.ok(!responsible.some((t) => /[0-9a-f]{8}-[0-9a-f]{4}/.test(t) && !t.includes(alfaceOrder._id) && !t.includes(alfaceOrder.lotId) && t.length === 36 && foreign.includes(t)));
      await shot(page, who + "-trajetoria-1440");
      for (const w of [390, 320]) {
        await page.setViewportSize({ width: w, height: 844 });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, who + " trajetória " + w);
        await shot(page, who + "-trajetoria-" + w);
      }
      await context.close();
      const reduced = await open(who, { reducedMotion: "reduce" });
      await reduced.page.goto(base + list + "/" + alfaceOrder._id);
      await reduced.page.locator(".trace-node").nth(5).waitFor();
      const dur = await reduced.page.locator(".trace-node").first().evaluate((n) => parseFloat(getComputedStyle(n).animationDuration));
      assert.ok(dur < 0.001, "movimento reduzido na trajetória");
      await reduced.context.close();
    }
    // Instituição com solicitação ainda sem aceite: só a data do pedido.
    const waiting = await as("instEditor", "inst", "/orders", { offerId: offers.Couve.id, quantityKg: 2, ...location });
    const { context, page } = await open("instEditor");
    await page.goto(base + "/solicitacoes/" + waiting.id);
    await page.getByText("O histórico do lote fica disponível depois que o produtor aceitar").waitFor();
    assert.equal(await page.locator(".trace-node[data-current='true'] strong").textContent(), "Solicitação recebida");
    assert.equal(await page.locator(".trace-node[data-future='true']").count(), 3);
    await shot(page, "instituicao-trajetoria-aguardando-aceite");
    await context.close();
    await as("instEditor", "inst", "/orders/" + waiting.id + "/cancel", location);
    // Outra cooperativa: nem a página nem o proxy revelam o pedido.
    const other = await open("otherCoop");
    await other.page.goto(base + "/remessas/" + alfaceOrder._id);
    await other.page.getByText("inexistente ou indisponível").waitFor();
    const leak = await other.context.request.get(base + "/api/agro/lots/" + alfaceOrder.lotId + "/events");
    assert.equal(leak.status(), 404);
    // Instituição não abre rota da cooperativa.
    await other.context.close();
    const inst = await open("instEditor");
    await inst.page.goto(base + "/remessas/" + alfaceOrder._id);
    await inst.page.getByText("Esta área não faz parte do perfil ativo.").waitFor();
    await inst.context.close();
    ok("trajetória para cooperativa e instituição: 6 etapas, atual destacada, oferta sem data inventada, isolamento por organização");
  }

  // 5. Conflito de estado (409): produtor cancela enquanto a cooperativa confirma.
  const couveReq = await as("instEditor", "inst", "/orders", { offerId: offers.Couve.id, quantityKg: 5, ...location });
  await as("producer", "producer", "/orders/" + couveReq.id + "/accept", { cooperativeOrganizationId: orgs.coop._id, ...location });
  {
    const { context, page } = await open("coopEditor");
    await page.locator(".pb-priorities").getByRole("button", { name: "Registrar retirada" }).click();
    await fillLocation(page);
    await as("producer", "producer", "/orders/" + couveReq.id + "/cancel", location);
    await page.locator(".cmd-sheet").getByRole("button", { name: "Confirmar retirada" }).click();
    await page.locator(".cmd-sheet").getByText("Os dados serão atualizados.").waitFor();
    await shot(page, "cooperativa-conflito-409", false);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".pb-priorities [data-write-action]"));
    assert.equal((await order({ _id: couveReq.id })).status, "CANCELADO");
    ok("409 exibido sem sucesso; lista recarregada sem a ação");
    await context.close();
  }

  // 6. LEITOR: nenhuma ação de escrita na interface e 403 no proxy.
  const pending = await as("instEditor", "inst", "/orders", { offerId: offers.Couve.id, quantityKg: 4, ...location });
  const accepted = await as("producer", "producer", "/orders/" + pending.id + "/accept", { cooperativeOrganizationId: orgs.coop._id, ...location });
  for (const [who, path] of [["coopReader", "/visao-geral"], ["instReader", "/ofertas-disponiveis"], ["instReader", "/visao-geral"]]) {
    const { context, page } = await open(who);
    await page.goto(base + path);
    await page.locator(".pb-home, .pb-offers").first().waitFor();
    assert.equal(await page.locator("[data-write-action]").count(), 0, who + path);
    await shot(page, "leitor-" + who + path.replace("/", "-"));
    const endpoint = who === "coopReader" ? "/api/agro/shipments/" + accepted.shipment.id + "/pickup" : "/api/agro/orders";
    const denied = await context.request.post(base + endpoint, { headers: { Origin: base, "Idempotency-Key": randomUUID() }, data: who === "coopReader" ? location : { offerId: offers.Couve.id, quantityKg: 1, ...location } });
    assert.equal(denied.status(), 403);
    await context.close();
  }
  assert.equal((await order({ _id: pending.id })).status, "ACEITO");
  ok("LEITOR sem controles de escrita e 403 no proxy");

  // 7. Isolamento de público no proxy (cooperativa não solicita; instituição não retira).
  {
    const { context } = await open("coopEditor");
    const r1 = await context.request.post(base + "/api/agro/orders", { headers: { Origin: base, "Idempotency-Key": randomUUID() }, data: { offerId: offers.Couve.id, quantityKg: 1, ...location } });
    assert.equal(r1.status(), 404);
    await context.close();
    const inst = await open("instEditor");
    const r2 = await inst.context.request.post(base + "/api/agro/shipments/" + accepted.shipment.id + "/pickup", { headers: { Origin: base, "Idempotency-Key": randomUUID() }, data: location });
    assert.equal(r2.status(), 404);
    await inst.context.close();
    ok("cooperativa não cria pedido; instituição não registra retirada");
  }

  // 8. Vínculos múltiplos: troca sem dados residuais.
  {
    const { context, page } = await open("multi");
    await page.locator(".pb-home[data-audience='cooperative']").waitFor();
    assert.equal(await page.locator("[data-write-action='Registrar retirada']").count() > 0, true);
    await page.getByLabel("Organização ativa").selectOption(orgs.inst._id);
    await page.locator(".pb-home[data-audience='institution']").waitFor();
    assert.equal(await page.locator("[data-write-action='Registrar retirada']").count(), 0);
    assert.equal(await page.locator(".pb-home[data-audience='cooperative']").count(), 0);
    await shot(page, "multiplo-instituicao-apos-troca");
    ok("troca cooperativa → instituição sem resíduos");
    await context.close();
  }

  // 9. Animação de entrada consistente em todas as abas; movimento reduzido desliga.
  const tabs = {
    producer: ["/visao-geral", "/minha-fazenda", "/producao", "/ofertas", "/pedidos", "/destino", "/rastreabilidade", "/perfil"],
    coopEditor: ["/visao-geral", "/remessas", "/perfil"],
    instEditor: ["/visao-geral", "/solicitacoes", "/ofertas-disponiveis", "/perfil"],
  };
  for (const [who, paths] of Object.entries(tabs)) {
    const { context, page } = await open(who, { reducedMotion: "no-preference" });
    const rows = [];
    for (const path of paths) {
      const link = page.locator(".portal-sidebar a.nav-item[href='" + path + "']");
      await link.click();
      await page.waitForURL("**" + path);
      const info = await page.evaluate(() => {
        const pageEl = document.querySelector(".ag-page");
        const top = [...(pageEl?.children ?? [])];
        // Contêiner único: os blocos animados são os filhos dele.
        const kids = top.length === 1 && getComputedStyle(top[0]).animationName === "none" ? [...top[0].children] : top;
        const anim = (el) => { const s = getComputedStyle(el); return { name: s.animationName, delay: s.animationDelay, duration: s.animationDuration }; };
        const rise = document.querySelectorAll(".ag-page .ag-rise").length;
        return { blocks: kids.length, first: kids[0] ? anim(kids[0]) : null, second: kids[1] ? anim(kids[1]) : null, rise };
      });
      const animated = info.first?.name === "ag-rise" || info.first?.name === "ag-fade" || info.rise > 0;
      assert.ok(animated, who + path + " sem animação de entrada");
      rows.push({ path, ...info });
      await page.waitForTimeout(700);
      await shot(page, "aba-" + who + path.replace(/\//g, "-") + "-1440", false);
    }
    report.animation[who] = rows;
    await context.close();
    const reduced = await open(who, { reducedMotion: "reduce" });
    for (const path of paths.slice(1, 3)) {
      await reduced.page.goto(base + path);
      await reduced.page.locator(".ag-page > *").first().waitFor();
      const names = await reduced.page.evaluate(() => [...document.querySelectorAll(".ag-page > *, .ag-page > * > *, .ag-rise")].map((e) => getComputedStyle(e).animationName));
      assert.ok(names.every((n) => n === "none"), who + path + " anima com movimento reduzido");
    }
    await reduced.context.close();
  }
  ok("entrada ag-rise em todas as abas; nenhuma com movimento reduzido", report.animation);

  // 10. Responsividade, texto 200%, skip-link e barra lateral.
  {
    const views = [["instEditor", "/ofertas-disponiveis"], ["coopEditor", "/remessas"], ["producer", "/producao"], ["instEditor", "/visao-geral"]];
    report.overflow = {};
    for (const [who, path] of views) {
      const { context, page } = await open(who);
      await page.goto(base + path);
      await page.locator(".ag-page > *").first().waitFor();
      await page.waitForLoadState("networkidle");
      for (const [w, big] of [[390, false], [320, false], [320, true]]) {
        await page.setViewportSize({ width: w, height: 844 });
        if (big) await page.addStyleTag({ content: "html{font-size:200% !important} body{font-size:200%}" });
        await page.waitForTimeout(200);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        const culprits = wide
          ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).slice(-4).map((e) => e.tagName + "." + String(e.className).split(" ")[0] + "@" + Math.round(e.getBoundingClientRect().right)).concat([document.documentElement.scrollWidth + "/" + innerWidth]).concat([...document.querySelectorAll("body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible").slice(-5).map((e) => "sw:" + e.tagName + "." + String(e.className).split(" ")[0] + "=" + e.scrollWidth + "/" + e.clientWidth)))
          : [];
        report.overflow[who + path + "-" + w + (big ? "-texto-200" : "")] = !wide;
        assert.equal(wide, false, who + path + " " + w + (big ? " texto 200%" : "") + " " + culprits.join(", "));
        await shot(page, who + path.replace(/\//g, "-") + "-" + w + (big ? "-texto-200" : ""));
      }
      // Skip-link focado continua dentro da tela.
      await page.keyboard.press("Tab");
      const skip = await page.locator(".skip-link").boundingBox();
      assert.ok(skip && skip.x >= 0 && skip.x + skip.width <= 320 + 1, "skip-link dentro da largura");
      await context.close();
    }
    const { context, page } = await open("coopEditor");
    await page.goto(base + "/remessas");
    await page.locator(".pb-ops").waitFor();
    const sidebarOk = await page.evaluate(() => {
      const frame = document.querySelector(".portal-frame");
      return getComputedStyle(frame).backgroundImage.includes("gradient");
    });
    assert.ok(sidebarOk);
    await shot(page, "sidebar-pagina-inteira-1440");
    await context.close();
    ok("sem rolagem horizontal em 390/320 e texto 200%; skip-link acessível; coluna lateral contínua");
  }

  assert.deepEqual(pageErrors, []);
  report.finishedAt = new Date().toISOString();
  console.log(`${report.checks.length} verificações aprovadas.`);
} catch (error) {
  report.failure = { message: error.message, at: (error.stack ?? "").split(/\r?\n/).find((l) => l.includes("e2e-portal-operacoes.mjs"))?.replace(/^.*e2e-portal-operacoes\.mjs/, "e2e-portal-operacoes.mjs") };
  report.pageErrors = pageErrors;
  console.error("FALHA", error.message);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "relatorio-e2e.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close().catch(() => {});
  portal?.kill();
  api?.close();
  await connection?.client.close().catch(() => {});
  await mongo?.stop().catch(() => {});
  if (dbPath) await rm(dbPath, { recursive: true, force: true }).catch(() => {});
}
