import test from "node:test";
import assert from "node:assert/strict";
import { openStore, saveBankSettings } from "../server/store.js";
import { createApp } from "../server/app.js";

const adminPassword = "secret-admin-pass-123";
const origin = "http://localhost:3000";

async function createFixture() {
  const db = await openStore(":memory:");
  const config = {
    origin,
    production: false,
    paymentsMode: "disabled",
    adminPassword,
    bank: {
      code: "MB",
      gateway: "MBBank",
      accountNumber: "0123456789",
      accountName: "SHOP VNL",
    },
    webhookSecret: "secret-key-12345678901234",
  };
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    db,
    config,
    server,
    base,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test("Admin: Xem danh sách khách hàng và số dư ví (GET /api/admin/customers)", async () => {
  const { db, base, close } = await createFixture();
  try {
    await saveBankSettings(db, {
      bankCode: "MB",
      bankGateway: "MBBank",
      accountNumber: "0123456789",
      accountName: "SHOP VNL",
      isActive: true,
      autoCredit: true,
      webhookSecret: "secret-key-12345678901234",
    });

    // 1. Chặn người dùng không có quyền admin
    const unauthRes = await fetch(base + "/api/admin/customers");
    assert.equal(unauthRes.status, 401);

    // 2. Tạo 2 tài khoản khách hàng
    const regRes1 = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email: "user-rich@example.com", password: "Password123!" }),
    });
    assert.equal(regRes1.status, 201);
    const user1 = await regRes1.json();
    const cookie1 = regRes1.headers.get("set-cookie").split(";")[0];

    const regRes2 = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email: "user-zero@example.com", password: "Password123!" }),
    });
    assert.equal(regRes2.status, 201);

    // 3. Nạp tiền cho user1 (200k)
    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "X-CSRF-Token": user1.csrfToken, Cookie: cookie1 },
      body: JSON.stringify({ amount: 200000 }),
    });
    const depJson = await depRes.json();
    const dep = depJson.deposit;

    // Duyệt nạp tiền cho user1
    await fetch(base + `/api/admin/deposits/${dep.id}/credit`, {
      method: "POST",
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });

    // 4. Admin lấy danh sách khách hàng
    const customersRes = await fetch(base + "/api/admin/customers", {
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    assert.equal(customersRes.status, 200);
    const customersJson = await customersRes.json();
    assert.equal(customersJson.success, true);
    assert.equal(customersJson.customers.length, 2);

    const richCustomer = customersJson.customers.find((c) => c.email === "user-rich@example.com");
    assert.ok(richCustomer);
    assert.equal(richCustomer.balance, 200000);
    assert.equal(richCustomer.totalDeposited, 200000);
    assert.equal(richCustomer.depositsCount, 1);

    const zeroCustomer = customersJson.customers.find((c) => c.email === "user-zero@example.com");
    assert.ok(zeroCustomer);
    assert.equal(zeroCustomer.balance, 0);

    // 5. Kiểm tra tra cứu số dư riêng (GET /api/admin/customers/balance)
    const balanceByEmail = await fetch(base + "/api/admin/customers/balance?email=user-rich@example.com", {
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    assert.equal(balanceByEmail.status, 200);
    const balanceJson1 = await balanceByEmail.json();
    assert.equal(balanceJson1.customer.balance, 200000);

    const balanceByCode = await fetch(base + `/api/admin/customers/balance?code=${dep.code}`, {
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    assert.equal(balanceByCode.status, 200);
    const balanceJson2 = await balanceByCode.json();
    assert.equal(balanceJson2.customer.balance, 200000);
    assert.equal(balanceJson2.customer.email, "user-rich@example.com");

    // 6. Kiểm tra danh sách nạp tiền admin (GET /api/admin/deposits) cũng đã có userBalance
    const adminDepositsRes = await fetch(base + "/api/admin/deposits", {
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    const adminDepositsJson = await adminDepositsRes.json();
    assert.equal(adminDepositsJson.deposits[0].userBalance, 200000);
  } finally {
    await close();
  }
});
