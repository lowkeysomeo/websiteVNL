import test from "node:test";
import assert from "node:assert/strict";
import { openStore, createOrder, updateAdminOrder, balance } from "../server/store.js";
import { createApp } from "../server/app.js";
import { readConfig } from "../server/config.js";
import { getCatalog, updateInventory, createCustomProduct } from "../server/pricing.js";

async function setupTestApp() {
  const db = await openStore(":memory:");
  const config = readConfig({
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "admin-secret-password-xyz",
  });
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  return {
    db,
    config,
    server,
    origin,
    async request(method, path, body = null, headers = {}) {
      const res = await fetch(`${origin}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let responseBody = null;
      try {
        responseBody = await res.json();
      } catch {}
      return { status: res.status, body: responseBody };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test("Inventory: getCatalog attaches stock and soldCount to products and variants", async () => {
  const db = await openStore(":memory:");
  try {
    const catalog = await getCatalog(db, Date.now(), false);
    assert(catalog.length > 0);
    const nitro = catalog.find((p) => p.id === "nitro");
    assert(nitro);
    assert.equal(typeof nitro.stock, "number");
    assert.equal(typeof nitro.soldCount, "number");
    assert.equal(nitro.stock, 99);
    assert.equal(nitro.soldCount, 0);

    assert(nitro.variants.length > 0);
    assert.equal(typeof nitro.variants[0].stock, "number");
    assert.equal(typeof nitro.variants[0].soldCount, "number");
  } finally {
    db.close();
  }
});

test("Inventory: public GET /api/inventory returns real-time inventory map", async () => {
  const app = await setupTestApp();
  try {
    const res = await app.request("GET", "/api/inventory");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(res.body.inventory);
  } finally {
    await app.close();
  }
});

test("Inventory: Admin can edit stock & soldCount for default and custom items", async () => {
  const app = await setupTestApp();
  try {
    const adminHeaders = {
      "x-admin-key": app.config.adminPassword,
      origin: app.config.origin,
    };

    // Update stock and sold count for default product "nitro"
    const updateRes = await app.request(
      "PUT",
      "/api/admin/inventory",
      {
        productId: "nitro",
        stock: 45,
        soldCount: 155,
      },
      adminHeaders,
    );

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.updated.stock, 45);
    assert.equal(updateRes.body.updated.soldCount, 155);

    // Verify in catalog
    const catalogRes = await app.request("GET", "/api/catalog");
    const nitro = catalogRes.body.products.find((p) => p.id === "nitro");
    assert.equal(nitro.stock, 45);
    assert.equal(nitro.soldCount, 155);

    // Verify in public /api/inventory
    const invRes = await app.request("GET", "/api/inventory");
    assert.equal(invRes.body.inventory.nitro.stock, 45);
    assert.equal(invRes.body.inventory.nitro.soldCount, 155);
  } finally {
    await app.close();
  }
});

test("Inventory: Partner permissions - can edit own items, forbidden on others", async () => {
  const app = await setupTestApp();
  try {
    const adminHeaders = {
      "x-admin-key": app.config.adminPassword,
      origin: app.config.origin,
    };

    // 1. Admin creates a partner
    const createPartnerRes = await app.request(
      "POST",
      "/api/admin/partners",
      {
        email: "shop.partner@example.com",
        name: "Shop Doi Tac",
        password: "partner-password-789",
      },
      adminHeaders,
    );
    assert.equal(createPartnerRes.status, 201);

    // 2. Partner logs in
    const partnerLoginRes = await app.request("POST", "/api/admin/auth", {
      email: "shop.partner@example.com",
      password: "partner-password-789",
    });
    assert.equal(partnerLoginRes.status, 200);
    const partnerKey = partnerLoginRes.body.adminKey;
    const partnerHeaders = {
      "x-admin-key": partnerKey,
      origin: app.config.origin,
    };

    // 3. Partner creates a product
    const createProdRes = await app.request(
      "POST",
      "/api/admin/products",
      {
        name: "Canva Pro Partner",
        category: "creative",
        badge: "DESIGN / PRO",
        description: "Tai khoan Canva Pro 1 nam",
        stock: 30,
        soldCount: 10,
        variants: [
          { name: "Canva 1 nam", price: 120000, deliveryType: "gift", note: "Nang cap chinh chu" },
        ],
      },
      partnerHeaders,
    );
    assert.equal(createProdRes.status, 201);
    const partnerProduct = createProdRes.body.product;
    assert.equal(partnerProduct.stock, 30);
    assert.equal(partnerProduct.soldCount, 10);

    // 4. Partner updates stock & soldCount for their OWN product
    const partnerUpdateRes = await app.request(
      "PUT",
      "/api/admin/inventory",
      {
        productId: partnerProduct.id,
        stock: 25,
        soldCount: 15,
      },
      partnerHeaders,
    );
    assert.equal(partnerUpdateRes.status, 200);
    assert.equal(partnerUpdateRes.body.updated.stock, 25);
    assert.equal(partnerUpdateRes.body.updated.soldCount, 15);

    // 5. Partner attempts to edit a default product ("nitro") -> 403 Forbidden
    const illegalDefaultRes = await app.request(
      "PUT",
      "/api/admin/inventory",
      {
        productId: "nitro",
        stock: 999,
        soldCount: 999,
      },
      partnerHeaders,
    );
    assert.equal(illegalDefaultRes.status, 403);

    // 6. Admin can edit partner's product
    const adminEditPartnerRes = await app.request(
      "PUT",
      "/api/admin/inventory",
      {
        productId: partnerProduct.id,
        stock: 50,
        soldCount: 40,
      },
      adminHeaders,
    );
    assert.equal(adminEditPartnerRes.status, 200);
    assert.equal(adminEditPartnerRes.body.updated.stock, 50);
    assert.equal(adminEditPartnerRes.body.updated.soldCount, 40);
  } finally {
    await app.close();
  }
});

test("Inventory: Real-time deduction on order creation and restoration on cancel", async () => {
  const db = await openStore(":memory:");
  try {
    // 1. Set initial stock to 10 and sold to 5 for "decor-gift"
    await updateInventory(db, {
      productId: "decor-gift",
      stock: 10,
      soldCount: 5,
    });

    const initialCatalog = await getCatalog(db, Date.now(), false);
    const initialDecor = initialCatalog.find((p) => p.id === "decor-gift");
    assert.equal(initialDecor.stock, 10);
    assert.equal(initialDecor.soldCount, 5);

    // 2. Create order for 2 items
    const order = await createOrder(db, {
      customerName: "Khach Hang Test",
      customerEmail: "khach@test.com",
      items: [
        {
          productId: "decor-gift",
          variantId: "decor_gift_basic",
          name: "Discord Decor Gift",
          price: 49000,
          quantity: 2,
        },
      ],
      total: 98000,
      paymentMethod: "pending",
    });

    assert.equal(order.status, "pending");

    // Check stock decremented to 8, soldCount incremented to 7
    const afterOrderCatalog = await getCatalog(db, Date.now(), false);
    const afterDecor = afterOrderCatalog.find((p) => p.id === "decor-gift");
    assert.equal(afterDecor.stock, 8);
    assert.equal(afterDecor.soldCount, 7);

    // 3. Attempting to purchase more than available stock (e.g. 9 items when only 8 left)
    await assert.rejects(
      async () => {
        await createOrder(db, {
          customerName: "Khach Hang 2",
          customerEmail: "khach2@test.com",
          items: [
            {
              productId: "decor-gift",
              variantId: "decor_gift_basic",
              name: "Discord Decor Gift",
              price: 49000,
              quantity: 9,
            },
          ],
          total: 441000,
          paymentMethod: "pending",
        });
      },
      /đã hết hàng hoặc không đủ số lượng trong kho/,
    );

    // 4. Cancel the order -> stock restored to 10, soldCount decremented to 5
    await updateAdminOrder(db, order.id, { status: "cancelled" });

    const afterCancelCatalog = await getCatalog(db, Date.now(), false);
    const restoredDecor = afterCancelCatalog.find((p) => p.id === "decor-gift");
    assert.equal(restoredDecor.stock, 10);
    assert.equal(restoredDecor.soldCount, 5);
  } finally {
    db.close();
  }
});
