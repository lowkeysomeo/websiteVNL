import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore, balance, processTransfer } from "../server/store.js";
import {
  verifyWebhook,
  passwordHash,
  checkPassword,
} from "../server/security.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";

const bank = {
  code: "970415",
  gateway: "VietinBank",
  accountNumber: "1234567890",
  accountName: "TEST ACCOUNT",
};
const secret = "test-only-secret-not-for-deployment-00000000";
async function fixture() {
  const db = await openStore(":memory:");
  const user = randomUUID();
  const deposit = randomUUID();
  await db
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(user, "test@example.com", "not-used", Date.now());
  await db
    .prepare(
      "INSERT INTO deposits (id,user_id,code,amount,created_at,expires_at) VALUES (?,?,?,?,?,?)",
    )
    .run(
      deposit,
      user,
      "VNLABCDEF123456",
      50000,
      Date.now(),
      Date.now() + 86400000,
    );
  const event = {
    id: 12345,
    referenceCode: "TEST-1",
    transferType: "in",
    gateway: bank.gateway,
    accountNumber: bank.accountNumber,
    transferAmount: 50000,
    code: "VNLABCDEF123456",
    content: "VNLABCDEF123456 nap tien",
  };
  return { db, user, deposit, event };
}

test("signature verifies original bytes and rejects edited payloads or old timestamps", () => {
  const raw = Buffer.from('{ "id": 12345, "content": "nạp tiền" }');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    "x-sepay-timestamp": timestamp,
    "x-sepay-signature":
      "sha256=" +
      createHmac("sha256", secret)
        .update(timestamp + ".")
        .update(raw)
        .digest("hex"),
  };
  assert.equal(verifyWebhook(headers, raw, secret), true);
  assert.equal(
    verifyWebhook(headers, Buffer.from('{"id":12345}'), secret),
    false,
  );
  assert.equal(verifyWebhook(headers, raw, secret, Date.now() + 301000), false);
  assert.equal(verifyWebhook(headers, raw, ""), false);
});

test("a transfer is credited once even when id or reference is repeated", async () => {
  const { db, user, event } = await fixture();
  try {
    assert.equal((await processTransfer(db, event, bank)).outcome, "credited");
    assert.equal((await processTransfer(db, event, bank)).outcome, "duplicate");
    assert.equal(
      (await processTransfer(db, { ...event, id: 999 }, bank)).outcome,
      "duplicate",
    );
    assert.equal(
      (
        await processTransfer(
          db,
          { ...event, id: 1000, referenceCode: "TEST-2" },
          bank,
        )
      ).outcome,
      "already_paid",
    );
    assert.equal(await balance(db, user), 50000);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM wallet_ledger").get()).n,
      1,
    );
  } finally {
    db.close();
  }
});

test("outgoing, wrong bank, wrong account, missing and ambiguous codes do not credit", async () => {
  for (const patch of [
    { transferType: "out" },
    { gateway: "OtherBank" },
    { accountNumber: "000000" },
    { accountNumber: "991234567890" },
    { accountNumber: "123456" },
    { accountNumber: null },
    { gateway: null },
    { gateway: "MB", accountNumber: bank.accountNumber },
    { gateway: "Bank" },
    { transferType: null },
    { transferType: "unknown" },
    { code: null, content: "khong co ma" },
    { content: "VNLABCDEF123456 VNL000000000000" },
  ]) {
    const { db, user, event } = await fixture();
    try {
      assert.notEqual(
        (await processTransfer(db, { ...event, ...patch }, bank)).outcome,
        "credited",
      );
      assert.equal(await balance(db, user), 0);
    } finally {
      db.close();
    }
  }
});

test("incorrect amounts and late transfers go to review without credit", async () => {
  for (const expired of [false, true]) {
    const { db, user, deposit, event } = await fixture();
    try {
      if (expired)
        await db
          .prepare("UPDATE deposits SET expires_at = ? WHERE id = ?")
          .run(Date.now() - 1, deposit);
      assert.equal(
        (
          await processTransfer(
            db,
            { ...event, transferAmount: expired ? 50000 : 49000 },
            bank,
          )
        ).outcome,
        "review",
      );
      assert.equal(await balance(db, user), 0);
      assert.equal(
        (
          await db
            .prepare("SELECT status FROM deposits WHERE id = ?")
            .get(deposit)
        ).status,
        "review",
      );
    } finally {
      db.close();
    }
  }
});

