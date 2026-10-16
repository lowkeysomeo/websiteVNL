import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore, savePartner, createAdminToken, togglePartnerStatus} from '../server/store.js';
import {createApp} from '../server/app.js';
import {readConfig} from '../server/config.js';

test('Đối tác đăng, sửa, ẩn và xóa hướng dẫn riêng; chặn truy cập chéo và giả chủ bài', async () => {
  const db = await openStore(':memory:');
  const config = readConfig({PUBLIC_ORIGIN:'http://localhost:3000',ADMIN_PASSWORD:'test-admin-partner-guides'});
  const app = createApp(db, config);
  await new Promise(resolve => app.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+app.address().port;
  const request = (route, token='', method='GET', body, extra={}) => fetch(origin+route, {
    method, headers:{'content-type':'application/json',origin:config.origin,'x-admin-key':token,...extra},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const admin = config.adminPassword;
  try {
    const a = await savePartner(db,{email:'one@example.com',name:'Dịch vụ Một',password:'test-password-123'});
    const b = await savePartner(db,{email:'two@example.com',name:'Dịch vụ Hai',password:'test-password-123'});
    const tokenA = await createAdminToken(db,a.userId);
    const tokenB = await createAdminToken(db,b.userId);
    assert.equal((await request('/api/admin/guide')).status,401);
    const initial = await (await request('/api/admin/guide',tokenA)).json();
    assert.deepEqual(initial.guides,[]);
    assert.equal(initial.guide,null);
    const create = await request('/api/admin/guide',tokenA,'POST',{
      title:'Cách sử dụng dịch vụ', content:'Nội dung của đối tác Một',
      videoUrl:'https://youtu.be/dQw4w9WgXcQ', images:['assets/vnl-banner.png'],
      steps:[{title:'Bước 1',description:'Mở dịch vụ'}],
      partnerEmail:'two@example.com',partner_email:'two@example.com',
    });
    assert.equal(create.status,200);
    const guide = (await create.json()).guide;
    assert.notEqual(guide.id,'main');
    assert.equal((await db.prepare('SELECT partner_email FROM shopping_guides WHERE id = ?').get(guide.id)).partner_email,'one@example.com');
    const owned = await (await request('/api/admin/guide',tokenA)).json();
    assert.deepEqual(owned.guides.map(g=>g.id),[guide.id]);
    assert.deepEqual((await (await request('/api/admin/guide',tokenB)).json()).guides,[]);
    for (const id of ['main',guide.id]) {
      for (const method of ['PUT','POST','PATCH','DELETE']) {
        const suffix = method==='PATCH'?'/toggle':'';
        const denied = await request('/api/admin/guide/'+id+suffix,tokenB,method,{id:'new',title:'Chiếm bài',isActive:false,partnerEmail:'two@example.com'});
        assert.equal(denied.status,403,method+' '+id);
      }
      assert.equal((await request('/api/admin/guide',tokenB,'POST',{id,title:'Chiếm bài'})).status,403);
    }
    assert.equal((await request('/api/admin/guide/'+guide.id,tokenA,'PUT',{title:'Đã sửa',content:'Nội dung mới',partnerEmail:'two@example.com'})).status,200);
    assert.equal((await request('/api/admin/guide/'+guide.id,tokenA,'PUT',{title:'Sai nguồn'},{origin:'https://evil.example'})).status,403);
    const publicGuide = await (await request('/api/guide/'+guide.id)).json();
    assert.equal(publicGuide.guide.title,'Đã sửa');
    assert.equal(Object.hasOwn(publicGuide.guide,'partnerEmail'),false);
    const listed = await (await request('/api/guide')).json();
    assert.ok(listed.guides.some(g=>g.id===guide.id));
    assert.ok(listed.guides.every(g=>!Object.hasOwn(g,'partnerEmail')));
    const adminList = await (await request('/api/admin/guide',admin)).json();
    assert.equal(adminList.guides.find(g=>g.id===guide.id).partnerEmail,'one@example.com');
    assert.equal((await request('/api/admin/guide/'+guide.id+'/toggle',tokenA,'PATCH',{isActive:false})).status,200);
    assert.equal((await request('/api/guide/'+guide.id)).status,404);
    assert.equal((await request('/api/guide?id='+guide.id)).status,404);
    assert.ok(!(await (await request('/api/guide')).json()).guides.some(g=>g.id===guide.id));
    assert.equal((await (await request('/api/admin/guide',tokenA)).json()).guides[0].isActive,false);
    assert.equal((await request('/api/admin/guide/'+guide.id,admin,'PUT',{title:'Admin sửa',isActive:true,partnerEmail:'two@example.com'})).status,200);
    assert.equal((await db.prepare('SELECT partner_email FROM shopping_guides WHERE id = ?').get(guide.id)).partner_email,'one@example.com');
    assert.equal((await request('/api/admin/guide/'+guide.id,tokenA,'DELETE')).status,200);
    assert.equal((await request('/api/guide/'+guide.id)).status,404);
    const [first,second] = await Promise.all([1,2].map(()=>request('/api/admin/guide',tokenA,'POST',{id:'new',title:'Cùng tiêu đề'})));
    const firstId=(await first.json()).guide.id, secondId=(await second.json()).guide.id;
    assert.notEqual(firstId,secondId);
    assert.equal((await request('/api/admin/guide/'+firstId,admin,'DELETE')).status,200);
    await togglePartnerStatus(db,a.id,false);
    assert.equal((await request('/api/admin/guide',tokenA)).status,401);
    assert.equal((await request('/api/admin/guide',tokenA,'POST',{title:'Không được đăng'})).status,401);
  } finally { await new Promise(resolve=>app.close(resolve)); db.close(); }
});

test('Nâng cấp database cũ giữ bài của shop và lưu chủ bài qua khởi động lại', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vnl-partner-guides-'));
  const filename=path.join(dir,'legacy.sqlite');
  const schema=fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8').replace('  partner_email TEXT,\n  title TEXT NOT NULL,','  title TEXT NOT NULL,');
  const legacy=new DatabaseSync(filename);
  legacy.exec(schema);
  legacy.prepare("INSERT INTO shopping_guides (id,title,content,updated_at) VALUES ('main','Bài cũ','Nội dung cũ',1)").run();
  legacy.close();
  let db;
  try {
    db=await openStore(filename);
    const row=await db.prepare("SELECT title,content,partner_email FROM shopping_guides WHERE id='main'").get();
    assert.equal(row.title,'Bài cũ'); assert.equal(row.content,'Nội dung cũ'); assert.equal(row.partner_email,null);
    await db.prepare("INSERT INTO shopping_guides (id,title,partner_email,updated_at) VALUES ('partner-test','Bài đối tác','one@example.com',2)").run();
    db.close(); db=await openStore(filename);
    assert.equal((await db.prepare("SELECT partner_email FROM shopping_guides WHERE id='partner-test'").get()).partner_email,'one@example.com');
  } finally { db?.close(); fs.rmSync(dir,{recursive:true,force:true}); }
});
