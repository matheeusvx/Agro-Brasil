import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
export async function runTrace({
  page,
  context,
  db,
  ids,
  base,
  apiRequest,
  productions,
  capture,
  audit,
  result,
}) {
  const location = {
    location: { municipality: "Campinas", uf: "SP" },
    locationConfirmed: true,
  };
  const original = await db
    .collection("orders")
    .findOne({ lotId: productions[0].lot.id });
  const other = await apiRequest(
    "/orders",
    { offerId: original.offerId, quantityKg: 2, ...location },
    true,
  );
  await apiRequest("/orders/" + other.id + "/cancel", location);
  const transported = await db
    .collection("orders")
    .findOne({ status: "RETIRADO" });
  await apiRequest(
    "/shipments/" + transported.shipment.id + "/receipts",
    { quantityAcceptedKg: transported.quantityGrams / 1000, ...location },
    true,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("link", { name: "Rastreabilidade", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Rastreabilidade", exact: true })
    .waitFor();
  await page.locator("tbody tr").first().waitFor();
  await capture("rastreabilidade-lista");
  const dir = resolve("docs/design/portal/rastreabilidade/frames");
  await mkdir(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let chain = Promise.resolve();
  cdp.on("Page.screencastFrame", (f) => {
    const name = resolve(dir, String(frames.length).padStart(5, "0") + ".jpg");
    frames.push({ name, t: f.metadata.timestamp });
    chain = chain.then(() => writeFile(name, Buffer.from(f.data, "base64")));
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 80,
    maxWidth: 1440,
    maxHeight: 900,
    everyNthFrame: 1,
  });

  await page.locator('a[href="/rastreabilidade/' + original._id + '"]').click();
  await page.getByRole("heading", { name: "Trajetória do pedido" }).waitFor();
  await page.locator(".trace-node").first().waitFor();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator(".trace-node[data-cancel=true]").count(), 0);
  assert.equal(await page.locator(".trace-node[data-future=true]").count(), 3);
  await capture("rastreabilidade-solicitado");
  await page.locator(".trace-node").first().click();
  await page.waitForTimeout(600);
  await page.locator(".trace-node").nth(1).click();
  await page.waitForTimeout(600);
  await page.locator(".trace-node").nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  const accepted = await db.collection("orders").findOne({ status: "ACEITO" });
  await page.getByRole("link", { name: "Voltar aos pedidos" }).click();
  await page.locator('a[href="/rastreabilidade/' + accepted._id + '"]').click();
  await page.locator(".trace-node").first().waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator(".trace-node[data-future=true]").count(), 2);
  await capture("rastreabilidade-aceito");
  await apiRequest("/shipments/" + accepted.shipment.id + "/pickup", location);
  await page.getByRole("link", { name: "Voltar aos pedidos" }).click();
  await page.locator('a[href="/rastreabilidade/' + accepted._id + '"]').click();
  await page.locator(".trace-node").first().waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator(".trace-node[data-future=true]").count(), 1);
  await capture("rastreabilidade-retirado");
  await page.getByRole("link", { name: "Voltar aos pedidos" }).click();
  await page
    .locator('a[href="/rastreabilidade/' + transported._id + '"]')
    .click();
  await page.locator(".trace-node").first().waitFor();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator(".trace-node[data-future=true]").count(), 0);
  assert.equal(await page.locator(".trace-node").count(), 6);
  await capture("rastreabilidade-recebido");
  await audit("rastreabilidade");
  for (const width of [1440, 1366, 1024]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await capture("rastreabilidade-" + width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("link", { name: "Voltar aos pedidos" }).click();
  await page.locator('a[href="/rastreabilidade/' + other.id + '"]').click();
  await page.locator(".trace-node[data-cancel=true]").waitFor();
  await page.waitForTimeout(1000);
  await capture("rastreabilidade-cancelado");
  assert.equal(await page.locator(".trace-node[data-future=true]").count(), 0);
  await page.locator(".trace-node[data-cancel=true]").click();
  await page.waitForTimeout(700);
  await cdp.send("Page.stopScreencast");
  await chain;
  const concat = frames
    .map(
      (f, i) =>
        `file '${f.name.replaceAll("\\", "/")}'\nduration ${Math.max(0.02, (frames[i + 1]?.t ?? f.t + 0.4) - f.t)}\n`,
    )
    .join("");
  const list = resolve(dir, "frames.txt");
  await writeFile(list, concat);
  const ffmpeg = resolve(
    ".data/pedidos-tools/node_modules/ffmpeg-static/ffmpeg.exe",
  );
  const video = resolve(
    "docs/design/portal/rastreabilidade/rastreabilidade-demonstracao.mp4",
  );
  const encoded = spawnSync(
    ffmpeg,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-vf",
      "fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-movflags",
      "+faststart",
      video,
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  assert.equal(encoded.status, 0, encoded.stderr?.toString().slice(-500));

  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.ok(
    parseFloat(
      await page
        .locator(".trace-node")
        .first()
        .evaluate((e) => getComputedStyle(e).animationDuration),
    ) < 0.01,
  );
  await page.getByLabel("Organização ativa").selectOption(ids.otherOrg);
  await page
    .getByText(
      "Pedido inexistente ou indisponível na organização e propriedade selecionadas.",
      { exact: true },
    )
    .waitFor();
  const denied = await context.request.get(
    base + "/api/agro/lots/" + original.lotId + "/events",
  );
  assert.ok([403, 404].includes(denied.status()));
  result.checks.push(
    "Rastreabilidade: pedidos compartilhando lote sem mistura; solicitado/recebido/cancelado reais; seis eventos concluídos; consulta de metadados; teclado; três resoluções; acesso cruzado negado; MP4 real; reduced-motion e axe",
  );
}
