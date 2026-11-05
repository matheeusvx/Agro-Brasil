import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
export async function runOffers({
  page,
  context,
  db,
  ids,
  productions,
  base,
  capture,
  audit,
  result,
}) {
  const headers = { Origin: base, "Idempotency-Key": randomUUID() };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("link", { name: "Ofertas", exact: true }).click();
  await page.getByRole("heading", { name: "Minhas ofertas" }).waitFor();
  await page
    .getByRole("button", { name: "Detalhes da oferta de Alface" })
    .waitFor();
  for (const width of [1440, 1366, 1024]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await capture("ofertas-lista-" + width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await audit("ofertas");
  await page.getByRole("textbox", { name: "Pesquisar ofertas" }).fill("Tomate");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByRole("textbox", { name: "Pesquisar ofertas" }).fill("");
  await page.getByRole("button", { name: "Nova oferta", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(35);
    await page.screenshot({
      path: resolve(
        "docs/design/portal/evidencias/ofertas-motion-" + i + ".png",
      ),
      animations: "allow",
    });
  }
  await page.getByRole("heading", { name: "Prepare sua oferta." }).waitFor();
  const motion = await page.locator(".offer-drawer").evaluate((e) => ({
    name: getComputedStyle(e).animationName,
    duration: getComputedStyle(e).animationDuration,
  }));
  assert.equal(motion.name, "offer-drawer-in");
  await page.getByLabel("Lote de origem").selectOption(productions[5].lot.id);
  await page.getByLabel("Quantidade ofertada (kg)").fill("5.25");
  await page.getByLabel(/^Modalidade/).selectOption("VENDA");
  await page.getByLabel("Preço por kg (R$)").fill("4.90");
  const tomorrow = new Date(Date.now() + 86400000);
  const local = new Date(tomorrow - tomorrow.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.locator(".offer-drawer input[type=datetime-local]").fill(local);
  await capture("ofertas-criacao");
  await audit("ofertas-criacao");
  await page.setViewportSize({ width: 1366, height: 768 });
  await capture("ofertas-criacao-1366");
  assert.equal(
    await page
      .getByRole("button", { name: "Criar rascunho", exact: true })
      .isVisible(),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  let firstKey;
  await page.route("**/api/agro/offers", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    firstKey = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort("failed");
    await page.unroute("**/api/agro/offers");
  });
  await page
    .getByRole("button", { name: "Criar rascunho", exact: true })
    .click();
  await page.getByText(/Resposta não confirmada/).waitFor();
  const replayPromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/agro/offers") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Confirmar envio", exact: true })
    .click();
  const replay = await replayPromise;
  assert.equal(replay.headers()["idempotency-replayed"], "true");
  assert.equal(replay.request().headers()["idempotency-key"], firstKey);
  await page
    .getByRole("heading", { name: "Detalhes da oferta", exact: true })
    .waitFor();
  const created = await db
    .collection("offers")
    .findOne({ lotId: productions[5].lot.id });
  assert.ok(created);
  assert.equal(
    await db.collection("offers").countDocuments({ lotId: created.lotId }),
    1,
  );
  assert.equal(created.unitPriceCents, 490);
  await page
    .getByLabel("Confirmo a localização informada para publicar esta oferta.")
    .check();
  await capture("ofertas-confirmar-publicacao");
  await audit("ofertas-publicacao");
  await page.setViewportSize({ width: 1366, height: 768 });
  await capture("ofertas-publicacao-1366");
  assert.equal(
    await page
      .getByRole("button", { name: "Publicar oferta", exact: true })
      .isVisible(),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  let publicationKey;
  await page.route("**/api/agro/offers/*/publish", async (route) => {
    publicationKey = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort("failed");
    await page.unroute("**/api/agro/offers/*/publish");
  });
  await page
    .getByRole("button", { name: "Publicar oferta", exact: true })
    .click();
  await page.getByText(/Resposta não confirmada/).waitFor();
  const publishedPromise = page.waitForResponse((r) =>
    r.url().endsWith("/publish"),
  );
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .click();
  const published = await publishedPromise;
  assert.equal(published.headers()["idempotency-replayed"], "true");
  assert.equal(
    published.request().headers()["idempotency-key"],
    publicationKey,
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Oferta publicada." })
    .first()
    .waitFor();
  assert.equal(
    (await db.collection("offers").findOne({ _id: created._id })).status,
    "PUBLICADA",
  );
  assert.equal(
    await db
      .collection("traceEvents")
      .countDocuments({ operationId: created._id, type: "OFERTA_PUBLICADA" }),
    1,
  );
  await capture("ofertas-publicada");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Nova oferta", exact: true }).click();
  await page.getByLabel("Lote de origem").selectOption(productions[6].lot.id);
  await page.getByLabel("Quantidade ofertada (kg)").fill("2");
  await page.locator(".offer-drawer input[type=datetime-local]").fill(local);
  await page
    .getByRole("button", { name: "Criar rascunho", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Detalhes da oferta", exact: true })
    .waitFor();
  assert.equal(
    (await db.collection("offers").findOne({ lotId: productions[6].lot.id }))
      .unitPriceCents,
    0,
  );
  await page.keyboard.press("Escape");
  for (const index of [7, 8]) {
    const r = await context.request.post(base + "/api/agro/offers", {
      headers: { Origin: base, "Idempotency-Key": randomUUID() },
      data: {
        lotId: productions[index].lot.id,
        quantityKg: 1,
        destinationMode: "DOACAO",
        availableUntil: tomorrow.toISOString(),
      },
    });
    assert.equal(r.status(), 201);
  }
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await page.getByText("9 ofertas da propriedade").waitFor();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByRole("button", { name: "Anterior", exact: true }).click();
  await page.getByLabel("Filtrar modalidade").selectOption("VENDA");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Filtrar modalidade").selectOption("");
  await page.getByLabel("Filtrar situação da oferta").selectOption("RASCUNHO");
  assert.equal(await page.locator("tbody tr").count(), 3);
  await capture("ofertas-rascunhos");
  await page.getByLabel("Filtrar situação da oferta").selectOption("");
  // Erro de consulta e recuperação, sem substituir dados operacionais.
  await page.route("**/api/agro/offers?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Consulta indisponível no teste de recuperação." },
      }),
    }),
  );
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await page
    .getByText("Consulta indisponível no teste de recuperação.", {
      exact: true,
    })
    .waitFor();
  await capture("ofertas-erro");
  await page.unroute("**/api/agro/offers?*");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Detalhes da oferta de Tomate" })
    .first()
    .waitFor();
  for (const data of [
    {
      lotId: created.lotId,
      quantityKg: 0,
      destinationMode: "DOACAO",
      availableUntil: tomorrow.toISOString(),
    },
    {
      lotId: created.lotId,
      quantityKg: 1,
      destinationMode: "VENDA",
      unitPriceCents: 0,
      availableUntil: tomorrow.toISOString(),
    },
    {
      lotId: created.lotId,
      quantityKg: 1,
      destinationMode: "DOACAO",
      availableUntil: "2020-01-01T00:00:00.000Z",
    },
  ]) {
    const invalid = await context.request.post(base + "/api/agro/offers", {
      headers: { Origin: base, "Idempotency-Key": randomUUID() },
      data,
    });
    assert.equal(invalid.status(), 400);
  }
  const missing = await context.request.post(base + "/api/agro/offers", {
    headers: { Origin: base },
    data: {},
  });
  assert.equal(missing.status(), 400);
  const duplicate = await context.request.post(base + "/api/agro/offers", {
    headers,
    data: {
      lotId: created.lotId,
      quantityKg: 1,
      destinationMode: "DOACAO",
      availableUntil: tomorrow.toISOString(),
    },
  });
  assert.equal(duplicate.status(), 409);
  const foreign = await context.request.post(base + "/api/agro/offers", {
    headers: { Origin: base, "Idempotency-Key": randomUUID() },
    data: {
      lotId: randomUUID(),
      quantityKg: 1,
      destinationMode: "DOACAO",
      availableUntil: tomorrow.toISOString(),
    },
  });
  assert.equal(foreign.status(), 404);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Nova oferta", exact: true }).click();
  const reduced = await page
    .locator(".offer-drawer")
    .evaluate((e) => getComputedStyle(e).animationDuration);
  assert.ok(parseFloat(reduced) < 0.01);
  await page.keyboard.press("Escape");
  await page.getByLabel("Organização ativa").selectOption(ids.otherOrg);
  await page
    .getByRole("button", { name: "Nova oferta", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Nova oferta", exact: true })
      .isDisabled(),
    true,
  );
  const forbidden = await context.request.post(base + "/api/agro/offers", {
    headers: { Origin: base, "Idempotency-Key": randomUUID() },
    data: {},
  });
  assert.equal(forbidden.status(), 403);
  await capture("ofertas-leitor-vazio");
  await page
    .getByRole("button", { name: "Sair do portal", exact: true })
    .click();
  await page.getByRole("button", { name: "Entrar no portal" }).waitFor();
  result.checks.push(
    "Ofertas: criação VENDA e publicação reais; resposta perdida e replay das duas operações sem duplicatas; preço em centavos; pesquisa; três resoluções; LEITOR; lote estrangeiro; chave obrigatória; reduced-motion; axe lista/criação/publicação",
  );
}
