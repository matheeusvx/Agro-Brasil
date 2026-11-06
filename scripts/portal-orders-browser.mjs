import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
export async function runOrders({
  page,
  context,
  db,
  ids,
  base,
  capture,
  audit,
  result,
}) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const cooperative = randomUUID();
  await db
    .collection("organizations")
    .insertOne({
      _id: cooperative,
      name: "Cooperativa do Campo",
      type: "COOPERATIVA",
      status: "ATIVA",
    });
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page.getByRole("heading", { name: "Pedidos recebidos" }).waitFor();
  await page.locator("tbody tr").first().waitFor();
  for (const width of [1440, 1366, 1024]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await capture("pedidos-lista-" + width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await audit("pedidos");
  const target = await db
    .collection("orders")
    .findOne({ sellerOrganizationId: ids.org, status: "SOLICITADO" });
  const dir = resolve("docs/design/portal/pedidos/frames");
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
  await page
    .getByRole("button", {
      name: "Detalhes do pedido " + target._id.slice(0, 8),
    })
    .click();
  await page.waitForTimeout(650);
  await capture("pedidos-detalhes");
  await page
    .getByRole("button", { name: "Aceitar solicitação", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.getByLabel(/Cooperativa \(opcional\)/).selectOption(cooperative);
  await page
    .getByLabel("Confirmo a localização e a operação indicada.")
    .check();
  let key;
  await page.route("**/api/agro/orders/*/accept", async (route) => {
    key = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort("failed");
    await page.unroute("**/api/agro/orders/*/accept");
  });
  await page
    .getByRole("button", { name: "Confirmar operação", exact: true })
    .click();
  await page.getByText(/Resposta não confirmada/).waitFor();
  const replayPromise = page.waitForResponse((r) =>
    r.url().endsWith("/accept"),
  );
  await page
    .getByRole("button", { name: "Reenviar confirmação", exact: true })
    .click();
  const replay = await replayPromise;
  assert.equal(replay.request().headers()["idempotency-key"], key);
  assert.equal(replay.headers()["idempotency-replayed"], "true");
  await page
    .getByText("Operação concluída: Aceito.", { exact: true })
    .waitFor();
  await page.waitForTimeout(900);
  await capture("pedidos-aceito");
  assert.equal(
    await db
      .collection("traceEvents")
      .countDocuments({ orderId: target._id, type: "PEDIDO_ACEITO" }),
    1,
  );
  await page
    .getByRole("button", { name: "Registrar retirada", exact: true })
    .click();
  await page
    .getByLabel("Confirmo a localização e a operação indicada.")
    .check();
  await page
    .getByRole("button", { name: "Confirmar operação", exact: true })
    .click();
  await page
    .getByText("Operação concluída: Retirado.", { exact: true })
    .waitFor();
  await page.waitForTimeout(900);
  await capture("pedidos-retirada");
  await audit("pedidos-detalhes");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const cancel = await db
    .collection("orders")
    .findOne({ sellerOrganizationId: ids.org, status: "SOLICITADO" });
  await page
    .getByRole("button", {
      name: "Detalhes do pedido " + cancel._id.slice(0, 8),
    })
    .click();
  await page
    .getByRole("button", { name: "Cancelar pedido", exact: true })
    .click();
  await page
    .getByLabel("Confirmo a localização e a operação indicada.")
    .check();
  await page
    .getByRole("button", { name: "Confirmar operação", exact: true })
    .click();
  await page
    .getByText("Operação concluída: Cancelado.", { exact: true })
    .waitFor();
  await page.waitForTimeout(1000);
  await capture("pedidos-cancelado");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
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
  const video = resolve("docs/design/portal/pedidos/pedidos-demonstracao.mp4");
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
  await page
    .getByLabel("Situação do pedido", { exact: true })
    .selectOption("RETIRADO");
  assert.equal(await page.locator("tbody tr").count(), 2);
  await page
    .getByRole("button", {
      name: "Detalhes do pedido " + target._id.slice(0, 8),
    })
    .click();
  assert.ok(
    parseFloat(
      await page
        .locator(".order-drawer")
        .evaluate((e) => getComputedStyle(e).animationDuration),
    ) < 0.01,
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Organização ativa").selectOption(ids.otherOrg);
  await page
    .getByText(
      "Nenhum pedido encontrado nesta propriedade ou nos filtros selecionados.",
    )
    .waitFor();
  const denied = await context.request.post(
    base + "/api/agro/orders/" + target._id + "/cancel",
    {
      headers: { Origin: base, "Idempotency-Key": randomUUID() },
      data: {
        location: { municipality: "Campinas", uf: "SP" },
        locationConfirmed: true,
      },
    },
  );
  assert.equal(denied.status(), 403);
  result.checks.push(
    "Pedidos: aceite/replay sem duplicação; retirada; cancelamento; dados MongoDB; três larguras; filtro; LEITOR; redução de movimento; gravação MP4 real",
  );
}
