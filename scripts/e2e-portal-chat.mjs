// E2E do chat interno no portal Next.js real, com API real e MongoDB
// descartável. Nunca usa o banco local, .env, seed ou tokens de .data/.
// Pré-requisito: `npm run build` em apps/portal. Uso: node scripts/e2e-portal-chat.mjs
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { chromium } from "playwright-core";
import { createApp } from "../services/api/src/app.mjs";
import { connectDatabase } from "../services/api/src/database.mjs";
import { tokenHash } from "../services/api/src/auth.mjs";
const AxeBuilder = createRequire(new URL("../apps/portal/package.json", import.meta.url))("@axe-core/playwright").default;

const out = resolve("docs/design/mensagens");
await mkdir(out, { recursive: true });
const report = { mode: "BANCO_DESCARTAVEL_API_REAL", startedAt: new Date().toISOString(), checks: [], screenshots: [] };
const pageErrors = [];
let mongo, connection, api, portal, browser, dbPath;
const ok = (name, detail) => { report.checks.push({ name, ok: true, ...(detail ? { detail } : {}) }); console.log("ok", name); };

try {
  dbPath = resolve(".data/portal-chat-" + randomUUID());
  await mkdir(dbPath, { recursive: true });
  mongo = await MongoMemoryReplSet.create({ binary: { version: "8.0.16", downloadDir: resolve(".cache/mongodb-binaries") }, instanceOpts: [{ dbPath }], replSet: { count: 1, storageEngine: "wiredTiger" } });
  connection = await connectDatabase({ uri: mongo.getUri(), name: "portal_chat" });
  const db = connection.db;
  const org = (name, type) => ({ _id: randomUUID(), name, type, status: "ATIVA", isDemonstration: true });
  const orgs = { producer: org("Sítio Esperança", "PEQUENO_PRODUTOR_RURAL"), coop: org("Cooperativa Vale", "COOPERATIVA"), inst: org("Instituição Pão", "INSTITUICAO"), otherInst: org("Instituição Alheia", "INSTITUICAO") };
  await db.collection("organizations").insertMany(Object.values(orgs));
  const people = { producer: [["producer", "ADMIN"]], coop: [["coop", "EDITOR"]], inst: [["inst", "EDITOR"]], instReader: [["inst", "LEITOR"]], otherInst: [["otherInst", "ADMIN"]], multi: [["coop", "ADMIN"], ["inst", "ADMIN"]] };
  const tokens = {};
  for (const [who, links] of Object.entries(people)) {
    const userId = randomUUID();
    tokens[who] = randomBytes(32).toString("base64url");
    await db.collection("users").insertOne({ _id: userId, displayName: "Pessoa fictícia " + who, status: "ATIVO", isDemonstration: true });
    for (const [o, role] of links) await db.collection("memberships").insertOne({ _id: randomUUID(), userId, organizationId: orgs[o]._id, role, status: "ATIVO" });
    await db.collection("demoTokens").insertOne({ userId, tokenHash: tokenHash(tokens[who]), expiresAt: new Date(Date.now() + 3600000) });
  }
  const property = randomUUID();
  await db.collection("properties").insertOne({ _id: property, organizationId: orgs.producer._id, name: "Sítio Esperança", municipality: "Campinas", uf: "SP", status: "ATIVA" });
  const crops = ["Alface", "Tomate"].map((name) => ({ _id: randomUUID(), name, status: "ATIVA" }));
  await db.collection("crops").insertMany(crops);
  api = createApp(db, { demoAuthEnabled: true, weather: async () => ({ status: "unavailable" }) }).listen(0, "127.0.0.1");
  await once(api, "listening");
  const apiBase = "http://127.0.0.1:" + api.address().port;
  const location = { location: { municipality: "Campinas", uf: "SP" }, locationConfirmed: true };
  async function as(who, orgKey, path, body) {
    const r = await fetch(apiBase + "/api/v1" + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + tokens[who], "X-Organization-Id": orgs[orgKey]._id, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: body ? JSON.stringify(body) : undefined });
    const v = await r.json();
    assert.ok(r.ok, path + " " + JSON.stringify(v));
    return v.data ?? v;
  }
  const offers = [];
  for (const [i, crop] of crops.entries()) {
    const p = await as("producer", "producer", "/productions", { propertyId: property, cropId: crop._id, quantityKg: 80, seasonLabel: "Primavera 2026", harvestedOn: "2026-11-0" + (i + 1), ...location });
    const o = await as("producer", "producer", "/offers", { lotId: p.lot.id, quantityKg: 80, destinationMode: "DOACAO", availableUntil: new Date(Date.now() + 5 * 86400000).toISOString() });
    await as("producer", "producer", "/offers/" + o.id + "/publish", location);
    offers.push(o);
  }
  const order1 = await as("inst", "inst", "/orders", { offerId: offers[0].id, quantityKg: 10, ...location });
  await as("producer", "producer", "/orders/" + order1.id + "/accept", { cooperativeOrganizationId: orgs.coop._id, ...location });

  const port = Number(process.env.PORTAL_TEST_PORT ?? 3132);
  const base = "http://127.0.0.1:" + port;
  portal = spawn(process.execPath, [resolve("apps/portal/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: resolve("apps/portal"), windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORTAL_DEMO_ENABLED: "true", AGRO_API_URL: apiBase, NEXT_TELEMETRY_DISABLED: "1" } });
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + "/api/session")).status) break; } catch {}
    if (i > 80) throw new Error("Portal não iniciou.");
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  async function open(who, { reducedMotion = "no-preference", width = 1440, height = 900 } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(who + ": " + e.message));
    await page.goto(base + "/visao-geral");
    await page.getByLabel("Acesso temporário").fill(tokens[who]);
    await page.getByRole("button", { name: "Entrar no portal" }).click();
    await page.locator(".portal-frame").waitFor();
    return { context, page };
  }
  const shot = async (page, name, fullPage = false) => { await page.screenshot({ path: resolve(out, name + ".png"), fullPage }); report.screenshots.push(name + ".png"); };
  const shortId = (id) => "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const textCount = (chatId, text) => db.collection("chatMessages").countDocuments({ chatId, kind: "TEXT", ...(text ? { text } : {}) });
  const composer = (page) => page.getByLabel(/^Mensagem para/);

  // 1. Instituição abre conversa a partir da solicitação e envia; queda de rede não duplica.
  let chatInstProducer;
  {
    const { context, page } = await open("inst");
    await page.goto(base + "/solicitacoes");
    const row = page.locator(".pb-ops li").filter({ hasText: shortId(order1.id) });
    await row.getByRole("button", { name: "Enviar mensagem sobre este pedido" }).click();
    await page.getByRole("menu", { name: "Com quem conversar" }).waitFor();
    await shot(page, "instituicao-escolher-contraparte");
    await page.getByRole("menuitem", { name: "Produtor do pedido" }).click();
    await page.waitForURL(/\/mensagens\?conversa=/);
    chatInstProducer = new URL(page.url()).searchParams.get("conversa");
    await page.locator(".chat-system").filter({ hasText: shortId(order1.id) }).waitFor();
    await composer(page).fill("Olá! Podemos combinar a entrega?");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await page.locator(".chat-bubble[data-mine]").filter({ hasText: "Podemos combinar" }).waitFor();
    await page.locator(".chat-bubble[data-state]").waitFor({ state: "detached" });
    assert.equal(await textCount(chatInstProducer), 1);
    // Queda de rede: falha visível, nova tentativa com a MESMA chave, um único registro.
    const keys = [];
    let dropped = false;
    await page.route("**/api/agro/chats/*/messages", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (!dropped) { dropped = true; return route.abort("connectionreset"); }
      return route.continue();
    });
    await composer(page).fill("Segunda mensagem <b>com tag</b>");
    await composer(page).press("Enter");
    await page.locator(".chat-bubble[data-state='failed']").waitFor();
    await shot(page, "instituicao-envio-falhou");
    assert.equal(await textCount(chatInstProducer, "Segunda mensagem <b>com tag</b>"), 0, "nada gravado antes da confirmação");
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await page.locator(".chat-bubble[data-state]").waitFor({ state: "detached" });
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(await textCount(chatInstProducer, "Segunda mensagem <b>com tag</b>"), 1);
    // Texto com tags é literal (sem HTML interpretado).
    const bubble = page.locator(".chat-bubble").filter({ hasText: "Segunda mensagem" });
    assert.equal(await bubble.locator("b").count(), 0);
    assert.match(await bubble.locator("p").textContent(), /<b>com tag<\/b>/);
    await page.unroute("**/api/agro/chats/*/messages");
    await shot(page, "instituicao-conversa-1440");
    ok("instituição abre conversa pelo pedido, envia, falha de rede reenviada com a mesma chave e sem duplicar; HTML literal", { tentativas: keys.length });
    await context.close();
  }

  // 2. Produtor recebe, vê aviso do pedido e responde; polling chega à instituição sem reanimar o histórico.
  {
    const inst = await open("inst");
    await inst.page.goto(base + "/mensagens?conversa=" + chatInstProducer);
    await inst.page.locator(".chat-bubble").nth(1).waitFor();
    const initialNew = await inst.page.locator(".chat-bubble[data-new]").count();
    assert.equal(initialNew, 0, "histórico inicial não anima");
    const prod = await open("producer");
    await prod.page.getByRole("link", { name: "Mensagens", exact: true }).click();
    const item = prod.page.locator(".chat-item").first();
    await item.getByText("Segunda mensagem").waitFor();
    await item.click();
    await prod.page.locator(".chat-bubble:not([data-mine])").first().waitFor();
    await composer(prod.page).fill("Claro, amanhã pela manhã.");
    await composer(prod.page).press("Enter");
    await prod.page.locator(".chat-bubble[data-mine]").filter({ hasText: "amanhã" }).waitFor();
    await shot(prod.page, "produtor-conversa-1440");
    const t0 = Date.now();
    await inst.page.locator(".chat-bubble[data-new]:not([data-mine])").filter({ hasText: "amanhã" }).waitFor({ timeout: 10000 });
    const latency = Date.now() - t0;
    assert.equal(await inst.page.locator(".chat-bubble[data-new]").count(), 1, "só a nova mensagem anima");
    ok("produtor responde; instituição recebe pelo polling sem reanimar mensagens antigas", { latenciaMs: latency });

    // 3. Leitura sem saltos: com a pessoa lendo acima, nova mensagem mostra aviso e não rola.
    for (let i = 0; i < 25; i++) await as("producer", "producer", `/chats/${chatInstProducer}/messages`, { text: "Mensagem de histórico " + (i + 1) });
    await inst.page.locator(".chat-bubble").filter({ hasText: "Mensagem de histórico 25" }).waitFor({ timeout: 10000 });
    await inst.page.locator(".chat-scroll").evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
    await as("producer", "producer", `/chats/${chatInstProducer}/messages`, { text: "Mensagem enquanto você lê" });
    await inst.page.locator(".chat-new-pill").waitFor({ timeout: 10000 });
    assert.equal(await inst.page.locator(".chat-scroll").evaluate((el) => el.scrollTop), 0, "rolagem preservada");
    await shot(inst.page, "instituicao-nova-mensagem-lendo");
    await inst.page.locator(".chat-new-pill").click();
    await inst.page.waitForFunction(() => { const el = document.querySelector(".chat-scroll"); return el && el.scrollHeight - el.scrollTop - el.clientHeight < 5; });
    ok("nova mensagem durante a leitura não desloca a rolagem; aviso leva ao fim");
    await prod.context.close();
    await inst.context.close();
  }

  // 3b. Não lidas: menu lateral e lista indicam mensagens recebidas; abrir a conversa zera e persiste.
  {
    const { context, page } = await open("producer");
    const badge = page.locator(".nav-unread");
    const count = async () => Number((await badge.textContent()) || 0);
    await badge.waitFor({ timeout: 30000 });
    const before = await count();
    assert.ok(before >= 2, "textos da instituição contados como não lidos");
    await page.waitForTimeout(600);
    await shot(page, "nao-lidas-menu-produtor");
    await as("inst", "inst", `/chats/${chatInstProducer}/messages`, { text: "Mensagem nova para o produtor" });
    await page.waitForFunction((n) => Number(document.querySelector(".nav-unread")?.textContent || 0) === n + 1, before, { timeout: 30000 });
    // Nome acessível do link inclui o total (leitores de tela não dependem do contador visual).
    const link = page.locator(".portal-sidebar a.nav-item[href='/mensagens']");
    const accessible = (await link.evaluate((a) => a.textContent ?? "")).replace(/\s+/g, " ");
    assert.match(accessible, new RegExp((before + 1) + " mensagens não lidas"), accessible);
    // Mensagem enviada pela própria organização não conta.
    await as("producer", "producer", `/chats/${chatInstProducer}/messages`, { text: "Minha própria mensagem" });
    await page.waitForTimeout(16000);
    assert.equal(await count(), before + 1);
    await link.click();
    const item = page.locator(".chat-item").first();
    assert.equal(Number(await item.locator(".chat-unread").textContent()), before + 1);
    await page.waitForTimeout(600);
    await shot(page, "nao-lidas-lista");
    await item.click();
    await page.locator(".chat-bubble").filter({ hasText: "Mensagem nova para o produtor" }).waitFor();
    await badge.waitFor({ state: "detached" });
    await page.reload();
    await page.locator(".chat-bubble").first().waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await badge.count(), 0, "leitura persiste após recarregar");
    await page.getByRole("link", { name: "Pedidos", exact: true }).click();
    await as("inst", "inst", `/chats/${chatInstProducer}/messages`, { text: "Outra mensagem enquanto você está em Pedidos" });
    await page.waitForFunction(() => document.querySelector(".nav-unread")?.textContent === "1", null, { timeout: 30000 });
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    assert.ok(!stored.includes(tokens.producer) && !stored.includes("Mensagem"), "armazenamento sem token nem texto");
    await page.waitForTimeout(600);
    await shot(page, "nao-lidas-em-outra-aba");
    ok("não lidas no menu e na lista; próprias mensagens não contam; abrir zera e persiste; nova mensagem reaparece em outra aba", { antes: before });
    await context.close();
  }

  // 4. Conversa reutilizada: novo pedido do mesmo par → mesma conversa, novo aviso discreto.
  {
    const order2 = await as("inst", "inst", "/orders", { offerId: offers[1].id, quantityKg: 5, ...location });
    const { context, page } = await open("inst");
    await page.goto(base + "/solicitacoes");
    await page.locator(".pb-ops li").filter({ hasText: shortId(order2.id) }).getByRole("button", { name: "Enviar mensagem sobre este pedido" }).click();
    await page.waitForURL(/\/mensagens\?conversa=/);
    assert.equal(new URL(page.url()).searchParams.get("conversa"), chatInstProducer, "mesma conversa do par");
    await page.locator(".chat-system").filter({ hasText: shortId(order2.id) }).waitFor();
    assert.equal(await db.collection("chats").countDocuments({ organizationIds: { $all: [orgs.inst._id, orgs.producer._id] } }), 1);
    assert.equal(await db.collection("chatMessages").countDocuments({ chatId: chatInstProducer, kind: "ORDER_LINK" }), 2);
    await page.locator(".chat-system").last().scrollIntoViewIfNeeded();
    await shot(page, "conversa-reutilizada-aviso-pedido");
    ok("segundo pedido reutiliza a conversa do par e mostra aviso do pedido");
    await context.close();
  }

  // 5. LEITOR: lê, não envia, não abre conversas; 403 no proxy.
  {
    const { context, page } = await open("instReader");
    await page.getByRole("link", { name: "Mensagens", exact: true }).click();
    await page.locator(".chat-item").first().click();
    await page.locator(".chat-bubble").first().waitFor();
    assert.equal(await page.locator(".chat-composer").count(), 0);
    await page.getByText("Seu perfil é de consulta").waitFor();
    await page.goto(base + "/solicitacoes");
    await page.locator(".pb-ops li").first().waitFor();
    assert.equal(await page.locator(".msg-button").count(), 0);
    const denied = await context.request.post(base + `/api/agro/chats/${chatInstProducer}/messages`, { headers: { Origin: base, "Idempotency-Key": randomUUID() }, data: { text: "intruso" } });
    assert.equal(denied.status(), 403);
    const deniedOpen = await context.request.post(base + "/api/agro/chats/open", { headers: { Origin: base }, data: { organizationId: orgs.producer._id } });
    assert.equal(deniedOpen.status(), 403);
    await page.goto(base + "/mensagens?conversa=" + chatInstProducer);
    await page.locator(".chat-bubble").first().waitFor();
    await shot(page, "leitor-somente-consulta");
    assert.equal(await textCount(chatInstProducer, "intruso"), 0);
    ok("LEITOR lê histórico, sem compositor nem botões; envio e abertura recusados (403)");
    await context.close();
  }

  // 6. Acesso cruzado: organização sem pedido em comum.
  {
    const { context, page } = await open("otherInst");
    const r = await context.request.get(base + `/api/agro/chats/${chatInstProducer}/messages?limit=50&after=0`);
    assert.equal(r.status(), 404);
    const o = await context.request.post(base + "/api/agro/chats/open", { headers: { Origin: base }, data: { organizationId: orgs.producer._id } });
    assert.equal(o.status(), 404);
    await page.goto(base + "/mensagens?conversa=" + chatInstProducer);
    await page.getByText("Conversa indisponível para esta organização.").waitFor();
    assert.equal(await page.locator(".chat-bubble").count(), 0);
    await shot(page, "acesso-cruzado-indisponivel");
    ok("organização sem relação: 404 no histórico e na abertura; nada exibido");
    await context.close();
  }

  // 7. Troca de organização limpa histórico e recarrega conversas do novo contexto.
  {
    const c = await open("coop");
    await c.page.goto(base + "/remessas");
    await c.page.locator(".pb-ops li").filter({ hasText: shortId(order1.id) }).getByRole("button", { name: "Enviar mensagem sobre este pedido" }).click();
    await c.page.getByRole("menuitem", { name: "Produtor do pedido" }).click();
    await c.page.waitForURL(/\/mensagens\?conversa=/);
    const chatCoop = new URL(c.page.url()).searchParams.get("conversa");
    await composer(c.page).fill("Cooperativa: retirada confirmada para amanhã.");
    await composer(c.page).press("Enter");
    await c.page.locator(".chat-bubble[data-mine]").filter({ hasText: "retirada confirmada" }).waitFor();
    await c.context.close();
    const { context, page } = await open("multi");
    await page.goto(base + "/mensagens?conversa=" + chatCoop);
    await page.locator(".chat-bubble").filter({ hasText: "retirada confirmada" }).waitFor();
    await page.getByLabel("Organização ativa").selectOption(orgs.inst._id);
    await page.locator(".chat-item").first().waitFor();
    assert.equal(await page.locator(".chat-bubble").filter({ hasText: "retirada confirmada" }).count(), 0, "histórico anterior removido");
    const items = await page.locator(".chat-item").count();
    assert.equal(items, 1);
    await page.locator(".chat-item").first().click();
    await page.locator(".chat-bubble").filter({ hasText: "Podemos combinar" }).waitFor();
    ok("troca cooperativa → instituição limpa histórico e lista só conversas do novo contexto");
    await context.close();
  }

  // 8. Mobile 390/320, texto 200%, movimento reduzido e acessibilidade.
  {
    const { context, page } = await open("inst", { width: 390, height: 844, reducedMotion: "reduce" });
    await page.goto(base + "/mensagens");
    await page.locator(".chat-item").first().waitFor();
    assert.equal(await page.locator(".chat-main").isVisible(), false, "lista é a tela inicial");
    await shot(page, "mobile-390-lista");
    await page.locator(".chat-item").first().click();
    await page.locator(".chat-bubble").first().waitFor();
    assert.equal(await page.locator(".chat-list").isVisible(), false);
    const anim = await page.locator(".chat-thread").evaluate((e) => getComputedStyle(e).animationName);
    assert.equal(anim, "none", "movimento reduzido");
    await shot(page, "mobile-390-conversa");
    await page.getByRole("button", { name: "Voltar às conversas" }).click();
    await page.locator(".chat-item").first().waitFor();
    for (const big of [false, true]) {
      await page.setViewportSize({ width: 320, height: 760 });
      if (big) await page.addStyleTag({ content: "html{font-size:200% !important} body{font-size:200%}" });
      await page.locator(".chat-item").first().click();
      await page.locator(".chat-bubble").first().waitFor();
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "320" + (big ? " texto 200%" : ""));
      await shot(page, "mobile-320-conversa" + (big ? "-texto-200" : ""));
      await page.getByRole("button", { name: "Voltar às conversas" }).click();
    }
    await context.close();
    const desk = await open("inst");
    await desk.page.goto(base + "/mensagens?conversa=" + chatInstProducer);
    await desk.page.locator(".chat-bubble").first().waitFor();
    await desk.page.waitForTimeout(400);
    const axe = await new AxeBuilder({ page: desk.page }).include(".chat-page").analyze();
    report.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")) }));
    assert.deepEqual(report.axe.filter((v) => ["serious", "critical"].includes(v.impact)), [], JSON.stringify(report.axe));
    await shot(desk.page, "desktop-1440");
    await desk.context.close();
    ok("mobile lista → conversa → voltar; 320 px e texto 200% sem rolagem horizontal; movimento reduzido; axe sem violações sérias", { axe: report.axe });
  }

  assert.deepEqual(pageErrors, []);
  report.finishedAt = new Date().toISOString();
  console.log(`${report.checks.length} verificações aprovadas.`);
} catch (error) {
  report.failure = { message: error.message, at: (error.stack ?? "").split(/\r?\n/).find((l) => l.includes("e2e-portal-chat.mjs"))?.replace(/^.*e2e-portal-chat\.mjs/, "e2e-portal-chat.mjs") };
  report.pageErrors = pageErrors;
  console.error("FALHA", error.message, report.failure.at);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "relatorio-e2e-chat.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close().catch(() => {});
  portal?.kill();
  api?.close();
  await connection?.client.close().catch(() => {});
  await mongo?.stop().catch(() => {});
  if (dbPath) await rm(dbPath, { recursive: true, force: true }).catch(() => {});
}
