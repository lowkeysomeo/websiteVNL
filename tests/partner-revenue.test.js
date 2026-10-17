import test from "node:test";
import assert from "node:assert/strict";
import { openStore, listPartners, savePartner, createOrder, updateAdminOrder } from "../server/store.js";
import { createCustomProduct, updateVariant } from "../server/pricing.js";

test("partner revenue follows completed order prices, quantities and saved subtotals", async () => {
  const db = await openStore(":memory:");
  try {
    await savePartner(db, { email: "seller@example.com", name: "Seller", password: "partner-password-123" });
    const product = await createCustomProduct(db, {
      name: "Partner service", variants: [{ name: "Standard", price: 50000, deliveryType: "gift" }],
    }, Date.now(), "seller@example.com");
    const order = await createOrder(db, {
      customerName: "Buyer", customerEmail: "buyer@example.com", paymentMethod: "bank",
      requestItems: [{ productId: product.id, variantId: product.variants[0].id, quantity: 2 }],
    });
    const metrics = async () => (await listPartners(db))[0];
    assert.equal((await metrics()).revenue, 0, "pending orders do not generate revenue");
    await updateAdminOrder(db, order.id, { status: "processing" });
    assert.equal((await metrics()).revenue, 0, "processing orders do not generate completed revenue");
    await updateAdminOrder(db, order.id, { status: "completed" });
    assert.equal((await metrics()).revenue, 100000);
    assert.equal((await metrics()).orderCount, 1);
    await updateVariant(db, product.id, product.variants[0].id, { name: "Standard", price: 90000, deliveryType: "gift" });
    assert.equal((await metrics()).revenue, 100000, "current catalog price does not change historical sales");
    // Mixed orders and older records without subtotal retain their original prices.
    await db.prepare("UPDATE orders SET items_json = ? WHERE id = ?").run(JSON.stringify([
      { productId: product.id, price: 90000, quantity: 2, subtotal: 80000 },
      { productId: product.id, price: 7000, quantity: 3 },
      { productId: product.id, unitPrice: 5000, quantity: 2 },
      { productId: product.id, price: 90000, quantity: 1, subtotal: 0 },
      { productId: "nitro", price: 999999, quantity: 1 },
    ]), order.id);
    assert.equal((await metrics()).revenue, 111000);
    assert.equal((await metrics()).totalRevenue, 111000);
    assert.equal((await metrics()).orderCount, 1, "multiple lines count as one partner order");
    await updateAdminOrder(db, order.id, { status: "cancelled" });
    assert.equal((await metrics()).revenue, 0, "cancelled orders are excluded");
  } finally { db.close(); }
});
