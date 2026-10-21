import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.js";
import { digest } from "../server/security.js";
import { createApp } from "../server/app.js";
import { readConfig } from "../server/config.js";

test("Partner promotions: mã giảm giá & đợt giảm giá riêng cho đối tác", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "admin-super-password-xyz",
  });
  const server = createApp(db, config);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const adminHeaders = {
    Origin: config.origin,
    "Content-Type": "application/json",
    "X-Admin-Key": config.adminPassword,
  };

  async function request(path, method = "GET", body = undefined, headers = {}) {
    const res = await fetch(origin + path, {
      method,
      headers: { Origin: config.origin, "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, body: json || text };
  }

  try {
    // 1. Tạo 2 đối tác
    const p1Res = await request("/api/admin/partners", "POST", {
      email: "partner1@test.com",
      name: "Đối Tác 1",
      password: "password123",
    }, adminHeaders);
    assert.equal(p1Res.status, 201);

    const p2Res = await request("/api/admin/partners", "POST", {
      email: "partner2@test.com",
      name: "Đối Tác 2",
      password: "password123",
    }, adminHeaders);
    assert.equal(p2Res.status, 201);

    // Đăng nhập 2 đối tác
    const p1Auth = await request("/api/admin/auth", "POST", { email: "partner1@test.com", password: "password123" });
    assert.equal(p1Auth.status, 200);
    const p1Headers = { "X-Admin-Key": p1Auth.body.token };

    const p2Auth = await request("/api/admin/auth", "POST", { email: "partner2@test.com", password: "password123" });
    assert.equal(p2Auth.status, 200);
    const p2Headers = { "X-Admin-Key": p2Auth.body.token };

    // 2. Tạo mặt hàng cho Đối tác 1 và Đối tác 2
    const p1ProdRes = await request("/api/admin/products", "POST", {
      name: "Dịch Vụ P1",
      category: "services",
      variants: [{ name: "Gói 1", price: 100000, deliveryType: "gift" }],
    }, p1Headers);
    assert.equal(p1ProdRes.status, 201);
    const p1Product = p1ProdRes.body.product;

    const p2ProdRes = await request("/api/admin/products", "POST", {
      name: "Dịch Vụ P2",
      category: "services",
      variants: [{ name: "Gói 1", price: 200000, deliveryType: "gift" }],
    }, p2Headers);
    assert.equal(p2ProdRes.status, 201);
    const p2Product = p2ProdRes.body.product;

    // 3. Phân quyền tạo ưu đãi:
    // a. Đối tác 1 không được tạo ưu đãi toàn sàn (productIds rỗng)
    const emptyScopeRes = await request("/api/admin/promotions", "POST", {
      kind: "coupon",
      name: "Mã Toàn Sàn Bất Hợp Pháp",
      code: "INVALIDALL",
      type: "percent",
      value: 10,
      enabled: true,
      productIds: [],
      stackWithSale: true,
    }, p1Headers);
    assert.equal(emptyScopeRes.status, 400);

    // b. Đối tác 1 không được chọn mặt hàng của Đối tác 2
    const otherScopeRes = await request("/api/admin/promotions", "POST", {
      kind: "coupon",
      name: "Mã Áp Dụng Mặt Hàng P2",
      code: "STEALP2",
      type: "percent",
      value: 10,
      enabled: true,
      productIds: [p2Product.id],
      stackWithSale: true,
    }, p1Headers);
    assert.equal(otherScopeRes.status, 403);

    // c. Đối tác 1 không được chọn mặt hàng mặc định của Admin (nitro)
    const adminScopeRes = await request("/api/admin/promotions", "POST", {
      kind: "campaign",
      name: "Đợt Giảm Giá Nitro",
      type: "percent",
      value: 15,
      enabled: true,
      productIds: ["nitro"],
    }, p1Headers);
    assert.equal(adminScopeRes.status, 403);

    // d. Đối tác 1 tạo thành công đợt giảm giá (campaign) cho mặt hàng của mình
    const p1CampaignRes = await request("/api/admin/promotions", "POST", {
      kind: "campaign",
      name: "Sale Cuối Tuần P1",
      type: "percent",
      value: 20,
      enabled: true,
      productIds: [p1Product.id],
    }, p1Headers);
    assert.equal(p1CampaignRes.status, 201);
    assert.equal(p1CampaignRes.body.promotion.name, "Sale Cuối Tuần P1");
    assert.equal(p1CampaignRes.body.promotion.partnerEmail, "partner1@test.com");
    const p1CampaignId = p1CampaignRes.body.promotion.id;

    // e. Đối tác 1 tạo thành công mã giảm giá (coupon) cho mặt hàng của mình
    const p1CouponRes = await request("/api/admin/promotions", "POST", {
      kind: "coupon",
      name: "Giảm 10% Dịch Vụ P1",
      code: "P1VIP10",
      type: "percent",
      value: 10,
      enabled: true,
      productIds: [p1Product.id],
      minOrder: 50000,
      stackWithSale: true,
      usageLimit: 5,
      perUserLimit: 2,
    }, p1Headers);
    assert.equal(p1CouponRes.status, 201);
    assert.equal(p1CouponRes.body.promotion.code, "P1VIP10");
    assert.equal(p1CouponRes.body.promotion.partnerEmail, "partner1@test.com");
    const p1CouponId = p1CouponRes.body.promotion.id;

    // f. Đối tác 2 tạo mã giảm giá riêng của Đối tác 2
    const p2CouponRes = await request("/api/admin/promotions", "POST", {
      kind: "coupon",
      name: "Giảm 15% Dịch Vụ P2",
      code: "P2DISCOUNT",
      type: "percent",
      value: 15,
      enabled: true,
      productIds: [p2Product.id],
      minOrder: 100000,
      stackWithSale: true,
    }, p2Headers);
    assert.equal(p2CouponRes.status, 201);
    const p2CouponId = p2CouponRes.body.promotion.id;

    // 4. Cách ly danh sách ưu đãi trong GET /api/admin/pricing
    // Đối tác 1 chỉ thấy ưu đãi của Đối tác 1
    const p1Pricing = await request("/api/admin/pricing", "GET", undefined, p1Headers);
    assert.equal(p1Pricing.status, 200);
    assert.equal(p1Pricing.body.promotions.length, 2);
    assert.ok(p1Pricing.body.promotions.every(p => p.partnerEmail === "partner1@test.com"));

    // Đối tác 2 chỉ thấy ưu đãi của Đối tác 2
    const p2Pricing = await request("/api/admin/pricing", "GET", undefined, p2Headers);
    assert.equal(p2Pricing.status, 200);
    assert.equal(p2Pricing.body.promotions.length, 1);
    assert.equal(p2Pricing.body.promotions[0].partnerEmail, "partner2@test.com");

    // Admin thấy tất cả ưu đãi
    const adminPricing = await request("/api/admin/pricing", "GET", undefined, adminHeaders);
    assert.equal(adminPricing.status, 200);
    assert.ok(adminPricing.body.promotions.some(p => p.id === p1CouponId));
    assert.ok(adminPricing.body.promotions.some(p => p.id === p2CouponId));
    assert.ok(adminPricing.body.promotions.some(p => p.id === p1CampaignId));

    // 5. Kiểm tra quyền sửa, bật/tắt, xóa ưu đãi:
    // a. Đối tác 2 không thể sửa hoặc bật/tắt ưu đãi của Đối tác 1
    const p2HackToggle = await request(`/api/admin/promotions/${p1CouponId}`, "PATCH", { enabled: false }, p2Headers);
    assert.equal(p2HackToggle.status, 403);

    const p2HackEdit = await request(`/api/admin/promotions/${p1CouponId}`, "PUT", {
      kind: "coupon",
      name: "Bị Sửa Trộm",
      code: "P1VIP10",
      type: "percent",
      value: 50,
      enabled: true,
      productIds: [p1Product.id],
      stackWithSale: true,
    }, p2Headers);
    assert.equal(p2HackEdit.status, 403);

    const p2HackDelete = await request(`/api/admin/promotions/${p1CouponId}`, "DELETE", undefined, p2Headers);
    assert.equal(p2HackDelete.status, 403);

    // b. Đối tác 1 có thể bật/tắt ưu đãi của mình
    const p1Toggle = await request(`/api/admin/promotions/${p1CouponId}`, "PATCH", { enabled: false }, p1Headers);
    assert.equal(p1Toggle.status, 200);
    assert.equal(p1Toggle.body.promotion.enabled, false);

    // Bật lại
    const p1ToggleOn = await request(`/api/admin/promotions/${p1CouponId}`, "PATCH", { enabled: true }, p1Headers);
    assert.equal(p1ToggleOn.status, 200);
    assert.equal(p1ToggleOn.body.promotion.enabled, true);

    // c. Đối tác 1 có thể sửa ưu đãi của mình
    const p1Edit = await request(`/api/admin/promotions/${p1CouponId}`, "PUT", {
      kind: "coupon",
      name: "Giảm 20% Dịch Vụ P1 (Mới)",
      code: "P1VIP20",
      type: "percent",
      value: 20,
      enabled: true,
      productIds: [p1Product.id],
      minOrder: 60000,
      stackWithSale: true,
      usageLimit: 10,
      perUserLimit: 3,
    }, p1Headers);
    assert.equal(p1Edit.status, 200);
    assert.equal(p1Edit.body.promotion.code, "P1VIP20");
    assert.equal(p1Edit.body.promotion.value, 20);

    // 6. Kiểm tra tính giá catalog và quoteOrder cho khách hàng:
    // a. Khách xem catalog: Dịch vụ P1 nhận giảm 20% từ campaign (100k -> 80k)
    const catalogRes = await request("/api/catalog");
    assert.equal(catalogRes.status, 200);
    const catP1 = catalogRes.body.products.find(p => p.id === p1Product.id);
    assert.equal(catP1.variants[0].basePrice, 100000);
    assert.equal(catP1.variants[0].price, 80000);
    assert.equal(catP1.variants[0].sale.name, "Sale Cuối Tuần P1");

    // Dịch vụ P2 và Nitro của Admin không bị ảnh hưởng bởi campaign của P1
    const catP2 = catalogRes.body.products.find(p => p.id === p2Product.id);
    assert.equal(catP2.variants[0].price, 200000);
    assert.equal(catP2.variants[0].sale, null);

    // b. Khách đăng ký và tạo phiên
    const userSessionToken = "c".repeat(64);
    await db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'unused', 1)").run("user-p1-test", "customer@test.com");
    await db.prepare("INSERT INTO deposits (id,user_id,code,amount,status,created_at,expires_at) VALUES (?,?,?,?,'credited',1,9999999999999)").run("dep-p1", "user-p1-test", "DEPOSIT-P1", 1000000);
    await db.prepare("INSERT INTO bank_events (transaction_id,deposit_id,amount,outcome,received_at) VALUES (?,?,?,'credited',1)").run("evt-p1", "dep-p1", 1000000);
    await db.prepare("INSERT INTO wallet_ledger VALUES (?,?,?,?,?,1)").run("led-p1", "user-p1-test", "dep-p1", "evt-p1", 1000000);
    await db.prepare("INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)").run(digest(userSessionToken), "user-p1-test", "csrf-123", Date.now() + 3600000);
    const userHeaders = {
      Cookie: "vnl_session=" + userSessionToken,
      "X-CSRF-Token": "csrf-123",
    };

    // c. Khách báo giá quote với mã giảm giá P1:
    // Giỏ hàng gồm: 1 sản phẩm của P1 (giá sau sale là 80,000) và 1 sản phẩm của P2 (giá 200,000)
    const p1Item = { productId: p1Product.id, variantId: p1Product.variants[0].id, quantity: 1 };
    const p2Item = { productId: p2Product.id, variantId: p2Product.variants[0].id, quantity: 1 };

    const quoteRes = await request("/api/quote", "POST", {
      items: [p1Item, p2Item],
      couponCode: "P1VIP20",
    }, userHeaders);
    assert.equal(quoteRes.status, 200);
    const quote = quoteRes.body.quote;

    // Tổng tiền chưa coupon = 80,000 (P1) + 200,000 (P2) = 280,000
    // Mã P1VIP20 giảm 20% CHỈ TRÊN SẢN PHẨM P1 (20% của 80,000 = 16,000đ)
    // SẢN PHẨM CỦA P2 KHÔNG BỊ GIẢM!
    assert.equal(quote.couponDiscount, 16000);
    assert.equal(quote.total, 264000);
    assert.equal(quote.coupon.partnerEmail, "partner1@test.com");

    // d. Nếu giỏ hàng chỉ có sản phẩm P2 mà dùng mã của P1 -> báo lỗi không có sản phẩm đủ điều kiện
    const invalidQuote = await request("/api/quote", "POST", {
      items: [p2Item],
      couponCode: "P1VIP20",
    }, userHeaders);
    assert.equal(invalidQuote.status, 400);

    // e. Khách đặt hàng với mã giảm giá của P1:
    const orderRes = await request("/api/orders", "POST", {
      name: "Khách Mua Hàng",
      email: "customer@test.com",
      items: [p1Item, p2Item],
      couponCode: "P1VIP20",
      quoteFingerprint: quote.fingerprint,
    }, userHeaders);
    assert.equal(orderRes.status, 201);
    const createdOrder = orderRes.body.order;
    assert.equal(createdOrder.total, 264000);
    assert.equal(createdOrder.pricing.couponDiscount, 16000);

    // f. Kiểm tra lượt used trong pricing của Đối tác 1 đã tăng lên 1
    const p1PricingAfter = await request("/api/admin/pricing", "GET", undefined, p1Headers);
    const couponAfter = p1PricingAfter.body.promotions.find(p => p.id === p1CouponId);
    assert.equal(couponAfter.used, 1);

    // g. Đối tác 1 không thể xóa mã đã được dùng trong đơn hàng
    const deleteUsedRes = await request(`/api/admin/promotions/${p1CouponId}`, "DELETE", undefined, p1Headers);
    assert.equal(deleteUsedRes.status, 400);
    assert.ok(deleteUsedRes.body.error.includes("đã được sử dụng"));

    // h. Đối tác 1 xóa đợt giảm giá (chưa dùng trong order_pricing) -> thành công
    const deleteCampRes = await request(`/api/admin/promotions/${p1CampaignId}`, "DELETE", undefined, p1Headers);
    assert.equal(deleteCampRes.status, 200);
    assert.equal(deleteCampRes.body.deleted, true);

    const p1PricingFinal = await request("/api/admin/pricing", "GET", undefined, p1Headers);
    assert.equal(p1PricingFinal.body.promotions.some(p => p.id === p1CampaignId), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
