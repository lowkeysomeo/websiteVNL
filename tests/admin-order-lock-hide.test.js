import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Giao diện Admin: Khóa và ẩn đơn đã hoàn thành hoặc đã hủy", async (t) => {
  const htmlContent = fs.readFileSync(path.resolve("admin.html"), "utf8");
  const cssContent = fs.readFileSync(path.resolve("admin.css"), "utf8");
  const jsContent = fs.readFileSync(path.resolve("admin.js"), "utf8");

  await t.test("admin.html có bộ điều khiển ẩn/hiện và tab Hoàn tất (Đã khóa)", () => {
    assert.ok(
      htmlContent.includes('id="admin-hide-done-checkbox"'),
      "admin.html phải có checkbox #admin-hide-done-checkbox",
    );
    assert.ok(
      htmlContent.includes("Ẩn đơn đã xong & đã hủy"),
      "admin.html phải có nhãn Ẩn đơn đã xong & đã hủy",
    );
    assert.ok(
      htmlContent.includes("Hoàn tất (Đã khóa)"),
      "Tab hoàn tất phải ghi chú rõ Hoàn tất (Đã khóa)",
    );
  });

  await t.test("admin.css có kiểu dáng khóa thẻ đơn và banner thông báo ẩn", () => {
    assert.ok(
      cssContent.includes(".admin-hide-done-toggle"),
      "admin.css phải có class .admin-hide-done-toggle",
    );
    assert.ok(
      cssContent.includes(".admin-hidden-done-banner"),
      "admin.css phải có class .admin-hidden-done-banner",
    );
    assert.ok(
      cssContent.includes(".admin-locked-pill.completed"),
      "admin.css phải có style cho pill completed",
    );
    assert.ok(
      cssContent.includes(".admin-locked-pill.cancelled"),
      "admin.css phải có style cho pill cancelled",
    );
    assert.ok(
      cssContent.includes(".admin-gift-claim-box.locked-completed"),
      "admin.css phải có style cho claim box khóa khi hoàn tất",
    );
  });

  await t.test("admin.js loại bỏ nút Đang nạp và Hủy đơn khỏi đơn đã hoàn tất / đã hủy", () => {
    // Đơn completed hoặc cancelled không được hiện nút nạp hoặc hủy
    assert.ok(
      jsContent.includes('order.status !== "processing" && order.status !== "cancelled" && order.status !== "completed"'),
      "Nút Đang nạp không được xuất hiện trên đơn completed hoặc cancelled",
    );
    assert.ok(
      jsContent.includes('order.status !== "cancelled" && order.status !== "completed"'),
      "Nút Hủy đơn không được xuất hiện trên đơn completed hoặc cancelled",
    );
    assert.ok(
      jsContent.includes("admin-locked-pill completed"),
      "Đơn completed phải hiển thị huy hiệu khóa",
    );
    assert.ok(
      jsContent.includes("admin-locked-pill cancelled"),
      "Đơn cancelled phải hiển thị huy hiệu khóa",
    );
  });

  await t.test("admin.js có logic ẩn đơn hoàn tất/đã hủy khi ở tab all", () => {
    assert.ok(
      jsContent.includes('currentFilter === "all"'),
      "filterOrders phải kiểm tra tab all",
    );
    assert.ok(
      jsContent.includes("hideDoneOrders"),
      "filterOrders phải kiểm tra cờ hideDoneOrders",
    );
    assert.ok(
      jsContent.includes("vnl_admin_hide_done"),
      "Phải lưu tùy chọn ẩn đơn vào localStorage vnl_admin_hide_done",
    );
    assert.ok(
      jsContent.includes("unlock-claim"),
      "Phải có nút và sự kiện unlock-claim cho phép sửa link khi cần",
    );
  });

  await t.test("Ẩn / thu gọn bảng tùy chỉnh Discord Embed Legit Check cho đỡ vướng", () => {
    assert.ok(
      htmlContent.includes('id="legit-tpl-toggle-btn"'),
      "admin.html phải có nút #legit-tpl-toggle-btn để thu gọn / mở rộng",
    );
    assert.ok(
      htmlContent.includes('id="admin-discord-legit-customizer-body"'),
      "admin.html phải có wrapper #admin-discord-legit-customizer-body",
    );
    assert.ok(
      htmlContent.includes('id="legit-tpl-collapse-status"'),
      "admin.html phải có badge trạng thái #legit-tpl-collapse-status",
    );
    assert.ok(
      cssContent.includes(".admin-legit-customizer-box.is-collapsed"),
      "admin.css phải có class .admin-legit-customizer-box.is-collapsed",
    );
    assert.ok(
      cssContent.includes(".admin-legit-customizer-header"),
      "admin.css phải có class .admin-legit-customizer-header",
    );
    assert.ok(
      jsContent.includes("setLegitCustomizerCollapsed"),
      "admin.js phải có hàm điều khiển setLegitCustomizerCollapsed",
    );
    assert.ok(
      jsContent.includes("vnl_admin_hide_legit_embed"),
      "admin.js phải lưu trạng thái thu gọn vào localStorage vnl_admin_hide_legit_embed",
    );
  });
});
