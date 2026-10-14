import { randomUUID, createHash } from "node:crypto";
import { products, validateOrderItems } from "./catalog.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw fail(`${label} không hợp lệ.`);
  return value;
};
const optionalInteger = (value, max, label) => value == null ? null : integer(value, 1, max, label);
const mapRule = (row) => ({ ...JSON.parse(row.rules_json), id: row.id, kind: row.kind, code: row.code, updatedAt: row.updated_at });

export async function listPromotions(db, now = Date.now()) {
  const rows = await db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM order_pricing op JOIN orders o ON o.id = op.order_id
    WHERE op.coupon_id = p.id AND o.status != 'cancelled') AS used FROM promotions p ORDER BY p.updated_at DESC, p.id`).all();
  return rows.map(row => {
    const rule = mapRule(row);
    const status = !rule.enabled ? "disabled" : rule.endsAt != null && now >= rule.endsAt ? "expired"
      : rule.startsAt != null && now < rule.startsAt ? "scheduled"
      : rule.usageLimit != null && row.used >= rule.usageLimit ? "exhausted" : "active";
    return { ...rule, used: row.used, status };
  });
}

export async function savePromotion(db, body, id = null, now = Date.now()) {
  const old = id ? await db.prepare("SELECT * FROM promotions WHERE id = ?").get(id) : null;
  if (id && !old) throw fail("Không tìm thấy ưu đãi.", 404);
  if (!["campaign", "coupon"].includes(body.kind) || (old && old.kind !== body.kind)) throw fail("Loại ưu đãi không hợp lệ.");
  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên ưu đãi cần từ 1 đến 100 ký tự.");
  const code = body.kind === "coupon" ? String(body.code || "").trim().toUpperCase() : null;
  if (code !== null && !/^[A-Z0-9_-]{3,32}$/.test(code)) throw fail("Mã giảm giá gồm 3–32 chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.");
  if (typeof body.enabled !== "boolean" || !["percent", "fixed"].includes(body.type)) throw fail("Trạng thái hoặc cách giảm giá không hợp lệ.");
  const value = integer(body.value, 1, body.type === "percent" ? 100 : 1000000000, "Mức giảm");
  const startsAt = optionalInteger(body.startsAt, 8640000000000000, "Ngày bắt đầu");
  const endsAt = optionalInteger(body.endsAt, 8640000000000000, "Ngày kết thúc");
  if (endsAt != null && startsAt != null && endsAt <= startsAt) throw fail("Ngày kết thúc phải sau ngày bắt đầu.");
  if (!Array.isArray(body.productIds) || body.productIds.length > products.length || body.productIds.some(id => !products.some(p => p.id === id && !p.service))) throw fail("Danh sách sản phẩm không hợp lệ.");
  const isCoupon = body.kind === "coupon";
  if (isCoupon && typeof body.stackWithSale !== "boolean") throw fail("Vui lòng chọn cách kết hợp với đợt giảm giá.");
  const rule = {
    name, enabled: body.enabled, type: body.type, value, startsAt, endsAt,
    productIds: [...new Set(body.productIds)],
    minOrder: isCoupon ? integer(body.minOrder ?? 0, 0, 1000000000000, "Giá trị đơn tối thiểu") : 0,
    maxDiscount: isCoupon ? optionalInteger(body.maxDiscount, 1000000000, "Giới hạn số tiền giảm") : null,
    usageLimit: isCoupon ? optionalInteger(body.usageLimit, 1000000, "Tổng lượt sử dụng") : null,
    perUserLimit: isCoupon ? optionalInteger(body.perUserLimit, 1000000, "Lượt dùng mỗi khách") : null,
    stackWithSale: isCoupon ? body.stackWithSale : true,
  };
  if (code) {
    const existing = await db.prepare("SELECT id FROM promotions WHERE code = ? AND id != ?").get(code, id || "");
    if (existing) throw fail("Mã giảm giá này đã tồn tại.", 409);
  }
  id ||= randomUUID();
  await db.prepare(`INSERT INTO promotions (id, kind, code, rules_json, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET code = excluded.code, rules_json = excluded.rules_json, updated_at = excluded.updated_at`)
    .run(id, body.kind, code, JSON.stringify(rule), now);
  const allPromos = await listPromotions(db, now);
  return allPromos.find(p => p.id === id);
}

export async function setPromotionEnabled(db, id, enabled) {
  if (typeof enabled !== "boolean") throw fail("Trạng thái không hợp lệ.");
  const row = await db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
  if (!row) throw fail("Không tìm thấy ưu đãi.", 404);
  return await savePromotion(db, { ...mapRule(row), enabled }, id);
}

export async function savePrices(db, changes, now = Date.now()) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw fail("Danh sách giá không hợp lệ.");
  const catalog = await getCatalog(db, now, true);
  const seen = new Set();
  for (const item of changes) {
    const product = catalog.find(p => p.id === item?.productId && !p.service);
    if (!product?.variants.some(v => v.id === item.variantId)) throw fail("Không tìm thấy gói sản phẩm.");
    const key = `${item.productId}:${item.variantId}`;
    if (seen.has(key)) throw fail("Một gói sản phẩm bị lặp lại.");
    seen.add(key);
    if (item.price !== null) integer(item.price, 0, 1000000000, "Giá bán (VND)");
  }
  return db.transaction(async (tx) => {
    for (const item of changes) {
      if (item.price === null) {
        await tx.prepare("DELETE FROM product_prices WHERE product_id = ? AND variant_id = ?").run(item.productId, item.variantId);
      } else {
        await tx.prepare(`INSERT INTO product_prices (product_id, variant_id, price, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(product_id, variant_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`)
          .run(item.productId, item.variantId, item.price, now);
      }
    }
  });
}

const active = (rule, now) => rule.enabled && (rule.startsAt == null || now >= rule.startsAt) && (rule.endsAt == null || now < rule.endsAt);
const applies = (rule, id) => !rule.productIds.length || rule.productIds.includes(id);
const discount = (amount, rule) => Math.min(amount, rule.type === "percent" ? Math.floor(amount * rule.value / 100) : rule.value, rule.maxDiscount ?? Infinity);

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function getCatalog(db, now = Date.now(), includeInactive = false) {
  let statusMap = new Map();
  try {
    const statusRows = await db.prepare("SELECT * FROM catalog_item_status").all();
    statusMap = new Map(statusRows.map(r => [r.item_key, r.is_active === 1]));
  } catch {}

  let customProducts = [];
  try {
    customProducts = await db.prepare("SELECT * FROM custom_products ORDER BY created_at ASC").all();
  } catch {}

  let customVariants = [];
  try {
    customVariants = await db.prepare("SELECT * FROM custom_variants ORDER BY created_at ASC").all();
  } catch {}

  const priceRows = await db.prepare("SELECT * FROM product_prices").all();
  const overrides = new Map(priceRows.map(r => [`${r.product_id}:${r.variant_id}`, r.price]));
  const campaignRows = await db.prepare("SELECT * FROM promotions WHERE kind = 'campaign'").all();
  const campaigns = campaignRows.map(mapRule).filter(r => active(r, now));

  const defaultList = products.map(p => {
    const isProductActive = statusMap.has("product:" + p.id) ? statusMap.get("product:" + p.id) : true;
    const standardVariants = (p.variants || []).map(v => {
      const isVariantActive = statusMap.has("variant:" + p.id + ":" + v.id) ? statusMap.get("variant:" + p.id + ":" + v.id) : true;
      const basePrice = overrides.get(`${p.id}:${v.id}`) ?? v.price;
      let amount = 0, sale = null;
      for (const rule of campaigns) {
        const savings = applies(rule, p.id) ? discount(basePrice, rule) : 0;
        if (savings > amount) { amount = savings; sale = { id: rule.id, name: rule.name, endsAt: rule.endsAt }; }
      }
      return { ...v, isCustom: false, isActive: isVariantActive, defaultPrice: v.price, basePrice, price: basePrice - amount, sale };
    });

    const addedVariants = customVariants
      .filter(cv => cv.product_id === p.id)
      .map(cv => {
        const isVariantActive = cv.is_active === 1;
        const basePrice = overrides.get(`${p.id}:${cv.id}`) ?? cv.price;
        let amount = 0, sale = null;
        for (const rule of campaigns) {
          const savings = applies(rule, p.id) ? discount(basePrice, rule) : 0;
          if (savings > amount) { amount = savings; sale = { id: rule.id, name: rule.name, endsAt: rule.endsAt }; }
        }
        return {
          id: cv.id,
          name: cv.name,
          deliveryType: cv.delivery_type || "gift",
          note: cv.note || "",
          isCustom: true,
          isActive: isVariantActive,
          defaultPrice: cv.price,
          basePrice,
          price: basePrice - amount,
          sale,
        };
      });

    return { ...p, isCustom: false, isActive: isProductActive, variants: [...standardVariants, ...addedVariants] };
  });

  const customList = customProducts.map(cp => {
    const isProductActive = cp.is_active === 1;
    const prodVariants = customVariants
      .filter(cv => cv.product_id === cp.id)
      .map(cv => {
        const isVariantActive = cv.is_active === 1;
        const basePrice = overrides.get(`${cp.id}:${cv.id}`) ?? cv.price;
        let amount = 0, sale = null;
        for (const rule of campaigns) {
          const savings = applies(rule, cp.id) ? discount(basePrice, rule) : 0;
          if (savings > amount) { amount = savings; sale = { id: rule.id, name: rule.name, endsAt: rule.endsAt }; }
        }
        return {
          id: cv.id,
          name: cv.name,
          deliveryType: cv.delivery_type || "gift",
          note: cv.note || "",
          isCustom: true,
          isActive: isVariantActive,
          defaultPrice: cv.price,
          basePrice,
          price: basePrice - amount,
          sale,
        };
      });

    return {
      id: cp.id,
      name: cp.name,
      category: cp.category,
      badge: cp.badge || (cp.category ? cp.category.toUpperCase() : "HOT"),
      description: cp.description || "",
      image: cp.image || "assets/nitro.svg",
      features: cp.features_json ? JSON.parse(cp.features_json) : [
        "Bảo hành đầy đủ suốt thời hạn",
        "Kích hoạt nhanh chóng và uy tín",
      ],
      detail: cp.detail || cp.description || "",
      service: cp.service === 1,
      isCustom: true,
      isActive: isProductActive,
      variants: prodVariants,
    };
  });

  const allProducts = [...defaultList, ...customList];
  if (includeInactive) return allProducts;

  return allProducts
    .filter(p => p.isActive)
    .map(p => ({
      ...p,
      variants: (p.variants || []).filter(v => v.isActive),
    }))
    .filter(p => p.service || p.variants.length > 0);
}

export async function createCustomProduct(db, body, now = Date.now()) {
  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên mặt hàng cần từ 1 đến 100 ký tự.");
  const category = String(body.category || "entertainment").trim();
  const description = String(body.description || "").trim().slice(0, 500);
  const badge = String(body.badge || "").trim().slice(0, 50) || category.toUpperCase();
  const detail = String(body.detail || description).trim().slice(0, 2000);
  const image = String(body.image || "").trim() || "assets/nitro.svg";
  const service = body.service ? 1 : 0;

  let baseSlug = slugify(name) || "item";
  let id = baseSlug;
  const defaultCollision = products.some(p => p.id === id);
  const customCollision = await db.prepare("SELECT id FROM custom_products WHERE id = ?").get(id);
  if (defaultCollision || customCollision) {
    id = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  const features = Array.isArray(body.features) && body.features.length
    ? body.features.map(f => String(f).trim()).filter(Boolean).slice(0, 6)
    : [
        "Bảo hành đầy đủ suốt thời hạn",
        "Kích hoạt nhanh chóng và uy tín",
      ];

  await db.prepare(`INSERT INTO custom_products (id, name, category, badge, description, image, features_json, detail, service, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    id, name, category, badge, description, image, JSON.stringify(features), detail, service, now, now
  );

  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      if (v && v.name && v.price != null) {
        await addCustomVariant(db, id, v, now);
      }
    }
  }

  return (await getCatalog(db, now, true)).find(p => p.id === id);
}

