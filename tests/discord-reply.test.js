import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { openStore, createOrder, getOrderMessages, savePartner } from "../server/store.js";
import { createCustomProduct } from "../server/pricing.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import {
  verifyDiscordInteractionSignature,
  processDiscordReply,
  saveDiscordSettings,
  savePartnerDiscordSettings,
} from "../server/discord.js";

test("verifyDiscordInteractionSignature: Ed25519 signature verification", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublicKeyHex = publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("hex");

  const timestamp = "1729850000";
  const body = JSON.stringify({ type: 1 });
  const message = Buffer.from(timestamp + body, "utf8");
  const signature = crypto.sign(null, message, privateKey).toString("hex");

  // Valid signature
  const valid = verifyDiscordInteractionSignature(
    {
      "x-signature-ed25519": signature,
      "x-signature-timestamp": timestamp,
    },
    body,
    rawPublicKeyHex,
  );
  assert.equal(valid, true, "Signature should be valid");

  // Tampered body
  const tamperedBody = JSON.stringify({ type: 2 });
  const invalidBody = verifyDiscordInteractionSignature(
    {
      "x-signature-ed25519": signature,
      "x-signature-timestamp": timestamp,
    },
    tamperedBody,
    rawPublicKeyHex,
  );
  assert.equal(invalidBody, false, "Tampered body should fail verification");

  // Wrong timestamp
  const invalidTimestamp = verifyDiscordInteractionSignature(
    {
      "x-signature-ed25519": signature,
      "x-signature-timestamp": "1729859999",
    },
    body,
    rawPublicKeyHex,
  );
  assert.equal(invalidTimestamp, false, "Tampered timestamp should fail verification");

  // Missing headers
  assert.equal(
    verifyDiscordInteractionSignature({}, body, rawPublicKeyHex),
    false,
    "Missing headers should fail",
  );

  // Missing public key
  assert.equal(
    verifyDiscordInteractionSignature(
      { "x-signature-ed25519": signature, "x-signature-timestamp": timestamp },
      body,
      "",
    ),
    false,
    "Missing public key should fail",
  );
});

test("processDiscordReply: Admin can reply to any order from Discord", async () => {
  const db = await openStore(":memory:");
  const adminDiscordId = "604729446649298963";

  await saveDiscordSettings(db, {
    adminId: adminDiscordId,
    enabled: true,
  });

  const order = await createOrder(db, {
    customerEmail: "customer@example.com",
    customerName: "Nguyen Van A",
    paymentMethod: "bank",
    items: [
      {
        productId: "nitro-basic-1m",
        name: "Discord Nitro Basic",
        price: 50000,
        quantity: 1,
      },
    ],
    total: 50000,
    status: "processing",
    notes: "discord: nguyen#1234",
  });

  const res = await processDiscordReply({
    db,
    authorId: adminDiscordId,
    authorName: "AdminBoss",
    orderId: order.id,
    replyText: "Đã xử lý xong đơn cho bạn nhé!",
  });

  assert.equal(res.success, true);
  assert.equal(res.senderRole, "admin");
  assert.equal(res.orderId, order.id);

  const messages = await getOrderMessages(db, order.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].senderRole, "admin");
  assert.equal(messages[0].senderName, "AdminBoss (Shop)");
  assert.equal(messages[0].message, "Đã xử lý xong đơn cho bạn nhé!");
});

test("processDiscordReply: Partner can reply to their assigned product's order", async () => {
  const db = await openStore(":memory:");
  const partnerEmail = "partner@example.com";
  const partnerDiscordId = "888999000111222333";

  // Create partner
  await savePartner(db, {
    email: partnerEmail,
    name: "PartnerPro",
    password: "partner-password-123",
  });

  // Save partner discord settings
  await savePartnerDiscordSettings(db, partnerEmail, {
    discordId: partnerDiscordId,
    enabled: true,
  });

  // Create partner product
  const product = await createCustomProduct(
    db,
    {
      name: "Dịch vụ cày thuê VIP",
      variants: [{ name: "VIP 1", price: 100000, deliveryType: "gift" }],
    },
    Date.now(),
    partnerEmail,
  );

  const order = await createOrder(db, {
    customerName: "Tran Van B",
    customerEmail: "customer2@example.com",
    paymentMethod: "bank",
    requestItems: [
      {
        productId: product.id,
        variantId: product.variants[0].id,
        quantity: 1,
      },
    ],
  });

  const res = await processDiscordReply({
    db,
    authorId: partnerDiscordId,
    authorName: "PartnerPro",
    orderId: order.id,
    replyText: "Dịch vụ của bạn đang được tiến hành, vui lòng đợi 15 phút!",
  });

  assert.equal(res.success, true);
  assert.equal(res.senderRole, "partner");

  const messages = await getOrderMessages(db, order.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].senderRole, "partner");
  assert.equal(messages[0].senderName, "PartnerPro (Đối tác)");
  assert.equal(
    messages[0].message,
    "Dịch vụ của bạn đang được tiến hành, vui lòng đợi 15 phút!",
  );
});

test("processDiscordReply: Partner cannot reply to an order without partner products", async () => {
  const db = await openStore(":memory:");
  const partnerEmail = "partner2@example.com";
  const partnerDiscordId = "111222333444555666";

  await savePartner(db, {
    email: partnerEmail,
    name: "Partner2",
    password: "partner-password-123",
  });

  await savePartnerDiscordSettings(db, partnerEmail, {
    discordId: partnerDiscordId,
    enabled: true,
  });

  // Create normal shop order (no partner items)
  const shopOrder = await createOrder(db, {
    customerEmail: "customer3@example.com",
    customerName: "Le Thi C",
    paymentMethod: "bank",
    items: [
      {
        productId: "nitro-boost-1m",
        name: "Discord Nitro Boost",
        price: 70000,
        quantity: 1,
      },
    ],
    total: 70000,
    status: "processing",
  });

  const res = await processDiscordReply({
    db,
    authorId: partnerDiscordId,
    authorName: "Partner2",
    orderId: shopOrder.id,
    replyText: "Lẻn vào trả lời",
  });

  assert.equal(res.success, false);
  assert.equal(res.reason, "forbidden");
});

