import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore, createOrder, balance, updateAdminOrder, getUserOrders } from "../server/store.js";
import { getCatalog, savePrices, savePromotion, quoteOrder, listPromotions } from "../server/pricing.js";
import { createApp } from "../server/app.js";
import { readConfig } from "../server/config.js";
import { digest } from "../server/security.js";

const item = { productId: "nitro", variantId: "boost_gift_1m", quantity: 1 };
const campaign = changes => ({ kind: "campaign", name: "Cuối tuần", enabled: true, type: "percent", value: 20, startsAt: null, endsAt: null, productIds: [], ...changes });
const coupon = changes => ({ ...campaign(), kind: "coupon", code: "VNL10", name: "Ưu đãi thành viên", value: 10, minOrder: 0, usageLimit: null, perUserLimit: null, maxDiscount: null, stackWithSale: true, ...changes });
function seed(db, id = "buyer", credit = 1000000) {
  db.prepare("INSERT INTO users VALUES (?, ?, 'unused', 1)").run(id, id + "@example.test");
  if (!credit) return;
  db.prepare("INSERT INTO deposits (id,user_id,code,amount,status,created_at,expires_at) VALUES (?,?,?,?,'credited',1,9999999999999)").run(id, id, "DEPOSIT-" + id, credit);
  db.prepare("INSERT INTO bank_events (transaction_id,deposit_id,amount,outcome,received_at) VALUES (?,?,?,'credited',1)").run(id, id, credit);
  db.prepare("INSERT INTO wallet_ledger VALUES (?,?,?,?,?,1)").run(id, id, id, id, credit);
}
const orderData = (changes = {}) => ({ userId: "buyer", customerName: "Khách thử nghiệm", customerEmail: "buyer@example.test", requestItems: [item], ...changes });

test("Giá sửa được lưu; không nhận giá giả từ trình duyệt; cập nhật theo lô không dở dang", () => {
  const db = openStore(":memory:");
  try {
    savePrices(db, [{ ...item, price: 125000 }]);
    assert.equal(quoteOrder(db, [{ ...item, price: 1, subtotal: 1 }]).total, 125000);
    assert.throws(() => savePrices(db, [{ ...item, price: 90000 }, { productId: "bad", variantId: "bad", price: 1 }]));
    assert.equal(quoteOrder(db, [item]).total, 125000);
    for (const price of [-1, 1.5, "100", 1000000001]) assert.throws(() => savePrices(db, [{ ...item, price }]));
    savePrices(db, [{ ...item, price: null }]);
    assert.equal(quoteOrder(db, [item]).total, 99000);
    assert.throws(() => quoteOrder(db, [{ ...item, quantity: 10 }, item]), /10 gói/);
  } finally { db.close(); }
});

test("Đợt giảm giá theo lịch, chọn mức tốt nhất và giới hạn từng sản phẩm", () => {
  const db = openStore(":memory:");
  try {
    savePromotion(db, campaign({ startsAt: 1000, endsAt: 2000, productIds: ["nitro"] }));
    savePromotion(db, campaign({ type: "fixed", value: 5000 }));
    assert.equal(quoteOrder(db, [item], "", null, 999).total, 94000);
    assert.equal(quoteOrder(db, [item], "", null, 1000).total, 79200);
    assert.equal(quoteOrder(db, [item], "", null, 1999).total, 79200);
    assert.equal(quoteOrder(db, [item], "", null, 2000).total, 94000);
    assert.equal(quoteOrder(db, [{ productId: "youtube", variantId: "monthly", quantity: 1 }], "", null, 1500).total, 34000);
    const row = getCatalog(db, 1500).find(p => p.id === "nitro").variants[0];
    assert.equal(row.basePrice, 99000); assert.equal(row.price, 79200);
    savePromotion(db, campaign({ type: "fixed", value: 999999 }));
    assert.equal(quoteOrder(db, [item]).total, 0);
  } finally { db.close(); }
});

