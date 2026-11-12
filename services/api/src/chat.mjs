import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import { HttpError, uuid, invalid } from "./domain.mjs";
import { fields, page, missing, conflict } from "./commerce-domain.mjs";
import { assertTransactions } from "./commerce.mjs";

const states = ["SOLICITADO", "ACEITO", "RETIRADO", "RECEBIDO"];
const party = (id) => ({
  $or: [
    { sellerOrganizationId: id },
    { requesterOrganizationId: id },
    { "shipment.carrierOrganizationId": id },
  ],
});
export const pairKey = (pair) => [...pair].sort().join(":");
export function chatText(value) {
  if (typeof value !== "string") invalid("text deve ser texto simples.");
  const text = value.replace(/\r\n?/g, "\n").trim().normalize("NFC");
  if (
    !text ||
    text.length > 2000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
  )
    invalid("text: 1–2000 caracteres, sem controles.");
  return text;
}
const messageView = (m) => ({
  id: m._id,
  chatId: m.chatId,
  sequence: m.sequence,
  kind: m.kind,
  senderOrganizationId: m.senderOrganizationId || null,
  text: m.text || null,
  orderId: m.orderId || null,
  createdAt: m.createdAt,
});
const chatView = (c) => ({
  id: c._id,
  organizationIds: c.organizationIds,
  createdAt: c.createdAt,
});
const editable = (c) => {
  if (!["ADMIN", "EDITOR"].includes(c.role))
    throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão de envio.");
};

