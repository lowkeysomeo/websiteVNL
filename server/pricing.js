import { randomUUID, createHash } from "node:crypto";
import { products, validateOrderItems } from "./catalog.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw fail(`${label} không hợp lệ.`);
  return value;
};
const optionalInteger = (value, max, label) => value == null ? null : integer(value, 1, max, label);
const mapRule = (row) => ({ ...JSON.parse(row.rules_json), id: row.id, kind: row.kind, code: row.code, updatedAt: row.updated_at });

export async function listPromotions(db, now = Date.now(), partnerEmail = null) {
  let effectiveNow = typeof now === "number" ? now : Date.now();
  let effectiveEmail = partnerEmail;
  if (now && typeof now === "string") {
    effectiveEmail = now;
    effectiveNow = Date.now();
  } else if (now && typeof now === "object" && now.role) {
    effectiveEmail = now.role === "partner" ? now.email : null;
    effectiveNow = Date.now();
  }
  const rows = await db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM order_pricing op JOIN orders o ON o.id = op.order_id
    WHERE op.coupon_id = p.id AND o.status != 'cancelled') AS used FROM promotions p ORDER BY p.updated_at DESC, p.id`).all();
  const list = rows.map(row => {
    const rule = mapRule(row);
    const status = !rule.enabled ? "disabled" : rule.endsAt != null && effectiveNow >= rule.endsAt ? "expired"
      : rule.startsAt != null && effectiveNow < rule.startsAt ? "scheduled"
      : rule.usageLimit != null && row.used >= rule.usageLimit ? "exhausted" : "active";
    return { ...rule, used: row.used, status };
  });
  if (effectiveEmail) {
    const lower = String(effectiveEmail).trim().toLowerCase();
    return list.filter(p => p.partnerEmail && String(p.partnerEmail).trim().toLowerCase() === lower);
  }
  return list;
}

export async function savePromotion(db, body, id = null, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  const old = id ? await db.prepare("SELECT * FROM promotions WHERE id = ?").get(id) : null;
  if (id && !old) throw fail("Không tìm thấy ưu đãi.", 404);
  if (!["campaign", "coupon"].includes(body.kind) || (old && old.kind !== body.kind)) throw fail("Loại ưu đãi không hợp lệ.");
  const oldRule = old ? mapRule(old) : null;

  const isPartner = effectiveCaller?.role === "partner";
  const partnerEmail = isPartner ? String(effectiveCaller.email || "").trim().toLowerCase() : null;

  if (isPartner && oldRule) {
    if (!oldRule.partnerEmail || String(oldRule.partnerEmail).trim().toLowerCase() !== partnerEmail) {
      throw fail("Bạn chỉ có quyền quản lý ưu đãi của chính mình.", 403);
    }
  }

  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên ưu đãi cần từ 1 đến 100 ký tự.");
  const code = body.kind === "coupon" ? String(body.code || "").trim().toUpperCase() : null;
  if (code !== null && !/^[A-Z0-9_-]{3,32}$/.test(code)) throw fail("Mã giảm giá gồm 3 đến 32 chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.");
  if (typeof body.enabled !== "boolean" || !["percent", "fixed"].includes(body.type)) throw fail("Trạng thái hoặc cách giảm giá không hợp lệ.");
  const value = integer(body.value, 1, body.type === "percent" ? 100 : 1000000000, "Mức giảm");
  const startsAt = optionalInteger(body.startsAt, 8640000000000000, "Ngày bắt đầu");
  const endsAt = optionalInteger(body.endsAt, 8640000000000000, "Ngày kết thúc");
  if (endsAt != null && startsAt != null && endsAt <= startsAt) throw fail("Ngày kết thúc phải sau ngày bắt đầu.");

  const catalog = await getCatalog(db, effectiveNow, true);
  if (!Array.isArray(body.productIds)) throw fail("Danh sách sản phẩm không hợp lệ.");

  if (isPartner) {
    if (body.productIds.length === 0) {
      throw fail("Vui lòng chọn ít nhất 1 sản phẩm của bạn để áp dụng ưu đãi.");
    }
    for (const pid of body.productIds) {
      const prod = catalog.find(p => p.id === pid && !p.service);
      if (!prod || !prod.partnerEmail || String(prod.partnerEmail).trim().toLowerCase() !== partnerEmail) {
        throw fail("Danh sách sản phẩm không hợp lệ hoặc chứa sản phẩm không thuộc quyền quản lý của bạn.", 403);
      }
    }
  } else {
    for (const pid of body.productIds) {
      const prod = catalog.find(p => p.id === pid && !p.service);
      if (!prod) throw fail("Danh sách sản phẩm không hợp lệ.");
    }
  }

  let assignedPartnerEmail = null;
  if (isPartner) {
    assignedPartnerEmail = partnerEmail;
  } else if (oldRule?.partnerEmail) {
    assignedPartnerEmail = oldRule.partnerEmail;
  } else if (body.partnerEmail) {
    assignedPartnerEmail = String(body.partnerEmail).trim().toLowerCase();
  }

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
    ...(assignedPartnerEmail ? { partnerEmail: assignedPartnerEmail } : {}),
  };
  if (code) {
    const existing = await db.prepare("SELECT id FROM promotions WHERE code = ? AND id != ?").get(code, id || "");
    if (existing) throw fail("Mã giảm giá này đã tồn tại.", 409);
  }
  id ||= randomUUID();
  await db.prepare(`INSERT INTO promotions (id, kind, code, rules_json, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET code = excluded.code, rules_json = excluded.rules_json, updated_at = excluded.updated_at`)
    .run(id, body.kind, code, JSON.stringify(rule), effectiveNow);
  const allPromos = await listPromotions(db, effectiveNow);
  return allPromos.find(p => p.id === id);
}

export async function setPromotionEnabled(db, id, enabled, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  if (typeof enabled !== "boolean") throw fail("Trạng thái không hợp lệ.");
  const row = await db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
  if (!row) throw fail("Không tìm thấy ưu đãi.", 404);
  const rule = mapRule(row);
  if (effectiveCaller?.role === "partner") {
    const partnerEmail = String(effectiveCaller.email || "").trim().toLowerCase();
    if (!rule.partnerEmail || String(rule.partnerEmail).trim().toLowerCase() !== partnerEmail) {
      throw fail("Bạn chỉ có quyền quản lý ưu đãi của chính mình.", 403);
    }
  }
  return await savePromotion(db, { ...rule, enabled }, id, effectiveNow, effectiveCaller);
}

export async function deletePromotion(db, id, caller = null) {
  const row = await db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
  if (!row) throw fail("Không tìm thấy ưu đãi.", 404);
  const rule = mapRule(row);
  if (caller?.role === "partner") {
    const partnerEmail = String(caller.email || "").trim().toLowerCase();
    if (!rule.partnerEmail || String(rule.partnerEmail).trim().toLowerCase() !== partnerEmail) {
      throw fail("Bạn chỉ có quyền xóa ưu đãi của chính mình.", 403);
    }
  }
  const usedCount = await db.prepare("SELECT COUNT(*) AS count FROM order_pricing WHERE coupon_id = ?").get(id);
  if (usedCount && usedCount.count > 0) {
    throw fail("Mã giảm giá này đã được sử dụng trong các đơn hàng trước đó. Hãy chọn 'Tắt ưu đãi' thay vì xóa để lưu trữ lịch sử kế toán.", 400);
  }
  await db.prepare("DELETE FROM promotions WHERE id = ?").run(id);
  return { id, deleted: true };
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
const applies = (rule, id) => {
  if (rule.partnerEmail && (!Array.isArray(rule.productIds) || !rule.productIds.length)) return false;
  return !rule.productIds.length || rule.productIds.includes(id);
};
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
    statusMap = new Map(statusRows.map(r => [r.item_key, r.is_active]));
  } catch {}

  let overridesMap = new Map();
  try {
    const overrideRows = await db.prepare("SELECT * FROM catalog_item_overrides").all();
    overridesMap = new Map(overrideRows.map(r => [r.item_key, JSON.parse(r.data_json)]));
  } catch {}

  let customProducts = [];
  try {
    customProducts = await db.prepare("SELECT * FROM custom_products ORDER BY created_at ASC").all();
  } catch {}

  let customVariants = [];
  try {
    customVariants = await db.prepare("SELECT * FROM custom_variants ORDER BY created_at ASC").all();
  } catch {}

  let inventoryMap = new Map();
  try {
    const invRows = await db.prepare("SELECT * FROM product_inventory").all();
    for (const r of invRows) {
      inventoryMap.set(`${r.product_id}:${r.variant_id || ""}`, {
        stock: Number(r.stock),
        soldCount: Number(r.sold_count),
      });
    }
  } catch {}

  const priceRows = await db.prepare("SELECT * FROM product_prices").all();
  const overrides = new Map(priceRows.map(r => [`${r.product_id}:${r.variant_id}`, r.price]));
  const campaignRows = await db.prepare("SELECT * FROM promotions WHERE kind = 'campaign'").all();
  const campaigns = campaignRows.map(mapRule).filter(r => active(r, now));

  const defaultList = products
    .filter(p => statusMap.get("product:" + p.id) !== -1)
    .map(p => {
      const pOverride = overridesMap.get("product:" + p.id) || {};
      const mergedP = {
        ...p,
        ...pOverride,
        id: p.id,
      };
      const isProductActive = statusMap.get("product:" + p.id) !== 0;
      const pInvFallback = inventoryMap.get(`${p.id}:`) || { stock: 99, soldCount: 0 };

      const standardVariants = (p.variants || [])
        .filter(v => statusMap.get("variant:" + p.id + ":" + v.id) !== -1)
        .map(v => {
          const vOverride = overridesMap.get("variant:" + p.id + ":" + v.id) || {};
          const mergedV = {
            ...v,
            ...vOverride,
            id: v.id,
          };
          const isVariantActive = statusMap.get("variant:" + p.id + ":" + v.id) !== 0;
          const basePrice = overrides.get(`${p.id}:${v.id}`) ?? (mergedV.price ?? v.price);
          let amount = 0, sale = null;
          for (const rule of campaigns) {
            const savings = applies(rule, p.id) ? discount(basePrice, rule) : 0;
            if (savings > amount) { amount = savings; sale = { id: rule.id, name: rule.name, endsAt: rule.endsAt }; }
          }
          const vInv = inventoryMap.get(`${p.id}:${v.id}`);
          return {
            ...mergedV,
            isCustom: false,
            isActive: isVariantActive,
            defaultPrice: mergedV.price ?? v.price,
            basePrice,
            price: basePrice - amount,
            sale,
            stock: vInv ? vInv.stock : pInvFallback.stock,
            soldCount: vInv ? vInv.soldCount : pInvFallback.soldCount,
          };
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
          const vInv = inventoryMap.get(`${p.id}:${cv.id}`);
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
            stock: vInv ? vInv.stock : pInvFallback.stock,
            soldCount: vInv ? vInv.soldCount : pInvFallback.soldCount,
          };
        });

      return {
        ...mergedP,
        isCustom: false,
        isActive: isProductActive,
        stock: pInvFallback.stock,
        soldCount: pInvFallback.soldCount,
        variants: [...standardVariants, ...addedVariants],
      };
    });

  const customList = customProducts.map(cp => {
    const isProductActive = cp.is_active === 1;
    const pInvFallback = inventoryMap.get(`${cp.id}:`) || { stock: 99, soldCount: 0 };
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
        const vInv = inventoryMap.get(`${cp.id}:${cv.id}`);
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
          stock: vInv ? vInv.stock : pInvFallback.stock,
          soldCount: vInv ? vInv.soldCount : pInvFallback.soldCount,
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
      partnerEmail: cp.partner_email || null,
      isCustom: true,
      isActive: isProductActive,
      stock: pInvFallback.stock,
      soldCount: pInvFallback.soldCount,
      variants: prodVariants,
    };
  });

  const allProducts = [...defaultList, ...customList].map(p => ({
    ...p,
    checkoutNotice: overridesMap.get('notice:' + p.id) || null,
  }));

  let orderList = overridesMap.get("system:catalog_product_order");
  if (Array.isArray(orderList) && orderList.length) {
    const orderIndex = new Map(orderList.map((id, idx) => [id, idx]));
    allProducts.sort((a, b) => {
      const idxA = orderIndex.has(a.id) ? orderIndex.get(a.id) : 10000;
      const idxB = orderIndex.has(b.id) ? orderIndex.get(b.id) : 10000;
      return idxA - idxB;
    });
  }

  if (includeInactive) return allProducts;

  return allProducts
    .filter(p => p.isActive)
    .map(p => ({
      ...p,
      variants: (p.variants || []).filter(v => v.isActive),
    }))
    .filter(p => p.service || p.variants.length > 0);
}

export const DEFAULT_CATEGORIES = [
  { id: "discord", name: "Discord", icon: "gamepad" },
  { id: "decor", name: "Profile Decor", icon: "decor" },
  { id: "entertainment", name: "Giải trí", icon: "layers" },
  { id: "creative", name: "Sáng tạo", icon: "sparkles" },
  { id: "services", name: "Dịch vụ Discord", icon: "box" },
];

export async function getCategories(db) {
  let saved = [];
  try {
    const row = await db.prepare("SELECT data_json FROM catalog_item_overrides WHERE item_key = 'system:catalog_categories'").get();
    if (row?.data_json) saved = JSON.parse(row.data_json);
  } catch {}
  if (!Array.isArray(saved) || !saved.length) {
    saved = [...DEFAULT_CATEGORIES];
  }
  return saved;
}

function normalizeNowCaller(now, caller) {
  let effectiveNow = typeof now === "number" ? now : Date.now();
  let effectiveCaller = caller;
  if (now && typeof now === "object" && now.role) {
    effectiveCaller = now;
    effectiveNow = Date.now();
  }
  return { now: effectiveNow, caller: effectiveCaller };
}

export async function saveCategories(db, categories, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  if (!Array.isArray(categories) || !categories.length) throw fail("Danh sách hạng mục không hợp lệ.");

  const existing = await getCategories(db);
  const existingMap = new Map(existing.map(c => [c.id, c]));

  const isPartner = effectiveCaller?.role === "partner";
  const partnerEmail = isPartner ? String(effectiveCaller.email || "").trim().toLowerCase() : null;

  // Đối tác không được phép xóa hạng mục mặc định của hệ thống hoặc của đối tác khác
  if (isPartner) {
    const incomingIds = new Set(
      categories.map((c, idx) => slugify(c.id || c.name) || `cat-${idx + 1}`)
    );
    for (const oldCat of existing) {
      const isOwned = oldCat.partnerEmail && String(oldCat.partnerEmail).trim().toLowerCase() === partnerEmail;
      if (!isOwned && !incomingIds.has(oldCat.id)) {
        throw fail("Bạn không có quyền xóa hạng mục mặc định hoặc của đối tác khác.", 403);
      }
    }
  }

  const cleaned = categories.map((cat, idx) => {
    const id = slugify(cat.id || cat.name) || `cat-${idx + 1}`;
    let name = String(cat.name || id).trim().slice(0, 50);
    let icon = String(cat.icon || "box").trim().slice(0, 30);
    const oldCat = existingMap.get(id);

    let catPartnerEmail = null;
    if (oldCat) {
      catPartnerEmail = oldCat.partnerEmail || null;
      if (isPartner) {
        const isOwned = oldCat.partnerEmail && String(oldCat.partnerEmail).trim().toLowerCase() === partnerEmail;
        // Đối tác không được phép sửa tên hoặc icon của hạng mục mặc định/đối tác khác
        if (!isOwned) {
          name = oldCat.name;
          icon = oldCat.icon;
        }
      } else if (cat.partnerEmail !== undefined) {
        catPartnerEmail = cat.partnerEmail ? String(cat.partnerEmail).trim().toLowerCase() : null;
      }
    } else {
      // Hạng mục mới tạo
      if (isPartner) {
        catPartnerEmail = partnerEmail;
      } else if (cat.partnerEmail) {
        catPartnerEmail = String(cat.partnerEmail).trim().toLowerCase();
      }
    }

    const item = { id, name, icon };
    if (catPartnerEmail) {
      item.partnerEmail = catPartnerEmail;
    }
    return item;
  });

  const seen = new Set();
  for (const c of cleaned) {
    if (seen.has(c.id)) throw fail(`Mã hạng mục "${c.id}" bị trùng lặp.`);
    seen.add(c.id);
  }

  await db.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
    .run("system:catalog_categories", JSON.stringify(cleaned), effectiveNow);
  return cleaned;
}

export async function saveCatalogOrder(db, productIds, now = Date.now()) {
  if (!Array.isArray(productIds) || !productIds.length) throw fail("Danh sách thứ tự mặt hàng không hợp lệ.");
  const cleanIds = productIds.map(id => String(id).trim()).filter(Boolean);
  await db.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
    .run("system:catalog_product_order", JSON.stringify(cleanIds), now);
  return await getCatalog(db, now, true);
}

async function assertProductOwner(db, productId, caller) {
  if (!caller || caller.role !== "partner") return;
  const custom = await db.prepare("SELECT partner_email FROM custom_products WHERE id = ?").get(productId);
  if (!custom || String(custom.partner_email || "").toLowerCase() !== caller.email.toLowerCase()) {
    throw fail("Bạn chỉ có quyền quản lý dịch vụ / mặt hàng của chính mình.", 403);
  }
}

function parseCheckoutNotice(bodyNotice) {
  if (bodyNotice === undefined) return undefined;
  if (bodyNotice === null) return { title: "", content: "" };
  if (!bodyNotice || typeof bodyNotice !== "object" || typeof bodyNotice.title !== "string" || typeof bodyNotice.content !== "string") {
    throw fail("Hướng dẫn thanh toán cần có tiêu đề và nội dung dạng văn bản.");
  }
  if (bodyNotice.title.length > 120 || bodyNotice.content.length > 2000) {
    throw fail("Hướng dẫn thanh toán vượt quá độ dài cho phép.");
  }
  return { title: bodyNotice.title.trim(), content: bodyNotice.content.trim() };
}

export async function createCustomProduct(db, body, now = Date.now(), partnerEmail = null, caller = null) {
  let effectiveCaller = caller;
  let effectiveNow = typeof now === "number" ? now : Date.now();
  let effectivePartner = partnerEmail;
  if (now && typeof now === "object" && now.role) {
    effectiveCaller = now;
    effectiveNow = Date.now();
  } else if (partnerEmail && typeof partnerEmail === "object" && partnerEmail.role) {
    effectiveCaller = partnerEmail;
    effectivePartner = null;
  }
  const checkoutNotice = parseCheckoutNotice(body.checkoutNotice);
  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên mặt hàng cần từ 1 đến 100 ký tự.");
  const category = String(body.category || "entertainment").trim();
  const description = String(body.description || "").trim().slice(0, 500);
  const badge = String(body.badge || "").trim().slice(0, 50) || category.toUpperCase();
  const detail = String(body.detail !== undefined ? body.detail : description).trim().slice(0, 2000);
  const image = String(body.image || "").trim().slice(0, 500000) || "assets/nitro.svg";
  const service = body.service ? 1 : 0;
  const assignedPartnerEmail = (
    effectiveCaller?.role === "partner"
      ? effectiveCaller.email
      : (effectivePartner || body.partnerEmail || "")
  ).trim().toLowerCase() || null;

  let baseSlug = slugify(name) || "item";
  let id = baseSlug;
  const defaultCollision = products.some(p => p.id === id);
  const customCollision = await db.prepare("SELECT id FROM custom_products WHERE id = ?").get(id);
  if (defaultCollision || customCollision) {
    id = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  let features = [];
  if (Array.isArray(body.features)) {
    features = body.features.map(f => String(f).trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10);
  } else if (typeof body.featuresText === "string" || typeof body.features === "string") {
    const raw = typeof body.featuresText === "string" ? body.featuresText : body.features;
    features = raw.split("\n").map(f => f.trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10);
  }
  if (!features.length) {
    features = [
      "Bảo hành đầy đủ suốt thời hạn",
      "Kích hoạt nhanh chóng và uy tín",
    ];
  }

  await db.prepare(`INSERT INTO custom_products (id, name, category, badge, description, image, features_json, detail, service, partner_email, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    id, name, category, badge, description, image, JSON.stringify(features), detail, service, assignedPartnerEmail, effectiveNow, effectiveNow
  );

  if (checkoutNotice !== undefined) {
    await db.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .run("notice:" + id, JSON.stringify(checkoutNotice), effectiveNow);
  }

  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      if (v && v.name && v.price != null) {
        await addCustomVariant(db, id, v, effectiveNow);
      }
    }
  }

  if (body.stock !== undefined || body.soldCount !== undefined) {
    const stock = body.stock !== undefined && body.stock !== null ? integer(Number(body.stock), 0, 1000000, "Số lượng còn") : 99;
    const soldCount = body.soldCount !== undefined && body.soldCount !== null ? integer(Number(body.soldCount), 0, 10000000, "Số lượng đã bán") : 0;
    await db.prepare(`INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
      VALUES (?, '', ?, ?, ?)
      ON CONFLICT(product_id, variant_id) DO UPDATE SET stock = excluded.stock, sold_count = excluded.sold_count, updated_at = excluded.updated_at`)
      .run(id, stock, soldCount, effectiveNow);
  }

  return (await getCatalog(db, effectiveNow, true)).find(p => p.id === id);
}

