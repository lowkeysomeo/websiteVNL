import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { openStore, balance } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import { passwordHash } from "../server/security.js";
import {
  DEFAULT_ADMIN_ID,
  formatVND,
  getDiscordSettings,
  saveDiscordSettings,
  buildOrderEmbed,
  sendDiscordOrderNotification,
  sendDiscordTestNotification,
} from "../server/discord.js";

async function creditWallet(db, userId, amount = 500000) {
  const depositId = randomUUID();
  const txId = "TX-" + randomBytes(8).toString("hex");
  const code = "VNL" + randomBytes(6).toString("hex").toUpperCase();
  await db
    .prepare(
      "INSERT INTO deposits (id, user_id, code, amount, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(depositId, userId, code, amount, "credited", Date.now(), Date.now() + 86400000);
  await db
    .prepare(
      "INSERT INTO bank_events (transaction_id, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(txId, depositId, amount, "credited", Date.now());
  await db
    .prepare(
      "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, depositId, txId, amount, Date.now());
}

async function setupTestApp(overrides = {}, fetchFn = globalThis.fetch) {
  const db = await openStore(":memory:");
  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "testadminsecret",
    ...overrides,
  });

  const server = createApp(db, config, { fetchFn });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  async function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        `${origin}${path}`,
        {
          method,
          headers: {
            Origin: config.origin,
            Host: "localhost:3000",
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(payload),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            let data = null;
            try {
              data = JSON.parse(raw);
            } catch {
              data = raw;
            }
            resolve({ status: res.statusCode, headers: res.headers, data });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return { db, config, server, request, close: () => new Promise((res) => server.close(res)) };
}

test("Discord settings: fallback admin ID 604729446649298963, validation và lưu trữ DB", async () => {
  const db = await openStore(":memory:");

  // Default settings when empty
  const initial = await getDiscordSettings(db, {});
  assert.equal(initial.adminId, "604729446649298963");
  assert.equal(initial.webhookUrl, "");
  assert.equal(initial.enabled, false);

  // Settings from env
  const fromEnv = await getDiscordSettings(db, {
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/xyz",
    DISCORD_ADMIN_ID: "604729446649298963",
  });
  assert.equal(fromEnv.webhookUrl, "https://discord.com/api/webhooks/123/xyz");
  assert.equal(fromEnv.adminId, "604729446649298963");
  assert.equal(fromEnv.enabled, true);

  // Validation: Invalid webhook URL
  await assert.rejects(
    async () => {
      await saveDiscordSettings(db, { webhookUrl: "invalid-url", enabled: true });
    },
    (err) => err.status === 400,
  );

  // Validation: Invalid admin ID (must be numeric snowflake)
  await assert.rejects(
    async () => {
      await saveDiscordSettings(db, {
        webhookUrl: "https://discord.com/api/webhooks/123/xyz",
        adminId: "not-a-number",
      });
    },
    (err) => err.status === 400,
  );

  // Valid save
  const saved = await saveDiscordSettings(
    db,
    {
      webhookUrl: "https://discord.com/api/webhooks/999/test-token",
      adminId: "604729446649298963",
      enabled: true,
    },
    1700000000,
  );
  assert.equal(saved.enabled, true);
  assert.equal(saved.webhookUrl, "https://discord.com/api/webhooks/999/test-token");
  assert.equal(saved.adminId, "604729446649298963");

  // Re-fetch from DB
  const reloaded = await getDiscordSettings(db);
  assert.equal(reloaded.enabled, true);
  assert.equal(reloaded.webhookUrl, "https://discord.com/api/webhooks/999/test-token");
  assert.equal(reloaded.adminId, "604729446649298963");
  assert.equal(reloaded.updatedAt, 1700000000);
});

test("Discord embed formatting: tags admin 604729446649298963, format tiền VND, bảo mật password", async () => {
  const order = {
    id: "VNL-TEST99",
    customerName: "Nguyễn Văn A",
    customerEmail: "nguyenvana@gmail.com",
    customerNote: "Giao nhanh giúp em nhé",
    items: [
      {
        productId: "nitro-boost",
        productName: "Discord Nitro 2 Boost",
        variantName: "Gói 1 Tháng",
        price: 90000,
        quantity: 2,
      },
    ],
    total: 180000,
    paymentMethod: "wallet",
    hasLogItems: true,
    discordAccount: "vana#1234",
    discordPassword: "supersecretpassword",
    backupCodes: "11223344\n55667788\n99001122",
    serverInvite: "https://discord.gg/vnltest",
    decorImage: "https://example.com/avatar-decor.png",
    createdAt: Date.now(),
  };

  const payload = buildOrderEmbed(order, { adminId: "604729446649298963" }, "http://localhost:3000");

  // Content must ping admin
  assert.ok(payload.content.includes("<@604729446649298963>"));
  assert.ok(payload.content.includes("VNL-TEST99"));

  const embed = payload.embeds[0];
  assert.equal(embed.title, "🛒 Đơn hàng mới: VNL-TEST99");
  assert.equal(embed.url, "http://localhost:3000/admin.html");

  // Check fields
  const fields = embed.fields;
  const userField = fields.find((f) => f.name.includes("Khách hàng"));
  assert.ok(userField.value.includes("Nguyễn Văn A"));
  assert.ok(userField.value.includes("nguyenvana@gmail.com"));

  const totalField = fields.find((f) => f.name.includes("Tổng thanh toán"));
  assert.ok(totalField.value.includes("180.000₫"));

  const itemsField = fields.find((f) => f.name.includes("Mặt hàng"));
  assert.ok(itemsField.value.includes("Discord Nitro 2 Boost"));
  assert.ok(itemsField.value.includes("180.000₫"));

  const logField = fields.find((f) => f.name.includes("Nạp Acc (Log)"));
  assert.ok(logField, "Phải có trường Nạp Acc");
  assert.ok(logField.value.includes("||supersecretpassword||"), "Mật khẩu phải được bọc trong spoiler ||...||");
  assert.ok(logField.value.includes("11223344"), "Mã dự phòng phải có trong thông tin log");

  const boostField = fields.find((f) => f.name.includes("Server Boost"));
  assert.ok(boostField.value.includes("https://discord.gg/vnltest"));

  const decorField = fields.find((f) => f.name.includes("Ảnh mẫu Decor"));
  assert.ok(decorField.value.includes("https://example.com/avatar-decor.png"));
  assert.equal(embed.image?.url, "https://example.com/avatar-decor.png");
});

test("sendDiscordOrderNotification: gửi thành công và xử lý lỗi mạng an toàn mà không quăng lỗi", async () => {
  const db = await openStore(":memory:");
  await saveDiscordSettings(db, {
    webhookUrl: "https://discord.com/api/webhooks/test/channel",
    adminId: "604729446649298963",
    enabled: true,
  });

  const calls = [];
  const mockFetchSuccess = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, status: 200, text: async () => "ok" };
  };

  const sampleOrder = {
    id: "VNL-ABCD12",
    customerName: "Khách VIP",
    customerEmail: "vip@gmail.com",
    items: [{ productId: "decor-gift", productName: "Profile Decor Gift", price: 50000, quantity: 1 }],
    total: 50000,
    paymentMethod: "wallet",
  };

  const resultSuccess = await sendDiscordOrderNotification(db, sampleOrder, "http://localhost:3000", mockFetchSuccess);
  assert.equal(resultSuccess.sent, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.content.includes("<@604729446649298963>"));

  // Mock network failure (e.g. timeout / connection refused)
  const mockFetchError = async () => {
    throw new Error("Discord API is unreachable");
  };

  // Must NOT throw, should return error object gracefully
  const resultError = await sendDiscordOrderNotification(db, sampleOrder, "http://localhost:3000", mockFetchError);
  assert.equal(resultError.sent, false);
  assert.ok(resultError.error.includes("Discord API is unreachable"));
});

test("HTTP API Admin: Cấu hình Discord, gửi tin thử nghiệm và tự động thông báo khi có đơn mới", async () => {
  let webhookCall = null;
  const mockFetch = async (url, options) => {
    webhookCall = { url, body: JSON.parse(options.body) };
    return { ok: true, status: 200, text: async () => "ok" };
  };

  const { db, config, request, close } = await setupTestApp({}, mockFetch);

  try {
    // 1. Get Discord settings without admin auth -> 401
    const unauthGet = await request("GET", "/api/admin/discord");
    assert.equal(unauthGet.status, 401);

    // 2. Get Discord settings with admin auth -> default admin ID 604729446649298963
    const adminGet = await request("GET", "/api/admin/discord", null, {
      "X-Admin-Key": config.adminPassword,
    });
    assert.equal(adminGet.status, 200);
    assert.equal(adminGet.data.settings.adminId, "604729446649298963");
    assert.equal(adminGet.data.settings.enabled, false);

    // 3. Save Discord settings
    const saveRes = await request(
      "PUT",
      "/api/admin/discord",
      {
        webhookUrl: "https://discord.com/api/webhooks/111222333/test-webhook",
        adminId: "604729446649298963",
        enabled: true,
      },
      { "X-Admin-Key": config.adminPassword },
    );
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.data.settings.webhookUrl, "https://discord.com/api/webhooks/111222333/test-webhook");
    assert.equal(saveRes.data.settings.adminId, "604729446649298963");
    assert.equal(saveRes.data.settings.enabled, true);

    // 4. Test Webhook button
    const testRes = await request(
      "POST",
      "/api/admin/discord/test",
      {
        webhookUrl: "https://discord.com/api/webhooks/111222333/test-webhook",
        adminId: "604729446649298963",
      },
      { "X-Admin-Key": config.adminPassword },
    );
    assert.equal(testRes.status, 200);
    assert.equal(testRes.data.success, true);
    assert.ok(webhookCall.body.content.includes("<@604729446649298963>"));
    assert.ok(webhookCall.body.embeds[0].title.includes("Kiểm tra kết nối"));

    // Reset webhookCall
    webhookCall = null;

    // 5. Create a customer, deposit money, and place an order
    const email = "buyer_discord@gmail.com";
    const regRes = await request("POST", "/api/auth/register", {
      email,
      password: "password123",
    });
    const sessionCookie = regRes.headers["set-cookie"][0].split(";")[0];
    const csrfToken = regRes.data.csrfToken;

    const userRow = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    const userId = userRow.id;

    // Add balance to user
    await creditWallet(db, userId, 500000);

    // Place order
    const orderRes = await request(
      "POST",
      "/api/orders",
      {
        name: "Người mua thử nghiệm",
        email,
        items: [{ productId: "nitro", variantId: "boost_gift_1m", quantity: 1 }],
      },
      { Cookie: sessionCookie, "X-CSRF-Token": csrfToken },
    );

    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.data.success, true);
    const orderId = orderRes.data.order.id;

    // Verify webhook was triggered
    assert.ok(webhookCall, "Discord Webhook phải được gọi khi tạo đơn mới");
    assert.ok(webhookCall.body.content.includes("<@604729446649298963>"), "Webhook phải tag admin ID 604729446649298963");
    assert.ok(webhookCall.body.content.includes(orderId), "Webhook phải chứa mã đơn hàng");
    assert.equal(webhookCall.body.embeds[0].fields[0].value.includes("Người mua thử nghiệm"), true);
  } finally {
    await close();
  }
});

