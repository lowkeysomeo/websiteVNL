import vm from "node:vm";
import { readFileSync } from "node:fs";

const catalogCode = readFileSync(
  new URL("../products.js", import.meta.url),
  "utf8",
);
const rawProducts = vm.runInNewContext(catalogCode + "; products;");

export const products = rawProducts;

export function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    const error = new Error("Giỏ hàng của bạn đang trống hoặc không hợp lệ.");
    error.status = 400;
    throw error;
  }

  let total = 0;
  let hasLogItems = false;
  const validatedItems = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      const error = new Error("Mục sản phẩm không hợp lệ.");
      error.status = 400;
      throw error;
    }

    const product = products.find((p) => p.id === item.productId);
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

    const isLog = variant.deliveryType === "log";
    if (isLog) hasLogItems = true;

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

  return { validatedItems, total, hasLogItems };
}
