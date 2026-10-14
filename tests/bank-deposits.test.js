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
    assert.equal(depositJson.transferContent, depositJson.deposit.code);
    assert.equal(new URL(depositJson.qrUrl).searchParams.get("addInfo"), depositJson.deposit.code);
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

test("Hệ thống tự động cộng tiền qua Webhook SePay (Apikey header, trích xuất mã VNL, cộng tiền vào ví tức thì)", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    const testSecret = "sepay_secret_key_999";
    // 1. Admin cấu hình ngân hàng MB và bật Webhook Secret + AutoCredit
    const saveBankRes = await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "MB",
        bankGateway: "MB Bank",
        accountNumber: "0345678999",
        accountName: "VIETNAM LEGACY",
        isActive: true,
        autoCredit: true,
        webhookSecret: testSecret,
      }),
    });
    assert.equal(saveBankRes.status, 200);
    const bankJson = await saveBankRes.json();
    assert.equal(bankJson.settings.autoCredit, true);
    assert.equal(bankJson.settings.webhookSecret, testSecret);

    // 2. Khách hàng đăng ký & tạo yêu cầu nạp 200.000₫
    const regRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "auto-credit-user@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await regRes.json();
    const cookie = regRes.headers.get("set-cookie").split(";")[0];

    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 200000 }),
    });
    const depJson = await depRes.json();
    const depositCode = depJson.deposit.code;
    const depositId = depJson.deposit.id;

    // 3. Giả lập SePay gửi webhook POST /api/payments/webhook với sai API Key -> 401
    const unauthWebhook = await fetch(base + "/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Apikey wrong_key",
      },
      body: JSON.stringify({
        id: "12345678",
        gateway: "MBBank",
        accountNumber: "0345678999",
        amount: 200000,
        content: `NAP TIEN ${depositCode}`,
        transferType: "in",
      }),
    });
    assert.equal(unauthWebhook.status, 401);

    // 4. SePay gửi webhook hợp lệ với Authorization: Apikey <KEY>
    const validWebhook = await fetch(base + "/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${testSecret}`,
      },
      body: JSON.stringify({
        id: "12345678",
        gateway: "MB",
        accountNumber: "0345678999",
        amount: 200000,
        description: `MBVCB.THONG BAO SO DU.${depositCode}.NAP TIEN VI VNL`,
        transferType: "in",
      }),
    });
    assert.equal(validWebhook.status, 200);
    const hookJson = await validWebhook.json();
    assert.equal(hookJson.success, true);
    assert.equal(hookJson.outcome, "credited");

    // 5. Kiểm tra ví khách hàng -> đã được tự động cộng 200.000₫
    const checkWalletRes = await fetch(base + "/api/wallet", {
      headers: { Cookie: cookie },
    });
    const walletJson = await checkWalletRes.json();
    assert.equal(walletJson.balance, 200000);

    // 6. Kiểm tra trạng thái nạp tiền -> credited
    const checkDepositRes = await fetch(base + `/api/deposits/${depositId}`, {
      headers: { Cookie: cookie },
    });
    const depositStatusJson = await checkDepositRes.json();
    assert.equal(depositStatusJson.deposit.status, "credited");
    assert.equal(depositStatusJson.balance, 200000);
  } finally {
    await close();
  }
});

test("Admin thử nghiệm tự động cộng tiền qua endpoint simulate", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    // 1. Cấu hình ngân hàng
    await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "TCB",
        bankGateway: "Techcombank",
        accountNumber: "190333444555",
        accountName: "VIETNAM LEGACY ADMIN",
        isActive: true,
        autoCredit: true,
      }),
    });

    // 2. Khách hàng nạp 50.000₫
    const regRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sim-test@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await regRes.json();
    const cookie = regRes.headers.get("set-cookie").split(";")[0];

    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 50000 }),
    });
    const depJson = await depRes.json();
    const depositCode = depJson.deposit.code;

    // 3. Admin gọi simulate
    const simRes = await fetch(base + "/api/admin/deposits/simulate", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: depositCode }),
    });
    assert.equal(simRes.status, 200);
    const simJson = await simRes.json();
    assert.equal(simJson.success, true);
    assert.equal(simJson.result.outcome, "credited");

    // 4. Kiểm tra ví khách hàng -> số dư đã có 50.000₫
    const walletRes = await fetch(base + "/api/wallet", {
      headers: { Cookie: cookie },
    });
    const walletJson = await walletRes.json();
    assert.equal(walletJson.balance, 50000);
  } finally {
    await close();
  }
});

