import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { openStore, getAdminStats, createAdminToken } from "../server/store.js";
import { createApp } from "../server/app.js";

async function addOrder(db, id, status, items = [], total = 10000) {
  await db.prepare("INSERT INTO orders (id, customer_name, customer_email, items_json, total, status, created_at) VALUES (?, 'TEST', 'test@example.com', ?, ?, ?, ?)").run(id, JSON.stringify(items), total, status, Date.now());
}
async function addDeposit(db, id, status, expiry) {
  await db.prepare("INSERT INTO deposits (id,user_id,code,amount,status,created_at,expires_at) VALUES (?, 'user', ?, 50000, ?, ?, ?)").run(id, id, status, Date.now(), expiry);
}

test("Thống kê toàn bộ đơn, không cộng tiền nạp vào doanh thu và loại yêu cầu nạp đã hết hạn", async () => {
  const db = await openStore(":memory:");
  const now = Date.now();
  try {
    await db.prepare("INSERT INTO users VALUES ('user','test@example.com','unused',?)").run(now);
    for (let i = 0; i < 110; i++) await addOrder(db, "done-" + i, "completed");
    await addOrder(db, "process-1", "processing");
    await addOrder(db, "process-2", "processing");
    await addOrder(db, "pending", "pending");
    await addOrder(db, "cancelled", "cancelled");
    await addDeposit(db, "waiting", "pending", now + 60000);
    await addDeposit(db, "late", "pending", now - 1);
    await addDeposit(db, "review", "review", now - 1);
    await addDeposit(db, "credited", "credited", now + 60000);
    const stats = await getAdminStats(db, { now });
    assert.deepEqual(stats, {totalOrders:114, processingOrders:3, completedOrders:110, revenue:1100000, pendingDeposits:2, needsAction:5, updatedAt:now});
    await db.prepare("UPDATE orders SET status='completed' WHERE id='process-1'").run();
    await db.prepare("UPDATE deposits SET status='credited' WHERE id='waiting'").run();
    const updated = await getAdminStats(db, { now });
    assert.equal(updated.completedOrders, 111);
    assert.equal(updated.revenue, 1110000);
    assert.equal(updated.needsAction, 3);
  } finally { db.close(); }
});

test("API thống kê yêu cầu đăng nhập và chỉ trả dữ liệu thuộc phạm vi đối tác", async () => {
  const db = await openStore(":memory:");
  const config = { origin:"http://localhost:3000", adminPassword:"stats-test-only-password", bank:{}, paymentsMode:"disabled" };
  const server = createApp(db, config);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const root = "http://127.0.0.1:" + server.address().port;
  try {
    await db.prepare("INSERT INTO users VALUES ('partner','partner@example.com','unused',?)").run(Date.now());
    await db.prepare("INSERT INTO custom_products (id,name,category,partner_email,created_at,updated_at) VALUES ('owned','TEST','test','partner@example.com',?,?)").run(Date.now(),Date.now());
    await addOrder(db, "owned-order", "completed", [{productId:"owned",price:10000,quantity:1}]);
    await addOrder(db, "other-order", "completed", [{productId:"other",price:90000,quantity:1}],90000);
    const partnerKey = await createAdminToken(db, "partner");
    assert.equal((await fetch(root + "/api/admin/stats")).status,401);
    const admin = await fetch(root + "/api/admin/stats", {headers:{"X-Admin-Key":config.adminPassword}});
    assert.equal(admin.headers.get("cache-control"),"no-store");
    assert.equal((await admin.json()).stats.revenue,100000);
    const partner = await fetch(root + "/api/admin/stats", {headers:{"X-Admin-Key":partnerKey}});
    const stats = (await partner.json()).stats;
    assert.equal(stats.totalOrders,1);
    assert.equal(stats.revenue,10000);
    assert.equal(stats.pendingDeposits,0);
  } finally { await new Promise(resolve=>server.close(resolve)); db.close(); }
});

function statsPage() {
  const source = readFileSync(new URL("../admin.js",import.meta.url),"utf8");
  const start = source.indexOf("  function updateStats(stats)");
  const end = source.indexOf("  function filterOrders()",start);
  const elements = new Map();
  const listeners = {}, timers = [], calls = [];
  const document = { hidden:false, querySelector(id){ if(!elements.has(id)) elements.set(id,{textContent:"—"}); return elements.get(id); }, addEventListener(name,fn){listeners[name]=fn;} };
  const context = {document, window:{addEventListener(name,fn){listeners[name]=fn;}}, adminKey:"test", adminApp:{hidden:false},statsRequest:0, money:value=>value+" VND", Date, setInterval(fn,ms){timers.push({fn,ms});}, api(){return new Promise((resolve,reject)=>calls.push({resolve,reject}));}};
  vm.runInNewContext(source.slice(start,end)+";this.refreshStats=loadStats;",context);
  return {context,elements,listeners,timers,calls};
}
const sample = count => ({stats:{totalOrders:count,processingOrders:1,completedOrders:count-1,revenue:10000,pendingDeposits:2,needsAction:3,updatedAt:Date.now()}});

test("Giao diện tự làm mới, bỏ phản hồi cũ và giữ số liệu khi mất mạng", async () => {
  const page = statsPage();
  const first = page.context.refreshStats();
  const next = page.context.refreshStats();
  page.calls[1].resolve(sample(10)); await next;
  page.calls[0].resolve(sample(2)); await first;
  assert.equal(page.elements.get("#stat-total-orders").textContent,10);
  const failed = page.context.refreshStats();
  page.calls[2].reject(new Error("Mất mạng")); await failed;
  assert.equal(page.elements.get("#stat-total-orders").textContent,10);
  assert.match(page.elements.get("#admin-stats-feedback").textContent,/Mất mạng/);
  assert.equal(page.timers[0].ms,15000);
  page.context.document.hidden=true; page.timers[0].fn(); assert.equal(page.calls.length,3);
  page.context.document.hidden=false; page.listeners.visibilitychange(); assert.equal(page.calls.length,4);
  page.calls[3].resolve(sample(11));
});

test("Không ghi thống kê của phiên cũ sau khi đăng xuất", async () => {
  const page = statsPage();
  const pending = page.context.refreshStats();
  page.context.adminKey="";
  page.context.adminApp.hidden=true;
  page.calls[0].resolve(sample(99)); await pending;
  assert.equal(page.elements.get("#stat-total-orders"),undefined);
});
