import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.js";
import {
  getCatalog,
  createCustomProduct,
  addCustomVariant,
  toggleProductStatus,
  deleteProduct,
  toggleVariantStatus,
  deleteVariant,
  savePrices,
  quoteOrder,
  getCategories,
  saveCategories,
  saveCatalogOrder,
} from "../server/pricing.js";
import { createApp } from "../server/app.js";
import { readConfig } from "../server/config.js";

test("Tùy chỉnh mặt hàng: thêm mới, ẩn (bỏ bán), khôi phục và xóa sản phẩm/gói", async () => {
  const db = await openStore(":memory:");
  try {
    // 1. Kiểm tra ban đầu: catalog có sẵn các sản phẩm mặc định
    const initial = await getCatalog(db, Date.now(), false);
    assert(initial.some(p => p.id === "nitro"));
    assert(initial.some(p => p.id === "youtube"));

    // 2. Ẩn (bỏ bán) sản phẩm "youtube"
    await toggleProductStatus(db, "youtube", false);
    const afterHide = await getCatalog(db, Date.now(), false);
    assert(!afterHide.some(p => p.id === "youtube"), "Khách hàng không thấy mặt hàng đã ẩn");

    const adminCatalog = await getCatalog(db, Date.now(), true);
    const hiddenProduct = adminCatalog.find(p => p.id === "youtube");
    assert(hiddenProduct, "Admin vẫn thấy mặt hàng để quản lý");
    assert.equal(hiddenProduct.isActive, false, "Trạng thái isActive = false");

    // Khôi phục lại sản phẩm "youtube"
    await toggleProductStatus(db, "youtube", true);
    const restored = await getCatalog(db, Date.now(), false);
    assert(restored.some(p => p.id === "youtube"), "Khách hàng thấy lại mặt hàng sau khi khôi phục");

    // 3. Ẩn (bỏ) một gói cụ thể của sản phẩm "nitro"
    await toggleVariantStatus(db, "nitro", "boost_log_1y", false);
    const nitroVariants = (await getCatalog(db, Date.now(), false)).find(p => p.id === "nitro").variants;
    assert(!nitroVariants.some(v => v.id === "boost_log_1y"), "Gói bị bỏ không xuất hiện trên cửa hàng");

    // Khách hàng không thể đặt đơn cho gói đã bị bỏ
    await assert.rejects(
      async () => await quoteOrder(db, [{ productId: "nitro", variantId: "boost_log_1y", quantity: 1 }]),
      /không hợp lệ|không tồn tại/
    );

    // Khôi phục lại gói
    await toggleVariantStatus(db, "nitro", "boost_log_1y", true);
    const restoredNitro = (await getCatalog(db, Date.now(), false)).find(p => p.id === "nitro").variants;
    assert(restoredNitro.some(v => v.id === "boost_log_1y"), "Gói xuất hiện lại sau khi mở");

    // 4. Thêm gói mới vào sản phẩm đã có (ví dụ: Nitro Boost 6 tháng)
    const newVariant = await addCustomVariant(db, "nitro", {
      name: "🎁 [Gift] Nitro Boost · 6 tháng",
      price: 499000,
      deliveryType: "gift",
      note: "Link claim trực tiếp",
    });
    assert.equal(newVariant.price, 499000);
    assert.equal(newVariant.isCustom, true);

    const nitroWithNewPkg = (await getCatalog(db, Date.now(), false)).find(p => p.id === "nitro");
    assert(nitroWithNewPkg.variants.some(v => v.id === newVariant.id), "Gói mới xuất hiện trong sản phẩm");

    // Chỉnh giá cho gói mới thêm
    await savePrices(db, [{ productId: "nitro", variantId: newVariant.id, price: 479000 }]);
    const quotePkg = await quoteOrder(db, [{ productId: "nitro", variantId: newVariant.id, quantity: 1 }]);
    assert.equal(quotePkg.total, 479000, "Giá mới cập nhật cho gói tự thêm");

    // 5. Thêm mặt hàng hoàn toàn mới (ví dụ: Spotify Premium)
    const newProd = await createCustomProduct(db, {
      name: "Spotify Premium",
      category: "entertainment",
      badge: "MUSIC / PREMIUM",
      description: "Nghe nhạc không quảng cáo chất lượng cao",
      variants: [
        { name: "Spotify · 1 tháng", price: 35000, deliveryType: "gift", note: "Nâng cấp chính chủ" },
        { name: "Spotify · 3 tháng", price: 99000, deliveryType: "gift", note: "Nâng cấp chính chủ" },
      ],
    });
    assert.equal(newProd.name, "Spotify Premium");
    assert.equal(newProd.isCustom, true);
    assert.equal(newProd.variants.length, 2);

    const publicCatalogWithNew = await getCatalog(db, Date.now(), false);
    const foundNew = publicCatalogWithNew.find(p => p.id === newProd.id);
    assert(foundNew, "Mặt hàng mới xuất hiện ngay trên cửa hàng");
    assert.equal(foundNew.variants.length, 2);

    // Đặt thử đơn với mặt hàng mới
    const quoteCustom = await quoteOrder(db, [{ productId: newProd.id, variantId: newProd.variants[0].id, quantity: 2 }]);
    assert.equal(quoteCustom.total, 70000, "Tính đúng tổng tiền cho mặt hàng mới");

    // 6. Xóa vĩnh viễn mặt hàng tự tạo
    await deleteProduct(db, newProd.id);
    const afterDelete = await getCatalog(db, Date.now(), true);
    assert(!afterDelete.some(p => p.id === newProd.id), "Mặt hàng tự tạo đã được xóa vĩnh viễn");
  } finally {
    db.close();
  }
});