test("Tự động duyệt tiền nạp: VietinBank ICB alias, số tài khoản có dấu gạch ngang, nội dung có dấu tiếng Việt, URL trailing slash và tham số query apiKey", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    const testSecret = "vnl_sec_vietinbank_test_1234567890";
    // 1. Cấu hình VietinBank (970415 / VietinBank / STK 999999573939)
    await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "970415",
        bankGateway: "VietinBank",
        accountNumber: "999999573939",
        accountName: "LÂM TRẦN GIA HƯNG",
        isActive: true,
        autoCredit: true,
        webhookSecret: testSecret,
      }),
    });

    // 2. Khách nạp 100.000₫
    const regRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "vietin-user@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await regRes.json();
    const cookie = regRes.headers.get("set-cookie").split(";")[0];

    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 100000 }),
    });
    const depJson = await depRes.json();
    const depositCode = depJson.deposit.code;
    assert.equal(depJson.transferContent, "SEVQR " + depositCode);
    assert.equal(new URL(depJson.qrUrl).searchParams.get("addInfo"), depJson.transferContent);
    const reloaded = await fetch(base + "/api/deposits/" + depJson.deposit.id, { headers: { Cookie: cookie } });
    assert.equal((await reloaded.json()).transferContent, depJson.transferContent);
    const bankResponse = await fetch(base + "/api/admin/bank", { headers: { "X-Admin-Key": adminPassword } });
    assert.equal((await bankResponse.json()).settings.bank.transferPrefix, "SEVQR");

    // 3. SePay gửi Webhook với:
    // - URL có trailing slash và tham số query ?secret=...
    // - Header Authorization: apikey <key> (chữ thường)
    // - gateway: "ICB" (SePay dùng ICB thay vì VietinBank)
    // - accountNumber: "9999-9957-3939" (có dấu gạch ngang)
    // - content có dấu tiếng Việt: "KH LÂM TRẦN GIA HƯNG CHUYỂN TIỀN VNL..."
    const hookRes = await fetch(base + `/api/payments/webhook/?secret=${testSecret}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `apikey ${testSecret}`,
      },
      body: JSON.stringify({
        id: 24010192839210,
        referenceCode: "FT24010192839210",
        gateway: "ICB",
        accountNumber: "9999-9957-3939",
        transferAmount: "100000",
        content: depJson.transferContent,
        description: "Chuyen khoan",
        transferType: "in",
      }),
    });
    assert.equal(hookRes.status, 200);
    const hookData = await hookRes.json();
    assert.equal(hookData.success, true);
    assert.equal(hookData.outcome, "credited");
    assert.equal(hookData.depositCode, depositCode);

    // 4. Kiểm tra ví khách hàng -> tự động cộng 100.000₫
    const walletRes = await fetch(base + "/api/wallet", {
      headers: { Cookie: cookie },
    });
    const walletData = await walletRes.json();
    assert.equal(walletData.balance, 100000);
  } finally {
    await close();
  }
});

test("Không cộng tiền qua webhook khi chưa cấu hình khóa xác thực", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    // 1. Cấu hình ngân hàng MB nhưng webhookSecret để trống ("")
    await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "MB",
        bankGateway: "MB Bank",
        accountNumber: "0999888777",
        accountName: "SHOP TEST",
        isActive: true,
        autoCredit: true,
        webhookSecret: "",
      }),
    });

    // 2. Khách nạp 50.000₫
    const regRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "no-secret-user@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await regRes.json();
    const cookie = regRes.headers.get("set-cookie").split(";")[0];

    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 50000 }),
    });
    const depJson = await depRes.json();
    const depositCode = depJson.deposit.code;

    // Thiếu khóa xác thực: từ chối webhook và giữ nguyên số dư.
    const hookRes = await fetch(base + "/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "99887766",
        gateway: "MB",
        accountNumber: "0999888777",
        amount: 50000,
        content: `NAP TIEN ${depositCode}`,
        transferType: "in",
      }),
    });
    assert.equal(hookRes.status, 503);
    const hookData = await hookRes.json();
    assert.equal(hookData.success, false);
    assert.equal((await fixture.db.prepare("SELECT COUNT(*) AS n FROM bank_events").get()).n, 0);

    // Không thay đổi số dư khi chưa xác thực nguồn gửi.
    const walletRes = await fetch(base + "/api/wallet", {
      headers: { Cookie: cookie },
    });
    assert.equal((await walletRes.json()).balance, 0);
  } finally {
    await close();
  }
});

test("Admin có thể thu hồi tiền nạp đã lỡ duyệt nhầm (trừ ví khách và chuyển trạng thái về Cần đối soát)", async () => {
  const fixture = await createServerFixture();
  const { base, close } = fixture;

  try {
    // 1. Cấu hình ngân hàng
    await fetch(base + "/api/admin/bank", {
      method: "PUT",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: "MB",
        bankGateway: "MB Bank",
        accountNumber: "0999888777",
        accountName: "SHOP TEST",
        isActive: true,
        autoCredit: true,
      }),
    });

    // 2. Khách nạp 100.000₫
    const regRes = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "revoke-user@example.com",
        password: "secure-password-123",
      }),
    });
    const regJson = await regRes.json();
    const cookie = regRes.headers.get("set-cookie").split(";")[0];

    const depRes = await fetch(base + "/api/deposits", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": regJson.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 100000 }),
    });
    const depJson = await depRes.json();
    const depositId = depJson.deposit.id;

    // 3. Admin lỡ tay bấm duyệt cộng tiền khi tiền chưa về
    const creditRes = await fetch(base + `/api/admin/deposits/${depositId}/credit`, {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
      },
    });
    assert.equal(creditRes.status, 200);

    // Kiểm tra ví khách hàng lúc này: đã được cộng 100.000₫
    const walletBefore = await (await fetch(base + "/api/wallet", { headers: { Cookie: cookie } })).json();
    assert.equal(walletBefore.balance, 100000);

    // 4. Admin phát hiện duyệt nhầm -> Bấm THU HỒI TIỀN (POST /api/admin/deposits/:id/revoke)
    const revokeRes = await fetch(base + `/api/admin/deposits/${depositId}/revoke`, {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetStatus: "review" }),
    });
    assert.equal(revokeRes.status, 200);
    const revokeData = await revokeRes.json();
    assert.equal(revokeData.success, true);
    assert.equal(revokeData.revokedAmount, 100000);
    assert.equal(revokeData.status, "review");
    assert.equal(revokeData.newBalance, 0);

    // 5. Kiểm tra ví khách hàng -> Số dư đã bị trừ sạch 100.000₫, trở về 0₫!
    const walletAfter = await (await fetch(base + "/api/wallet", { headers: { Cookie: cookie } })).json();
    assert.equal(walletAfter.balance, 0);

    // 6. Kiểm tra lại thông tin đơn nạp -> status = review, credited_at = null
    const checkDep = await (await fetch(base + `/api/deposits/${depositId}`, { headers: { Cookie: cookie } })).json();
    assert.equal(checkDep.deposit.status, "review");
    assert.equal(checkDep.deposit.creditedAt, null);

    // 7. Gọi thu hồi lần nữa khi đơn không còn ở trạng thái credited -> Chặn lỗi 400
    const secondRevoke = await fetch(base + `/api/admin/deposits/${depositId}/revoke`, {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Admin-Key": adminPassword,
      },
    });
    assert.equal(secondRevoke.status, 400);
  } finally {
    await close();
  }
});


test("Cập nhật ngân hàng không truyền khóa vẫn giữ khóa webhook đã lưu", async () => {
  const db = await openStore(":memory:");
  const settings = { bankCode: "ICB", bankGateway: "VietinBank", accountNumber: "1234567890", accountName: "TEST", isActive: true };
  try {
    await saveBankSettings(db, { ...settings, webhookSecret: "test-secret-preserved-0000000000" });
    await saveBankSettings(db, { ...settings, autoCredit: false });
    assert.equal((await getBankSettings(db)).webhookSecret, "test-secret-preserved-0000000000");
    await saveBankSettings(db, { ...settings, webhookSecret: "" });
    assert.equal((await getBankSettings(db)).webhookSecret, "");
  } finally { db.close(); }
});

test("Webhook không tự sinh ID khi thiếu hoặc sai ID giao dịch SePay", async () => {
  const fixture = await createServerFixture();
  const { db, base, close } = fixture;
  const secret = "test-invalid-id-secret-000000000000";
  try {
    await saveBankSettings(db, { bankCode: "ICB", bankGateway: "VietinBank", accountNumber: "1234567890", accountName: "TEST", isActive: true, webhookSecret: secret });
    for (const id of [undefined, "FT24010192839210", {}, "invalid"]) {
      const res = await fetch(base + "/api/payments/webhook", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Apikey " + secret }, body: JSON.stringify({ id, transferAmount: 50000, gateway: "VietinBank", accountNumber: "1234567890", transferType: "in", content: "khong co ma" }) });
      assert.equal(res.status, 400);
    }
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM bank_events").get()).n, 0);
  } finally { await close(); }
});
