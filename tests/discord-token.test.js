import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, createOrder, getUserOrders, getAdminOrders, updateAdminOrder, balance } from '../server/store.js';
import { getCatalog, createCustomProduct, updateProduct, quoteOrder } from '../server/pricing.js';
import { buildOrderEmbed, buildPartnerOrderEmbed } from '../server/discord.js';
import fs from 'node:fs';

test('Quản lý mặt hàng yêu cầu Token Discord: Tạo, cập nhật và hiển thị trong catalog', async () => {
  const db = await openStore(':memory:');
  try {
    // 1. Tạo mặt hàng tự tạo có yêu cầu Token Discord
    const product = await createCustomProduct(db, {
      name: 'Auto Badge Discord',
      category: 'services',
      description: 'Treo huy hiệu Discord tự động',
      requiresToken: true,
      variants: [{ name: 'Gói 1 tháng', price: 50000, deliveryType: 'gift' }],
    });

    assert.equal(product.requiresToken, true, 'Product requiresToken should be true');

    let catalog = await getCatalog(db);
    let found = catalog.find(p => p.id === product.id);
    assert.equal(found.requiresToken, true);

    // 2. Cập nhật tắt yêu cầu token
    await updateProduct(db, product.id, {
      ...found,
      requiresToken: false,
    });
    catalog = await getCatalog(db);
    found = catalog.find(p => p.id === product.id);
    assert.equal(found.requiresToken, false);

    // 3. Cập nhật bật lại yêu cầu token
    await updateProduct(db, product.id, {
      ...found,
      requiresToken: true,
    });
    catalog = await getCatalog(db);
    found = catalog.find(p => p.id === product.id);
    assert.equal(found.requiresToken, true);

    // 4. Bật yêu cầu token cho mặt hàng mặc định (VD: boost)
    const boostProd = catalog.find(p => p.id === 'boost');
    await updateProduct(db, 'boost', {
      ...boostProd,
      requiresToken: true,
    });
    catalog = await getCatalog(db);
    const updatedBoost = catalog.find(p => p.id === 'boost');
    assert.equal(updatedBoost.requiresToken, true);
  } finally {
    await db.close();
  }
});

test('Đặt hàng mặt hàng yêu cầu Token Discord: Validate giỏ hàng, lưu trữ và bảo mật token', async () => {
  const db = await openStore(':memory:');
  try {
    const userId = 'user-token-test';
    await db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run(userId, "test@example.com", "hash", Date.now());

    const depositId = 'dep-token-1';
    await db.prepare(
      "INSERT INTO deposits (id, user_id, code, amount, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(depositId, userId, "VNLTKN123456", 200000, "credited", Date.now(), Date.now() + 86400000);
    await db.prepare(
      "INSERT INTO bank_events (transaction_id, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?)",
    ).run('TX999', depositId, 200000, 'credited', Date.now());
    await db.prepare(
      "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run('w-token-1', userId, depositId, 'TX999', 200000, Date.now());

    assert.equal(await balance(db, userId), 200000);

    const product = await createCustomProduct(db, {
      name: 'Auto Badge Discord',
      category: 'services',
      description: 'Treo huy hiệu Discord tự động',
      requiresToken: true,
      variants: [{ id: 'pkg-1', name: 'Gói 1 tháng', price: 50000, deliveryType: 'gift' }],
    });

    // Quote order phát hiện hasTokenItems
    const quote = await quoteOrder(db, [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }]);
    assert.equal(quote.hasTokenItems, true, 'quoteOrder should flag hasTokenItems');

    // Tạo đơn hàng kèm Discord Token
    const testToken = 'vnl_mock_discord_user_token_abc123xyz789';
    const order = await createOrder(db, {
      userId,
      customerName: 'Nguyễn Văn A',
      customerEmail: 'a@example.com',
      customerNote: 'Làm nhanh giúp mình',
      items: quote.validatedItems,
      total: quote.total,
      paymentMethod: 'wallet',
      discordToken: testToken,
    });

    assert.equal(order.discordToken, testToken);

    // Khách xem lại đơn hàng nhận được discordToken
    const userOrders = await getUserOrders(db, userId);
    assert.equal(userOrders.length, 1);
    assert.equal(userOrders[0].discordToken, testToken);

    // Admin xem danh sách đơn hàng nhận được discordToken
    const adminOrders = await getAdminOrders(db);
    assert.equal(adminOrders.length, 1);
    assert.equal(adminOrders[0].discordToken, testToken);

    // updateAdminOrder trả về discordToken
    const updatedOrder = await updateAdminOrder(db, order.id, { status: 'completed' });
    assert.equal(updatedOrder.discordToken, testToken);

    // Discord Webhook embed chứa Token bảo mật dạng spoiler ||...||
    const adminPayload = buildOrderEmbed(updatedOrder);
    const tokenField = adminPayload.embeds[0].fields.find(f => f.name.includes('Token Discord'));
    assert.ok(tokenField, 'Admin embed should contain Token Discord field');
    assert.equal(tokenField.value, `||${testToken}||`, 'Token should be masked with spoilers');

    // Partner Webhook embed cũng chứa Token nếu có
    const partnerPayload = buildPartnerOrderEmbed(updatedOrder, 'partner@example.com', updatedOrder.items);
    const partnerTokenField = partnerPayload.embeds[0].fields.find(f => f.name.includes('Token Discord'));
    assert.ok(partnerTokenField, 'Partner embed should contain Token Discord field');
    assert.equal(partnerTokenField.value, `||${testToken}||`);
  } finally {
    await db.close();
  }
});

test('Giao diện HTML & Client JS hỗ trợ nhập và cấu hình Token Discord', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes('id="checkout-token-notice"'), 'index.html has #checkout-token-notice');
  assert.ok(indexHtml.includes('id="checkout-discord-token"'), 'index.html has #checkout-discord-token');

  const appJs = fs.readFileSync('app.js', 'utf8');
  assert.ok(appJs.includes('detail-discord-token'), 'app.js has detail-discord-token in product popup');
  assert.ok(appJs.includes('checkout-token-notice'), 'app.js toggles checkout-token-notice');
  assert.ok(appJs.includes('discordToken'), 'app.js handles discordToken in checkout submission');
  assert.ok(appJs.includes('order-token-info'), 'app.js displays token status in customer order history');

  const adminPricingJs = fs.readFileSync('admin-pricing.js', 'utf8');
  assert.ok(adminPricingJs.includes('name="requiresToken"'), 'admin-pricing.js has requiresToken checkbox');
  assert.ok(adminPricingJs.includes('data.get("requiresToken") === "1"'), 'admin-pricing.js reads requiresToken on submit');

  const adminJs = fs.readFileSync('admin.js', 'utf8');
  assert.ok(adminJs.includes('TOKEN TÀI KHOẢN DISCORD CỦA KHÁCH'), 'admin.js has token display box for admin/partner');
  assert.ok(adminJs.includes('data-action="toggle-pass"'), 'admin.js has toggle show/hide for token');
});
