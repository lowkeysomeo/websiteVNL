import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore, getAnnouncement, saveAnnouncement } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";

test("Thông báo giữ nội dung và trạng thái bật/tắt qua khởi động lại", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "vnl-announcement-"));
  let db = await openStore(path.join(directory, "test.sqlite"));
  try {
    assert.equal((await getAnnouncement(db)).is_active, true);
    await saveAnnouncement(db, "  ✦ Thông báo mới của cửa hàng  ", true, 1234);
    db.close(); db = await openStore(path.join(directory, "test.sqlite"));
    assert.deepEqual(await getAnnouncement(db), { content: "✦ Thông báo mới của cửa hàng", is_active: true, updated_at: 1234 });
    await saveAnnouncement(db, "", false, 2345);
    assert.equal((await getAnnouncement(db)).is_active, false);
    await assert.rejects(async () => await saveAnnouncement(db, "", true), /không được để trống/);
    await assert.rejects(async () => await saveAnnouncement(db, "x".repeat(401), true), /400/);
    assert.equal((await getAnnouncement(db)).is_active, false);
    await db.exec("DROP TABLE site_announcements");
    await assert.rejects(async () => await getAnnouncement(db));
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("API lưu thông báo phản ánh đúng ra cửa hàng và chặn thay đổi không hợp lệ", async () => {
  const db = await openStore(":memory:");
  const config = readConfig({ PUBLIC_ORIGIN: "http://localhost:3000", ADMIN_PASSWORD: "notice-test-only" });
  const server = createApp(db, config);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  const save = (body, headers = {}) => fetch(root + "/api/admin/announcement", {
    method: "POST", headers: { Origin: config.origin, "X-Admin-Key": config.adminPassword, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await save({ content: "Thông báo mới", is_active: true }, { "X-Admin-Key": "wrong" })).status, 401);
    assert.equal((await save({ content: "Thông báo mới", is_active: true }, { Origin: "https://wrong.test" })).status, 403);
    const saved = await save({ content: "✦ Ưu đãi hôm nay", is_active: true });
    assert.equal(saved.status, 200);
    const expected = (await saved.json()).announcement;
    const response = await fetch(root + "/api/announcement");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()).announcement, expected);
    assert.equal((await save({ content: "✦ Ưu đãi hôm nay", is_active: "false" })).status, 400);
    assert.equal((await save({ content: "", is_active: false })).status, 200);
    assert.equal((await (await fetch(root + "/api/announcement")).json()).announcement.is_active, false);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});

function announcementPage() {
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const begin = source.indexOf("function initAnnouncement() {");
  const endMatch = source.slice(begin).search(/\/\*\s*={10,}\s*\r?\n\s*ULTRA-SMOOTH/);
  const snippet = endMatch !== -1 ? source.slice(begin, begin + endMatch) : source.slice(begin);
  const elements = Object.fromEntries(["announcement-bar", "announcement-track", "announcement-content", "announcement-content-duplicate"].map(id => ["#" + id, { style: {}, textContent: "Thông báo cũ" }]));
  const animation = { currentTime: 123 };
  elements["#announcement-track"].getAnimations = () => [animation];
  const pending = [], listeners = {}, timers = [];
  let channel;
  const document = { hidden: false, querySelector: selector => elements[selector], addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = {
    document,
    window: {
      innerWidth: 1280,
      addEventListener: (name, fn) => { listeners[name] = fn; },
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    },
    BroadcastChannel: class { constructor(name) { this.name = name; channel = this; } addEventListener(name, fn) { this.onmessage = fn; } },
    setInterval: fn => timers.push(fn),
    fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })),
  };
  vm.runInNewContext(snippet + "\ninitAnnouncement();", context);
  const respond = async (request, content, active = true) => {
    request.resolve({ ok: true, json: async () => ({ announcement: { content, is_active: active } }) });
    await new Promise(resolve => setImmediate(resolve));
  };
  return { elements, animation, pending, listeners, channel, timers, document, respond };
}

test("Cửa hàng nhận thông báo từ tab admin ngay, không cần tải lại hay chờ bộ hẹn giờ", async () => {
  const page = announcementPage();
  assert.equal(page.pending.length, 1);
  assert.equal(page.pending[0].options.cache, "no-store");
  await page.respond(page.pending[0], "Nội dung đã lưu");
  page.channel.onmessage();
  assert.equal(page.pending.length, 2);
  await page.respond(page.pending[1], "Ưu đãi mới ✦");
  assert.equal(page.elements["#announcement-content"].textContent, "Ưu đãi mới ✦");
  assert.equal(page.elements["#announcement-content-duplicate"].textContent, "Ưu đãi mới ✦");
  assert.equal(page.animation.currentTime, 0);
  page.channel.onmessage(); await page.respond(page.pending[2], "Ưu đãi mới ✦", false);
  assert.equal(page.elements["#announcement-bar"].style.display, "none");
  page.listeners.storage({ key: "vnl-announcement-updated" }); await page.respond(page.pending[3], "Đã bật lại", true);
  assert.equal(page.elements["#announcement-bar"].style.display, "flex");
});

test("Phản hồi chậm không ghi đè thông báo mới; quay lại tab lấy dữ liệu ngay", async () => {
  const page = announcementPage();
  page.listeners.focus();
  await page.respond(page.pending[1], "Thông báo mới nhất");
  await page.respond(page.pending[0], "Phản hồi cũ");
  assert.equal(page.elements["#announcement-content"].textContent, "Thông báo mới nhất");
  page.document.hidden = true; page.timers[0](); assert.equal(page.pending.length, 2);
  page.document.hidden = false; page.listeners.visibilitychange(); assert.equal(page.pending.length, 3);
});