export async function addCustomVariant(db, productId, body, now = Date.now()) {
  const catalog = await getCatalog(db, now, true);
  const product = catalog.find(p => p.id === productId);
  if (!product) throw fail("Không tìm thấy mặt hàng.", 404);

  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên gói sản phẩm cần từ 1 đến 100 ký tự.");
  const price = integer(Number(body.price), 0, 1000000000, "Giá gói");
  const deliveryType = ["gift", "log", "service"].includes(body.deliveryType) ? body.deliveryType : "gift";
  const note = String(body.note || "").trim().slice(0, 200);

  let baseSlug = slugify(name) || "pkg";
  let id = baseSlug;
  const existing = (product.variants || []).some(v => v.id === id);
  if (existing) {
    id = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  await db.prepare(`INSERT INTO custom_variants (id, product_id, name, price, delivery_type, note, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    id, productId, name, price, deliveryType, note, now, now
  );

  return { id, productId, name, price, deliveryType, note, isActive: true, isCustom: true };
}

export async function toggleProductStatus(db, productId, isActive, now = Date.now()) {
  const custom = await db.prepare("SELECT * FROM custom_products WHERE id = ?").get(productId);
  if (custom) {
    await db.prepare("UPDATE custom_products SET is_active = ?, updated_at = ? WHERE id = ?").run(isActive ? 1 : 0, now, productId);
  } else {
    const isDefault = products.some(p => p.id === productId);
    if (!isDefault) throw fail("Không tìm thấy mặt hàng.", 404);
    await db.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
      .run("product:" + productId, isActive ? 1 : 0, now);
  }
  return { productId, isActive };
}

export async function deleteProduct(db, productId) {
  const custom = await db.prepare("SELECT * FROM custom_products WHERE id = ?").get(productId);
  if (custom) {
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM custom_products WHERE id = ?").run(productId);
      await tx.prepare("DELETE FROM custom_variants WHERE product_id = ?").run(productId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ?").run(productId);
    });
    return { productId, deleted: true };
  } else {
    const isDefault = products.some(p => p.id === productId);
    if (!isDefault) throw fail("Không tìm thấy mặt hàng.", 404);
    await toggleProductStatus(db, productId, false);
    return { productId, hidden: true };
  }
}

export async function toggleVariantStatus(db, productId, variantId, isActive, now = Date.now()) {
  const custom = await db.prepare("SELECT * FROM custom_variants WHERE product_id = ? AND id = ?").get(productId, variantId);
  if (custom) {
    await db.prepare("UPDATE custom_variants SET is_active = ?, updated_at = ? WHERE product_id = ? AND id = ?")
      .run(isActive ? 1 : 0, now, productId, variantId);
  } else {
    const defaultProduct = products.find(p => p.id === productId);
    const defaultVariant = defaultProduct?.variants?.some(v => v.id === variantId);
    if (!defaultVariant) throw fail("Không tìm thấy gói sản phẩm.", 404);
    await db.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
      .run("variant:" + productId + ":" + variantId, isActive ? 1 : 0, now);
  }
  return { productId, variantId, isActive };
}

export async function deleteVariant(db, productId, variantId) {
  const custom = await db.prepare("SELECT * FROM custom_variants WHERE product_id = ? AND id = ?").get(productId, variantId);
  if (custom) {
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM custom_variants WHERE product_id = ? AND id = ?").run(productId, variantId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ?").run(productId, variantId);
    });
    return { productId, variantId, deleted: true };
  } else {
    await toggleVariantStatus(db, productId, variantId, false);
    return { productId, variantId, hidden: true };
  }
}

// Mọi giá trị thanh toán đều được tính lại từ dữ liệu của shop, không lấy giá do trình duyệt gửi lên.
export async function quoteOrder(db, items, couponCode = "", userId = null, now = Date.now()) {
  const catalog = await getCatalog(db, now);
  const result = validateOrderItems(items, catalog);
  const enriched = result.validatedItems.map(item => {
    const variant = catalog.find(p => p.id === item.productId).variants.find(v => v.id === item.variantId);
    return { ...item, basePrice: variant.basePrice, sale: variant.sale };
  });
  const subtotal = enriched.reduce((sum, i) => sum + i.basePrice * i.quantity, 0);
  const saleDiscount = subtotal - result.total;
  if (typeof couponCode !== "string" || couponCode.length > 32) throw fail("Mã giảm giá không hợp lệ.");
  const code = couponCode.trim().toUpperCase();
  let coupon = null, couponDiscount = 0;
  if (code) {
    if (!userId) throw fail("Vui lòng đăng nhập để áp dụng mã giảm giá.", 401);
    const row = await db.prepare("SELECT * FROM promotions WHERE kind = 'coupon' AND code = ?").get(code);
    if (!row || !active(mapRule(row), now)) throw fail("Mã giảm giá không tồn tại, chưa bắt đầu hoặc đã hết hạn.");
    const rule = mapRule(row);
    const usage = await db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(o.user_id = ?), 0) AS personal
      FROM order_pricing op JOIN orders o ON o.id = op.order_id WHERE op.coupon_id = ? AND o.status != 'cancelled'`).get(userId, rule.id);
    if (rule.usageLimit != null && usage.total >= rule.usageLimit) throw fail("Mã giảm giá đã hết lượt sử dụng.");
    if (rule.perUserLimit != null && usage.personal >= rule.perUserLimit) throw fail("Tài khoản đã dùng hết lượt của mã giảm giá này.");
    if (result.total < rule.minOrder) throw fail(`Mã yêu cầu đơn từ ${rule.minOrder.toLocaleString("vi-VN")}₫ sau giảm giá sản phẩm.`);
    if (!rule.stackWithSale && saleDiscount > 0) throw fail("Mã này không kết hợp với sản phẩm đang giảm giá.");
    const eligible = enriched.filter(i => applies(rule, i.productId)).reduce((sum, i) => sum + i.subtotal, 0);
    if (eligible === 0) throw fail("Giỏ hàng chưa có sản phẩm đủ điều kiện dùng mã.");
    couponDiscount = discount(eligible, rule);
    coupon = { id: rule.id, code, name: rule.name };
  }
  const quote = { ...result, validatedItems: enriched, subtotal, saleDiscount, couponDiscount, total: result.total - couponDiscount, coupon };
  // Dấu đối chiếu giúp phát hiện giá thay đổi trước lúc khách xác nhận trả tiền.
  quote.fingerprint = createHash("sha256").update(JSON.stringify(quote)).digest("hex");
  return quote;
}
