import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const begin = source.indexOf('async function initHeroGuides() {');
const end = source.indexOf('function parseGuideVideo(url)', begin);
const snippet = source.slice(begin, end).replace('void initHeroGuides();', '');
function page(fetch) {
  const events = {}, opened = [], grid = {innerHTML: ''};
  const section = {hidden: true, addEventListener(name, fn) {events[name] = fn;}};
  const context = {fetch, cachedGuides: [], cachedGuide: null,
    guideCategoryLabels: {guide: 'Hướng dẫn', tips: 'Mẹo & Thủ thuật'},
    escapeHtml(value) {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    document: {querySelector(selector) {return selector === '#hero-guides' ? section : grid;}},
    showGuideModal(id) {opened.push(id);},
  };
  vm.runInNewContext(snippet, context);
  return {context, section, grid, events, opened};
}

test('Thẻ hero chỉ hiện tối đa bốn bài công khai và bấm mở đúng bài admin đăng', async () => {
  const guides = [
    {id:'hidden', title:'Bản nháp', isActive:false},
    {id:'one', title:'<script>không thực thi</script>', coverImage:'image" onerror="bad', isActive:true},
    ...['two','three','four','five'].map(id => ({id, title:id, category:'guide', isActive:true})),
  ];
  const p = page(async () => ({ok:true, json:async () => ({guides})}));
  await p.context.initHeroGuides();
  assert.equal(p.section.hidden, false);
  assert.equal((p.grid.innerHTML.match(/class="hero-guide-card"/g) || []).length, 4);
  assert.doesNotMatch(p.grid.innerHTML, /data-hero-guide="(?:hidden|five)"|<script>/);
  assert.match(p.grid.innerHTML, /&lt;script&gt;/);
  assert.match(p.grid.innerHTML, /image&quot; onerror=&quot;bad/);
  assert.match(p.grid.innerHTML, /assets\/vnl-banner.png/);
  p.events.click({target:{closest:() => ({dataset:{heroGuide:'three'}})}});
  assert.deepEqual(p.opened, ['three']);
});

test('Không tạo bài giả hoặc hiện khung rỗng khi không có bài công khai hay mất kết nối', async () => {
  for (const fetch of [
    async () => ({ok:true, json:async () => ({guides:[]})}),
    async () => ({ok:false}),
    async () => {throw new Error('offline');},
  ]) {
    const p = page(fetch);
    await p.context.initHeroGuides();
    assert.equal(p.section.hidden, true);
    assert.equal(p.grid.innerHTML, '');
  }
});
