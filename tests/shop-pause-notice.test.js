import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { openStore, getAnnouncement } from "../server/store.js";

test("Giao diện: index.html có hộp thoại thông báo tạm ngưng web và link Discord", () => {
  const indexHtml = fs.readFileSync("index.html", "utf8");

  assert.ok(
    indexHtml.includes('id="shop-pause-dialog"'),
    "index.html must contain #shop-pause-dialog",
  );
  assert.ok(
    indexHtml.includes('id="shop-pause-title"'),
    "index.html must contain #shop-pause-title",
  );
  assert.ok(
    indexHtml.includes("https://discord.gg/vietnamlegacy"),
    "index.html must contain official Discord invite link",
  );
  assert.ok(
    indexHtml.includes("Shop tạm ngưng hoạt động trên web, liên hệ qua"),
    "index.html must state that the shop paused website operations",
  );
  assert.ok(
    indexHtml.includes('id="shop-pause-copy-btn"'),
    "index.html must have #shop-pause-copy-btn",
  );
  assert.ok(
    indexHtml.includes('id="shop-pause-dismiss-btn"'),
    "index.html must have #shop-pause-dismiss-btn with data-close",
  );
  assert.ok(
    indexHtml.includes('id="announcement-content"'),
    "index.html has marquee announcement",
  );
  assert.ok(
    indexHtml.includes("⚠️ THÔNG BÁO: Shop tạm ngưng hoạt động trên web, liên hệ qua Discord để mua hàng"),
    "index.html announcement bar text updated with notice",
  );
});

test("Kiểu dáng: styles.css có định dạng cho hộp thoại shop pause và nút Discord", () => {
  const css = fs.readFileSync("styles.css", "utf8");

  assert.ok(css.includes(".shop-pause-dialog"), "styles.css must have .shop-pause-dialog");
  assert.ok(css.includes(".button-discord-primary"), "styles.css must style Discord button");
  assert.ok(css.includes(".shop-pause-pulse"), "styles.css must have pulse indicator");
  assert.ok(css.includes("#5865F2"), "styles.css must use Discord brand color");
});

test("Client script: app.js khởi tạo initShopPauseNotice khi tải trang", () => {
  const appJs = fs.readFileSync("app.js", "utf8");

  assert.ok(
    appJs.includes("function initShopPauseNotice()"),
    "app.js must declare initShopPauseNotice()",
  );
  assert.ok(
    appJs.includes("initShopPauseNotice();"),
    "app.js must call initShopPauseNotice() during startup",
  );
  assert.ok(
    appJs.includes("https://discord.gg/vietnamlegacy"),
    "app.js must contain the discord link for clipboard copy",
  );
});

test("Server: store.js trả về thông báo tạm ngưng web mặc định", async () => {
  const db = await openStore(":memory:");
  try {
    const announcement = await getAnnouncement(db);
    assert.equal(announcement.is_active, true);
    assert.match(
      announcement.content,
      /Shop tạm ngưng hoạt động trên web, liên hệ qua discord để mua hàng: https:\/\/discord\.gg\/vietnamlegacy/i,
    );
  } finally {
    db.close();
  }
});
