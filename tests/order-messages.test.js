import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  openStore,
  getUserOrders,
  getAdminOrders,
  addOrderMessage,
  getOrderMessages,
} from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import { passwordHash, digest } from "../server/security.js";

async function setupServer() {
  const db = await openStore(":memory:");
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

test("Order messages: Store functions validate input, roles, and message ordering", async () => {
  const db = await openStore(":memory:");
  try {
    const userId = randomUUID();
    const orderId = "VNL-TEST-MSG-01";
    await db.prepare("INSERT INTO users VALUES (?, ?, 'pw', ?)").run(userId, "user1@example.com", Date.now());
    await db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, items_json, total, status, created_at)
      VALUES (?, ?, 'Nguyen Van A', 'user1@example.com', '[]', 50000, 'processing', ?)
    `).run(orderId, userId, Date.now());

    // 1. Validation checks
    await assert.rejects(
      () => addOrderMessage(db, { orderId: "NON-EXISTENT", senderRole: "admin", message: "Hello" }),
      (err) => err.status === 404,
    );
    await assert.rejects(
      () => addOrderMessage(db, { orderId, senderRole: "admin", message: "   " }),
      (err) => err.status === 400,
    );
    await assert.rejects(
      () => addOrderMessage(db, { orderId, senderRole: "admin", message: "a".repeat(2001) }),
      (err) => err.status === 400,
    );
    await assert.rejects(
      () => addOrderMessage(db, { orderId, senderRole: "invalid-role", message: "Hello" }),
      (err) => err.status === 400,
    );

    // 2. Add messages from admin and customer
    const m1 = await addOrderMessage(db, {
      orderId,
      senderRole: "customer",
      senderId: userId,
      senderName: "Nguyen Van A",
      message: "Shop ơi đơn này nạp lâu không ạ?",
      now: 1000,
    });
    assert.equal(m1.orderId, orderId);
    assert.equal(m1.senderRole, "customer");
    assert.equal(m1.message, "Shop ơi đơn này nạp lâu không ạ?");

    const m2 = await addOrderMessage(db, {
      orderId,
      senderRole: "admin",
      senderId: "admin",
      senderName: "Quản trị viên (Shop)",
      message: "Shop đang nạp gói cho bạn nhé, tầm 5 phút là xong!",
      now: 2000,
    });
    assert.equal(m2.senderRole, "admin");

    // 3. getOrderMessages returns messages in chronological order
    const messages = await getOrderMessages(db, orderId);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].id, m1.id);
    assert.equal(messages[1].id, m2.id);

    // 4. getUserOrders and getAdminOrders include attached messages
    const userOrders = await getUserOrders(db, userId);
    assert.equal(userOrders.length, 1);
    assert.equal(userOrders[0].messages.length, 2);
    assert.equal(userOrders[0].messages[0].message, "Shop ơi đơn này nạp lâu không ạ?");

    const adminOrders = await getAdminOrders(db);
    assert.equal(adminOrders.length, 1);
    assert.equal(adminOrders[0].messages.length, 2);
    assert.equal(adminOrders[0].messages[1].message, "Shop đang nạp gói cho bạn nhé, tầm 5 phút là xong!");
  } finally {
    db.close();
  }
});

test("Order messages HTTP API: Customer can view/send messages on own orders; forbidden on others", async () => {
  const ctx = await setupServer();
  try {
    const user1Id = randomUUID();
    const user2Id = randomUUID();
    const now = Date.now();
    await ctx.db.prepare("INSERT INTO users VALUES (?, ?, 'pw', ?)").run(user1Id, "user1@example.com", now);
    await ctx.db.prepare("INSERT INTO users VALUES (?, ?, 'pw', ?)").run(user2Id, "user2@example.com", now);

    const token1 = "a".repeat(64);
    const token2 = "b".repeat(64);
    await ctx.db.prepare("INSERT INTO sessions VALUES (?, ?, 'csrf1', ?)").run(digest(token1), user1Id, now + 3600000);
    await ctx.db.prepare("INSERT INTO sessions VALUES (?, ?, 'csrf2', ?)").run(digest(token2), user2Id, now + 3600000);

    const orderId = "VNL-ORDER-USER1";
    await ctx.db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, items_json, total, status, created_at)
      VALUES (?, ?, 'User One', 'user1@example.com', '[]', 100000, 'processing', ?)
    `).run(orderId, user1Id, now);

    // Unauthenticated request rejected
    const unauthRes = await ctx.request("GET", `/api/orders/${orderId}/messages`);
    assert.equal(unauthRes.status, 401);

    // User 2 trying to access User 1's order messages returns 404
    const user2Res = await ctx.request("GET", `/api/orders/${orderId}/messages`, null, {
      cookie: `vnl_session=${token2}`,
    });
    assert.equal(user2Res.status, 404);

    // User 1 gets empty messages initially
    const user1GetRes = await ctx.request("GET", `/api/orders/${orderId}/messages`, null, {
      cookie: `vnl_session=${token1}`,
    });
    assert.equal(user1GetRes.status, 200);
    assert.deepEqual(user1GetRes.data.messages, []);

    // User 1 sends a message
    const sendRes = await ctx.request(
      "POST",
      `/api/orders/${orderId}/messages`,
      { message: "Em vừa chuyển khoản và gửi tài khoản, shop check giúp em ạ" },
      { cookie: `vnl_session=${token1}` },
    );
    assert.equal(sendRes.status, 201);
    assert.equal(sendRes.data.success, true);
    assert.equal(sendRes.data.message.senderRole, "customer");
    assert.equal(sendRes.data.message.message, "Em vừa chuyển khoản và gửi tài khoản, shop check giúp em ạ");

    // Re-query: message is now present
    const user1ReGet = await ctx.request("GET", `/api/orders/${orderId}/messages`, null, {
      cookie: `vnl_session=${token1}`,
    });
    assert.equal(user1ReGet.data.messages.length, 1);
    assert.equal(user1ReGet.data.messages[0].message, "Em vừa chuyển khoản và gửi tài khoản, shop check giúp em ạ");
  } finally {
    await ctx.close();
  }
});

