import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { openStore } from "../server/store.js";
import { createApp } from "../server/app.js";
import { digest } from "../server/security.js";

test("Tổng đơn và lịch sử mua hàng phân trang thuộc đúng khách, không lộ thông tin đăng nhập", async () => {
  const db = await openStore(":memory:");
  const config={origin:"http://localhost:3000",bank:{},paymentsMode:"disabled"};
  const server=createApp(db,config);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const root="http://127.0.0.1:"+server.address().port;
  const rawToken="a".repeat(64);
  const headers={cookie:"vnl_session="+rawToken};
  try {
    for(const id of ["one","two"]) await db.prepare("INSERT INTO users VALUES (?,?,'unused',?)").run(id,id+"@example.com",Date.now());
    await db.prepare("INSERT INTO sessions VALUES (?, 'one', 'test-csrf', ?)").run(digest(rawToken),Date.now()+60000);
    for(let i=0;i<70;i++){
      const status=i<60?"completed":i<65?"processing":i<68?"cancelled":"pending";
      await db.prepare("INSERT INTO orders (id,user_id,customer_name,customer_email,items_json,total,status,created_at,discord_password,backup_codes) VALUES (?, 'one', 'TEST', 'recipient@example.com', '[]', 10000, ?, ?, 'NEVER-RETURN-PASSWORD', 'NEVER-RETURN-CODES')").run("order-"+String(i).padStart(3,"0"),status,Date.now());
    }
    await db.prepare("INSERT INTO orders (id,user_id,customer_name,customer_email,items_json,total,status,created_at) VALUES ('OTHER-ACCOUNT','two','OTHER','two@example.com','[]',990000,'completed',?)").run(Date.now());
    assert.equal((await fetch(root+"/api/orders")).status,401);
    const ids=[];
    for(let offset=0;offset<70;offset+=20){
      const response=await fetch(root+"/api/orders?limit=20&offset="+offset+"&userId=two",{headers});
      assert.equal(response.status,200);
      assert.equal(response.headers.get("cache-control"),"no-store");
      const text=await response.text();
      assert.doesNotMatch(text,/NEVER-RETURN|OTHER-ACCOUNT/);
      const data=JSON.parse(text);
      assert.deepEqual(data.stats,{totalOrders:70,purchasedOrders:65,completedOrders:60,totalSpent:650000});
      assert.equal(data.account.email,"one@example.com");
      assert.equal(data.pagination.hasMore,offset+20<70);
      ids.push(...data.orders.map(order=>order.id));
    }
    assert.equal(ids.length,70); assert.equal(new Set(ids).size,70);
    const wallet=await (await fetch(root+"/api/wallet",{headers})).json();
    assert.equal(wallet.purchaseStats.purchasedOrders,65);
    for(const query of ["limit=0","limit=51","offset=-1","offset=1.5","limit=abc"]){
      assert.equal((await fetch(root+"/api/orders?"+query,{headers})).status,400);
    }
  } finally {await new Promise(resolve=>server.close(resolve));db.close();}
});

function historyPage(fetch){
  const source=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const start=source.indexOf("let ordersRequest = 0;");
  const end=source.indexOf('document.addEventListener("vnl:logout"',start);
  const renders=[];
  const context={fetch,AbortSignal,infoDialog:{open:true},showInfo(title,html){renders.push({title,html});},escapeHtml:value=>String(value??""),money:value=>value+" VND",paintIcons(){},document:{querySelector(){return {};}}};
  vm.runInNewContext(source.slice(start,end)+";this.openHistory=showOrders;",context);
  return {context,renders};
}

test("Lịch sử tải lỗi không hiển thị nhầm dữ liệu rỗng hoặc đơn lưu trên máy", async()=>{
  const page=historyPage(async()=>({ok:false,status:401,json:async()=>({error:"Đăng nhập"})}));
  await page.context.openHistory();
  assert.match(page.renders.at(-1).html,/Đăng nhập tài khoản/);
  assert.doesNotMatch(page.renders.at(-1).html,/Chưa có đơn|Đơn hàng đã lưu/);
});

test("Giao diện hiển thị số đơn đã mua, tổng tiền và điều hướng lịch sử",async()=>{
  const page=historyPage(async()=>({ok:true,json:async()=>({orders:[],account:{email:"one@example.com"},stats:{purchasedOrders:0,completedOrders:0,totalSpent:0},pagination:{limit:20,offset:0,total:0,hasMore:false}})}));
  await page.context.openHistory();
  assert.match(page.renders.at(-1).html,/Đơn đã mua/);
  assert.match(page.renders.at(-1).html,/Tổng tiền mua/);
  assert.match(page.renders.at(-1).html,/one@example.com/);
});