export function chatRouter(db) {
  const router = Router();
  router.use("/chats", (req, _res, next) => {
    if (
      !["ADMIN", "EDITOR", "LEITOR"].includes(req.context.role) ||
      ![
        "PEQUENO_PRODUTOR_RURAL",
        "COOPERATIVA",
        "INSTITUICAO",
        "COMPRADOR_LOCAL",
      ].includes(req.context.organizationType)
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Perfil não autorizado para mensagens.",
      );
    }
    next();
  });
  // All writes are confined to chat collections, never to commercial transactions.
  async function transaction(work) {
    await assertTransactions(db);
    for (let attempt = 0; attempt < 5; attempt++) {
      const session = db.client.startSession();
      try {
        return await session.withTransaction(() => work(session), {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
        });
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      } finally {
        await session.endSession();
      }
    }
  }
  async function relationship(pair, session) {
    const active = await db
      .collection("organizations")
      .countDocuments({ _id: { $in: pair }, status: "ATIVA" }, { session });
    if (active !== 2) missing();
    const orders = await db
      .collection("orders")
      .find(
        { status: { $in: states }, $and: pair.map(party) },
        { session, projection: { _id: 1, createdAt: 1 } },
      )
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    if (!orders.length) missing();
    return orders;
  }
  async function append(chat, values, session) {
    const updated = await db
      .collection("chats")
      .findOneAndUpdate(
        { _id: chat._id },
        { $inc: { sequence: 1 } },
        { session, returnDocument: "after" },
      );
    if (!Number.isSafeInteger(updated.sequence))
      throw new Error("Sequência fora do limite seguro.");
    const message = {
      _id: randomUUID(),
      chatId: chat._id,
      sequence: updated.sequence,
      createdAt: new Date().toISOString(),
      ...values,
    };
    await db.collection("chatMessages").insertOne(message, { session });
    return message;
  }
  async function synchronize(chat, orders, session) {
    const associated = new Set(
      (
        await db
          .collection("chatOrders")
          .find({ chatId: chat._id }, { session, projection: { orderId: 1 } })
          .toArray()
      ).map((row) => row.orderId),
    );
    for (const order of orders) {
      if (associated.has(order._id)) continue;
      const id = chat._id + ":" + order._id;
      const result = await db
        .collection("chatOrders")
        .updateOne(
          { _id: id },
          { $setOnInsert: { chatId: chat._id, orderId: order._id } },
          { session, upsert: true },
        );
      if (result.upsertedCount)
        await append(chat, { kind: "ORDER_LINK", orderId: order._id }, session);
    }
  }
  async function authorized(req, session) {
    const chat = await db.collection("chats").findOne(
      {
        _id: uuid(req.params.id, "id"),
        organizationIds: req.context.organizationId,
      },
      { session },
    );
    if (!chat) missing();
    const orders = await relationship(chat.organizationIds, session);
    await synchronize(chat, orders, session);
    return chat;
  }
  router.post("/chats/open", async (req, res) => {
    editable(req.context);
    fields(req.body, ["organizationId"]);
    const peer = uuid(req.body.organizationId, "organizationId");
    if (peer === req.context.organizationId)
      invalid("Escolha outra organização participante.");
    const pair = [peer, req.context.organizationId].sort();
    const chat = await transaction(async (session) => {
      const orders = await relationship(pair, session);
      const chat = await db.collection("chats").findOneAndUpdate(
        { pairKey: pairKey(pair) },
        {
          $setOnInsert: {
            _id: randomUUID(),
            pairKey: pairKey(pair),
            organizationIds: pair,
            sequence: 0,
            createdAt: new Date().toISOString(),
          },
        },
        { session, upsert: true, returnDocument: "after" },
      );
      await synchronize(chat, orders, session);
      return chat;
    });
    res.json({ data: chatView(chat) });
  });
  router.get("/chats", async (req, res) => {
    const pagination = page(req.query);
    // Validate current relation before pagination, without trusting stored chat grants.
    const [result] = await db
      .collection("chats")
      .aggregate(
        [
          { $match: { organizationIds: req.context.organizationId } },
          {
            $lookup: {
              from: "organizations",
              localField: "organizationIds",
              foreignField: "_id",
              as: "participants",
              pipeline: [
                { $match: { status: "ATIVA" } },
                { $project: { _id: 1 } },
              ],
            },
          },
          { $match: { $expr: { $eq: [{ $size: "$participants" }, 2] } } },
          {
            $lookup: {
              from: "orders",
              let: { pair: "$organizationIds" },
              pipeline: [
                {
                  $match: {
                    ...party(req.context.organizationId),
                    status: { $in: states },
                    $expr: {
                      $setIsSubset: [
                        "$$pair",
                        [
                          "$sellerOrganizationId",
                          "$requesterOrganizationId",
                          "$shipment.carrierOrganizationId",
                        ],
                      ],
                    },
                  },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: "relation",
            },
          },
          { $match: { "relation.0": { $exists: true } } },
          { $sort: { createdAt: -1, _id: -1 } },
          {
            $facet: {
              rows: [
                { $skip: pagination.offset },
                { $limit: pagination.limit },
                { $project: { organizationIds: 1, createdAt: 1 } },
              ],
              total: [{ $count: "value" }],
            },
          },
        ],
        { readConcern: { level: "snapshot" } },
      )
      .toArray();
    res.json({
      data: result.rows.map(chatView),
      pagination: { ...pagination, total: result.total[0]?.value || 0 },
    });
  });
  router.get("/chats/:id/messages", async (req, res) => {
    const { limit = "50", after = "0" } = req.query;
    if (
      typeof limit !== "string" ||
      !/^\d+$/.test(limit) ||
      +limit < 1 ||
      +limit > 100 ||
      typeof after !== "string" ||
      !/^\d+$/.test(after) ||
      !Number.isSafeInteger(+after)
    )
      invalid("limit: 1–100; after: sequência inteira não negativa.");
    const rows = await transaction(async (session) => {
      const chat = await authorized(req, session);
      return db
        .collection("chatMessages")
        .find({ chatId: chat._id, sequence: { $gt: +after } }, { session })
        .sort({ sequence: 1 })
        .limit(+limit + 1)
        .toArray();
    });
    const data = rows.slice(0, +limit).map(messageView);
    res.json({
      data,
      pagination: {
        limit: +limit,
        after: +after,
        nextAfter: data.at(-1)?.sequence ?? +after,
        hasMore: rows.length > +limit,
      },
    });
  });
  router.post("/chats/:id/messages", async (req, res) => {
    editable(req.context);
    fields(req.body, ["text"]);
    const text = chatText(req.body.text);
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(key))
      invalid("Idempotency-Key: 8–128 letras, números, _ ou -.");
    let replayed = false;
    const message = await transaction(async (session) => {
      replayed = false;
      const chat = await authorized(req, session);
      const idempotencyId = createHash("sha256")
        .update(JSON.stringify([chat._id, req.context.organizationId, key]))
        .digest("hex");
      const previous = await db
        .collection("chatMessages")
        .findOne({ idempotencyId }, { session });
      if (previous) {
        if (previous.text !== text)
          conflict("Chave já utilizada com outro texto.");
        replayed = true;
        return previous;
      }
      const minute = Math.floor(Date.now() / 60000),
        id = req.context.organizationId + ":" + minute;
      const rate = await db.collection("chatRateLimits").findOneAndUpdate(
        { _id: id },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) },
        },
        { session, upsert: true, returnDocument: "after" },
      );
      if (rate.count > 30)
        throw new HttpError(
          429,
          "RATE_LIMITED",
          "Limite de 30 mensagens por minuto por organização.",
        );
      return append(
        chat,
        {
          kind: "TEXT",
          senderOrganizationId: req.context.organizationId,
          authorUserId: req.context.userId,
          text,
          idempotencyId,
        },
        session,
      );
    });
    res
      .set("Idempotency-Replayed", String(replayed))
      .status(replayed ? 200 : 201)
      .json({ data: messageView(message) });
  });
  return router;
}