test("Order creation resilience: Nếu Discord webhook bị lỗi/timeout, đơn hàng vẫn tạo thành công 201", async () => {
  // Mock fetch that throws an error
  const mockFailingFetch = async () => {
    throw new Error("Discord gateway timeout (504)");
  };

  const { db, config, request, close } = await setupTestApp({}, mockFailingFetch);

  try {
    // Configure discord to enabled
    await saveDiscordSettings(db, {
      webhookUrl: "https://discord.com/api/webhooks/mock/fail",
      adminId: "604729446649298963",
      enabled: true,
    });

    // Register user & add money
    const email = "buyer_resilience@gmail.com";
    const regRes = await request("POST", "/api/auth/register", {
      email,
      password: "password123",
    });
    const sessionCookie = regRes.headers["set-cookie"][0].split(";")[0];
    const csrfToken = regRes.data.csrfToken;

    const userRow = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    const userId = userRow.id;

    await creditWallet(db, userId, 200000);

    // Place order when Discord is down
    const orderRes = await request(
      "POST",
      "/api/orders",
      {
        name: "Khách hàng kiên cường",
        email,
        items: [{ productId: "nitro", variantId: "boost_gift_1m", quantity: 1 }],
      },
      { Cookie: sessionCookie, "X-CSRF-Token": csrfToken },
    );

    // Order must succeed with 201 Created even though webhook failed!
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.data.success, true);
    assert.ok(orderRes.data.order.id.startsWith("VNL-"));
  } finally {
    await close();
  }
});
