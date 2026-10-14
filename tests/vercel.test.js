import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { adaptClient, openStore } from "../server/database.js";
import { balance, processTransfer, createOrder } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createHmac } from "node:crypto";
import { webHandler } from "../server/web-handler.js";
import { createApp } from "../server/app.js";

test("Web handler preserves signed body bytes, cookies, paths and CSRF", async () => {
  const db = await openStore(":memory:");
  const origin = "https://shop.example";
  const secret = "test-only-webhook-secret-00000000000000";
  const config = {
    origin,
    production: true,
    bank: { ...bank, code: "970415", accountName: "TEST" },
    paymentsMode: "live",
    webhookSecret: secret,
  };
  const endpoint = webHandler(createApp(db, config).listeners("request")[0]);
  const request = (route, body, extra = {}) =>
    endpoint.fetch(
      new Request(origin + route, {
        method: body === undefined ? "GET" : "POST",
        headers: { origin, "content-type": "application/json", ...extra },
        body,
      }),
    );
  try {
    const register = await request(
      "/api/auth/register",
      JSON.stringify({
        email: "web@example.com",
        password: "test-password-123",
      }),
    );
    assert.equal(register.status, 201);
    const cookie = register.headers.get("set-cookie").split(";")[0];
    assert.match(cookie, /^__Host-vnl_session=/);
    assert.match(register.headers.get("set-cookie"), /Secure/);
    const identity = await register.json();
    const headers = { cookie, "x-csrf-token": identity.csrfToken };
    assert.equal(
      (await request("/api/deposits", '{"amount":50000}', { cookie })).status,
      403,
    );
    const created = await request("/api/deposits", '{"amount":50000}', headers);
    assert.equal(created.status, 201);
    const { deposit } = await created.json();
    const raw = JSON.stringify(
      { ...event, code: deposit.code, content: "nạp tiền" },
      null,
      2,
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = {
      "x-sepay-timestamp": timestamp,
      "x-sepay-signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(timestamp + "." + raw)
          .digest("hex"),
    };
    const credited = await request("/api/webhooks/sepay", raw, signed);
    assert.equal(credited.status, 200);
    assert.equal((await credited.json()).outcome, "credited");
    assert.equal(
      (
        await request(
          "/api/webhooks/sepay",
          JSON.stringify(JSON.parse(raw)),
          signed,
        )
      ).status,
      401,
    );
    assert.equal(
      (await (await request("/api/wallet", undefined, headers)).json()).balance,
      50000,
    );
  } finally {
    db.close();
  }
});

const bank = { gateway: "VietinBank", accountNumber: "1234567890" };
const event = {
  id: 123,
  transferType: "in",
  transferAmount: 50000,
  ...bank,
  code: "VNLABCDEF123456",
};

test("libSQL adapter serializes duplicate credits and competing wallet purchases", async () => {
  const db = adaptClient(createClient({ url: ":memory:" }));
  try {
    await db.exec(
      await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
    );
    await db
      .prepare("INSERT INTO users VALUES (?, ?, ?, ?)")
      .run("user", "test@example.com", "unused", Date.now());
    await db
      .prepare(
        "INSERT INTO deposits (id,user_id,code,amount,created_at,expires_at) VALUES (?,?,?,?,?,?)",
      )
      .run(
        "deposit",
        "user",
        event.code,
        50000,
        Date.now(),
        Date.now() + 60000,
      );
    const credits = await Promise.all(
      Array.from({ length: 5 }, () => processTransfer(db, event, bank)),
    );
    assert.equal(credits.filter((x) => x.outcome === "credited").length, 1);
    assert.equal(await balance(db, "user"), 50000);
    const order = {
      userId: "user",
      customerName: "Test",
      customerEmail: "test@example.com",
      items: [],
      total: 40000,
    };
    const results = await Promise.allSettled([
      createOrder(db, order),
      createOrder(db, order),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(await balance(db, "user"), 10000);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM orders").get()).n,
      1,
    );
  } finally {
    db.close();
  }
});

test("Vercel refuses local database fallback and accepts integration variable aliases", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    await assert.rejects(openStore(":memory:"), /TURSO_DATABASE_URL/);
    const config = readConfig({
      VERCEL: "1",
      PUBLIC_ORIGIN: "https://shop.example",
      TURSO_URL: "libsql://test.example",
      TURSO_AUTH_TOKEN: "test-token",
    });
    assert.equal(config.remoteDatabase.url, "libsql://test.example");
    assert.equal(config.adminPassword, "");
    const { default: endpoint } = await import("../api/index.js");
    const response = await endpoint.fetch(
      new Request("https://shop.example/api/session"),
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("Vercel web handler serves admin-pricing.js asset and handles pricing APIs over libSQL", async () => {
  const db = adaptClient(createClient({ url: ":memory:" }));
  const origin = "https://shop.example";
  const config = {
    origin,
    production: true,
    bank: { gateway: "VietinBank", accountNumber: "1234567890", code: "970415", accountName: "TEST" },
    paymentsMode: "disabled",
    adminPassword: "test-admin-vercel",
  };
  try {
    await db.exec(await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"));
    const endpoint = webHandler(createApp(db, config).listeners("request")[0]);

    // 1. Static asset: admin-pricing.js and favicon.ico are accessible
    const assetRes = await endpoint.fetch(new Request(origin + "/admin-pricing.js"));
    assert.equal(assetRes.status, 200);
    assert.match(assetRes.headers.get("content-type"), /javascript/);

    const faviconRes = await endpoint.fetch(new Request(origin + "/favicon.ico"));
    assert.equal(faviconRes.status, 200);
    assert.equal(faviconRes.headers.get("content-type"), "image/x-icon");

    // 2. Admin pricing endpoint
    const adminHeaders = { "X-Admin-Key": config.adminPassword, Origin: origin, "Content-Type": "application/json" };
    const pricingRes = await endpoint.fetch(new Request(origin + "/api/admin/pricing", { headers: adminHeaders }));
    assert.equal(pricingRes.status, 200);
    const pricingData = await pricingRes.json();
    assert.ok(Array.isArray(pricingData.products));
    assert.ok(Array.isArray(pricingData.promotions));

    // 3. Admin create campaign
    const promoRes = await endpoint.fetch(
      new Request(origin + "/api/admin/promotions", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          kind: "campaign",
          name: "Vercel Launch Sale",
          enabled: true,
          type: "percent",
          value: 15,
          productIds: [],
        }),
      }),
    );
    assert.equal(promoRes.status, 201);

    // 4. Public catalog reflects discount on libSQL
    const catalogRes = await endpoint.fetch(new Request(origin + "/api/catalog"));
    assert.equal(catalogRes.status, 200);
    const catalogData = await catalogRes.json();
    const nitro = catalogData.products.find((p) => p.id === "nitro");
    assert.equal(nitro.variants[0].price, Math.round(nitro.variants[0].basePrice * 0.85));

    // 5. Admin bank configuration over libSQL
    const bankPutRes = await endpoint.fetch(
      new Request(origin + "/api/admin/bank", {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          bankCode: "MB",
          bankGateway: "MB Bank",
          accountNumber: "123456789",
          accountName: "TEST VERCEL",
          isActive: true,
        }),
      }),
    );
    assert.equal(bankPutRes.status, 200);
    const bankPutData = await bankPutRes.json();
    assert.equal(bankPutData.settings.enabled, true);
    assert.equal(bankPutData.settings.bank.code, "MB");

    // 6. Public session reflects enabled bank top-up over libSQL
    const sessionRes = await endpoint.fetch(new Request(origin + "/api/session"));
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.paymentsEnabled, true);
    assert.equal(sessionData.bank.code, "MB");
  } finally {
    db.close();
  }
});