test("Mã giảm áp dụng sau ưu đãi, kiểm tra mức tối thiểu, trần giảm, phạm vi và kết hợp", () => {
  const db = openStore(":memory:");
  try {
    seed(db);
    savePromotion(db, campaign());
    const promo = savePromotion(db, coupon({ minOrder: 79000, maxDiscount: 5000 }));
    const quote = quoteOrder(db, [item], " vnl10 ", "buyer");
    assert.equal(quote.subtotal, 99000); assert.equal(quote.saleDiscount, 19800); assert.equal(quote.couponDiscount, 5000); assert.equal(quote.total, 74200);
    assert.throws(() => quoteOrder(db, [item], "VNL10"), /đăng nhập/);
    savePromotion(db, { ...promo, minOrder: 80000 }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer"), /80.000/);
    savePromotion(db, { ...promo, stackWithSale: false }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer"), /không kết hợp/);
    savePromotion(db, { ...promo, productIds: ["youtube"] }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer"), /đủ điều kiện/);
    savePromotion(db, { ...promo, enabled: false }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer"), /không tồn tại/);
    savePromotion(db, { ...promo, enabled: true, startsAt: 1000, endsAt: 2000 }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer", 2000), /hết hạn/);
    savePromotion(db, { ...promo, type: "fixed", value: 1000000000, maxDiscount: null }, promo.id);
    assert.equal(quoteOrder(db, [item], "VNL10", "buyer").total, 0);
  } finally { db.close(); }
});

test("Lưu đơn và lượt mã cùng giao dịch, hủy đơn trả lượt và hoàn đúng tiền đã giảm", () => {
  const db = openStore(":memory:");
  try {
    seed(db); seed(db, "poor", 0);
    const promo = savePromotion(db, coupon({ usageLimit: 1, perUserLimit: 1 }));
    assert.throws(() => createOrder(db, orderData({ userId: "poor", couponCode: "VNL10" })), /Số dư/);
    assert.equal(listPromotions(db)[0].used, 0);
    const order = createOrder(db, orderData({ couponCode: "VNL10" }));
    assert.equal(order.total, 89100); assert.equal(balance(db, "buyer"), 910900);
    assert.equal(listPromotions(db)[0].used, 1);
    assert.throws(() => createOrder(db, orderData({ couponCode: "VNL10" })), /hết lượt/);
    savePromotion(db, { ...promo, value: 50, usageLimit: null }, promo.id);
    assert.throws(() => quoteOrder(db, [item], "VNL10", "buyer"), /Tài khoản/);
    savePrices(db, [{ ...item, price: 100000 }]);
    assert.equal(getUserOrders(db, "buyer")[0].pricing.couponDiscount, 9900);
    updateAdminOrder(db, order.id, { status: "cancelled" });
    assert.equal(balance(db, "buyer"), 1000000);
    assert.equal(listPromotions(db)[0].used, 0);
    assert.equal(quoteOrder(db, [item], "VNL10", "buyer").total, 50000);
    assert.throws(() => updateAdminOrder(db, order.id, { status: "processing" }), /không thể mở lại/);
  } finally { db.close(); }
});

test("Giá thay đổi phải xác nhận lại; lỗi ghi ưu đãi hoàn tác cả đơn", () => {
  const db = openStore(":memory:");
  try {
    seed(db);
    const quote = quoteOrder(db, [item]);
    savePrices(db, [{ ...item, price: 120000 }]);
    assert.throws(() => createOrder(db, orderData({ quoteFingerprint: quote.fingerprint })), /đã thay đổi/);
    assert.equal(balance(db, "buyer"), 1000000);
    db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON order_pricing BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.throws(() => createOrder(db, orderData()), /test rollback/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
    assert.equal(balance(db, "buyer"), 1000000);
  } finally { db.close(); }
});

test("Giá, lịch giảm và lượt mã còn nguyên khi mở lại SQLite", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "vnl-pricing-test-"));
  let db = openStore(path.join(folder, "test.sqlite"));
  try {
    seed(db); savePrices(db, [{ ...item, price: 200000 }]);
    savePromotion(db, campaign({ value: 25 }));
    savePromotion(db, coupon({ usageLimit: 4 }));
    createOrder(db, orderData({ couponCode: "VNL10" }));
    db.close(); db = openStore(path.join(folder, "test.sqlite"));
    assert.equal(quoteOrder(db, [item]).total, 150000);
    assert.equal(listPromotions(db).find(p => p.kind === "coupon").used, 1);
    assert.equal(getUserOrders(db, "buyer")[0].total, 135000);
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("Kiểm tra dữ liệu ưu đãi và mã trùng không phân biệt hoa thường", () => {
  const db = openStore(":memory:");
  try {
    savePromotion(db, coupon());
    assert.throws(() => savePromotion(db, coupon({ code: "vnl10" })), /đã tồn tại/);
    for (const changes of [{ value: 101 }, { value: 1.5 }, { enabled: "true" }, { startsAt: 2000, endsAt: 1000 }, { productIds: ["server-setup"] }, { code: "<script>" }, { usageLimit: -1 }, { perUserLimit: 0 }, { maxDiscount: -1 }]) {
      assert.throws(() => savePromotion(db, coupon({ code: "NEW10", ...changes })));
    }
    assert.equal(listPromotions(db).length, 1);
  } finally { db.close(); }
});

test("HTTP: quyền admin, giá công khai, báo giá và hai khách tranh lượt mã cuối", async () => {
  const db = openStore(":memory:");
  const config = readConfig({ PUBLIC_ORIGIN: "http://localhost:3000", ADMIN_PASSWORD: "test-admin-pricing-only" });
  const server = createApp(db, config);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const admin = { "X-Admin-Key": config.adminPassword };
  async function request(route, method = "GET", body, headers = {}) {
    const response = await fetch(origin + route, { method, headers: { Origin: config.origin, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    seed(db); seed(db, "other");
    for (const [user, token] of [["buyer", "a".repeat(64)], ["other", "b".repeat(64)]]) db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(digest(token), user, "csrf-test", Date.now() + 60000);
    const auth = { Cookie: "vnl_session=" + "a".repeat(64), "X-CSRF-Token": "csrf-test" };
    const auth2 = { ...auth, Cookie: "vnl_session=" + "b".repeat(64) };
    assert.equal((await request("/api/admin/pricing")).status, 401);
    assert.equal((await request("/api/admin/prices", "PUT", { prices: [{ ...item, price: 100000 }] }, { ...admin, Origin: "https://other.test" })).status, 403);
    assert.equal((await request("/api/admin/prices", "PUT", { prices: [{ ...item, price: 100000 }] }, admin)).status, 200);
    assert.equal((await request("/api/admin/promotions", "POST", campaign(), admin)).status, 201);
    assert.equal((await request("/api/admin/promotions", "POST", coupon({ usageLimit: 1 }), admin)).status, 201);
    const catalog = await request("/api/catalog");
    assert.equal(catalog.body.products[0].variants[0].price, 80000);
    assert.equal(JSON.stringify(catalog.body).includes("VNL10"), false);
    assert.equal((await request("/api/quote", "POST", { items: [item], couponCode: "VNL10" })).status, 401);
    const quote = await request("/api/quote", "POST", { items: [item], couponCode: "VNL10" }, auth);
    assert.equal(quote.body.quote.total, 72000);
    const payload = { name: "Khách kiểm thử", email: "buyer@example.test", items: [{ ...item, price: 1 }], total: 1, couponCode: "VNL10", quoteFingerprint: quote.body.quote.fingerprint };
    const results = await Promise.all([request("/api/orders", "POST", payload, auth), request("/api/orders", "POST", payload, auth2)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
    const order = results.find(r => r.status === 201).body.order;
    assert.equal(order.total, 72000); assert.equal(order.pricing.couponDiscount, 8000);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
    assert.equal((await request("/api/admin/pricing", "GET", undefined, admin)).body.promotions.find(p => p.kind === "coupon").used, 1);
    const cancelled = await request("/api/admin/orders/" + order.id, "PATCH", { status: "cancelled" }, admin);
    assert.equal(cancelled.status, 200);
    assert.equal(balance(db, "buyer") + balance(db, "other"), 2000000);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