test("HTTP API Admin quản lý thêm/bỏ mặt hàng và gói", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "test-admin-catalog-only",
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
    // 1. Thêm mặt hàng mới qua POST /api/admin/products
    const createRes = await fetch(origin + "/api/admin/products", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Canva Pro VIP",
        category: "creative",
        badge: "DESIGN / PRO",
        description: "Thiết kế không giới hạn tài nguyên",
        variants: [{ name: "Canva · 1 năm", price: 120000, deliveryType: "key" }],
      }),
    });
    assert.equal(createRes.status, 201);
    const createdData = await createRes.json();
    const prodId = createdData.product.id;
    assert(prodId);
    assert.equal(createdData.product.variants[0].deliveryType, "key", "Gói đầu tiên nhận deliveryType là key");

    // 2. Thêm gói mới vào mặt hàng với hình thức nhận hàng tùy chỉnh (custom deliveryType)
    const addVarRes = await fetch(origin + `/api/admin/products/${prodId}/variants`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Canva · Vĩnh viễn",
        price: 250000,
        deliveryType: "Ticket Discord",
      }),
    });
    assert.equal(addVarRes.status, 201);
    const addedVarData = await addVarRes.json();
    assert.equal(addedVarData.variant.deliveryType, "Ticket Discord", "Gói mới nhận deliveryType tùy chỉnh");

    // 3. Ẩn mặt hàng qua PATCH /api/admin/products/:id/toggle
    const toggleRes = await fetch(origin + `/api/admin/products/${prodId}/toggle`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(toggleRes.status, 200);

    // Kiểm tra /api/catalog công khai không trả về mặt hàng đã ẩn
    const publicRes = await fetch(origin + "/api/catalog");
    const publicList = (await publicRes.json()).products;
    assert(!publicList.some(p => p.id === prodId), "Mặt hàng đã ẩn không có trong public catalog");

    // 4. Mở lại mặt hàng
    await fetch(origin + `/api/admin/products/${prodId}/toggle`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ isActive: true }),
    });
    const publicRes2 = await fetch(origin + "/api/catalog");
    const publicList2 = (await publicRes2.json()).products;
    assert(publicList2.some(p => p.id === prodId), "Mặt hàng xuất hiện lại trong public catalog");

    // 5. Xóa mặt hàng tự tạo qua DELETE /api/admin/products/:id
    const delRes = await fetch(origin + `/api/admin/products/${prodId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(delRes.status, 200);

    const publicRes3 = await fetch(origin + "/api/catalog");
    assert(!(await publicRes3.json()).products.some(p => p.id === prodId));
  } finally {
    server.close();
    db.close();
  }
});

test("Admin có thể chỉnh sửa và xóa mặt hàng/gói mặc định (Discord Nitro Boost, vv)", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "test-admin-catalog-edit",
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
    // 1. Chỉnh sửa thông tin mặt hàng mặc định Nitro
    const editProdRes = await fetch(origin + "/api/admin/products/nitro", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "Discord Nitro Boost VIP",
        category: "discord",
        badge: "DISCORD / VIP NITRO",
        description: "Mô tả mới đã được cập nhật bởi Admin.",
      }),
    });
    assert.equal(editProdRes.status, 200);
    const editedProd = (await editProdRes.json()).product;
    assert.equal(editedProd.name, "Discord Nitro Boost VIP");
    assert.equal(editedProd.badge, "DISCORD / VIP NITRO");
    assert.equal(editedProd.description, "Mô tả mới đã được cập nhật bởi Admin.");

    // Cửa hàng công khai thấy thông tin mới
    const pubRes1 = await fetch(origin + "/api/catalog");
    const nitroPub = (await pubRes1.json()).products.find(p => p.id === "nitro");
    assert.equal(nitroPub.name, "Discord Nitro Boost VIP");
    assert.equal(nitroPub.badge, "DISCORD / VIP NITRO");

    // 2. Chỉnh sửa gói mặc định của Nitro
    const editVarRes = await fetch(origin + "/api/admin/products/nitro/variants/boost_gift_1m", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "🎁 [Gift] Nitro Boost · 1 tháng (Khuyến mãi)",
        price: 89000,
        deliveryType: "gift",
        note: "Ghi chú mới cho gói 1 tháng",
      }),
    });
    assert.equal(editVarRes.status, 200);
    const editedVar = (await editVarRes.json()).variant;
    assert.equal(editedVar.name, "🎁 [Gift] Nitro Boost · 1 tháng (Khuyến mãi)");
    assert.equal(editedVar.price, 89000);
    assert.equal(editedVar.note, "Ghi chú mới cho gói 1 tháng");

    // Đặt đơn phản ánh giá mới
    const quoteRes = await fetch(origin + "/api/quote", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: "nitro", variantId: "boost_gift_1m", quantity: 1 }],
      }),
    });
    assert.equal(quoteRes.status, 200);
    assert.equal((await quoteRes.json()).quote.total, 89000);

    // 3. Xóa một gói mặc định của Nitro (ví dụ: boost_log_1y)
    const delVarRes = await fetch(origin + "/api/admin/products/nitro/variants/boost_log_1y", {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(delVarRes.status, 200);

    const pubRes2 = await fetch(origin + "/api/catalog");
    const nitroAfterDel = (await pubRes2.json()).products.find(p => p.id === "nitro");
    assert(!nitroAfterDel.variants.some(v => v.id === "boost_log_1y"), "Gói boost_log_1y đã bị xóa hoàn toàn");

    // Admin cũng không thấy gói đã xóa
    const adminPricingRes = await fetch(origin + "/api/admin/pricing", { headers: adminHeaders });
    const adminNitro = (await adminPricingRes.json()).products.find(p => p.id === "nitro");
    assert(!adminNitro.variants.some(v => v.id === "boost_log_1y"), "Admin cũng không thấy gói đã xóa");

    // 4. Xóa một mặt hàng mặc định (ví dụ: youtube)
    const delProdRes = await fetch(origin + "/api/admin/products/youtube", {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(delProdRes.status, 200);

    const pubRes3 = await fetch(origin + "/api/catalog");
    assert(!(await pubRes3.json()).products.some(p => p.id === "youtube"), "Mặt hàng youtube đã bị xóa khỏi catalog");
  } finally {
    server.close();
    db.close();
  }
});

test("Tùy chỉnh vị trí hiển thị mặt hàng và phân chia hạng mục: lưu DB, reorder API, danh mục tùy chỉnh", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    ORIGIN: "https://shop.vietnamlegacy.test",
    ADMIN_PASSWORD: "test-admin-order-cats",
  });
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Kiểm tra danh mục ban đầu
    const defaultCats = await getCategories(db);
    assert(defaultCats.some(c => c.id === "services"));
    assert(defaultCats.some(c => c.id === "entertainment"));
    assert(defaultCats.some(c => c.id === "services"));

    // 2. Cập nhật danh mục mới qua saveCategories
    const customCats = [
      { id: "giai-tri", name: "Giải trí & Phim ảnh", icon: "play" },
      { id: "discord-nitro", name: "Discord & Nitro", icon: "sparkles" },
      { id: "thiet-ke", name: "Thiết kế & Bot", icon: "box" },
    ];
    await saveCategories(db, customCats);
    const updatedCats = await getCategories(db);
    assert.equal(updatedCats.length, 3);
    assert.equal(updatedCats[0].id, "giai-tri");

    // 3. Thay đổi thứ tự mặt hàng (cho youtube lên đầu tiên, sau đó tới server-setup)
    const initialCatalog = await getCatalog(db, Date.now(), true);
    const reorderedIds = [
      "youtube",
      "server-setup",
      "nitro",
      "netflix",
      ...initialCatalog.map(p => p.id).filter(id => !["youtube", "server-setup", "nitro", "netflix"].includes(id)),
    ];
    await saveCatalogOrder(db, reorderedIds);

    const reorderedCatalog = await getCatalog(db, Date.now(), true);
    assert.equal(reorderedCatalog[0].id, "youtube", "YouTube phải đứng vị trí #1");
    assert.equal(reorderedCatalog[1].id, "server-setup", "server-setup phải đứng vị trí #2");
    assert.equal(reorderedCatalog[2].id, "nitro", "Nitro phải đứng vị trí #3");

    // 4. Kiểm tra qua HTTP API công khai
    const pubCatRes = await fetch(origin + "/api/catalog");
    assert.equal(pubCatRes.status, 200);
    const pubCatData = await pubCatRes.json();
    assert.equal(pubCatData.products[0].id, "youtube", "Khách hàng thấy YouTube đầu tiên theo vị trí admin chỉnh");
    assert(pubCatData.categories.some(c => c.id === "giai-tri"), "Khách hàng nhận được danh mục tùy chỉnh");

    const getCategoriesRes = await fetch(origin + "/api/categories");
    assert.equal(getCategoriesRes.status, 200);
    const getCategoriesData = await getCategoriesRes.json();
    assert.equal(getCategoriesData.categories.length, 3);

    // 5. Kiểm tra HTTP API Admin
    const adminHeaders = {
      Origin: config.origin,
      "Content-Type": "application/json",
      "X-Admin-Key": config.adminPassword,
    };

    // 6. Admin cập nhật lại thứ tự mặt hàng qua PUT /api/admin/catalog/reorder
    const putReorderRes = await fetch(origin + "/api/admin/catalog/reorder", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        productIds: ["capcut", "youtube", "nitro"],
      }),
    });
    assert.equal(putReorderRes.status, 200);
    const reorderedFromAdmin = (await putReorderRes.json()).products;
    assert.equal(reorderedFromAdmin[0].id, "capcut", "CapCut lên vị trí số #1");
    assert.equal(reorderedFromAdmin[1].id, "youtube", "YouTube ở vị trí số #2");

    // 7. Admin thêm/cập nhật danh mục qua PUT /api/admin/categories
    const putCatsRes = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        categories: [
          { id: "hot", name: "Gói Bán Chạy", icon: "sparkles" },
          { id: "giai-tri", name: "Giải trí", icon: "play" },
          { id: "discord", name: "Discord Nitro & Decor", icon: "box" },
          { id: "dich-vu", name: "Dịch vụ Server & Bot", icon: "box" },
        ],
      }),
    });
    assert.equal(putCatsRes.status, 200);
    const savedCatsFromAdmin = (await putCatsRes.json()).categories;
    assert.equal(savedCatsFromAdmin.length, 4);
    assert.equal(savedCatsFromAdmin[0].id, "hot");

    // 8. Chặn request không có quyền admin hoặc sai CSRF
    const unauthReorder = await fetch(origin + "/api/admin/catalog/reorder", {
      method: "PUT",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: ["nitro"] }),
    });
    assert.equal(unauthReorder.status, 401, "Từ chối khi không có phiên đăng nhập admin");

    const unauthCats = await fetch(origin + "/api/admin/categories", {
      method: "PUT",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ categories: [] }),
    });
    assert.equal(unauthCats.status, 401, "Từ chối khi không có phiên đăng nhập admin");
  } finally {
    server.close();
    db.close();
  }
});

test("Mặt hàng Profile Decor: Tách thành 2 mặt hàng Decor Gift và Decor Log nằm cạnh nhau", async () => {
  const db = await openStore(":memory:");
  try {
    const catalog = await getCatalog(db, Date.now(), false);
    const decorGift = catalog.find((p) => p.id === "decor-gift");
    const decorLog = catalog.find((p) => p.id === "decor-log");

    assert(decorGift, "Mặt hàng Discord Decor Gift tồn tại");
    assert(decorLog, "Mặt hàng Discord Decor Log tồn tại");

    assert.equal(decorGift.badge, "PROFILE / DECOR");
    assert.equal(decorLog.badge, "PROFILE / DECOR");
    assert.equal(decorGift.category, "decor");
    assert.equal(decorLog.category, "decor");

    // Vị trí nằm liền kề nhau
    const giftIdx = catalog.findIndex((p) => p.id === "decor-gift");
    const logIdx = catalog.findIndex((p) => p.id === "decor-log");
    assert.equal(Math.abs(giftIdx - logIdx), 1, "Hai mặt hàng Decor phải nằm liền kề cạnh nhau");

    // Đặt đơn qua decor-gift
    const quoteGift = await quoteOrder(db, [
      { productId: "decor-gift", variantId: "decor_gift_basic", quantity: 1 },
    ]);
    assert.equal(quoteGift.total, 49000);

    // Đặt đơn qua decor-log
    const quoteLog = await quoteOrder(db, [
      { productId: "decor-log", variantId: "decor_log_basic", quantity: 2 },
    ]);
    assert.equal(quoteLog.total, 78000);

    // Đặt đơn tương thích ngược với productId = 'decor'
    const quoteLegacy = await quoteOrder(db, [
      { productId: "decor", variantId: "decor_log_collection", quantity: 1 },
    ]);
    assert.equal(quoteLegacy.total, 79000);
  } finally {
    db.close();
  }
});