test("invalid amounts do not enter the ledger or event log", async () => {
  const { db, user, event } = await fixture();
  try {
    for (const transferAmount of [
      -50000,
      0,
      0.5,
      "50000",
      Number.MAX_SAFE_INTEGER,
    ])
      await assert.rejects(
        async () =>
          await processTransfer(db, { ...event, transferAmount }, bank),
      );
    assert.equal(await balance(db, user), 0);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM bank_events").get()).n,
      0,
    );
  } finally {
    db.close();
  }
});

test("a failed ledger write rolls back the event so a retry can succeed", async () => {
  const { db, user, event } = await fixture();
  try {
    await db.exec(
      "CREATE TRIGGER fail_ledger BEFORE INSERT ON wallet_ledger BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    await assert.rejects(async () => await processTransfer(db, event, bank));
    assert.equal(await balance(db, user), 0);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM bank_events").get()).n,
      0,
    );
    await db.exec("DROP TRIGGER fail_ledger");
    assert.equal((await processTransfer(db, event, bank)).outcome, "credited");
    assert.equal(await balance(db, user), 50000);
  } finally {
    db.close();
  }
});

test("wallet balances survive closing and reopening the database", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "vnl-wallet-test-"));
  const filename = path.join(folder, "test.sqlite");
  let db = await openStore(filename);
  try {
    const user = randomUUID();
    const deposit = randomUUID();
    await db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(user, "persist@example.com", "unused", Date.now());
    await db
      .prepare(
        "INSERT INTO deposits (id,user_id,code,amount,created_at,expires_at) VALUES (?,?,?,?,?,?)",
      )
      .run(
        deposit,
        user,
        "VNLABCDEF123456",
        50000,
        Date.now(),
        Date.now() + 60000,
      );
    await processTransfer(
      db,
      {
        id: 123,
        transferType: "in",
        accountNumber: bank.accountNumber,
        gateway: bank.gateway,
        transferAmount: 50000,
        code: "VNLABCDEF123456",
      },
      bank,
    );
    db.close();
    db = await openStore(filename);
    assert.equal(await balance(db, user), 50000);
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("passwords are salted and live config refuses incomplete setup", async () => {
  const a = await passwordHash("test-password-123");
  const b = await passwordHash("test-password-123");
  assert.notEqual(a, b);
  assert.equal(await checkPassword("test-password-123", a), true);
  assert.equal(await checkPassword("wrong-password", a), false);
  assert.equal(readConfig({}).paymentsMode, "disabled");
  assert.throws(() => readConfig({ PAYMENTS_MODE: "live" }));
  assert.throws(() =>
    readConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: "http://example.com" }),
  );
});

