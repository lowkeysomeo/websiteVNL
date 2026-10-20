import vm from "node:vm";
import { readFileSync } from "node:fs";

const catalogCode = readFileSync(
  new URL("../products.js", import.meta.url),
  "utf8",
);
const rawProducts = vm.runInNewContext(catalogCode + "; products;");

export const products = rawProducts;

export function validateOrderItems(items, catalog = products) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    const error = new Error("Giỏ hàng của bạn đang trống hoặc không hợp lệ.");
    error.status = 400;
    throw error;
  }

  let total = 0;
  let hasLogItems = false;
  let hasBoostItems = false;
  let hasTokenItems = false;
  const validatedItems = [];

  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object") {
      const error = new Error("Mục sản phẩm không hợp lệ.");
      error.status = 400;
      throw error;
    }

    let product = catalog.find((p) => p.id === item.productId);
    if (!product && item.productId === "decor") {
      product = catalog.find((p) => p.variants?.some((v) => v.id === item.variantId));
    }
    if (!product || product.service) {
      const error = new Error(
        `Sản phẩm "${item.productId}" không tồn tại hoặc yêu cầu tư vấn riêng.`,
      );
      error.status = 400;
      throw error;
    }

    const variant = product.variants?.find((v) => v.id === item.variantId);
    if (!variant) {
      const error = new Error(
        `Gói sản phẩm "${item.variantId}" không hợp lệ.`,
      );
      error.status = 400;
      throw error;
    }

    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
      const error = new Error("Số lượng mỗi sản phẩm phải từ 1 đến 10.");
      error.status = 400;
      throw error;
    }

    const key = product.id + ':' + variant.id;
    quantities.set(key, (quantities.get(key) || 0) + quantity);
    if (quantities.get(key) > 10) throw Object.assign(new Error("Tối đa 10 gói cùng loại trong một đơn."), { status: 400 });

    const isLog = variant.deliveryType === "log";
    if (isLog) hasLogItems = true;
    if (product.id === "boost") hasBoostItems = true;
    if (Boolean(product.requiresToken)) hasTokenItems = true;

    const subtotal = variant.price * quantity;
    total += subtotal;

    validatedItems.push({
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantName: variant.name,
      price: variant.price,
      quantity,
      deliveryType: variant.deliveryType || "gift",
      subtotal,
    });
  }

  return { validatedItems, total, hasLogItems, hasBoostItems, hasTokenItems };
}