test("processDiscordReply: Rejects unauthorized Discord users and invalid orders", async () => {
  const db = await openStore(":memory:");

  // Non-existent order
  const notFound = await processDiscordReply({
    db,
    authorId: "604729446649298963",
    authorName: "Admin",
    orderId: "VNL-NONEXIST",
    replyText: "Hello",
  });
  assert.equal(notFound.success, false);
  assert.equal(notFound.reason, "not_found");

  const order = await createOrder(db, {
    customerEmail: "customer4@example.com",
    customerName: "Pham D",
    paymentMethod: "bank",
    items: [
      {
        productId: "nitro-boost-1m",
        name: "Discord Nitro Boost",
        price: 70000,
        quantity: 1,
      },
    ],
    total: 70000,
    status: "processing",
  });

  const unauth = await processDiscordReply({
    db,
    authorId: "999999999999999999", // not admin nor partner
    authorName: "Stranger",
    orderId: order.id,
    replyText: "Spam message",
  });
  assert.equal(unauth.success, false);
  assert.equal(unauth.reason, "unauthorized");

  // Blank message
  const blank = await processDiscordReply({
    db,
    authorId: "604729446649298963",
    authorName: "Admin",
    orderId: order.id,
    replyText: "   ",
  });
  assert.equal(blank.success, false);
  assert.equal(blank.reason, "invalid_input");
});

test("POST /api/discord/interactions: Handles PING and Slash Command /rep", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublicKeyHex = publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("hex");

  const db = await openStore(":memory:");
  const adminDiscordId = "604729446649298963";

  await saveDiscordSettings(db, {
    adminId: adminDiscordId,
    publicKey: rawPublicKeyHex,
    enabled: true,
  });

  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "testadminsecret",
    DISCORD_PUBLIC_KEY: rawPublicKeyHex,
  });

  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  function sendInteraction(bodyObj) {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(bodyObj);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = Buffer.from(timestamp + bodyStr, "utf8");
      const signature = crypto.sign(null, message, privateKey).toString("hex");

      const req = http.request(
        `${origin}/api/discord/interactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyStr),
            "X-Signature-Ed25519": signature,
            "X-Signature-Timestamp": timestamp,
          },
        },
        (res) => {
          let chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            let json = null;
            try {
              json = JSON.parse(raw);
            } catch {
              // ignore
            }
            resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
          });
        },
      );
      req.on("error", reject);
      req.write(bodyStr);
      req.end();
    });
  }

  try {
    // 1. PING test (type: 1)
    const pingRes = await sendInteraction({ type: 1 });
    assert.equal(pingRes.status, 200);
    assert.deepEqual(pingRes.body, { type: 1 }, "PING should return { type: 1 }");

    // 2. Create customer and order
    const order = await createOrder(db, {
      customerEmail: "slash@example.com",
      customerName: "Slash User",
      paymentMethod: "bank",
      items: [
        {
          productId: "nitro-boost-1m",
          name: "Discord Nitro Boost",
          price: 70000,
          quantity: 1,
        },
      ],
      total: 70000,
      status: "processing",
    });

    // 3. Slash command /rep
    const slashRes = await sendInteraction({
      type: 2,
      data: {
        name: "rep",
        options: [
          { name: "don_hang", value: order.id },
          { name: "tin_nhan", value: "Chào bạn qua lệnh Slash /rep!" },
        ],
      },
      member: {
        user: {
          id: adminDiscordId,
          username: "AdminDiscordSlash",
        },
      },
    });

    assert.equal(slashRes.status, 200);
    assert.equal(slashRes.body.type, 4); // ChannelMessageWithSource
    assert.ok(slashRes.body.data.content.includes("Đã gửi phản hồi"));

    // Check database
    const messages = await getOrderMessages(db, order.id);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].message, "Chào bạn qua lệnh Slash /rep!");
    assert.equal(messages[0].senderRole, "admin");

    // 4. Message Component Button click (type: 3)
    const btnRes = await sendInteraction({
      type: 3,
      data: {
        custom_id: `reply_order:${order.id}`,
      },
    });
    assert.equal(btnRes.status, 200);
    assert.equal(btnRes.body.type, 9); // MODAL
    assert.equal(btnRes.body.data.custom_id, `rep_modal:${order.id}`);

    // 5. Modal Submit (type: 5)
    const modalRes = await sendInteraction({
      type: 5,
      data: {
        custom_id: `rep_modal:${order.id}`,
        components: [
          {
            type: 1,
            components: [
              {
                custom_id: "rep_message",
                value: "Trả lời từ Discord Modal popup!",
              },
            ],
          },
        ],
      },
      member: {
        user: {
          id: adminDiscordId,
          username: "AdminDiscordModal",
        },
      },
    });
    assert.equal(modalRes.status, 200);
    assert.equal(modalRes.body.type, 4);
    assert.ok(modalRes.body.data.content.includes("Đã gửi phản hồi"));

    const messagesAfterModal = await getOrderMessages(db, order.id);
    assert.equal(messagesAfterModal.length, 2);
    assert.equal(messagesAfterModal[1].message, "Trả lời từ Discord Modal popup!");
  } finally {
    server.close();
  }
});
