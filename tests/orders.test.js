import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { openStore, balance } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import { passwordHash } from "../server/security.js";

async function setupServer() {
  const db = openStore(":memory:");
  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "testadminsecret",
  });
  const server = createApp(db, config);
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

  return {
    db,
    config,
    server,
    origin,
    request,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test("order creation distinguishes gift vs log and protects discord credentials", async () => {
  const ctx = await setupServer();
  try {
    // 1. Create a user and credit wallet with 300,000 VND
    const userId = randomUUID();
    const email = "buyer@example.com";
    const passHash = await passwordHash("securepassword123");
    ctx.db
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId, email, passHash, Date.now());

    // Credit user's wallet
    const depositId = randomUUID();
    ctx.db
      .prepare(
        "INSERT INTO deposits (id, user_id, code, amount, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(depositId, userId, "VNL1234567890AB", 300000, "credited", Date.now(), Date.now() + 86400000);
    ctx.db
      .prepare(
        "INSERT INTO bank_events (transaction_id, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("TX1001", depositId, 300000, "credited", Date.now());
    ctx.db
      .prepare(
        "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), userId, depositId, "TX1001", 300000, Date.now());

    assert.equal(balance(ctx.db, userId), 300000);

    // 2. Log in
    const loginRes = await ctx.request("POST", "/api/auth/login", {
      email,
      password: "securepassword123",
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers["set-cookie"][0].split(";")[0];
    const csrfToken = loginRes.data.csrfToken;
    const authHeaders = {
      Cookie: cookie,
      "X-CSRF-Token": csrfToken,
    };

    // 3. Place GIFT order (Nitro Boost Gift 1m: 99,000đ)
    // Gift does NOT need Discord credentials
    const giftOrderRes = await ctx.request(
      "POST",
      "/api/orders",
      {
        name: "Nguyen Van A",
        email: "buyer@example.com",
        items: [{ productId: "nitro", variantId: "boost_gift_1m", quantity: 1 }],
      },
      authHeaders,
    );
    assert.equal(giftOrderRes.status, 201);
    assert.equal(giftOrderRes.data.success, true);
    assert.equal(giftOrderRes.data.order.hasLogItems, false);
    assert.equal(giftOrderRes.data.order.total, 99000);
    assert.equal(giftOrderRes.data.balance, 201000);
    const giftOrderId = giftOrderRes.data.order.id;

    // 4. Place LOG order without credentials -> MUST FAIL (400)
    const logOrderFail = await ctx.request(
      "POST",
      "/api/orders",
      {
        name: "Nguyen Van A",
        email: "buyer@example.com",
        items: [{ productId: "nitro", variantId: "boost_log_1m", quantity: 1 }],
      },
      authHeaders,
    );
    assert.equal(logOrderFail.status, 400);

    // 5. Place LOG order with credentials but insufficient backup codes -> MUST FAIL (400)
    const logOrderBadCodes = await ctx.request(
      "POST",
      "/api/orders",
      {
        name: "Nguyen Van A",
        email: "buyer@example.com",
        discordAccount: "discorduser@gmail.com",
        discordPassword: "supersecretpass",
        backupCodes: "11112222", // only 1 code
        items: [{ productId: "nitro", variantId: "boost_log_1m", quantity: 1 }],
      },
      authHeaders,
    );
    assert.equal(logOrderBadCodes.status, 400);

    // 6. Place LOG order with full valid credentials (3 backup codes) -> SUCCESS (201)
    // Nitro Boost Log 1m: 79,000đ
    const logOrderSuccess = await ctx.request(
      "POST",
      "/api/orders",
      {
        name: "Nguyen Van A",
        email: "buyer@example.com",
        discordAccount: "discorduser@gmail.com",
        discordPassword: "supersecretpass",
        backupCodes: "12345678, 87654321, 99887766",
        items: [{ productId: "nitro", variantId: "boost_log_1m", quantity: 1 }],
      },
      authHeaders,
    );
    assert.equal(logOrderSuccess.status, 201);
    assert.equal(logOrderSuccess.data.order.hasLogItems, true);
    assert.equal(logOrderSuccess.data.order.total, 79000);
    assert.equal(logOrderSuccess.data.balance, 122000); // 201,000 - 79,000 = 122,000
    const logOrderId = logOrderSuccess.data.order.id;

    // 7. Verify Customer GET /api/orders NEVER exposes password or backup codes!
    const customerOrdersRes = await ctx.request("GET", "/api/orders", null, authHeaders);
    assert.equal(customerOrdersRes.status, 200);
    assert.equal(customerOrdersRes.data.orders.length, 2);
    for (const ord of customerOrdersRes.data.orders) {
      assert.equal(ord.discordPassword, undefined);
      assert.equal(ord.backupCodes, undefined);
      assert.equal("discord_password" in ord, false);
      assert.equal("backup_codes" in ord, false);
    }

    // 8. Admin Endpoint Access Control
    // Without Admin Key -> 401
    const unauthAdmin = await ctx.request("GET", "/api/admin/orders");
    assert.equal(unauthAdmin.status, 401);

    // With wrong Admin Key -> 401
    const wrongKeyAdmin = await ctx.request("GET", "/api/admin/orders", null, {
      "X-Admin-Key": "wrong-secret",
    });
    assert.equal(wrongKeyAdmin.status, 401);

    // With valid Admin Key -> 200 and CAN view credentials!
    const adminOrders = await ctx.request("GET", "/api/admin/orders", null, {
      "X-Admin-Key": "testadminsecret",
    });
    assert.equal(adminOrders.status, 200);
    assert.equal(adminOrders.data.orders.length, 2);

    const adminLogOrder = adminOrders.data.orders.find((o) => o.id === logOrderId);
    assert.equal(adminLogOrder.discordAccount, "discorduser@gmail.com");
    assert.equal(adminLogOrder.discordPassword, "supersecretpass");
    assert.equal(adminLogOrder.backupCodes, "12345678, 87654321, 99887766");

    // 9. Admin updates Gift order with claim link and marks completed
    const patchRes = await ctx.request(
      "PATCH",
      `/api/admin/orders/${giftOrderId}`,
      {
        status: "completed",
        claimLink: "https://discord.gift/ABCDEFGHIJKLMNOP",
      },
      { "X-Admin-Key": "testadminsecret" },
    );
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.order.status, "completed");
    assert.equal(patchRes.data.order.claimLink, "https://discord.gift/ABCDEFGHIJKLMNOP");

    // 10. Customer now sees the claimLink in their orders
    const updatedCustomerOrders = await ctx.request("GET", "/api/orders", null, authHeaders);
    const customerGiftOrder = updatedCustomerOrders.data.orders.find((o) => o.id === giftOrderId);
    assert.equal(customerGiftOrder.status, "completed");
    assert.equal(customerGiftOrder.claimLink, "https://discord.gift/ABCDEFGHIJKLMNOP");

    // 11. Insufficient balance test
    // User balance is now 122,000 VND. Try to order Nitro Boost Gift 1y (950,000 VND)
    const expensiveOrder = await ctx.request(
      "POST",
      "/api/orders",
      {
        name: "Nguyen Van A",
        email: "buyer@example.com",
        items: [{ productId: "nitro", variantId: "boost_gift_1y", quantity: 1 }],
      },
      authHeaders,
    );
    assert.equal(expensiveOrder.status, 400);
    assert.match(expensiveOrder.data.error, /Số dư ví không đủ/);
  } finally {
    await ctx.close();
  }
});
