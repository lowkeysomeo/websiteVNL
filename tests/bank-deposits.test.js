import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  openStore,
  balance,
  getBankSettings,
  saveBankSettings,
  getAdminDeposits,
  manualCreditDeposit,
  cancelDeposit,
} from "../server/store.js";
import { createApp } from "../server/app.js";

const adminPassword = "secret-admin-pass-123";
const origin = "http://localhost:3000";

async function createServerFixture(initialBank = null) {
  const db = await openStore(":memory:");
  const config = {
    origin,
    production: false,
    paymentsMode: "disabled",
    adminPassword,
    bank: initialBank || {
      code: "",
      gateway: "",
      accountNumber: "",
      accountName: "",
    },
    webhookSecret: "",
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

test("Cài đặt ngân hàng: lưu vào DB, kiểm tra hợp lệ và giữ nguyên sau khi mở lại SQLite", async () => {
  const db = await openStore(":memory:");
  try {
    const initial = await getBankSettings(db, { paymentsMode: "disabled" });
    assert.equal(initial.enabled, false);
    assert.equal(initial.isActive, false);

    // Lưu thông tin ngân hàng hợp lệ
    const saved = await saveBankSettings(db, {
      bankCode: "MB",
      bankGateway: "MB Bank",
      accountNumber: "0987654321",
      accountName: "NGUYEN VAN A",
      isActive: true,
    });
    assert.equal(saved.enabled, true);
    assert.equal(saved.isActive, true);
    assert.equal(saved.bank.code, "MB");
    assert.equal(saved.bank.gateway, "MB Bank");
    assert.equal(saved.bank.accountNumber, "0987654321");
    assert.equal(saved.bank.accountName, "NGUYEN VAN A");

    // Lấy lại từ DB
    const fetched = await getBankSettings(db);
    assert.equal(fetched.enabled, true);
    assert.equal(fetched.bank.code, "MB");
    assert.equal(fetched.bank.accountNumber, "0987654321");

    // Tắt nạp tiền
    const disabled = await saveBankSettings(db, {
      bankCode: "MB",
      bankGateway: "MB Bank",
      accountNumber: "0987654321",
      accountName: "NGUYEN VAN A",
      isActive: false,
    });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.isActive, false);

    // Kiểm tra chặn dữ liệu không hợp lệ khi bật
    await assert.rejects(
      () =>
        saveBankSettings(db, {
          bankCode: "X", // Quá ngắn
          bankGateway: "Test",
          accountNumber: "12345",
          accountName: "TEST",
          isActive: true,
        }),
      { status: 400 },
    );

    await assert.rejects(
      () =>
        saveBankSettings(db, {
          bankCode: "MB",
          bankGateway: "MB Bank",
          accountNumber: "abc123", // Chứa chữ cái
          accountName: "TEST",
          isActive: true,
        }),
      { status: 400 },
    );
  } finally {
    db.close();
  }
});

test("HTTP API Admin: Cấu hình ngân hàng, duyệt nạp thủ công và cập nhật số dư ví", async () => {
  const fixture = await createServerFixture();
  const { base, db, close } = fixture;

  try {
    // 1. Kiểm tra yêu cầu quyền admin
    const unauthBank = await fetch(base + "/api/admin/bank");
    assert.equal(unauthBank.status, 401);

    // 2. Admin cấu hình tài khoản MB Bank
    const saveBankRes = await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "MB",
        bankGateway: "MB Bank Quân Đội",
        accountNumber: "9999888877",
        accountName: "SHOP VNL OWNER",
        isActive: true,
      }),
    });
    assert.equal(saveBankRes.status, 200);
    const saveBankJson = await saveBankRes.json();
    assert.equal(saveBankJson.settings.enabled, true);
    assert.equal(saveBankJson.settings.bank.code, "MB");

    // 3. Khách hàng đăng ký tài khoản
    const registerRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "customer-bank@example.com",
        password: "secure-password-123",
      }),
    });
    assert.equal(registerRes.status, 201);
    const regJson = await registerRes.json();
    const cookie = registerRes.headers.get("set-cookie").split(";")[0];
    const csrfToken = regJson.csrfToken;

    // 4. Khách hàng kiểm tra /api/session -> nạp tiền đã mở
    const sessionRes = await fetch(base + "/api/session", {
      headers: { Cookie: cookie },
    });
    const sessionJson = await sessionRes.json();
    assert.equal(sessionJson.paymentsEnabled, true);
    assert.equal(sessionJson.bank.code, "MB");
    assert.equal(sessionJson.bank.accountNumber, "9999888877");

    // 5. Khách hàng tạo yêu cầu nạp 100.000₫
    const depositRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 100000 }),
    });
    assert.equal(depositRes.status, 201);
    const depositJson = await depositRes.json();
    assert.equal(depositJson.deposit.amount, 100000);
    assert.equal(depositJson.deposit.status, "pending");
    assert.equal(depositJson.bank.code, "MB");
    assert.ok(depositJson.qrUrl.includes("img.vietqr.io/image/MB-9999888877-compact2.png"));
    assert.ok(depositJson.qrUrl.includes("amount=100000"));
    assert.ok(depositJson.qrUrl.includes(depositJson.deposit.code));

    const depositId = depositJson.deposit.id;

    // 6. Admin xem danh sách nạp tiền
    const adminDepositsRes = await fetch(base + "/api/admin/deposits?status=pending", {
      headers: { "X-Admin-Key": adminPassword },
    });
    assert.equal(adminDepositsRes.status, 200);
    const adminDepositsJson = await adminDepositsRes.json();
    assert.equal(adminDepositsJson.deposits.length, 1);
    assert.equal(adminDepositsJson.deposits[0].id, depositId);
    assert.equal(adminDepositsJson.deposits[0].userEmail, "customer-bank@example.com");

    // 7. Admin bấm "Duyệt cộng tiền"
    const creditRes = await fetch(base + `/api/admin/deposits/${depositId}/credit`, {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
      },
    });
    assert.equal(creditRes.status, 200);
    const creditJson = await creditRes.json();
    assert.equal(creditJson.status, "credited");

    // 8. Khách hàng kiểm tra yêu cầu nạp -> đã được cộng tiền và số dư ví tăng lên 100.000₫
    const checkDepositRes = await fetch(base + `/api/deposits/${depositId}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(checkDepositRes.status, 200);
    const checkDepositJson = await checkDepositRes.json();
    assert.equal(checkDepositJson.deposit.status, "credited");
    assert.equal(checkDepositJson.balance, 100000);

    // 9. Thử duyệt lại yêu cầu đã cộng tiền -> bị từ chối 409
    const duplicateCredit = await fetch(base + `/api/admin/deposits/${depositId}/credit`, {
      method: "POST",
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    assert.equal(duplicateCredit.status, 409);
  } finally {
    await close();
  }
});

test("Admin có thể hủy yêu cầu nạp tiền chưa chuyển khoản", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    // Bật nạp tiền
    await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "VCB",
        bankGateway: "Vietcombank",
        accountNumber: "0011223344",
        accountName: "SHOP VNL OWNER",
        isActive: true,
      }),
    });

    // Đăng ký khách
    const registerRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "cancel-test@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await registerRes.json();
    const cookie = registerRes.headers.get("set-cookie").split(";")[0];

    // Tạo yêu cầu nạp
    const depositRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 50000 }),
    });
    const depositJson = await depositRes.json();
    const depositId = depositJson.deposit.id;

    // Admin hủy yêu cầu
    const cancelRes = await fetch(base + `/api/admin/deposits/${depositId}/cancel`, {
      method: "POST",
      headers: { Origin: origin, "X-Admin-Key": adminPassword },
    });
    assert.equal(cancelRes.status, 200);
    const cancelJson = await cancelRes.json();
    assert.equal(cancelJson.status, "expired");

    // Kiểm tra trạng thái yêu cầu
    const checkRes = await fetch(base + `/api/deposits/${depositId}`, {
      headers: { Cookie: cookie },
    });
    const checkJson = await checkRes.json();
    assert.equal(checkJson.deposit.status, "expired");
  } finally {
    await close();
  }
});
