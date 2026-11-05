import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const requirePortal = createRequire(
  new URL("../apps/portal/package.json", import.meta.url),
);
const AxeBuilder = requirePortal("@axe-core/playwright").default;
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { chromium } from "playwright-core";
import { createApp } from "../services/api/src/app.mjs";
import { connectDatabase } from "../services/api/src/database.mjs";
import { tokenHash } from "../services/api/src/auth.mjs";

// Banco isolado obrigatório. Nunca consome .env, seed ou tokens existentes.
assert.ok(
  !process.argv.includes("--existing"),
  "Este roteiro aceita apenas banco isolado.",
);
const directory = resolve("docs/design/portal/evidencias");
await mkdir(directory, { recursive: true });
let mongo, connection, api, portalProcess, browser, page, token;
let serverOutput = "";
const errors = [];
const result = {
  mode: "BANCO_ISOLADO_FICTICIO_API_REAL",
  screenshots: [],
  checks: [],
};
try {
  const dbPath = resolve(".data/portal-smoke-" + randomUUID());
  await mkdir(dbPath, { recursive: true });
  mongo = await MongoMemoryReplSet.create({
    binary: {
      version: "8.0.16",
      downloadDir: resolve(".cache/mongodb-binaries"),
    },
    instanceOpts: [{ dbPath }],
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  connection = await connectDatabase({
    uri: mongo.getUri(),
    name: "portal_smoke",
  });
  const db = connection.db;
  const ids = {
    user: randomUUID(),
    org: randomUUID(),
    otherOrg: randomUUID(),
    property: randomUUID(),
    secondProperty: randomUUID(),
    otherProperty: randomUUID(),
    institution: randomUUID(),
    institutionUser: randomUUID(),
  };
  token = randomBytes(32).toString("base64url");
  const institutionToken = randomBytes(32).toString("base64url");
  await db.collection("users").insertMany([
    {
      _id: ids.user,
      displayName: "Matheus Morelli Rodrigues",
      status: "ATIVO",
      isDemonstration: true,
    },
    { _id: ids.institutionUser, status: "ATIVO", isDemonstration: true },
  ]);
  await db.collection("organizations").insertMany([
    {
      _id: ids.org,
      name: "Agro Boa Esperança",
      type: "PEQUENO_PRODUTOR_RURAL",
      status: "ATIVA",
      isDemonstration: true,
    },
    {
      _id: ids.otherOrg,
      name: "Horta do Vale",
      type: "PEQUENO_PRODUTOR_RURAL",
      status: "ATIVA",
      isDemonstration: true,
    },
    {
      _id: ids.institution,
      name: "Instituição de teste",
      type: "INSTITUICAO",
      status: "ATIVA",
      isDemonstration: true,
    },
  ]);
  await db.collection("memberships").insertMany([
    {
      userId: ids.user,
      organizationId: ids.org,
      role: "ADMIN",
      status: "ATIVO",
    },
    {
      userId: ids.user,
      organizationId: ids.otherOrg,
      role: "LEITOR",
      status: "ATIVO",
    },
    {
      userId: ids.institutionUser,
      organizationId: ids.institution,
      role: "ADMIN",
      status: "ATIVO",
    },
  ]);
  await db.collection("demoTokens").insertMany([
    {
      userId: ids.user,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
    {
      userId: ids.institutionUser,
      tokenHash: tokenHash(institutionToken),
      expiresAt: new Date(Date.now() + 3600000),
    },
  ]);
  await db.collection("properties").insertMany([
    {
      _id: ids.property,
      organizationId: ids.org,
      name: "Sítio Boa Esperança",
      municipality: "Campinas",
      uf: "SP",
      status: "ATIVA",
    },
    {
      _id: ids.secondProperty,
      organizationId: ids.org,
      name: "Área de expansão",
      municipality: "Campinas",
      uf: "SP",
      status: "ATIVA",
    },
    {
      _id: ids.otherProperty,
      organizationId: ids.otherOrg,
      name: "Horta do Vale",
      municipality: "Valinhos",
      uf: "SP",
      status: "ATIVA",
    },
  ]);
  const crops = [];
  for (const name of ["Alface", "Tomate", "Cenoura", "Couve", "Abobrinha"]) {
    const crop = { _id: randomUUID(), name, status: "ATIVA" };
    crops.push(crop);
    await db.collection("crops").insertOne(crop);
  }
  let weatherEnabledForTest = false;
  api = createApp(db, {
    demoAuthEnabled: true,
    // Fixture meteorológica de teste; não consulta nem representa observação real.
    weather: async (property) =>
      weatherEnabledForTest
        ? {
            status: "available",
            temperatureC: property._id === ids.secondProperty ? 29 : 23,
            observedAt: new Date().toISOString(),
            description: "Condição controlada de teste",
            locality: {
              municipality: property.municipality,
              uf: property.uf,
              approximate: true,
            },
          }
        : { status: "unavailable" },
  }).listen(0, "127.0.0.1");
  await once(api, "listening");
  const apiBase = "http://127.0.0.1:" + api.address().port;
  const location = {
    location: { municipality: "Campinas", uf: "SP" },
    locationConfirmed: true,
  };
  async function apiRequest(path, body, recipient = false) {
    const response = await fetch(apiBase + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + (recipient ? institutionToken : token),
        "X-Organization-Id": recipient ? ids.institution : ids.org,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await response.json();
    assert.ok(response.ok, JSON.stringify(value));
    return value.data ?? value;
  }
  const productions = [];
  for (let i = 0; i < 9; i++)
    productions.push(
      await apiRequest("/productions", {
        propertyId: ids.property,
        cropId: crops[i % 5]._id,
        quantityKg: [120, 82.5, 54, 36, 44, 67, 29, 18, 32][i],
        seasonLabel: i < 5 ? "Primavera 2026" : "Inverno 2026",
        harvestedOn: "2026-10-" + String(25 - i).padStart(2, "0"),
        ...location,
      }),
    );
  for (let i = 0; i < 5; i++) {
    const offer = await apiRequest("/offers", {
      lotId: productions[i].lot.id,
      quantityKg: productions[i].quantityKg,
      destinationMode: "DOACAO",
      availableUntil: new Date(Date.now() + 86400000).toISOString(),
    });
    await apiRequest("/offers/" + offer.id + "/publish", location);
    const order = await apiRequest(
      "/orders",
      { offerId: offer.id, quantityKg: [12, 20, 7, 6, 10][i], ...location },
      true,
    );
    if (i === 1 || i === 2) {
      const accepted = await apiRequest(
        "/orders/" + order.id + "/accept",
        location,
      );
      if (i === 2)
        await apiRequest(
          "/shipments/" + accepted.shipment.id + "/pickup",
          location,
        );
    }
    if (i === 3) await apiRequest("/orders/" + order.id + "/cancel", location);
  }
  const port = Number(process.env.PORTAL_TEST_PORT ?? 3130),
    base = "http://127.0.0.1:" + port;
  portalProcess = spawn(
    process.execPath,
    [
      resolve("apps/portal/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: resolve("apps/portal"),
      windowsHide: true,
      env: {
        ...process.env,
        PORTAL_DEMO_ENABLED: "true",
        AGRO_API_URL: apiBase,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  portalProcess.stdout.on(
    "data",
    (chunk) => (serverOutput += chunk.toString()),
  );
  portalProcess.stderr.on(
    "data",
    (chunk) => (serverOutput += chunk.toString()),
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/visao-geral")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
    if (i === 79) throw Error("Portal não iniciou.");
  }
  browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/visao-geral");
  await page.getByRole("button", { name: "Entrar no portal" }).waitFor();
  const wrongOrigin = await context.request.post(base + "/api/session", {
    headers: { Origin: "https://example.com" },
    data: { token },
  });
  assert.equal(wrongOrigin.status(), 403);
  await page.getByLabel("Acesso temporário").fill(token);
  await page.getByRole("button", { name: "Entrar no portal" }).click();
  await page.getByRole("heading", { name: "Olá, Matheus." }).waitFor();
  await page.getByLabel("Organização ativa").selectOption(ids.org);
  await page
    .getByLabel("Propriedade", { exact: true })
    .selectOption(ids.property);
  await page.waitForFunction(
    (id) =>
      document.querySelector('select[aria-label="Propriedade"]')?.value === id,
    ids.property,
  );
  await page.getByText("Produção registrada", { exact: true }).waitFor();
  const cookies = await context.cookies();
  const cookie = cookies.find((c) => c.name === "agro_portal_session");
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, "Strict");
  assert.notEqual(cookie.value, token);
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  assert.equal((await page.content()).includes(token), false);
  result.checks.push(
    "cookie HttpOnly / SameSite Strict; nenhum token em HTML ou storage; origem externa rejeitada",
  );
  async function audit(name) {
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await writeFile(
      resolve(directory, "a11y-" + name + ".json"),
      JSON.stringify(
        audit.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        null,
        2,
      ),
    );
    assert.equal(audit.violations.length, 0, "Acessibilidade: " + name);
  }
  async function capture(name) {
    await page.screenshot({
      path: resolve(directory, name + ".png"),
      animations: "disabled",
    });
    result.screenshots.push(name + ".png");
  }
  if (process.argv.includes("--offers")) {
    const { runOffers } = await import("./portal-offers-browser.mjs");
    await runOffers({
      page,
      context,
      db,
      ids,
      productions,
      crops,
      base,
      capture,
      audit,
      result,
    });
  } else {
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1024, 768],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      await capture("home-" + width);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await audit("home");
    await page.screenshot({
      path: resolve(directory, "home-completa.png"),
      fullPage: true,
      animations: "disabled",
    });
    result.screenshots.push("home-completa.png");
    await page.getByRole("button", { name: "Recolher menu lateral" }).click();
    await page.waitForTimeout(250);
    const contextBounds = await page.locator(".context-controls").boundingBox();
    assert.ok(
      contextBounds &&
        contextBounds.x >= 0 &&
        contextBounds.x + contextBounds.width <= 1440,
      "Contexto deve continuar no viewport ao recolher menu",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    result.sidebarContextBounds = contextBounds;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await capture("sidebar-recolhida");
    await page.getByRole("button", { name: "Expandir menu lateral" }).click();
    await page.getByRole("button", { name: /Tomate.*kg/ }).hover();
    await page.getByRole("button", { name: /Tomate.*kg/ }).click();
    await page.getByLabel("Distribuição da produção").scrollIntoViewIfNeeded();
    await capture("graficos");
    for (const [label, name] of [
      ["Distribuição da produção", "grafico-barras"],
      ["Distribuição dos pedidos", "grafico-rosca"],
    ]) {
      await page.getByLabel(label, { exact: true }).screenshot({
        path: resolve(directory, name + ".png"),
        animations: "disabled",
      });
      result.screenshots.push(name + ".png");
    }
    await page.locator(".recharts-bar-rectangle").nth(1).hover();
    await page
      .locator(".recharts-tooltip-wrapper")
      .first()
      .waitFor({ state: "visible" });
    await capture("tooltip-barras");
    const ring = await page.locator(".donut-canvas").boundingBox();
    await page.mouse.move(
      ring.x + ring.width / 2 + 73,
      ring.y + ring.height / 2,
    );
    await page
      .locator(".recharts-tooltip-wrapper")
      .nth(1)
      .waitFor({ state: "visible" });
    await capture("tooltip-rosca");
    await page.getByRole("button", { name: "Consultar pedido" }).click();
    await page
      .getByRole("heading", { name: "Detalhes da solicitação" })
      .waitFor();
    await capture("pedido-prioritario");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Produção", exact: true }).click();
    await page.getByRole("heading", { name: "Minha produção" }).waitFor();
    await capture("producao");
    await audit("producao");
    for (const width of [1366, 1024]) {
      await page.setViewportSize({ width, height: 768 });
      await capture("producao-" + width);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Próxima página" }).click();
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByRole("button", { name: "Página anterior" }).click();
    assert.equal(await page.locator("tbody tr").count(), 8);
    await page.getByLabel("Selecionar registros desta página").check();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar seleção" }).click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), "utf8");
    assert.equal(csv.split("\r\n").length, 9);
    assert.ok(csv.includes("Quantidade (kg)"));
    await page.getByLabel("Selecionar registros desta página").uncheck();
    await page
      .getByRole("textbox", { name: "Pesquisar produção" })
      .fill("Tomate");
    await page.waitForTimeout(150);
    assert.equal(await page.locator("tbody tr").count(), 2);
    await capture("producao-filtrada");
    await page.getByRole("textbox", { name: "Pesquisar produção" }).fill("");
    await page.getByLabel("Filtrar por cultura").selectOption(crops[2]._id);
    assert.equal(await page.locator("tbody tr").count(), 2);
    await page.getByLabel("Filtrar por cultura").selectOption("");
    await page
      .getByRole("button", { name: /Ver detalhes de Alface/ })
      .first()
      .click();
    await page.getByRole("heading", { name: "Detalhes da produção" }).waitFor();
    await page.getByText("Caminho do lote", { exact: true }).waitFor();
    await capture("detalhes-lote");
    await audit("detalhes");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Nova produção", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Da colheita ao primeiro registro." })
      .waitFor();
    await capture("cadastro");
    await audit("cadastro");
    for (const width of [1366, 1024]) {
      await page.setViewportSize({ width, height: 768 });
      await capture("cadastro-" + width);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Registrar produção", exact: true })
          .isVisible(),
        true,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('select[name="cropId"]').selectOption(crops[1]._id);
    await page.locator('input[name="quantityKg"]').fill("25.75");
    await page.locator('input[name="seasonLabel"]').fill("Verão 2026/27");
    await page.locator('input[name="confirmed"]').check();
    await capture("cadastro-preenchido");
    await page
      .getByRole("button", { name: "Registrar produção", exact: true })
      .click();
    await page
      .getByText("Produção registrada. Lote e origem criados juntos.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await db
        .collection("productions")
        .countDocuments({ organizationId: ids.org }),
      10,
    );
    await capture("cadastro-concluido");
    // Somente os estados de falha são controlados; os registros vêm da API/MongoDB isolados.
    await page.route("**/api/agro/catalog", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            message:
              "Serviço temporariamente indisponível no teste de recuperação.",
          },
        }),
      }),
    );
    await page.getByRole("button", { name: "Atualizar dados" }).click();
    await page
      .getByRole("heading", { name: "Não foi possível carregar seu espaço." })
      .waitFor();
    await capture("erro-recuperavel");
    await page.unroute("**/api/agro/catalog");
    await page.route("**/api/agro/catalog", async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.continue();
    });
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page
      .getByRole("status", { name: "Carregando espaço de trabalho" })
      .waitFor();
    await capture("carregamento");
    await page.getByRole("heading", { name: "Minha produção" }).waitFor();
    await page.unroute("**/api/agro/catalog");
    const requestHeaders = { Origin: base };
    const invalidContext = await context.request.post(base + "/api/session", {
      headers: requestHeaders,
      data: { organizationId: randomUUID() },
    });
    assert.equal(invalidContext.status(), 403);
    const csrf = await context.request.post(base + "/api/agro/productions", {
      headers: { Origin: "https://example.com" },
      data: {},
    });
    assert.equal(csrf.status(), 403);
    const forbidden = await context.request.post(base + "/api/agro/orders", {
      headers: requestHeaders,
      data: {},
    });
    assert.equal(forbidden.status(), 404);
    await page
      .getByLabel("Propriedade", { exact: true })
      .selectOption(ids.secondProperty);
    await page
      .getByText("Sua próxima colheita começa aqui.", { exact: true })
      .waitFor();
    await capture("producao-vazia");
    await page.getByLabel("Organização ativa").selectOption(ids.otherOrg);
    await page
      .getByText("Sua próxima colheita começa aqui.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Nova produção", exact: true })
        .isDisabled(),
      true,
    );
    await capture("somente-leitura");
    const denied = await context.request.post(base + "/api/agro/productions", {
      headers: requestHeaders,
      data: {
        propertyId: ids.property,
        cropId: crops[0]._id,
        quantityKg: 1,
        seasonLabel: "Intruso",
        harvestedOn: "2026-10-01",
        ...location,
      },
    });
    assert.equal(denied.status(), 403);
    assert.equal(
      await db
        .collection("productions")
        .countDocuments({ organizationId: ids.otherOrg }),
      0,
    );
    const crossRead = await context.request.get(
      base + "/api/agro/productions/" + productions[0].id,
    );
    assert.ok([403, 404].includes(crossRead.status()));
    result.checks.push(
      "listagem, pesquisa, cultura, drawer/eventos, cadastro persistido, propriedade vazia, troca de organização, LEITOR sem escrita, proxy restrito e CSRF",
    );
    await page.waitForTimeout(5000);
    // Fixture adicional isolada: pedidos encerrados, categoria única e nenhuma pendência.
    await db
      .collection("orders")
      .updateMany(
        { organizationId: ids.org },
        { $set: { status: "RECEBIDO" } },
      );
    await db
      .collection("orders")
      .updateMany({}, { $set: { status: "RECEBIDO" } });
    await page.getByLabel("Organização ativa").selectOption(ids.org);
    await page
      .getByLabel("Propriedade", { exact: true })
      .selectOption(ids.property);
    await page.getByRole("link", { name: "Visão geral", exact: true }).click();
    await page
      .getByRole("heading", { name: "Tudo em dia por aqui.", exact: true })
      .waitFor();
    assert.equal(await page.locator(".priority-panel.clear").count(), 1);
    assert.equal(
      await page.locator(".workspace-footer, .organization-note").count(),
      0,
    );
    assert.equal(await page.locator(".donut-legend button").count(), 1);
    for (const width of [1440, 1366, 1024]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
      await capture("rotina-restaurada-" + width);
      const box = await page.locator(".priority-panel.clear").boundingBox();
      const row = await page.locator(".priority-row").boundingBox();
      const metrics = await page.locator(".metrics-grid").boundingBox();
      assert.ok(box.width <= 520);
      assert.ok(box.height <= 120);
      assert.ok(
        metrics.y - row.y - row.height >= 16 &&
          metrics.y - row.y - row.height <= 24,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await audit("home-sem-pendencias");
    assert.equal(
      await page.getByText("Clima indisponível", { exact: true }).count(),
      1,
    );
    assert.equal(await page.locator(".weather-compact").count(), 0);
    await capture("clima-indisponivel");
    weatherEnabledForTest = true;
    await db
      .collection("properties")
      .updateOne(
        { _id: ids.secondProperty },
        { $set: { municipality: "Valinhos" } },
      );
    await page.getByRole("button", { name: "Atualizar dados" }).click();
    await page.getByText("23 °C em Campinas", { exact: true }).waitFor();
    await page
      .getByText("Referência aproximada do município", { exact: true })
      .waitFor();
    for (const width of [1440, 1366, 1024]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
      await capture("clima-saudacao-" + width);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await audit("clima-saudacao");
    await page
      .getByLabel("Propriedade", { exact: true })
      .selectOption(ids.secondProperty);
    await page.getByText("29 °C em Valinhos", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("23 °C em Campinas", { exact: true }).count(),
      0,
    );
    await capture("clima-troca-propriedade");
    result.checks.push(
      "clima em linha: indisponível, duas temperaturas/cidades controladas, atualização por propriedade, atribuição e rotina preservada",
    );

    await page
      .getByRole("link", { name: "Perfil e configurações", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Perfil e configurações", exact: true })
      .waitFor();
    await capture("perfil");
    await page
      .getByRole("button", { name: "Sair do portal", exact: true })
      .click();
    await page.getByRole("button", { name: "Entrar no portal" }).waitFor();
    assert.equal(
      (await context.request.get(base + "/api/agro/catalog")).status(),
      401,
    );
    result.checks.push(
      "logout invalida sessão; paginação e CSV; recuperação de erro e carregamento; leitura cruzada rejeitada; quatro auditorias axe sem violações",
    );
  }
  assert.deepEqual(errors, []);
  result.errors = errors;
  result.verifiedAt = new Date().toISOString();
  result.browser = await browser.version();
  await writeFile(
    resolve(
      directory,
      process.argv.includes("--offers") ? "ofertas-result.json" : "result.json",
    ),
    JSON.stringify(result, null, 2),
  );
  console.log(
    "Portal aprovado: autenticação, três resoluções, navegação, filtros, detalhes, cadastro, contextos e permissões.",
  );
} catch (error) {
  const sanitize = (value) =>
    String(value)
      .split(token ?? "\0")
      .join("[REDACTED]");
  if (page)
    await page
      .screenshot({ path: resolve(directory, "failure.png") })
      .catch(() => {});
  await writeFile(
    resolve(directory, "failure.json"),
    JSON.stringify(
      {
        error: sanitize(error.message),
        errors: errors.map(sanitize),
        server: sanitize(serverOutput.slice(-5000)),
      },
      null,
      2,
    ),
  );
  console.error("Smoke portal falhou; consulte failure.json sanitizado.");
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (portalProcess) portalProcess.kill();
  if (api) await new Promise((r) => api.close(r));
  if (connection) await connection.client.close();
  if (mongo) await mongo.stop({ doCleanup: false });
}