export async function addCustomVariant(db, productId, body, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const catalog = await getCatalog(db, effectiveNow, true);
  const product = catalog.find(p => p.id === productId);
  if (!product) throw fail("Không tìm thấy mặt hàng.", 404);

  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên gói sản phẩm cần từ 1 đến 100 ký tự.");
  const price = integer(Number(body.price), 0, 1000000000, "Giá gói");
  const deliveryType = String(body.deliveryType || "gift").trim().slice(0, 50) || "gift";
  const note = String(body.note || "").trim().slice(0, 200);

  let baseSlug = slugify(name) || "pkg";
  let id = baseSlug;
  const existing = (product.variants || []).some(v => v.id === id);
  if (existing) {
    id = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  }

  await db.prepare(`INSERT INTO custom_variants (id, product_id, name, price, delivery_type, note, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    id, productId, name, price, deliveryType, note, effectiveNow, effectiveNow
  );

  return { id, productId, name, price, deliveryType, note, isActive: true, isCustom: true };
}

export async function toggleProductStatus(db, productId, isActive, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const custom = await db.prepare("SELECT * FROM custom_products WHERE id = ?").get(productId);
  if (custom) {
    await db.prepare("UPDATE custom_products SET is_active = ?, updated_at = ? WHERE id = ?").run(isActive ? 1 : 0, effectiveNow, productId);
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền quản lý mặt hàng của chính mình.", 403);
    const isDefault = products.some(p => p.id === productId);
    if (!isDefault) throw fail("Không tìm thấy mặt hàng.", 404);
    await db.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
      .run("product:" + productId, isActive ? 1 : 0, effectiveNow);
  }
  return { productId, isActive };
}

export async function updateProduct(db, productId, body, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const checkoutNotice = parseCheckoutNotice(body.checkoutNotice);
  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên mặt hàng cần từ 1 đến 100 ký tự.");
  const category = String(body.category || "entertainment").trim();
  const description = String(body.description || "").trim().slice(0, 500);
  const badge = String(body.badge || "").trim().slice(0, 50) || category.toUpperCase();
  const detail = String(body.detail !== undefined ? body.detail : (body.description || "")).trim().slice(0, 2000);
  const image = String(body.image || "").trim().slice(0, 500000) || "assets/nitro.svg";

  let features = undefined;
  if (Array.isArray(body.features)) {
    features = body.features.map(f => String(f).trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10);
  } else if (typeof body.featuresText === "string" || typeof body.features === "string") {
    const raw = typeof body.featuresText === "string" ? body.featuresText : body.features;
    features = raw.split("\n").map(f => f.trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10);
  }

  const custom = await db.prepare("SELECT * FROM custom_products WHERE id = ?").get(productId);
  if (custom) {
    const nextPartnerEmail = effectiveCaller && effectiveCaller.role === "admin" && body.partnerEmail !== undefined
      ? (body.partnerEmail ? String(body.partnerEmail).trim().toLowerCase() : null)
      : custom.partner_email;
    const nextFeaturesJson = features !== undefined ? JSON.stringify(features) : custom.features_json;
    await db.prepare(`UPDATE custom_products SET name = ?, category = ?, badge = ?, description = ?, image = ?, detail = ?, features_json = ?, partner_email = ?, updated_at = ? WHERE id = ?`)
      .run(name, category, badge, description, image, detail, nextFeaturesJson, nextPartnerEmail, effectiveNow, productId);
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền quản lý mặt hàng của chính mình.", 403);
    const isDefault = products.some(p => p.id === productId);
    if (!isDefault) throw fail("Không tìm thấy mặt hàng.", 404);
    const existingRow = await db.prepare("SELECT data_json FROM catalog_item_overrides WHERE item_key = ?").get("product:" + productId);
    const existingData = existingRow ? JSON.parse(existingRow.data_json) : {};
    const overrideData = { ...existingData, name, category, badge, description, image, detail };
    if (features !== undefined) {
      overrideData.features = features;
    }
    await db.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .run("product:" + productId, JSON.stringify(overrideData), effectiveNow);
  }
  if (checkoutNotice !== undefined) {
    await db.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .run('notice:' + productId, JSON.stringify(checkoutNotice), effectiveNow);
  }
  if (body.stock !== undefined || body.soldCount !== undefined) {
    let existing = null;
    try {
      existing = await db.prepare("SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ''").get(productId);
    } catch {}
    const nextStock = body.stock !== undefined && body.stock !== null ? integer(Number(body.stock), 0, 1000000, "Số lượng còn") : (existing ? existing.stock : 99);
    const nextSold = body.soldCount !== undefined && body.soldCount !== null ? integer(Number(body.soldCount), 0, 10000000, "Số lượng đã bán") : (existing ? existing.sold_count : 0);
    await db.prepare(`INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
      VALUES (?, '', ?, ?, ?)
      ON CONFLICT(product_id, variant_id) DO UPDATE SET stock = excluded.stock, sold_count = excluded.sold_count, updated_at = excluded.updated_at`)
      .run(productId, nextStock, nextSold, effectiveNow);
  }
  return (await getCatalog(db, effectiveNow, true)).find(p => p.id === productId);
}

export async function deleteProduct(db, productId, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const custom = await db.prepare("SELECT * FROM custom_products WHERE id = ?").get(productId);
  if (custom) {
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM custom_products WHERE id = ?").run(productId);
      await tx.prepare("DELETE FROM custom_variants WHERE product_id = ?").run(productId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ?").run(productId);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("product:" + productId);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("notice:" + productId);
      await tx.prepare("DELETE FROM product_inventory WHERE product_id = ?").run(productId);
    });
    return { productId, deleted: true };
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền xóa mặt hàng của chính mình.", 403);
    const isDefault = products.some(p => p.id === productId);
    if (!isDefault) throw fail("Không tìm thấy mặt hàng.", 404);
    await db.transaction(async (tx) => {
      await tx.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
        .run("product:" + productId, -1, effectiveNow);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("product:" + productId);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("notice:" + productId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ?").run(productId);
      await tx.prepare("DELETE FROM product_inventory WHERE product_id = ?").run(productId);
    });
    return { productId, deleted: true };
  }
}

export async function toggleVariantStatus(db, productId, variantId, isActive, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const custom = await db.prepare("SELECT * FROM custom_variants WHERE product_id = ? AND id = ?").get(productId, variantId);
  if (custom) {
    await db.prepare("UPDATE custom_variants SET is_active = ?, updated_at = ? WHERE product_id = ? AND id = ?")
      .run(isActive ? 1 : 0, effectiveNow, productId, variantId);
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền quản lý mặt hàng của chính mình.", 403);
    const defaultProduct = products.find(p => p.id === productId);
    const defaultVariant = defaultProduct?.variants?.some(v => v.id === variantId);
    if (!defaultVariant) throw fail("Không tìm thấy gói sản phẩm.", 404);
    await db.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
      .run("variant:" + productId + ":" + variantId, isActive ? 1 : 0, effectiveNow);
  }
  return { productId, variantId, isActive };
}

export async function updateVariant(db, productId, variantId, body, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const name = String(body.name || "").trim();
  if (!name || name.length > 100) throw fail("Tên gói sản phẩm cần từ 1 đến 100 ký tự.");
  const price = integer(Number(body.price), 0, 1000000000, "Giá gói");
  const deliveryType = String(body.deliveryType || "gift").trim().slice(0, 50) || "gift";
  const note = String(body.note || "").trim().slice(0, 200);

  const custom = await db.prepare("SELECT * FROM custom_variants WHERE product_id = ? AND id = ?").get(productId, variantId);
  if (custom) {
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE custom_variants SET name = ?, price = ?, delivery_type = ?, note = ?, updated_at = ? WHERE product_id = ? AND id = ?`)
        .run(name, price, deliveryType, note, effectiveNow, productId, variantId);
      await tx.prepare(`INSERT INTO product_prices (product_id, variant_id, price, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(product_id, variant_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`)
        .run(productId, variantId, price, effectiveNow);
      if (body.stock !== undefined || body.soldCount !== undefined) {
        let existing = null;
        try {
          existing = await tx.prepare("SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ?").get(productId, variantId);
        } catch {}
        const nextStock = body.stock !== undefined && body.stock !== null ? integer(Number(body.stock), 0, 1000000, "Số lượng còn") : (existing ? existing.stock : 99);
        const nextSold = body.soldCount !== undefined && body.soldCount !== null ? integer(Number(body.soldCount), 0, 10000000, "Số lượng đã bán") : (existing ? existing.sold_count : 0);
        await tx.prepare(`INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(product_id, variant_id) DO UPDATE SET stock = excluded.stock, sold_count = excluded.sold_count, updated_at = excluded.updated_at`)
          .run(productId, variantId, nextStock, nextSold, effectiveNow);
      }
    });
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền quản lý mặt hàng của chính mình.", 403);
    const defaultProduct = products.find(p => p.id === productId);
    const defaultVariant = defaultProduct?.variants?.some(v => v.id === variantId);
    if (!defaultVariant) throw fail("Không tìm thấy gói sản phẩm.", 404);
    const overrideData = { name, deliveryType, note, price };
    await db.transaction(async (tx) => {
      await tx.prepare(`INSERT INTO catalog_item_overrides (item_key, data_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(item_key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
        .run("variant:" + productId + ":" + variantId, JSON.stringify(overrideData), effectiveNow);
      await tx.prepare(`INSERT INTO product_prices (product_id, variant_id, price, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(product_id, variant_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`)
        .run(productId, variantId, price, effectiveNow);
      if (body.stock !== undefined || body.soldCount !== undefined) {
        let existing = null;
        try {
          existing = await tx.prepare("SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ?").get(productId, variantId);
        } catch {}
        const nextStock = body.stock !== undefined && body.stock !== null ? integer(Number(body.stock), 0, 1000000, "Số lượng còn") : (existing ? existing.stock : 99);
        const nextSold = body.soldCount !== undefined && body.soldCount !== null ? integer(Number(body.soldCount), 0, 10000000, "Số lượng đã bán") : (existing ? existing.sold_count : 0);
        await tx.prepare(`INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(product_id, variant_id) DO UPDATE SET stock = excluded.stock, sold_count = excluded.sold_count, updated_at = excluded.updated_at`)
          .run(productId, variantId, nextStock, nextSold, effectiveNow);
      }
    });
  }
  const cat = await getCatalog(db, effectiveNow, true);
  const prod = cat.find(p => p.id === productId);
  return prod?.variants?.find(v => v.id === variantId);
}

export async function deleteVariant(db, productId, variantId, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  await assertProductOwner(db, productId, effectiveCaller);
  const custom = await db.prepare("SELECT * FROM custom_variants WHERE product_id = ? AND id = ?").get(productId, variantId);
  if (custom) {
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM custom_variants WHERE product_id = ? AND id = ?").run(productId, variantId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ?").run(productId, variantId);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("variant:" + productId + ":" + variantId);
      await tx.prepare("DELETE FROM product_inventory WHERE product_id = ? AND variant_id = ?").run(productId, variantId);
    });
    return { productId, variantId, deleted: true };
  } else {
    if (effectiveCaller && effectiveCaller.role === "partner") throw fail("Bạn chỉ có quyền quản lý mặt hàng của chính mình.", 403);
    const defaultProduct = products.find(p => p.id === productId);
    const defaultVariant = defaultProduct?.variants?.some(v => v.id === variantId);
    if (!defaultVariant) throw fail("Không tìm thấy gói sản phẩm.", 404);
    await db.transaction(async (tx) => {
      await tx.prepare(`INSERT INTO catalog_item_status (item_key, is_active, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(item_key) DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`)
        .run("variant:" + productId + ":" + variantId, -1, effectiveNow);
      await tx.prepare("DELETE FROM catalog_item_overrides WHERE item_key = ?").run("variant:" + productId + ":" + variantId);
      await tx.prepare("DELETE FROM product_prices WHERE product_id = ? AND variant_id = ?").run(productId, variantId);
      await tx.prepare("DELETE FROM product_inventory WHERE product_id = ? AND variant_id = ?").run(productId, variantId);
    });
    return { productId, variantId, deleted: true };
  }
}

// Mọi giá trị thanh toán đều được tính lại từ dữ liệu của shop, không lấy giá do trình duyệt gửi lên.
export async function quoteOrder(db, items, couponCode = "", userId = null, now = Date.now()) {
  const catalog = await getCatalog(db, now);
  const result = validateOrderItems(items, catalog);
  const enriched = result.validatedItems.map(item => {
    const prod = catalog.find(p => p.id === item.productId);
    const variant = prod?.variants?.find(v => v.id === item.variantId);
    return {
      ...item,
      basePrice: variant ? variant.basePrice : item.price,
      sale: variant ? variant.sale : null,
      partnerEmail: prod?.partnerEmail || null,
    };
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

    const isPartnerCoupon = Boolean(rule.partnerEmail);
    const eligibleItems = enriched.filter(i => applies(rule, i.productId));
    const eligible = eligibleItems.reduce((sum, i) => sum + i.subtotal, 0);
    if (eligible === 0) throw fail("Giỏ hàng chưa có sản phẩm đủ điều kiện dùng mã.");

    const minOrderBase = isPartnerCoupon ? eligible : result.total;
    if (minOrderBase < rule.minOrder) {
      if (isPartnerCoupon) {
        throw fail(`Mã yêu cầu tổng tiền các sản phẩm của đối tác từ ${rule.minOrder.toLocaleString("vi-VN")}₫.`);
      }
      throw fail(`Mã yêu cầu đơn từ ${rule.minOrder.toLocaleString("vi-VN")}₫ sau giảm giá sản phẩm.`);
    }

    if (!rule.stackWithSale) {
      const partnerSaleDiscount = eligibleItems.reduce((sum, i) => sum + (i.basePrice * i.quantity - i.subtotal), 0);
      const hasSale = isPartnerCoupon ? (partnerSaleDiscount > 0) : (saleDiscount > 0);
      if (hasSale) throw fail("Mã này không kết hợp với sản phẩm đang giảm giá.");
    }

    couponDiscount = discount(eligible, rule);
    coupon = { id: rule.id, code, name: rule.name, partnerEmail: rule.partnerEmail || null };
  }
  const quote = { ...result, validatedItems: enriched, subtotal, saleDiscount, couponDiscount, total: result.total - couponDiscount, coupon };
  // Dấu đối chiếu giúp phát hiện giá thay đổi trước lúc khách xác nhận trả tiền.
  quote.fingerprint = createHash("sha256").update(JSON.stringify(quote)).digest("hex");
  return quote;
}

export async function getInventory(db) {
  try {
    const rows = await db.prepare("SELECT * FROM product_inventory").all();
    const inventory = {};
    for (const r of rows) {
      if (!inventory[r.product_id]) {
        inventory[r.product_id] = { stock: 99, soldCount: 0, variants: {} };
      }
      if (!r.variant_id) {
        inventory[r.product_id].stock = Number(r.stock);
        inventory[r.product_id].soldCount = Number(r.sold_count);
      } else {
        inventory[r.product_id].variants[r.variant_id] = {
          stock: Number(r.stock),
          soldCount: Number(r.sold_count),
        };
      }
    }
    return inventory;
  } catch {
    return {};
  }
}

export async function updateInventory(db, payload, now = Date.now(), caller = null) {
  const { now: effectiveNow, caller: effectiveCaller } = normalizeNowCaller(now, caller);
  const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : [payload]);
  if (!items.length) throw fail("Dữ liệu cập nhật kho không hợp lệ.");

  const results = [];
  await db.transaction(async (tx) => {
    for (const item of items) {
      const productId = String(item.productId || "").trim();
      if (!productId) throw fail("Mã mặt hàng không hợp lệ.");
      await assertProductOwner(tx, productId, effectiveCaller);

      const variantId = String(item.variantId || "").trim();
      const stock = item.stock !== undefined && item.stock !== null
        ? integer(Number(item.stock), 0, 1000000, "Số lượng còn lại")
        : null;
      const soldCount = item.soldCount !== undefined && item.soldCount !== null
        ? integer(Number(item.soldCount), 0, 10000000, "Số lượng đã bán")
        : null;

      if (stock === null && soldCount === null) throw fail("Cần nhập số lượng hàng còn hoặc số lượng đã bán.");

      let existing = null;
      try {
        existing = await tx.prepare("SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ?").get(productId, variantId);
      } catch {}

      const nextStock = stock !== null ? stock : (existing ? existing.stock : 99);
      const nextSold = soldCount !== null ? soldCount : (existing ? existing.sold_count : 0);

      await tx.prepare(`
        INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(product_id, variant_id) DO UPDATE SET
          stock = excluded.stock,
          sold_count = excluded.sold_count,
          updated_at = excluded.updated_at
      `).run(productId, variantId, nextStock, nextSold, effectiveNow);

      results.push({ productId, variantId, stock: nextStock, soldCount: nextSold });
    }
  });

  return results.length === 1 ? results[0] : results;
}

