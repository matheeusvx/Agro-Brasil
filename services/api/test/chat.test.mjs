import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  MongoMemoryReplSet,
  MongoMemoryServer,
} from "mongodb-memory-server-core";
import { connectDatabase } from "../src/database.mjs";
import { createApp } from "../src/app.mjs";
import { tokenHash } from "../src/auth.mjs";
import { pairKey, chatText } from "../src/chat.mjs";

test("chat: chave canônica e texto simples", () => {
  assert.equal(pairKey(["b", "a"]), pairKey(["a", "b"]));
  assert.equal(chatText(" oi\r\n "), "oi");
  for (const value of [null, {}, "", " ".repeat(20), "x".repeat(2001), "x\x00"])
    assert.throws(() => chatText(value));
  assert.equal(
    chatText("<script>alert(1)</script>"),
    "<script>alert(1)</script>",
  );
});
test(
  "chat HTTP, concorrência, isolamento e persistência",
  { timeout: 180000 },
  async (t) => {
    let mongo, connection, server, base;
    const profiles = {};
    const start = async () => {
      server = createApp(connection.db, { demoAuthEnabled: true }).listen(
        0,
        "127.0.0.1",
      );
      await once(server, "listening");
      base = `http://127.0.0.1:${server.address().port}/api/v1`;
    };
    const request = async (who, path, body, key = randomUUID()) => {
      const p = profiles[who];
      const r = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${p.token}`,
          "X-Organization-Id": p.org,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: r.status,
        body: await r.json(),
        replayed: r.headers.get("idempotency-replayed"),
      };
    };
    const expect = async (...args) => {
      const r = await request(...args);
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r));
      return r.body;
    };
    let chat, orderId;
    const sendKey = randomUUID();
    try {
      const dir = resolve(".data/chat-" + randomUUID());
      await mkdir(dir, { recursive: true });
      mongo = await MongoMemoryReplSet.create({
        binary: {
          version: "8.0.16",
          downloadDir: resolve(".cache/mongodb-binaries"),
        },
        instanceOpts: [{ dbPath: dir }],
        replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      });
      connection = await connectDatabase({
        uri: mongo.getUri(),
        name: "chat_test",
      });
      let db = connection.db;
      for (const [name, type] of Object.entries({
        p: "PEQUENO_PRODUTOR_RURAL",
        i: "INSTITUICAO",
        c: "COOPERATIVA",
        x: "COOPERATIVA",
        b: "COMPRADOR_LOCAL",
      })) {
        const p = {
          user: randomUUID(),
          org: randomUUID(),
          token: randomBytes(32).toString("base64url"),
        };
        profiles[name] = p;
        await db
          .collection("organizations")
          .insertOne({ _id: p.org, type, status: "ATIVA" });
        await db
          .collection("users")
          .insertOne({ _id: p.user, status: "ATIVO" });
        await db.collection("memberships").insertOne({
          userId: p.user,
          organizationId: p.org,
          status: "ATIVO",
          role: "ADMIN",
        });
        await db.collection("demoTokens").insertOne({
          userId: p.user,
          tokenHash: tokenHash(p.token),
          expiresAt: new Date(Date.now() + 3600000),
        });
      }
      profiles.p2 = {
        user: randomUUID(),
        org: profiles.p.org,
        token: randomBytes(32).toString("base64url"),
      };
      await db
        .collection("users")
        .insertOne({ _id: profiles.p2.user, status: "ATIVO" });
      await db.collection("memberships").insertOne({
        userId: profiles.p2.user,
        organizationId: profiles.p.org,
        status: "ATIVO",
        role: "EDITOR",
      });
      await db.collection("demoTokens").insertOne({
        userId: profiles.p2.user,
        tokenHash: tokenHash(profiles.p2.token),
        expiresAt: new Date(Date.now() + 3600000),
      });
      await start();
      await t.test(
        "consulta vazia e inexistência de relação não autorizam abertura",
        async () => {
          assert.deepEqual((await expect("p", "/chats")).data, []);
          assert.equal(
            (
              await request("p", "/chats/open", {
                organizationId: profiles.i.org,
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request("p", "/chats/open", {
                organizationId: profiles.p.org,
              })
            ).status,
            400,
          );
          assert.equal(
            (await request("p", "/chats/not-id/messages")).status,
            400,
          );
        },
      );
      orderId = randomUUID();
      await db.collection("orders").insertOne({
        _id: orderId,
        sellerOrganizationId: profiles.p.org,
        requesterOrganizationId: profiles.i.org,
        status: "ACEITO",
        createdAt: new Date().toISOString(),
        shipment: { id: randomUUID(), carrierOrganizationId: profiles.c.org },
      });
      await t.test(
        "abertura concorrente e aviso único por par/pedido",
        async () => {
          const responses = await Promise.all(
            Array.from({ length: 8 }, (_, i) =>
              expect(i % 2 ? "i" : "p", "/chats/open", {
                organizationId: i % 2 ? profiles.p.org : profiles.i.org,
              }),
            ),
          );
          chat = responses[0].data;
          assert.equal(new Set(responses.map((r) => r.data.id)).size, 1);
          assert.equal(await db.collection("chats").countDocuments(), 1);
          assert.equal(await db.collection("chatOrders").countDocuments(), 1);
          assert.equal(
            await db
              .collection("chatMessages")
              .countDocuments({ kind: "ORDER_LINK" }),
            1,
          );
          assert.equal((await expect("p", "/chats")).pagination.total, 1);
        },
      );
      await t.test(
        "cooperativa designada comunica com ambos; terceiros não enumeram",
        async () => {
          for (const target of ["p", "i"])
            assert.ok(
              (
                await expect("c", "/chats/open", {
                  organizationId: profiles[target].org,
                })
              ).data.id,
            );
          assert.equal(
            (
              await request("x", "/chats/open", {
                organizationId: profiles.p.org,
              })
            ).status,
            404,
          );
          assert.deepEqual((await expect("x", "/chats")).data, []);
          for (const method of [undefined, { text: "intrusão" }])
            assert.equal(
              (await request("x", `/chats/${chat.id}/messages`, method)).status,
              404,
            );
          assert.equal(
            (
              await request("b", "/chats/open", {
                organizationId: profiles.p.org,
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        "segundo pedido reutiliza conversa e materializa um aviso em polling",
        async () => {
          const id = randomUUID();
          await db.collection("orders").insertOne({
            _id: id,
            sellerOrganizationId: profiles.p.org,
            requesterOrganizationId: profiles.i.org,
            status: "SOLICITADO",
            createdAt: new Date().toISOString(),
          });
          await Promise.all(
            Array.from({ length: 4 }, () =>
              expect("i", `/chats/${chat.id}/messages`),
            ),
          );
          assert.equal(
            (
              await expect("i", "/chats/open", {
                organizationId: profiles.p.org,
              })
            ).data.id,
            chat.id,
          );
          assert.equal(
            await db
              .collection("chatOrders")
              .countDocuments({ chatId: chat.id }),
            2,
          );
          assert.equal(
            await db.collection("chatMessages").countDocuments({
              chatId: chat.id,
              kind: "ORDER_LINK",
              orderId: id,
            }),
            1,
          );
        },
      );
      await t.test(
        "envio concorrente idempotente, usuários da organização e projeção",
        async () => {
          const key = sendKey;
          const results = await Promise.all(
            Array.from({ length: 6 }, () =>
              request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "Olá <b>texto</b>" },
                key,
              ),
            ),
          );
          for (const r of results)
            assert.ok([200, 201].includes(r.status), JSON.stringify(r));
          assert.equal(new Set(results.map((r) => r.body.data.id)).size, 1);
          assert.equal(
            (
              await request(
                "p2",
                `/chats/${chat.id}/messages`,
                { text: "Olá <b>texto</b>" },
                key,
              )
            ).replayed,
            "true",
          );
          assert.equal(
            (
              await request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "outro" },
                key,
              )
            ).status,
            409,
          );
          const r = await expect("p2", `/chats/${chat.id}/messages`, {
            text: "Outro autor",
          });
          const stored = await db
            .collection("chatMessages")
            .findOne({ _id: r.data.id });
          assert.equal(stored.authorUserId, profiles.p2.user);
          assert.equal(r.data.authorUserId, undefined);
          assert.equal(r.data.idempotencyId, undefined);
          for (const text of ["", null, "x".repeat(2001), "x\x00"])
            assert.equal(
              (await request("p", `/chats/${chat.id}/messages`, { text }))
                .status,
              400,
            );
          assert.equal(
            (
              await request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "a" },
                "short",
              )
            ).status,
            400,
          );
        },
      );
      await t.test(
        "vínculo múltiplo respeita organização selecionada e corpo não forja autor",
        async () => {
          await db.collection("memberships").insertOne({
            userId: profiles.p.user,
            organizationId: profiles.x.org,
            status: "ATIVO",
            role: "ADMIN",
          });
          profiles.multi = { ...profiles.p, org: profiles.x.org };
          assert.deepEqual((await expect("multi", "/chats")).data, []);
          assert.equal(
            (await request("multi", `/chats/${chat.id}/messages`)).status,
            404,
          );
          assert.equal(
            (
              await request("multi", `/chats/${chat.id}/messages`, {
                text: "forjado",
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request("p", `/chats/${chat.id}/messages`, {
                text: "forjado",
                authorUserId: profiles.i.user,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("p", "/chats/open", {
                organizationId: profiles.i.org,
                orderId: orderId,
              })
            ).status,
            400,
          );
          await db.collection("memberships").deleteOne({
            userId: profiles.p.user,
            organizationId: profiles.x.org,
          });
        },
      );
      await t.test(
        "paginação estável, sequência, vazio e limite distribuído",
        async () => {
          const first = await expect("i", `/chats/${chat.id}/messages?limit=2`);
          assert.equal(first.data.length, 2);
          assert.equal(first.pagination.hasMore, true);
          const rest = await expect(
            "i",
            `/chats/${chat.id}/messages?after=${first.pagination.nextAfter}`,
          );
          assert.ok(
            rest.data.every((m) => m.sequence > first.pagination.nextAfter),
          );
          assert.equal(
            new Set([...first.data, ...rest.data].map((m) => m.sequence)).size,
            first.data.length + rest.data.length,
          );
          assert.deepEqual(
            (await expect("i", `/chats/${chat.id}/messages?after=100000`)).data,
            [],
          );
          assert.equal(
            (await request("i", `/chats/${chat.id}/messages?limit=0`)).status,
            400,
          );
          for (let n = 0; n < 30; n++)
            await expect(
              "i",
              `/chats/${chat.id}/messages`,
              { text: "Teste " + n },
              "rate_key_" + n,
            );
          assert.equal(
            (
              await request("i", `/chats/${chat.id}/messages`, {
                text: "excesso",
              })
            ).status,
            429,
          );
          assert.equal(
            (
              await request(
                "i",
                `/chats/${chat.id}/messages`,
                { text: "Teste 0" },
                "rate_key_0",
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "LEITOR consulta, revogação e inativação bloqueiam sem apagar histórico",
        async () => {
          await db
            .collection("memberships")
            .updateOne(
              { userId: profiles.i.user },
              { $set: { role: "LEITOR" } },
            );
          await expect("i", `/chats/${chat.id}/messages`);
          for (const route of ["/chats/open", `/chats/${chat.id}/messages`])
            assert.equal(
              (
                await request(
                  "i",
                  route,
                  route.endsWith("open")
                    ? { organizationId: profiles.p.org }
                    : { text: "a" },
                )
              ).status,
              403,
            );
          await db
            .collection("memberships")
            .updateOne(
              { userId: profiles.i.user },
              { $set: { status: "INATIVO" } },
            );
          assert.equal((await request("i", "/chats")).status, 403);
          await db
            .collection("memberships")
            .updateOne(
              { userId: profiles.i.user },
              { $set: { status: "ATIVO" } },
            );
          await db
            .collection("users")
            .updateOne(
              { _id: profiles.i.user },
              { $set: { status: "INATIVO" } },
            );
          assert.equal((await request("i", "/chats")).status, 401);
          await db
            .collection("users")
            .updateOne({ _id: profiles.i.user }, { $set: { status: "ATIVO" } });
          await db
            .collection("organizations")
            .updateOne(
              { _id: profiles.i.org },
              { $set: { status: "INATIVA" } },
            );
          assert.equal((await request("i", "/chats")).status, 403);
          assert.equal(
            (await request("p", `/chats/${chat.id}/messages`)).status,
            404,
          );
          await db
            .collection("organizations")
            .updateOne({ _id: profiles.i.org }, { $set: { status: "ATIVA" } });
          await db
            .collection("orders")
            .updateOne(
              { _id: orderId },
              { $set: { "shipment.carrierOrganizationId": profiles.x.org } },
            );
          const cChat = await db
            .collection("chats")
            .findOne({ pairKey: pairKey([profiles.c.org, profiles.p.org]) });
          assert.equal(
            (await request("c", `/chats/${cChat._id}/messages`)).status,
            404,
          );
          assert.deepEqual((await expect("c", "/chats")).data, []);
          assert.ok(
            await db
              .collection("chatMessages")
              .countDocuments({ chatId: cChat._id }),
          );
        },
      );
      await t.test(
        "comprador participa somente dos seus pedidos e cancelamento remove acesso",
        async () => {
          const id = randomUUID();
          await db.collection("orders").insertOne({
            _id: id,
            sellerOrganizationId: profiles.p.org,
            requesterOrganizationId: profiles.b.org,
            status: "SOLICITADO",
            createdAt: new Date().toISOString(),
          });
          const c = (
            await expect("b", "/chats/open", { organizationId: profiles.p.org })
          ).data;
          await expect("b", `/chats/${c.id}/messages`, {
            text: "Consulta do comprador",
          });
          await db
            .collection("orders")
            .updateOne({ _id: id }, { $set: { status: "CANCELADO" } });
          assert.equal(
            (await request("b", `/chats/${c.id}/messages`)).status,
            404,
          );
          assert.deepEqual((await expect("b", "/chats")).data, []);
          assert.ok(
            await db
              .collection("chatMessages")
              .countDocuments({ chatId: c.id }),
          );
        },
      );
      await t.test(
        "reinício API, conexão e MongoDB preserva sequência e idempotência",
        async () => {
          await new Promise((r) => server.close(r));
          server = undefined;
          await connection.client.close();
          connection = undefined;
          const port = mongo.servers[0].instanceInfo.port;
          await mongo.stop({ doCleanup: false });
          mongo = await MongoMemoryServer.create({
            binary: {
              version: "8.0.16",
              downloadDir: resolve(".cache/mongodb-binaries"),
            },
            instance: {
              dbPath: dir,
              port,
              replSet: "testset",
              storageEngine: "wiredTiger",
              ip: "127.0.0.1",
            },
          });
          connection = await connectDatabase({
            uri: mongo.getUri(),
            name: "chat_test",
          });
          db = connection.db;
          await start();
          assert.equal(
            (
              await request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "Olá <b>texto</b>" },
                sendKey,
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "Olá <b>texto</b>" },
                "restart_key",
              )
            ).status,
            201,
          );
          const r = await expect("p", `/chats/${chat.id}/messages?limit=100`);
          assert.ok(r.data.length > 30);
          assert.ok(
            r.data.every((m, i) => !i || m.sequence > r.data[i - 1].sequence),
          );
          assert.equal(
            (
              await request(
                "p",
                `/chats/${chat.id}/messages`,
                { text: "Olá <b>texto</b>" },
                "restart_key",
              )
            ).status,
            200,
          );
        },
      );
    } finally {
      if (server) await new Promise((r) => server.close(r));
      if (connection) await connection.client.close();
      if (mongo) await mongo.stop();
    }
  },
);
