import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../server/database.js";
import { getShoppingGuide, saveShoppingGuide, listShoppingGuides } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";

test("Hướng dẫn mua hàng: Lưu vào DB, kiểm tra hợp lệ và giữ nguyên sau khi mở lại SQLite", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "vnl-guide-"));
  let db = await openStore(path.join(directory, "test.sqlite"));
  try {
    const defaultGuide = await getShoppingGuide(db);
    assert.ok(defaultGuide.title.includes("VietNam Legacy"));
    assert.equal(defaultGuide.isActive, true);
    assert.ok(Array.isArray(defaultGuide.steps));
    assert.ok(defaultGuide.steps.length > 0);

    // Save custom guide with video and images
    await saveShoppingGuide(
      db,
      {
        title: "Hướng dẫn mua Nitro & Decor siêu tốc",
        subtitle: "3 bước đơn giản",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        images: ["assets/vnl-banner.png", "https://example.com/step1.png"],
        steps: [
          { title: "Bước 1: Chọn gói", description: "Bấm chọn gói Nitro hoặc Decor" },
          { title: "Bước 2: Nạp ví QR", description: "Quét mã VietQR chuyển khoản" },
        ],
        content: "Cần hỗ trợ hãy nhắn tin Discord cho shop.",
        isActive: true,
      },
      1234567,
    );

    // Close and reopen SQLite
    db.close();
    db = await openStore(path.join(directory, "test.sqlite"));

    const loaded = await getShoppingGuide(db);
    assert.equal(loaded.title, "Hướng dẫn mua Nitro & Decor siêu tốc");
    assert.equal(loaded.subtitle, "3 bước đơn giản");
    assert.equal(loaded.videoUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.deepEqual(loaded.images, [
      "assets/vnl-banner.png",
      "https://example.com/step1.png",
    ]);
    assert.equal(loaded.steps.length, 2);
    assert.equal(loaded.steps[0].title, "Bước 1: Chọn gói");
    assert.equal(loaded.content, "Cần hỗ trợ hãy nhắn tin Discord cho shop.");
    assert.equal(loaded.isActive, true);
    assert.equal(loaded.updatedAt, 1234567);

    // Validation: empty title
    await assert.rejects(
      async () => await saveShoppingGuide(db, { title: "" }),
      /không được để trống/,
    );
    // Validation: title too long
    await assert.rejects(
      async () => await saveShoppingGuide(db, { title: "x".repeat(201) }),
      /quá dài/,
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP API: Khách xem hướng dẫn công khai và Admin quản lý video/ảnh hướng dẫn", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "guide-admin-password",
  });
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}`;

  const adminHeaders = {
    Origin: config.origin,
    "X-Admin-Key": config.adminPassword,
    "Content-Type": "application/json",
  };

  try {
    // 1. Public GET /api/guide
    const publicRes = await fetch(root + "/api/guide");
    assert.equal(publicRes.status, 200);
    const publicData = await publicRes.json();
    assert.equal(publicData.success, true);
    assert.ok(publicData.guide.title);

    // 2. Admin GET /api/admin/guide without key -> 401
    const unauthRes = await fetch(root + "/api/admin/guide");
    assert.equal(unauthRes.status, 401);

    // 3. Admin GET with key -> 200
    const adminGetRes = await fetch(root + "/api/admin/guide", {
      headers: { "X-Admin-Key": config.adminPassword },
    });
    assert.equal(adminGetRes.status, 200);

    // 4. Admin POST with invalid origin -> 403
    const badOriginRes = await fetch(root + "/api/admin/guide", {
      method: "POST",
      headers: { ...adminHeaders, Origin: "http://evil.com" },
      body: JSON.stringify({ title: "Hack" }),
    });
    assert.equal(badOriginRes.status, 403);

    // 5. Admin POST with valid payload -> 200
    const saveRes = await fetch(root + "/api/admin/guide", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        title: "Hướng dẫn mua hàng chuẩn VNL 2026",
        subtitle: "Uy tín số 1",
        videoUrl: "https://youtu.be/dQw4w9WgXcQ",
        images: ["assets/vnl-avatar.png"],
        steps: [
          {
            title: "Bước 1: Chọn dịch vụ",
            description: "Chọn gói Nitro hoặc Discord Decor",
          },
        ],
        content: "Hotline hỗ trợ 24/7",
        isActive: true,
      }),
    });
    assert.equal(saveRes.status, 200);
    const savedData = await saveRes.json();
    assert.equal(savedData.success, true);
    assert.equal(savedData.guide.title, "Hướng dẫn mua hàng chuẩn VNL 2026");
    assert.equal(savedData.guide.videoUrl, "https://youtu.be/dQw4w9WgXcQ");

    // 6. Public API immediately reflects updated guide
    const updatedPublicRes = await fetch(root + "/api/guide");
    const updatedPublicData = await updatedPublicRes.json();
    assert.equal(
      updatedPublicData.guide.title,
      "Hướng dẫn mua hàng chuẩn VNL 2026",
    );
    assert.deepEqual(updatedPublicData.guide.images, ["assets/vnl-avatar.png"]);

    // 7. Validation error on empty title -> 400
    const invalidSaveRes = await fetch(root + "/api/admin/guide", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "   " }),
    });
    assert.equal(invalidSaveRes.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});

test("Đăng và quản lý nhiều bài viết hướng dẫn & tin tức (Thêm, Sửa, Ẩn, Xóa, Lọc danh mục và Lượt xem)", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "vnl-multi-guide-"));
  let db = await openStore(path.join(directory, "test.sqlite"));
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "multi-guide-admin-password",
  });
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  const adminHeaders = {
    Origin: config.origin,
    "X-Admin-Key": config.adminPassword,
    "Content-Type": "application/json",
  };

  try {
    // 1. Initial list has seeded guides
    const initialList = await listShoppingGuides(db, true);
    assert.ok(initialList.length >= 4);
    const mainGuide = initialList.find((g) => g.id === "main");
    assert.ok(mainGuide);
    assert.equal(mainGuide.category, "guide");

    // 2. View count increments when viewing specific guide
    const prevViews = mainGuide.views;
    const viewed = await getShoppingGuide(db, "main");
    assert.equal(viewed.views, prevViews + 1);

    // 3. Admin adds a new guide article via HTTP POST
    const createRes = await fetch(root + "/api/admin/guide", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        id: "new",
        title: "Mẹo tối ưu chất lượng âm thanh Discord Voice",
        subtitle: "Cách bật khử tiếng ồn Krisp và chỉnh bitrate 384kbps",
        category: "tips",
        coverImage: "assets/vnl-banner.png",
        content: "Chi tiết cách cấu hình phòng voice đạt âm thanh chuẩn phòng thu.",
        steps: [
          { title: "Bước 1", description: "Vào Voice & Video Settings" },
        ],
        isActive: true,
      }),
    });
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.ok(createData.guide.id.includes("meo-toi-uu"));
    const newGuideId = createData.guide.id;

    // 4. Public API GET /api/guide returns both single primary guide and list of guides
    const publicListRes = await fetch(root + "/api/guide");
    assert.equal(publicListRes.status, 200);
    const publicListData = await publicListRes.json();
    assert.ok(Array.isArray(publicListData.guides));
    assert.ok(publicListData.guides.some((g) => g.id === newGuideId));

    // 5. Public API GET /api/guide/:id returns specific article
    const getArticleRes = await fetch(root + `/api/guide/${newGuideId}`);
    assert.equal(getArticleRes.status, 200);
    const getArticleData = await getArticleRes.json();
    assert.equal(getArticleData.guide.title, "Mẹo tối ưu chất lượng âm thanh Discord Voice");
    assert.equal(getArticleData.guide.category, "tips");

    // 6. Admin updates article via PUT
    const updateRes = await fetch(root + `/api/admin/guide/${newGuideId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        title: "Mẹo tối ưu chất lượng âm thanh Discord Voice VIP 2026",
        subtitle: "Cập nhật mới nhất",
        category: "tips",
        isActive: true,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.guide.title, "Mẹo tối ưu chất lượng âm thanh Discord Voice VIP 2026");

    // 7. Admin toggles status to inactive (Ẩn)
    const toggleRes = await fetch(root + `/api/admin/guide/${newGuideId}/toggle`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(toggleRes.status, 200);

    // Public list should not contain hidden guide
    const hiddenPublicRes = await fetch(root + "/api/guide");
    const hiddenPublicData = await hiddenPublicRes.json();
    assert.ok(!hiddenPublicData.guides.some((g) => g.id === newGuideId));

    // Admin list should still contain hidden guide
    const adminListRes = await fetch(root + "/api/admin/guide", {
      headers: { "X-Admin-Key": config.adminPassword },
    });
    const adminListData = await adminListRes.json();
    const adminGuide = adminListData.guides.find((g) => g.id === newGuideId);
    assert.ok(adminGuide);
    assert.equal(adminGuide.isActive, false);

    // 8. Admin deletes guide
    const deleteRes = await fetch(root + `/api/admin/guide/${newGuideId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(deleteRes.status, 200);

    const afterDeleteAdminRes = await fetch(root + "/api/admin/guide", {
      headers: { "X-Admin-Key": config.adminPassword },
    });
    const afterDeleteData = await afterDeleteAdminRes.json();
    assert.ok(!afterDeleteData.guides.some((g) => g.id === newGuideId));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
