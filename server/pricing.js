import { randomUUID, createHash } from "node:crypto";
import { products, validateOrderItems } from "./catalog.js";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw fail(`${label} không hợp lệ.`);
  return value;
};
const optionalInteger = (value, max, label) => value == null ? null : integer(value, 1, max, label);
const mapRule = (row) => ({ ...JSON.parse(row.rules_json), id: row.id, kind: row.kind, code: row.code, updatedAt: row.updated_at });

export function listPromotions(db, now = Date.now()) {
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM order_pricing op JOIN orders o ON o.id = op.order_id
    WHERE op.coupon_id = p.id AND o.status != 'cancelled') AS used FROM promotions p ORDER BY p.updated_at DESC, p.id`).all().map(row => {
    const rule = mapRule(row);
    const status = !rule.enabled ? "disabled" : rule.endsAt != null && now >= rule.endsAt ? "expired"
      : rule.startsAt != null && now < rule.startsAt ? "scheduled"
      : rule.usageLimit != null && row.used >= rule.usageLimit ? "exhausted" : "active";
    return { ...rule, used: row.used, status };
  });
}

export function savePromotion(db, body, id = null, now = Date.now()) {
  const old = id ? db.prepare("SELECT * FROM promotions WHERE id = ?").get(id) : null;
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
  if (code && db.prepare("SELECT id FROM promotions WHERE code = ? AND id != ?").get(code, id || "")) throw fail("Mã giảm giá này đã tồn tại.", 409);
  id ||= randomUUID();
  db.prepare(`INSERT INTO promotions (id, kind, code, rules_json, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET code = excluded.code, rules_json = excluded.rules_json, updated_at = excluded.updated_at`)
    .run(id, body.kind, code, JSON.stringify(rule), now);
  return listPromotions(db, now).find(p => p.id === id);
}

export function setPromotionEnabled(db, id, enabled) {
  if (typeof enabled !== "boolean") throw fail("Trạng thái không hợp lệ.");
  const row = db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
  if (!row) throw fail("Không tìm thấy ưu đãi.", 404);
  return savePromotion(db, { ...mapRule(row), enabled }, id);
}

export function savePrices(db, changes, now = Date.now()) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw fail("Danh sách giá không hợp lệ.");
  const seen = new Set();
  for (const item of changes) {
    const product = products.find(p => p.id === item?.productId && !p.service);
    if (!product?.variants.some(v => v.id === item.variantId)) throw fail("Không tìm thấy gói sản phẩm.");
    const key = `${item.productId}:${item.variantId}`;
    if (seen.has(key)) throw fail("Một gói sản phẩm bị lặp lại.");
    seen.add(key);
    if (item.price !== null) integer(item.price, 0, 1000000000, "Giá bán (VND)");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const item of changes) {
      if (item.price === null) db.prepare("DELETE FROM product_prices WHERE product_id = ? AND variant_id = ?").run(item.productId, item.variantId);
      else db.prepare(`INSERT INTO product_prices (product_id, variant_id, price, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(product_id, variant_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`)
        .run(item.productId, item.variantId, item.price, now);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

const active = (rule, now) => rule.enabled && (rule.startsAt == null || now >= rule.startsAt) && (rule.endsAt == null || now < rule.endsAt);
const applies = (rule, id) => !rule.productIds.length || rule.productIds.includes(id);
const discount = (amount, rule) => Math.min(amount, rule.type === "percent" ? Math.floor(amount * rule.value / 100) : rule.value, rule.maxDiscount ?? Infinity);

export function getCatalog(db, now = Date.now()) {
  const overrides = new Map(db.prepare("SELECT * FROM product_prices").all().map(r => [`${r.product_id}:${r.variant_id}`, r.price]));
  const campaigns = db.prepare("SELECT * FROM promotions WHERE kind = 'campaign'").all().map(mapRule).filter(r => active(r, now));
  return products.map(p => ({ ...p, variants: p.variants.map(v => {
    const basePrice = overrides.get(`${p.id}:${v.id}`) ?? v.price;
    let amount = 0, sale = null;
    for (const rule of campaigns) {
      const savings = applies(rule, p.id) ? discount(basePrice, rule) : 0;
      if (savings > amount) { amount = savings; sale = { id: rule.id, name: rule.name, endsAt: rule.endsAt }; }
    }
    return { ...v, defaultPrice: v.price, basePrice, price: basePrice - amount, sale };
  }) }));
}

// Mọi giá trị thanh toán đều được tính lại từ dữ liệu của shop, không lấy giá do trình duyệt gửi lên.
export function quoteOrder(db, items, couponCode = "", userId = null, now = Date.now()) {
  const catalog = getCatalog(db, now);
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
    const row = db.prepare("SELECT * FROM promotions WHERE kind = 'coupon' AND code = ?").get(code);
    if (!row || !active(mapRule(row), now)) throw fail("Mã giảm giá không tồn tại, chưa bắt đầu hoặc đã hết hạn.");
    const rule = mapRule(row);
    const usage = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(o.user_id = ?), 0) AS personal
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