test("HTTP registration, ownership, CSRF, signed webhook, session expiry and logout", async () => {
  const db = await openStore(":memory:");
  // Integration test uses fake bank data only. readConfig blocks live payments on local HTTP.
  const config = {
    production: false,
    origin: "http://localhost",
    bank,
    webhookSecret: secret,
    paymentsMode: "live",
  };
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(
    route,
    { method = "GET", body, cookie, csrf, headers = {} } = {},
  ) {
    return fetch(base + route, {
      method,
      headers: {
        Origin: config.origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
  }
  try {
    assert.equal((await call("/api/wallet")).status, 401);
    const register = await call("/api/auth/register", {
      method: "POST",
      body: { email: "ONE@example.com", password: "test-password-123" },
    });
    assert.equal(register.status, 201);
    const cookie = register.headers.get("set-cookie").split(";")[0];
    const identity = await register.json();
    assert.ok(register.headers.get("set-cookie").includes("HttpOnly"));
    assert.ok(register.headers.get("set-cookie").includes("SameSite=Lax"));
    assert.equal(identity.user.email, "one@example.com");
    const owner = { cookie, csrf: identity.csrfToken };
    assert.equal(
      (
        await call("/api/deposits", {
          method: "POST",
          cookie,
          body: { amount: 50000 },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/deposits", {
          method: "POST",
          ...owner,
          headers: { Origin: "https://attacker.example" },
          body: { amount: 50000 },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/deposits", {
          method: "POST",
          ...owner,
          body: { amount: 1 },
        })
      ).status,
      400,
    );
    const created = await call("/api/deposits", {
      method: "POST",
      ...owner,
      body: { amount: 50000 },
    });
    assert.equal(created.status, 201);
    const { deposit } = await created.json();
    const second = await call("/api/auth/register", {
      method: "POST",
      body: { email: "two@example.com", password: "another-password-456" },
    });
    assert.equal(second.status, 201);
    const other = second.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await call(`/api/deposits/${deposit.id}`, { cookie: other })).status,
      404,
    );
    const body = JSON.stringify({
      id: 200,
      referenceCode: "TEST-HTTP",
      transferType: "in",
      transferAmount: 50000,
      accountNumber: bank.accountNumber,
      gateway: bank.gateway,
      content: deposit.code,
    });
    assert.equal(
      (await call("/api/webhooks/sepay", { method: "POST", body })).status,
      401,
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = {
      "X-SePay-Timestamp": timestamp,
      "X-SePay-Signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(timestamp + "." + body)
          .digest("hex"),
    };
    const webhook = await call("/api/webhooks/sepay", {
      method: "POST",
      body,
      headers,
    });
    assert.equal(webhook.status, 200);
    assert.equal((await webhook.json()).outcome, "credited");
    assert.equal(
      (await (await call("/api/wallet", owner)).json()).balance,
      50000,
    );
    await call("/api/webhooks/sepay", { method: "POST", body, headers });
    assert.equal(
      (await (await call("/api/wallet", owner)).json()).balance,
      50000,
    );
    assert.equal(
      (await (await call("/api/wallet", { cookie: other })).json()).balance,
      0,
    );
    for (const route of [
      "/.env",
      "/server/config.js",
      "/data/vnl.sqlite",
      "/package.json",
    ])
      assert.equal((await call(route)).status, 404);
    assert.equal(
      (await call("/api/auth/logout", { method: "POST", ...owner, body: {} }))
        .status,
      200,
    );
    assert.equal((await call("/api/wallet", owner)).status, 401);
    const bad = await call("/api/auth/login", {
      method: "POST",
      body: { email: "one@example.com", password: "wrong-password-123" },
    });
    assert.equal(bad.status, 401);
    const login = await call("/api/auth/login", {
      method: "POST",
      body: { email: "one@example.com", password: "test-password-123" },
    });
    assert.equal(login.status, 200);
    const newCookie = login.headers.get("set-cookie").split(";")[0];
    assert.notEqual(cookie, newCookie);
    await db.prepare("UPDATE sessions SET expires_at = 0").run();
    assert.equal(
      (await call("/api/wallet", { cookie: newCookie })).status,
      401,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});

test("disabled payments refuse both deposit creation and webhook processing", async () => {
  const db = await openStore(":memory:");
  const config = {
    production: false,
    origin: "http://localhost",
    bank,
    webhookSecret: secret,
    paymentsMode: "disabled",
  };
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await fetch(base + "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "disabled@example.com",
        password: "test-password-123",
      }),
      headers: { Origin: config.origin, "Content-Type": "application/json" },
    });
    const data = await result.json();
    const cookie = result.headers.get("set-cookie").split(";")[0];
    const deposit = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: config.origin,
        Cookie: cookie,
        "X-CSRF-Token": data.csrfToken,
      },
      body: JSON.stringify({ amount: 50000 }),
    });
    assert.equal(deposit.status, 503);
    assert.equal(
      (
        await fetch(base + "/api/webhooks/sepay", {
          method: "POST",
          body: "{}",
        })
      ).status,
      503,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
