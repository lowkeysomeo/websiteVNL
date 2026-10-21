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
    // 5. Đối tác đăng sản phẩm & gói dịch vụ riêng của họ (kèm ảnh minh họa, đoạn giới thiệu chi tiết và danh sách đặc điểm tích xanh)
    // -------------------------------------------------------------
    const createProdRes = await fetch(origin + "/api/admin/products", {
      method: "POST",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Dịch Vụ Thiết Kế Banner Discord",
        category: "design",
        badge: "PARTNER / DESIGN",
        description: "Thiết kế banner chất lượng cao theo yêu cầu.",
        detail: "Đoạn giới thiệu chi tiết về dịch vụ thiết kế banner của đối tác dành cho khách hàng xem popup.",
        features: [
          "Bàn giao file gốc PSD / AI chất lượng cao",
          "Chỉnh sửa miễn phí không giới hạn 3 lần",
          "Hỗ trợ hoàn thành trong vòng 24 giờ",
        ],
        image: "https://i.imgur.com/partner-custom-banner.png",
        variants: [
          { name: "Gói Cơ Bản (1 Banner)", price: 50000, deliveryType: "gift" },
        ],
      }),
    });
    assert.equal(createProdRes.status, 201);
    const createdProd = (await createProdRes.json()).product;
    assert.equal(createdProd.partnerEmail, "doitac@gmail.com", "Sản phẩm tự động gắn partner_email");
    assert.equal(createdProd.image, "https://i.imgur.com/partner-custom-banner.png", "Ảnh minh họa riêng của đối tác được lưu thành công");
    assert.equal(createdProd.detail, "Đoạn giới thiệu chi tiết về dịch vụ thiết kế banner của đối tác dành cho khách hàng xem popup.");
    assert.deepEqual(createdProd.features, [
      "Bàn giao file gốc PSD / AI chất lượng cao",
      "Chỉnh sửa miễn phí không giới hạn 3 lần",
      "Hỗ trợ hoàn thành trong vòng 24 giờ",
    ], "Đặc điểm tích xanh được lưu chính xác");

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

    // Đối tác sửa sản phẩm của chính mình và cập nhật ảnh, detail, features mới -> thành công
    const goodEditRes = await fetch(origin + `/api/admin/products/${createdProd.id}`, {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Dịch Vụ Thiết Kế Banner Discord VIP",
        description: "Mô tả mới của đối tác.",
        detail: "Nội dung chi tiết mới sau khi cập nhật bởi đối tác.",
        featuresText: "✓ Bàn giao file gốc PSD / AI chất lượng cao (Update)\n- Bảo hành bản quyền thiết kế trọn đời",
        image: "https://i.imgur.com/partner-custom-banner-updated.png",
      }),
    });
    assert.equal(goodEditRes.status, 200);
    const editedProd = (await goodEditRes.json()).product;
    assert.equal(editedProd.image, "https://i.imgur.com/partner-custom-banner-updated.png", "Ảnh minh họa được cập nhật thành công");
    assert.equal(editedProd.detail, "Nội dung chi tiết mới sau khi cập nhật bởi đối tác.");
    assert.deepEqual(editedProd.features, [
      "Bàn giao file gốc PSD / AI chất lượng cao (Update)",
      "Bảo hành bản quyền thiết kế trọn đời",
    ], "Tính năng và tiền tố checkmark được làm sạch và lưu đúng");

    // Master Admin tùy chỉnh detail và features cho mặt hàng mặc định (Nitro)
    const adminEditNitroRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Discord Nitro Boost VIP",
        detail: "Gói Discord Nitro Boost cao cấp do Admin nâng cấp chi tiết.",
        features: [
          "Áp dụng cho mọi tài khoản Discord",
          "Kích hoạt siêu tốc 30 giây",
          "Bảo hành đầy đủ 100% thời gian",
        ],
      }),
    });
    assert.equal(adminEditNitroRes.status, 200);
    const adminEditedNitro = (await adminEditNitroRes.json()).product;
    assert.equal(adminEditedNitro.detail, "Gói Discord Nitro Boost cao cấp do Admin nâng cấp chi tiết.");
    assert.deepEqual(adminEditedNitro.features, [
      "Áp dụng cho mọi tài khoản Discord",
      "Kích hoạt siêu tốc 30 giây",
      "Bảo hành đầy đủ 100% thời gian",
    ]);

    // Kiểm tra catalog công khai trả về đúng detail và features cho cả sản phẩm đối tác và sản phẩm mặc định
    const catalogRes = await fetch(origin + "/api/catalog");
    assert.equal(catalogRes.status, 200);
    const pubCatalog = (await catalogRes.json()).products;
    const pubNitro = pubCatalog.find(p => p.id === "nitro");
    assert.equal(pubNitro.detail, "Gói Discord Nitro Boost cao cấp do Admin nâng cấp chi tiết.");
    assert.equal(pubNitro.features.length, 3);
    const pubPartnerProd = pubCatalog.find(p => p.id === createdProd.id);
    assert.equal(pubPartnerProd.detail, "Nội dung chi tiết mới sau khi cập nhật bởi đối tác.");
    assert.equal(pubPartnerProd.features.length, 2);

    // -------------------------------------------------------------
    // 5.1. Quản lý hạng mục: Đối tác chỉ được tạo & xóa hạng mục của chính mình
    // -------------------------------------------------------------
    const getPricingRes = await fetch(origin + "/api/admin/pricing", { headers: partnerHeaders });
    assert.equal(getPricingRes.status, 200);
    const initialCats = (await getPricingRes.json()).categories;
    assert.equal(initialCats.length, 3); // 3 hạng mục mặc định (Dịch vụ Discord, Giải trí, Sáng tạo)

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
        categories: addedCats.filter(c => c.id !== "services"),
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
        categories: addedCats.map(c => c.id === "services" ? { ...c, name: "Hacked Discord Name" } : c),
      }),
    });
    assert.equal(tamperCatRes.status, 200);
    const preservedCats = (await tamperCatRes.json()).categories;
    assert.equal(preservedCats.find(c => c.id === "services").name, "Dịch vụ Discord", "Tên hạng mục mặc định được bảo vệ không bị đối tác sửa");

    // D. Đối tác sửa hạng mục của chính mình với emoji / icon tùy chọn (VD: ⚡) -> Thành công
    const editOwnCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: addedCats.map(c => c.id === "custom-ptn-cat" ? { ...c, name: "Dịch Vụ Riêng VIP", icon: "⚡" } : c),
      }),
    });
    assert.equal(editOwnCatRes.status, 200);
    const editedCats = (await editOwnCatRes.json()).categories;
    const editedPtnCat = editedCats.find(c => c.id === "custom-ptn-cat");
    assert.equal(editedPtnCat.name, "Dịch Vụ Riêng VIP");
    assert.equal(editedPtnCat.icon, "⚡", "Biểu tượng icon / emoji tùy chọn (⚡) được lưu chính xác");

    // Khách hàng xem danh mục công khai nhận được icon emoji tùy chọn
    const pubCatsRes = await fetch(origin + "/api/categories");
    assert.equal(pubCatsRes.status, 200);
    const pubCats = (await pubCatsRes.json()).categories;
    const pubCustomCat = pubCats.find(c => c.id === "custom-ptn-cat");
    assert(pubCustomCat, "Danh mục tùy chọn xuất hiện ngoài cửa hàng");
    assert.equal(pubCustomCat.icon, "⚡", "Emoji tùy chọn được trả về đúng cho cửa hàng");

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
    assert.equal(remainingCats.length, 3, "3 hạng mục mặc định vẫn còn nguyên");

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
    const metrics = await (await fetch(origin + "/api/admin/partners", { headers: adminHeaders })).json();
    const partnerMetrics = metrics.partners.find(p => p.id === partnerId);
    assert.equal(partnerMetrics.orderCount, 1);
    assert.equal(partnerMetrics.revenue, 50000, "Doanh số đọc price từ đơn hoàn thành");
    assert.equal(partnerMetrics.totalRevenue, 50000);


    // -------------------------------------------------------------
    // 6.1. Admin chuyển giao mặt hàng mặc định (Default Product) và Danh mục cho đối tác
    // -------------------------------------------------------------
    // A. Admin chuyển quyền sở hữu mặt hàng mặc định "nitro" cho đối tác "doitac@gmail.com"
    const transferNitroRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Discord Nitro Boost Partner",
        partnerEmail: "doitac@gmail.com",
        category: "services",
        description: "Gói Nitro Boost chuyển giao cho đối tác quản lý.",
      }),
    });
    assert.equal(transferNitroRes.status, 200);
    const transferredNitro = (await transferNitroRes.json()).product;
    assert.equal(transferredNitro.partnerEmail, "doitac@gmail.com", "Mặt hàng mặc định nitro đã được chuyển cho đối tác");

    // B. Đối tác xem danh sách mặt hàng thấy nitro đã thuộc quyền sở hữu của mình
    const partnerCatalogRes = await fetch(origin + "/api/admin/pricing", { headers: partnerHeaders });
    assert.equal(partnerCatalogRes.status, 200);
    const partnerCatalog = await partnerCatalogRes.json();
    const nitroInPartner = partnerCatalog.products.find(p => p.id === "nitro");
    assert(nitroInPartner, "nitro phải có trong catalog");
    assert.equal(nitroInPartner.partnerEmail, "doitac@gmail.com");

    // C. Đối tác có quyền cập nhật thông tin mặt hàng nitro được giao
    const partnerUpdateNitroRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "Discord Nitro Boost Partner VIP",
        description: "Mô tả do đối tác cập nhật.",
      }),
    });
    assert.equal(partnerUpdateNitroRes.status, 200, "Đối tác được phép cập nhật mặt hàng thuộc sở hữu của mình");

    // D. Đối tác có quyền bật/tắt trạng thái và cập nhật giá gói của nitro
    const toggleNitroRes = await fetch(origin + "/api/admin/products/nitro/toggle", {
      method: "PATCH",
      headers: partnerHeaders,
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(toggleNitroRes.status, 200, "Đối tác toggle mặt hàng được giao thành công");

    const updateVariantRes = await fetch(origin + "/api/admin/products/nitro/variants/boost_gift_1m", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        name: "1 Tháng Boost (Đối tác)",
        price: 52000,
        deliveryType: "gift",
        note: "Giao ngay",
      }),
    });
    assert.equal(updateVariantRes.status, 200, "Đối tác cập nhật gói của mặt hàng được giao thành công");

    // E. Đối tác xem danh sách đơn hàng giờ đây thấy cả đơn chứa nitro (order1)
    const partnerOrdersWithNitroRes = await fetch(origin + "/api/admin/orders", { headers: partnerHeaders });
    assert.equal(partnerOrdersWithNitroRes.status, 200);
    const partnerOrdersWithNitro = await partnerOrdersWithNitroRes.json();
    assert(partnerOrdersWithNitro.orders.some(o => o.id === order1.id), "Đối tác thấy đơn hàng của sản phẩm mặc định đã chuyển giao");

    // Đối tác có quyền cập nhật / xử lý đơn nitro đó
    const fulfillNitroOrderRes = await fetch(origin + `/api/admin/orders/${order1.id}`, {
      method: "PATCH",
      headers: partnerHeaders,
      body: JSON.stringify({
        status: "completed",
        claimLink: "https://discord.gift/nitro-partner-valid",
      }),
    });
    assert.equal(fulfillNitroOrderRes.status, 200, "Đối tác hoàn thành đơn hàng cho sản phẩm nitro được giao");

    // F. Admin chuyển giao hạng mục cho đối tác
    const transferCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        categories: [
          { id: "services", name: "Dịch vụ Discord Đối Tác", icon: "discord", partnerEmail: "doitac@gmail.com" },
          { id: "entertainment", name: "Giải trí", icon: "entertainment" },
          { id: "creative", name: "Sáng tạo", icon: "lightbulb" },
        ],
      }),
    });
    assert.equal(transferCatRes.status, 200);
    const transferredCats = (await transferCatRes.json()).categories;
    const catServices = transferredCats.find(c => c.id === "services");
    assert.equal(catServices.partnerEmail, "doitac@gmail.com", "Hạng mục services đã được chuyển cho đối tác");

    // Đối tác sửa tên hạng mục services do chính mình sở hữu -> thành công
    const partnerEditCatRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: partnerHeaders,
      body: JSON.stringify({
        categories: [
          { id: "services", name: "Dịch vụ Discord Veigo", icon: "⚡" },
          { id: "entertainment", name: "Giải trí", icon: "entertainment" },
          { id: "creative", name: "Sáng tạo", icon: "lightbulb" },
        ],
      }),
    });
    assert.equal(partnerEditCatRes.status, 200);
    const pCats = (await partnerEditCatRes.json()).categories;
    assert.equal(pCats.find(c => c.id === "services").name, "Dịch vụ Discord Veigo");

    // G. Admin thu hồi sản phẩm về Cửa hàng chính (partnerEmail: null)
    const revokeNitroRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Discord Nitro Boost",
        partnerEmail: "",
      }),
    });
    assert.equal(revokeNitroRes.status, 200);
    const revokedNitro = (await revokeNitroRes.json()).product;
    assert.equal(revokedNitro.partnerEmail, null, "Đã thu hồi quyền sản phẩm về cửa hàng chính");

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
