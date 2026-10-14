import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../server/store.js';
import { getCatalog, updateProduct, createCustomProduct, deleteProduct } from '../server/pricing.js';

test('Hướng dẫn thanh toán lưu riêng cho mặt hàng mặc định và tự tạo, hỗ trợ đặt lại', async () => {
  const db = await openStore(':memory:');
  try {
    const customWithNotice = await createCustomProduct(db, {
      name: 'Dịch vụ có sẵn hướng dẫn',
      category: 'work',
      description: 'Mô tả',
      checkoutNotice: { title: '🎁 Tiêu đề tạo mới', content: 'Nội dung tạo mới' },
      variants: [{ name: 'Gói 1', price: 20000, deliveryType: 'gift' }],
    });
    assert.deepEqual(customWithNotice.checkoutNotice, { title: '🎁 Tiêu đề tạo mới', content: 'Nội dung tạo mới' });

    const custom = await createCustomProduct(db, { name: 'Dịch vụ thử', category: 'entertainment', description: 'Thử nghiệm', variants: [{name:'Gói thử',price:10000,deliveryType:'gift'}] });
    for (const id of ['nitro', custom.id]) {
      const product = (await getCatalog(db)).find(p => p.id === id);
      const notice = {title: '🎁 Nhận hàng', content: 'Dòng một\nDòng hai <b>văn bản</b>'};
      await updateProduct(db, id, {...product, checkoutNotice: notice});
      let saved = (await getCatalog(db)).find(p => p.id === id);
      assert.deepEqual(saved.checkoutNotice, notice);
      const {checkoutNotice, ...withoutNotice} = saved;
      await updateProduct(db, id, withoutNotice);
      assert.deepEqual((await getCatalog(db)).find(p => p.id === id).checkoutNotice, notice);
      await assert.rejects(updateProduct(db,id,{...saved,checkoutNotice:{title:'a'.repeat(121),content:''}}));
      await updateProduct(db,id,{...saved,checkoutNotice: null});
      assert.deepEqual((await getCatalog(db)).find(p => p.id === id).checkoutNotice,{title:'',content:''});
    }
    assert.equal((await getCatalog(db)).find(p => p.id === 'youtube').checkoutNotice,null);

    // Xóa mặt hàng tự tạo dọn sạch ghi đè notice
    await updateProduct(db, custom.id, { ...custom, checkoutNotice: { title: 'T1', content: 'C1' } });
    await deleteProduct(db, custom.id);
    const row = await db.prepare("SELECT * FROM catalog_item_overrides WHERE item_key = ?").get("notice:" + custom.id);
    assert.equal(row, undefined);
  } finally { await db.close(); }
});