test("Order messages HTTP API: Admin and Partner permissions and replies", async () => {
  const ctx = await setupServer();
  try {
    const userId = randomUUID();
    const partnerUserId = randomUUID();
    const partnerEmail = "partner@example.com";
    const now = Date.now();

    await ctx.db.prepare("INSERT INTO users VALUES (?, ?, 'pw', ?)").run(userId, "cust@example.com", now);
    await ctx.db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(
      partnerUserId,
      partnerEmail,
      await passwordHash("partnerpass123"),
      now,
    );
    await ctx.db.prepare(`
      INSERT INTO partners (id, user_id, email, name, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'Partner Pro', 1, ?, ?)
    `).run("p1", partnerUserId, partnerEmail, now, now);

    // Add a custom product owned by partner
    await ctx.db.prepare(`
      INSERT INTO custom_products (id, name, category, partner_email, created_at, updated_at)
      VALUES ('partner-service', 'Dịch vụ Đối tác', 'dich-vu', ?, ?, ?)
    `).run(partnerEmail, now, now);

    // Create 2 orders: Order 1 has partner product, Order 2 is standard shop order
    const order1 = "VNL-PARTNER-ORDER";
    const order2 = "VNL-SHOP-ORDER";
    await ctx.db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, items_json, total, status, created_at)
      VALUES (?, ?, 'Cust A', 'cust@example.com', ?, 120000, 'processing', ?)
    `).run(order1, userId, JSON.stringify([{ productId: "partner-service", variantId: "v1", quantity: 1, price: 120000 }]), now);

    await ctx.db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, items_json, total, status, created_at)
      VALUES (?, ?, 'Cust B', 'cust@example.com', ?, 80000, 'processing', ?)
    `).run(order2, userId, JSON.stringify([{ productId: "nitro-boost", variantId: "1m", quantity: 1, price: 80000 }]), now);

    // Login partner to get token
    const partnerLoginRes = await ctx.request("POST", "/api/admin/auth", {
      email: partnerEmail,
      password: "partnerpass123",
    });
    assert.equal(partnerLoginRes.status, 200);
    const partnerKey = partnerLoginRes.data.token || partnerLoginRes.data.adminKey;

    // 1. Admin can post message to any order using x-admin-key: config.adminPassword
    const adminMsgRes = await ctx.request(
      "POST",
      `/api/admin/orders/${order2}/messages`,
      { message: "Admin đã nhận đơn hàng và đang xử lý nhé!" },
      { "x-admin-key": "testadminsecret" },
    );
    assert.equal(adminMsgRes.status, 201);
    assert.equal(adminMsgRes.data.message.senderRole, "admin");

    // 2. Partner can post message to order containing partner product
    const partnerMsgRes = await ctx.request(
      "POST",
      `/api/admin/orders/${order1}/messages`,
      { message: "Đối tác đã nhận đơn dịch vụ của bạn!" },
      { "x-admin-key": partnerKey },
    );
    assert.equal(partnerMsgRes.status, 201);
    assert.equal(partnerMsgRes.data.message.senderRole, "partner");

    // 3. Partner is FORBIDDEN from posting message to order NOT containing partner's product
    const partnerForbiddenRes = await ctx.request(
      "POST",
      `/api/admin/orders/${order2}/messages`,
      { message: "Should be forbidden" },
      { "x-admin-key": partnerKey },
    );
    assert.equal(partnerForbiddenRes.status, 403);

    // 4. Admin reads messages of order1
    const getOrder1Res = await ctx.request("GET", `/api/admin/orders/${order1}/messages`, null, {
      "x-admin-key": "testadminsecret",
    });
    assert.equal(getOrder1Res.status, 200);
    assert.equal(getOrder1Res.data.messages.length, 1);
    assert.equal(getOrder1Res.data.messages[0].message, "Đối tác đã nhận đơn dịch vụ của bạn!");
  } finally {
    await ctx.close();
  }
});
