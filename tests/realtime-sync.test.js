import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Realtime Sync: app.js phát BroadcastChannel khi khách đặt hàng thành công", () => {
  const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(appJs.includes('new BroadcastChannel("vnl-live-sync")'), "app.js must create vnl-live-sync BroadcastChannel");
  assert.ok(appJs.includes('type: "order_created"'), "app.js must post order_created event");
});

test("Realtime Sync: wallet.js phát BroadcastChannel khi khách tạo hoặc làm mới mã QR nạp tiền", () => {
  const walletJs = readFileSync(new URL("../wallet.js", import.meta.url), "utf8");
  assert.ok(walletJs.includes('new BroadcastChannel("vnl-live-sync")'), "wallet.js must create vnl-live-sync BroadcastChannel");
  assert.ok(walletJs.includes('type: "deposit_created"'), "wallet.js must post deposit_created event");
  // Kiểm tra cả 2 nơi: tạo ban đầu và tạo lại
  const matches = walletJs.match(/type:\s*"deposit_created"/g);
  assert.ok(matches && matches.length >= 2, "wallet.js must dispatch deposit_created at both initial and recreate QR");
});

test("Realtime Sync: admin.js lắng nghe BroadcastChannel và polling nền tự động cập nhật đơn mới không cần F5", () => {
  const adminJs = readFileSync(new URL("../admin.js", import.meta.url), "utf8");
  assert.ok(adminJs.includes('new BroadcastChannel("vnl-live-sync")'), "admin.js must listen on vnl-live-sync channel");
  assert.ok(adminJs.includes("syncAdminOrders"), "admin.js must have syncAdminOrders function");
  assert.ok(adminJs.includes("playAdminChime"), "admin.js must have playAdminChime function");
  assert.ok(adminJs.includes("order-just-arrived"), "admin.js must apply order-just-arrived class to new orders");
  assert.ok(adminJs.includes("setInterval"), "admin.js must poll orders on interval");
});

test("Realtime Sync: admin-pricing.js cập nhật yêu cầu nạp tiền QR mới và gắn class highlight tức thì", () => {
  const adminPricingJs = readFileSync(new URL("../admin-pricing.js", import.meta.url), "utf8");
  assert.ok(adminPricingJs.includes("refreshDeposits"), "admin-pricing.js must have refreshDeposits function");
  assert.ok(adminPricingJs.includes("window.refreshAdminDeposits = refreshDeposits"), "admin-pricing.js must expose refreshAdminDeposits to window");
  assert.ok(adminPricingJs.includes("deposit-just-arrived"), "admin-pricing.js must apply deposit-just-arrived class");
  assert.ok(adminPricingJs.includes("data-deposit-code="), "admin-pricing.js must mark data-deposit-code for cards");
});

test("Realtime Sync: admin.css chứa keyframes và style phát sáng viền cho đơn hàng & QR mới", () => {
  const adminCss = readFileSync(new URL("../admin.css", import.meta.url), "utf8");
  assert.ok(adminCss.includes("@keyframes newItemGlow"), "admin.css must define newItemGlow animation");
  assert.ok(adminCss.includes(".order-just-arrived"), "admin.css must define .order-just-arrived selector");
  assert.ok(adminCss.includes(".deposit-just-arrived"), "admin.css must define .deposit-just-arrived selector");
});
