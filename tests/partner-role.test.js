import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openStore } from "../server/store.js";
import { createApp } from "../server/app.js";
import { readConfig } from "../server/config.js";

test("Role đối tác (Partner): Cấp quyền, đăng nhập đối tác, phân quyền và cách ly đơn hàng / dịch vụ", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "master-admin-secret-key-123",
  });
  const server = createApp(db, config);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const adminHeaders = {
    Origin: config.origin,
    "Content-Type": "application/json",
    "X-Admin-Key": config.adminPassword,
  };

  try {
    // -------------------------------------------------------------
    // 1. Master Admin đăng nhập và kiểm tra /api/admin/me
    // -------------------------------------------------------------
    const adminMeRes = await fetch(origin + "/api/admin/me", { headers: adminHeaders });
    assert.equal(adminMeRes.status, 200);
    const adminMe = await adminMeRes.json();
    assert.equal(adminMe.role, "admin");

    // -------------------------------------------------------------
    // 2. Master Admin cấp quyền đối tác cho gmail "doitac@gmail.com"
    // -------------------------------------------------------------
    const createPartnerRes = await fetch(origin + "/api/admin/partners", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        email: "doitac@gmail.com",
        name: "Shop Đối Tác Uy Tín",
        password: "partner-secure-pass-888",
      }),
    });
    assert.equal(createPartnerRes.status, 201);
    const partnerData = await createPartnerRes.json();
    assert.equal(partnerData.ok, true);
    assert.equal(partnerData.partner.email, "doitac@gmail.com");
    assert.equal(partnerData.partner.name, "Shop Đối Tác Uy Tín");
    const partnerId = partnerData.partner.id;

    // Danh sách đối tác
    const listRes = await fetch(origin + "/api/admin/partners", { headers: adminHeaders });
    assert.equal(listRes.status, 200);
    const { partners } = await listRes.json();
    assert(partners.some(p => p.email === "doitac@gmail.com"));

    // -------------------------------------------------------------
    // 3. Đối tác đăng nhập vào trang Admin qua POST /api/admin/auth
    // -------------------------------------------------------------
    // Thử sai mật khẩu -> thất bại
    const wrongAuthRes = await fetch(origin + "/api/admin/auth", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "doitac@gmail.com",
        password: "wrong-password",
      }),
    });
    assert.equal(wrongAuthRes.status, 401);

    // Mật khẩu đúng -> nhận role: "partner" và token "vnl_ptn_..."
    const partnerAuthRes = await fetch(origin + "/api/admin/auth", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "doitac@gmail.com",
        password: "partner-secure-pass-888",
      }),
    });
    assert.equal(partnerAuthRes.status, 200);
    const partnerAuth = await partnerAuthRes.json();
    assert.equal(partnerAuth.ok, true);
    assert.equal(partnerAuth.role, "partner");
    assert.equal(partnerAuth.email, "doitac@gmail.com");
    assert.equal(partnerAuth.name, "Shop Đối Tác Uy Tín");
    assert(partnerAuth.token.startsWith("vnl_ptn_"));

    const partnerHeaders = {
      Origin: config.origin,
      "Content-Type": "application/json",
      "X-Admin-Key": partnerAuth.token,
    };

    // Kiểm tra /api/admin/me với token của đối tác
    const partnerMeRes = await fetch(origin + "/api/admin/me", { headers: partnerHeaders });
    assert.equal(partnerMeRes.status, 200);
    const partnerMe = await partnerMeRes.json();
    assert.equal(partnerMe.role, "partner");
    assert.equal(partnerMe.email, "doitac@gmail.com");

    // -------------------------------------------------------------
    // 4. Kiểm tra phân quyền: Đối tác bị chặn ở các API nhạy cảm của Master Admin
    // -------------------------------------------------------------
    const forbiddenBank = await fetch(origin + "/api/admin/bank", { headers: partnerHeaders });
    assert.equal(forbiddenBank.status, 403, "Đối tác không được xem cấu hình ngân hàng");

    const forbiddenPartners = await fetch(origin + "/api/admin/partners", { headers: partnerHeaders });
    assert.equal(forbiddenPartners.status, 403, "Đối tác không được quản lý các đối tác khác");

    const forbiddenSimulate = await fetch(origin + "/api/admin/deposits/simulate", {
      method: "POST",
      headers: partnerHeaders,
      body: JSON.stringify({ code: "VNL123456" }),
    });
    assert.equal(forbiddenSimulate.status, 403, "Đối tác không được can thiệp duyệt tiền hay giả lập nạp");

    // -------------------------------------------------------------
    // 5. Đối tác đăng sản phẩm & gói dịch vụ riêng của họ
    // -------------------------------------------------------------
    const createProdRes = await fetch(origin + "/api/admin/products", {
      method: "POST",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Dịch Vụ Thiết Kế Banner Discord",
        category: "design",
        badge: "PARTNER / DESIGN",
        description: "Thiết kế banner chất lượng cao theo yêu cầu.",
        variants: [
          { name: "Gói Cơ Bản (1 Banner)", price: 50000, deliveryType: "gift" },
        ],
      }),
    });
    assert.equal(createProdRes.status, 201);
    const createdProd = (await createProdRes.json()).product;
    assert.equal(createdProd.partnerEmail, "doitac@gmail.com", "Sản phẩm tự động gắn partner_email");

    // Thêm variant cho sản phẩm của mình
    const addVarRes = await fetch(origin + `/api/admin/products/${createdProd.id}/variants`, {
      method: "POST",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Gói Cao Cấp (Bộ Avatar + Banner)",
        price: 120000,
        deliveryType: "gift",
      }),
    });
    assert.equal(addVarRes.status, 201);

    // Đối tác không thể sửa hoặc xóa sản phẩm mặc định của Master Admin (như 'nitro')
    const badEditRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({ name: "Hacked Nitro" }),
    });
    assert.equal(badEditRes.status, 403, "Đối tác bị chặn sửa sản phẩm không thuộc quyền quản lý");

    const badDeleteRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "DELETE",
      headers: partnerHeaders,
    });
    assert.equal(badDeleteRes.status, 403, "Đối tác bị chặn xóa sản phẩm của Master Admin");

    // Đối tác sửa sản phẩm của chính mình -> thành công
    const goodEditRes = await fetch(origin + `/api/admin/products/${createdProd.id}`, {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Dịch Vụ Thiết Kế Banner Discord VIP",
        description: "Mô tả mới của đối tác.",
      }),
    });
    assert.equal(goodEditRes.status, 200);

    // -------------------------------------------------------------
    // 5.1. Quản lý hạng mục: Đối tác chỉ được tạo & xóa hạng mục của chính mình
    // -------------------------------------------------------------
    const getPricingRes = await fetch(origin + "/api/admin/pricing", { headers: partnerHeaders });
    assert.equal(getPricingRes.status, 200);
    const initialCats = (await getPricingRes.json()).categories;
    assert.equal(initialCats.length, 5); // 5 hạng mục mặc định

    // A. Đối tác tạo hạng mục mới riêng của họ
    const addCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: [
          ...initialCats,
          { id: "custom-ptn-cat", name: "Dịch Vụ Riêng", icon: "sparkles" },
        ],
      }),
    });
    assert.equal(addCatRes.status, 200);
    const addedCats = (await addCatRes.json()).categories;
    const partnerCat = addedCats.find(c => c.id === "custom-ptn-cat");
    assert(partnerCat, "Hạng mục của đối tác phải được thêm");
    assert.equal(partnerCat.partnerEmail, "doitac@gmail.com", "Hạng mục mới được tự động gắn partnerEmail");

    // B. Đối tác cố tình xóa hạng mục mặc định của hệ thống -> Bị chặn 403
    const badDeleteCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: addedCats.filter(c => c.id !== "discord"),
      }),
    });
    assert.equal(badDeleteCatRes.status, 403, "Đối tác không được xóa hạng mục mặc định của hệ thống");
    const badDeleteErr = await badDeleteCatRes.json();
    assert.match(badDeleteErr.error, /không có quyền xóa hạng mục mặc định/i);

    // C. Đối tác cố tình đổi tên hạng mục mặc định của hệ thống -> Hệ thống giữ nguyên giá trị gốc
    const tamperCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: addedCats.map(c => c.id === "discord" ? { ...c, name: "Hacked Discord Name" } : c),
      }),
    });
    assert.equal(tamperCatRes.status, 200);
    const preservedCats = (await tamperCatRes.json()).categories;
    assert.equal(preservedCats.find(c => c.id === "discord").name, "Discord", "Tên hạng mục mặc định được bảo vệ không bị đối tác sửa");

    // D. Đối tác sửa hạng mục của chính mình -> Thành công
    const editOwnCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: addedCats.map(c => c.id === "custom-ptn-cat" ? { ...c, name: "Dịch Vụ Riêng VIP", icon: "box" } : c),
      }),
    });
    assert.equal(editOwnCatRes.status, 200);
    const editedCats = (await editOwnCatRes.json()).categories;
    assert.equal(editedCats.find(c => c.id === "custom-ptn-cat").name, "Dịch Vụ Riêng VIP");

    // E. Đối tác xóa hạng mục của chính mình -> Thành công
    const deleteOwnCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: editedCats.filter(c => c.id !== "custom-ptn-cat"),
      }),
    });
    assert.equal(deleteOwnCatRes.status, 200);
    const remainingCats = (await deleteOwnCatRes.json()).categories;
    assert(!remainingCats.some(c => c.id === "custom-ptn-cat"), "Hạng mục của đối tác đã được xóa");
    assert.equal(remainingCats.length, 5, "5 hạng mục mặc định vẫn còn nguyên");

    // -------------------------------------------------------------
    // 6. Cách ly đơn hàng và trả hàng (Fulfillment)
    // -------------------------------------------------------------
    // Tạo 1 đơn hàng cho sản phẩm của Admin (nitro)
    const order1Id = randomUUID();
    await db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, customer_note, items_json, total, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order1Id,
      null,
      "Khách 1",
      "khach1@gmail.com",
      "",
      JSON.stringify([{ productId: "nitro", variantId: "boost_gift_1m", productName: "Discord Nitro", variantName: "1 Tháng", price: 50000, quantity: 1 }]),
      50000,
      "processing",
      Date.now()
    );

    // Tạo 1 đơn hàng cho dịch vụ của Đối tác
    const order2Id = randomUUID();
    await db.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_email, customer_note, items_json, total, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order2Id,
      null,
      "Khách 2",
      "khach2@gmail.com",
      "",
      JSON.stringify([{ productId: createdProd.id, variantId: createdProd.variants[0].id, productName: "Banner Design", variantName: "1 Banner", price: 50000, quantity: 1 }]),
      50000,
      "processing",
      Date.now()
    );

    const order1 = { id: order1Id };
    const order2 = { id: order2Id };

    // Đối tác xem danh sách đơn hàng qua GET /api/admin/orders
    const partnerOrdersRes = await fetch(origin + "/api/admin/orders", { headers: partnerHeaders });
    assert.equal(partnerOrdersRes.status, 200);
    const partnerOrdersData = await partnerOrdersRes.json();
    assert.equal(partnerOrdersData.orders.length, 1, "Đối tác chỉ thấy đúng 1 đơn hàng chứa dịch vụ của họ");
    assert.equal(partnerOrdersData.orders[0].id, order2.id);
    assert(!partnerOrdersData.orders.some(o => o.id === order1.id), "Không thấy đơn của mặt hàng khác");

    // Master Admin xem danh sách đơn hàng -> thấy cả 2 đơn
    const allOrdersRes = await fetch(origin + "/api/admin/orders", { headers: adminHeaders });
    const allOrdersData = await allOrdersRes.json();
    assert(allOrdersData.orders.some(o => o.id === order1.id));
    assert(allOrdersData.orders.some(o => o.id === order2.id));

    // Đối tác thử trả hàng/cập nhật đơn hàng của Admin -> 403
    const badFulfillRes = await fetch(origin + `/api/admin/orders/${order1.id}`, {
      method: "PATCH",
      headers: partnerHeaders,
      body: JSON.stringify({ claimLink: "https://discord.gift/fake" }),
    });
    assert.equal(badFulfillRes.status, 403, "Đối tác không thể can thiệp vào đơn hàng không thuộc về họ");

    // Đối tác trả hàng cho đơn dịch vụ của mình -> 200
    const goodFulfillRes = await fetch(origin + `/api/admin/orders/${order2.id}`, {
      method: "PATCH",
      headers: partnerHeaders,
      body: JSON.stringify({
        status: "completed",
        claimLink: "https://drive.google.com/banner-design-finished",
      }),
    });
    assert.equal(goodFulfillRes.status, 200);
    const fulfilledOrder = await goodFulfillRes.json();
    assert.equal(fulfilledOrder.order.status, "completed");
    assert.equal(fulfilledOrder.order.claimLink, "https://drive.google.com/banner-design-finished");

    // -------------------------------------------------------------
    // 7. Khóa hoặc gỡ quyền đối tác (Lock / Revoke)
    // -------------------------------------------------------------
    // Master Admin khóa đối tác
    const lockRes = await fetch(origin + `/api/admin/partners/${partnerId}/toggle`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(lockRes.status, 200);

    // Token cũ của đối tác lập tức bị vô hiệu hóa
    const expiredMeRes = await fetch(origin + "/api/admin/me", { headers: partnerHeaders });
    assert.equal(expiredMeRes.status, 401, "Token đối tác bị khóa không còn hợp lệ");

    // Đối tác cố gắng đăng nhập lại khi đang bị khóa -> 403
    const lockedLoginRes = await fetch(origin + "/api/admin/auth", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "doitac@gmail.com",
        password: "partner-secure-pass-888",
      }),
    });
    assert.equal(lockedLoginRes.status, 403, "Tài khoản đối tác bị khóa không thể đăng nhập");

    // Master Admin mở khóa lại
    const unlockRes = await fetch(origin + `/api/admin/partners/${partnerId}/toggle`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(unlockRes.status, 200);

    // Đăng nhập lại thành công
    const reLoginRes = await fetch(origin + "/api/admin/auth", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "doitac@gmail.com",
        password: "partner-secure-pass-888",
      }),
    });
    assert.equal(reLoginRes.status, 200);

    // Master Admin gỡ quyền / xóa đối tác
    const deletePartnerRes = await fetch(origin + `/api/admin/partners/${partnerId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(deletePartnerRes.status, 200);

    // Sau khi xóa, không thể đăng nhập được nữa
    const deletedLoginRes = await fetch(origin + "/api/admin/auth", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "doitac@gmail.com",
        password: "partner-secure-pass-888",
      }),
    });
    assert.equal(deletedLoginRes.status, 401);
  } finally {
    server.close();
    db.close();
  }
});
