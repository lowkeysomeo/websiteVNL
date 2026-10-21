import { quoteOrder } from "./pricing.js";
import { randomUUID, randomBytes } from "node:crypto";
import { passwordHash, digest, equal } from "./security.js";
export { openStore } from "./database.js";

export async function balance(db, userId) {
  const depositSum = (
    await db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE user_id = ?",
      )
      .get(userId)
  ).total;
  const orderSpent = (
    await db
      .prepare(
        "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE user_id = ? AND payment_method = 'wallet' AND status != 'cancelled'",
      )
      .get(userId)
  ).total;
  return depositSum - orderSpent;
}

const BANK_ALIASES = [
  { bin: "970415", codes: ["icb", "ctg", "vietinbank", "vietin", "congthuong", "970415"] },
  { bin: "970436", codes: ["vcb", "vietcombank", "vietcom", "ngoathuong", "970436"] },
  { bin: "970422", codes: ["mb", "mbb", "mbbank", "quandoi", "970422"] },
  { bin: "970407", codes: ["tcb", "techcombank", "techcom", "kythuong", "970407"] },
  { bin: "970418", codes: ["bidv", "dautuvaphattrien", "970418"] },
  { bin: "970416", codes: ["acb", "achau", "asiacommercial", "970416"] },
  { bin: "970432", codes: ["vpb", "vpbank", "thinhvuong", "970432"] },
  { bin: "970423", codes: ["tpb", "tpbank", "tienphong", "970423"] },
  { bin: "970405", codes: ["vba", "agribank", "nongnghiep", "varb", "970405"] },
  { bin: "970403", codes: ["stb", "sacombank", "saigonthuongtin", "970403"] },
  { bin: "970437", codes: ["hdb", "hdbank", "phattrien", "970437"] },
  { bin: "970441", codes: ["vib", "quocte", "970441"] },
  { bin: "970443", codes: ["shb", "saigonhanoi", "970443"] },
  { bin: "970448", codes: ["ocb", "phuongdong", "970448"] },
  { bin: "970426", codes: ["msb", "hanghai", "maritimebank", "970426"] },
  { bin: "970440", codes: ["seab", "seabank", "dongabank", "970440"] },
  { bin: "970449", codes: ["lpb", "lpbank", "lienviet", "lienvietpostbank", "970449"] },
  { bin: "970428", codes: ["nab", "namabank", "namachau", "970428"] },
  { bin: "970431", codes: ["eib", "eximbank", "xuatnhapkhau", "970431"] },
  { bin: "970438", codes: ["bvb", "baovietbank", "baoviet", "970438"] },
  { bin: "970454", codes: ["vietcapital", "vietcapitalbank", "banviet", "bvbank", "970454"] },
  { bin: "970429", codes: ["scb", "saigon", "970429"] },
  { bin: "970452", codes: ["kienlong", "kienlongbank", "klb", "970452"] },
  { bin: "970457", codes: ["woori", "wooribank", "970457"] },
  { bin: "970458", codes: ["uob", "unitedoverseas", "970458"] },
  { bin: "970462", codes: ["cake", "cakebyvpbank", "970462"] },
  { bin: "970463", codes: ["ubank", "970463"] },
  { bin: "970466", codes: ["timoplus", "timo", "970466"] },
];

function normalizeBankIdentifier(val) {
  if (!val) return "";
  return String(val)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function isBankMatch(eventGateway, bankGateway, bankCode) {
  const event = normalizeBankIdentifier(eventGateway);
  const configured = [bankGateway, bankCode].map(normalizeBankIdentifier).filter(Boolean);
  if (!event || !configured.length) return false;
  if (configured.includes(event)) return true;

  // Chỉ đối chiếu tên/mã đầy đủ; không nhận một phần tên ngân hàng.
  return BANK_ALIASES.some(({ codes }) =>
    codes.includes(event) && configured.some(value => codes.includes(value)),
  );
}

function extractDepositCode(event) {
  const codes = new Set();
  const explicit = String(event.code || "").toUpperCase().trim();
  if (/^VNL[A-F0-9]{12}$/.test(explicit)) codes.add(explicit);

  const fields = [
    event.content,
    event.description,
    event.referenceCode,
    event.reference,
    event.orderCode,
    event.order_code,
    event.memo,
    event.note,
  ];

  for (const field of fields) {
    if (!field || typeof field !== "string") continue;
    const upper = field.toUpperCase();
    const stripped = upper
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Đ/g, "D");

    for (const match of stripped.matchAll(
      /(?:^|[^A-Z0-9])(VNL[A-F0-9]{12})(?=$|[^A-Z0-9])/g,
    )) {
      codes.add(match[1]);
    }
  }

  if (codes.size === 0) {
    for (const field of fields) {
      if (!field || typeof field !== "string") continue;
      const stripped = field
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Đ/g, "D");
      for (const match of stripped.matchAll(/VNL[A-F0-9]{12}/g)) {
        codes.add(match[0]);
      }
    }
  }

  return codes.size === 1 ? [...codes][0] : null;
}

// The event, ledger entry and deposit status commit together. A retry cannot add money twice.
export async function processTransfer(db, event, bank, now = Date.now(), autoCredit = true) {
  const id = String(event.id ?? event.transaction_id ?? "");
  const rawAmount = event.transferAmount !== undefined ? event.transferAmount : event.amount;
  if (
    !/^\d{1,30}$/.test(id) ||
    typeof rawAmount !== "number" ||
    !Number.isSafeInteger(rawAmount) ||
    rawAmount <= 0 ||
    rawAmount > 1000000000
  ) {
    const error = new Error("Dữ liệu giao dịch không hợp lệ.");
    error.status = 400;
    throw error;
  }
  const transferAmount = rawAmount;
  const reference =
    typeof event.referenceCode === "string" && event.referenceCode.trim()
      ? event.referenceCode.trim().slice(0, 160)
      : (typeof event.reference === "string" && event.reference.trim() ? event.reference.trim().slice(0, 160) : null);
  const code = extractDepositCode(event);
  return db.transaction(async (db) => {
    const duplicate = await db
      .prepare(
        "SELECT outcome FROM bank_events WHERE transaction_id = ? OR (? IS NOT NULL AND reference = ?)",
      )
      .get(id, reference, reference);
    if (duplicate) {
      return { outcome: "duplicate" };
    }
    const deposit = code
      ? await db.prepare("SELECT * FROM deposits WHERE code = ?").get(code)
      : null;
    let outcome = "unmatched";
    const rawType = String(event.transferType || event.type || "")
      .trim()
      .toLowerCase();
    const isOutgoing = ["out", "outgoing", "debit", "d", "-"].includes(rawType);

    const gatewayMatch = isBankMatch(event.gateway, bank.gateway, bank.code);

    const cleanAcc = (value) => {
      const formatted = String(value || "").trim();
      return /^[\d\s-]+$/.test(formatted) ? formatted.replace(/[\s-]/g, "") : "";
    };
    const eventAcc = cleanAcc(event.accountNumber || event.account_number);
    const bankAcc = cleanAcc(bank.accountNumber);
    const accMatch = Boolean(eventAcc && bankAcc && eventAcc === bankAcc);

    if (isOutgoing) outcome = "outgoing";
    else if (!["in", "incoming", "credit"].includes(rawType)) outcome = "invalid_direction";
    else if (!accMatch || !gatewayMatch)
      outcome = "wrong_account";
    else if (deposit) {
      if (deposit.status === "credited") outcome = "already_paid";
      else if (deposit.status !== "pending" || deposit.expires_at < now)
        outcome = "review";
      else if (deposit.amount !== transferAmount) outcome = "review";
      else outcome = autoCredit ? "credited" : "review";
    }
    await db
      .prepare(
        "INSERT INTO bank_events (transaction_id, reference, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        reference,
        deposit?.id ?? null,
        transferAmount,
        outcome,
        now,
      );
    if (outcome === "credited") {
      await db
        .prepare(
          "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          deposit.user_id,
          deposit.id,
          id,
          transferAmount,
          now,
        );
      await db
        .prepare(
          "UPDATE deposits SET status = 'credited', credited_at = ? WHERE id = ?",
        )
        .run(now, deposit.id);
    } else if (outcome === "review" && deposit?.status !== "credited") {
      await db
        .prepare("UPDATE deposits SET status = 'review' WHERE id = ?")
        .run(deposit.id);
    }
    return { outcome, depositCode: code, amount: transferAmount };
  });
}

export async function createOrder(db, orderData) {
  const {
    userId,
    customerName,
    customerEmail,
    customerNote = "",
    items: inputItems,
    total: inputTotal,
    paymentMethod = "wallet",
    hasLogItems = 0,
    discordAccount = null,
    discordPassword = null,
    backupCodes = null,
    serverInvite = null,
    decorImage = null,
    discordToken = null,
    now = Date.now(),
  } = orderData;

  return db.transaction(async (tx) => {
    const pricing = orderData.requestItems
      ? await quoteOrder(tx, orderData.requestItems, orderData.couponCode, userId, now)
      : null;
    if (
      orderData.quoteFingerprint !== undefined &&
      orderData.quoteFingerprint !== pricing?.fingerprint
    ) {
      throw Object.assign(
        new Error(
          "Giá hoặc ưu đãi đã thay đổi. Hãy kiểm tra lại tổng tiền trước khi xác nhận.",
        ),
        { status: 409 },
      );
    }
    const items = pricing?.validatedItems ?? inputItems;
    const total = pricing?.total ?? inputTotal;

    if (paymentMethod === "wallet") {
      if (!userId) {
        const error = new Error(
          "Vui lòng đăng nhập tài khoản để thanh toán bằng ví.",
        );
        error.status = 401;
        throw error;
      }
      const currentBalance = await balance(tx, userId);
      if (currentBalance < total) {
        const formattedBalance = new Intl.NumberFormat("vi-VN").format(
          currentBalance,
        );
        const formattedTotal = new Intl.NumberFormat("vi-VN").format(total);
        const error = new Error(
          `Số dư ví không đủ (hiện có: ${formattedBalance}₫, cần thanh toán: ${formattedTotal}₫). Vui lòng nạp thêm tiền.`,
        );
        error.status = 400;
        throw error;
      }
    }

    // Kiểm tra và trừ số lượng hàng còn trong kho, tăng số lượng đã bán theo thời gian thật
    for (const item of (items || [])) {
      const qty = Number(item.quantity) || 1;
      let currentStock = 99;
      let currentSold = 0;
      try {
        const invRow = await tx.prepare(
          "SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ''"
        ).get(item.productId);
        if (invRow) {
          currentStock = Number(invRow.stock);
          currentSold = Number(invRow.sold_count);
        }
      } catch {}

      if (currentStock < qty) {
        throw Object.assign(
          new Error(`Mặt hàng "${item.name || item.productId}" đã hết hàng hoặc không đủ số lượng trong kho (còn ${currentStock}).`),
          { status: 400 }
        );
      }

      const nextStock = Math.max(0, currentStock - qty);
      const nextSold = currentSold + qty;

      try {
        await tx.prepare(`
          INSERT INTO product_inventory (product_id, variant_id, stock, sold_count, updated_at)
          VALUES (?, '', ?, ?, ?)
          ON CONFLICT(product_id, variant_id) DO UPDATE SET
            stock = excluded.stock,
            sold_count = excluded.sold_count,
            updated_at = excluded.updated_at
        `).run(item.productId, nextStock, nextSold, now);

        if (item.variantId) {
          const vRow = await tx.prepare(
            "SELECT stock, sold_count FROM product_inventory WHERE product_id = ? AND variant_id = ?"
          ).get(item.productId, item.variantId);
          if (vRow) {
            await tx.prepare(`
              UPDATE product_inventory SET
                stock = MAX(0, stock - ?),
                sold_count = sold_count + ?,
                updated_at = ?
              WHERE product_id = ? AND variant_id = ?
            `).run(qty, qty, now, item.productId, item.variantId);
          }
        }
      } catch (err) {
        console.error("[Inventory deduction error]", err);
      }
    }

    const orderId = "VNL-" + randomBytes(4).toString("hex").toUpperCase();
    const initialStatus = paymentMethod === "wallet" ? "processing" : "pending";

    await tx
      .prepare(
        `INSERT INTO orders (
        id, user_id, customer_name, customer_email, customer_note,
        items_json, total, payment_method, has_log_items,
        discord_account, discord_password, backup_codes, server_invite, decor_image, discord_token, claim_link,
        status, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      )
      .run(
        orderId,
        userId || null,
        customerName,
        customerEmail,
        customerNote,
        JSON.stringify(items),
        total,
        paymentMethod,
        hasLogItems ? 1 : 0,
        discordAccount,
        discordPassword,
        backupCodes,
        serverInvite,
        decorImage,
        discordToken,
        initialStatus,
        now,
      );

    if (pricing) {
      await tx
        .prepare(
          "INSERT INTO order_pricing (order_id, coupon_id, snapshot_json) VALUES (?, ?, ?)",
        )
        .run(orderId, pricing.coupon?.id ?? null, JSON.stringify(pricing));
    }

    return {
      pricing,
      id: orderId,
      userId,
      customerName,
      customerEmail,
      customerNote,
      items,
      total,
      paymentMethod,
      hasLogItems: Boolean(hasLogItems),
      serverInvite,
      decorImage,
      discordToken,
      status: initialStatus,
      createdAt: now,
    };
  });
}

async function orderPricing(db, orderId) {
  const row = await db
    .prepare("SELECT snapshot_json FROM order_pricing WHERE order_id = ?")
    .get(orderId);
  return row ? JSON.parse(row.snapshot_json) : null;
}

// User-facing order history: NEVER returns discord_password or backup_codes
export async function getUserOrders(db, userId, { limit = 50, offset = 0 } = {}) {
  const rows = await db
    .prepare(
      "SELECT o.id, o.customer_name, o.customer_email, o.customer_note, o.items_json, o.total, o.payment_method, o.has_log_items, o.server_invite, o.decor_image, o.discord_token, o.claim_link, o.status, o.created_at, o.completed_at, op.snapshot_json AS pricing_json FROM orders o LEFT JOIN order_pricing op ON op.order_id = o.id WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?",
    )
    .all(userId, limit, offset);
  const messagesByOrder = await attachOrderMessages(db, rows.map((r) => r.id));
  return rows.map((row) => ({
    id: row.id,
    pricing: row.pricing_json ? JSON.parse(row.pricing_json) : null,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerNote: row.customer_note,
    items: JSON.parse(row.items_json),
    total: row.total,
    paymentMethod: row.payment_method,
    hasLogItems: Boolean(row.has_log_items),
    serverInvite: row.server_invite,
    decorImage: row.decor_image || null,
    discordToken: row.discord_token || null,
    claimLink: row.claim_link,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    messages: messagesByOrder.get(row.id) || [],
  }));
}

async function attachOrderMessages(db, orderIds) {
  const messagesByOrder = new Map();
  if (!orderIds || orderIds.length === 0) return messagesByOrder;
  try {
    const placeholders = orderIds.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT id, order_id, sender_role, sender_id, sender_name, message, created_at FROM order_messages WHERE order_id IN (${placeholders}) ORDER BY created_at ASC, rowid ASC`,
      )
      .all(...orderIds);
    for (const r of rows) {
      if (!messagesByOrder.has(r.order_id)) {
        messagesByOrder.set(r.order_id, []);
      }
      messagesByOrder.get(r.order_id).push({
        id: r.id,
        orderId: r.order_id,
        senderRole: r.sender_role,
        senderId: r.sender_id,
        senderName: r.sender_name,
        message: r.message,
        createdAt: r.created_at,
      });
    }
  } catch {
    // Bỏ qua nếu bảng chưa tồn tại
  }
  return messagesByOrder;
}

export async function addOrderMessage(
  db,
  { orderId, senderRole, senderId, senderName, message, now = Date.now() },
) {
  if (!orderId || typeof orderId !== "string") {
    throw Object.assign(new Error("Mã đơn hàng không hợp lệ."), { status: 400 });
  }
  const order = await db
    .prepare("SELECT id, user_id, customer_name, customer_email, items_json FROM orders WHERE id = ?")
    .get(orderId);
  if (!order) {
    throw Object.assign(new Error("Không tìm thấy đơn hàng."), { status: 404 });
  }

  const cleanMsg = typeof message === "string" ? message.trim() : "";
  if (!cleanMsg) {
    throw Object.assign(new Error("Nội dung phản hồi không được để trống."), { status: 400 });
  }
  if (cleanMsg.length > 2000) {
    throw Object.assign(new Error("Nội dung phản hồi quá dài (tối đa 2000 ký tự)."), { status: 400 });
  }
  if (!["admin", "partner", "customer"].includes(senderRole)) {
    throw Object.assign(new Error("Vai trò người gửi không hợp lệ."), { status: 400 });
  }

  const cleanSenderId = String(senderId || "unknown");
  const cleanSenderName = String(
    senderName || (senderRole === "admin" ? "Quản trị viên" : senderRole === "partner" ? "Đối tác shop" : "Khách hàng"),
  ).slice(0, 100);

  const id = "msg_" + randomUUID();
  await db
    .prepare(
      "INSERT INTO order_messages (id, order_id, sender_role, sender_id, sender_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, orderId, senderRole, cleanSenderId, cleanSenderName, cleanMsg, now);

  return {
    id,
    orderId,
    senderRole,
    senderId: cleanSenderId,
    senderName: cleanSenderName,
    message: cleanMsg,
    createdAt: now,
  };
}

export async function getOrderMessages(db, orderId) {
  if (!orderId || typeof orderId !== "string") {
    throw Object.assign(new Error("Mã đơn hàng không hợp lệ."), { status: 400 });
  }
  const rows = await db
    .prepare(
      "SELECT id, order_id, sender_role, sender_id, sender_name, message, created_at FROM order_messages WHERE order_id = ? ORDER BY created_at ASC, rowid ASC",
    )
    .all(orderId);
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    senderRole: r.sender_role,
    senderId: r.sender_id,
    senderName: r.sender_name,
    message: r.message,
    createdAt: r.created_at,
  }));
}

// Tổng đơn đã mua và tiền đã chi của đúng tài khoản đang đăng nhập.
export async function getUserPurchaseStats(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS totalOrders,
    COALESCE(SUM(CASE WHEN status IN ('processing','completed') THEN 1 ELSE 0 END),0) AS purchasedOrders,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),0) AS completedOrders,
    COALESCE(SUM(CASE WHEN status IN ('processing','completed') THEN total ELSE 0 END),0) AS totalSpent
    FROM orders WHERE user_id = ?`).get(userId);
  return Object.fromEntries(Object.entries(row).map(([key,value]) => [key,Number(value)]));
}

// Admin order view: Full credentials only visible to admin or item partner
export async function getAdminOrders(
  db,
  { status, partnerEmail, limit = 50, offset = 0 } = {},
) {
  let partnerProductIds = null;
  if (partnerEmail) {
    try {
      const products = await db.prepare("SELECT id FROM custom_products WHERE LOWER(partner_email) = ?").all(partnerEmail.toLowerCase());
      partnerProductIds = new Set((products || []).map(p => p.id));
    } catch {
      partnerProductIds = new Set();
    }
  }

  let query =
    "SELECT o.*, op.snapshot_json AS pricing_json FROM orders o LEFT JOIN order_pricing op ON op.order_id = o.id";
  const params = [];
  if (
    status &&
    ["pending", "processing", "completed", "cancelled"].includes(status)
  ) {
    query += " WHERE o.status = ?";
    params.push(status);
  }
  query += " ORDER BY o.created_at DESC";

  const allRows = await db.prepare(query).all(...params);
  let orders = allRows.map((row) => ({
    id: row.id,
    pricing: row.pricing_json ? JSON.parse(row.pricing_json) : null,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerNote: row.customer_note,
    items: JSON.parse(row.items_json),
    total: row.total,
    paymentMethod: row.payment_method,
    hasLogItems: Boolean(row.has_log_items),
    discordAccount: row.discord_account,
    discordPassword: row.discord_password,
    discordToken: row.discord_token || null,
    backupCodes: row.backup_codes,
    serverInvite: row.server_invite,
    decorImage: row.decor_image || null,
    claimLink: row.claim_link,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));

  if (partnerProductIds) {
    orders = orders.filter(o => o.items && o.items.some(it => partnerProductIds.has(it.productId)));
  }

  const slicedOrders = orders.slice(offset, offset + limit);
  const messagesByOrder = await attachOrderMessages(db, slicedOrders.map(o => o.id));
  return slicedOrders.map(o => ({
    ...o,
    messages: messagesByOrder.get(o.id) || [],
  }));
}

// Thống kê toàn bộ dữ liệu, không phụ thuộc số đơn đang tải ở danh sách.
export async function getAdminStats(db, { partnerEmail, now = Date.now() } = {}) {
  const params = [];
  const scope = partnerEmail ? `WHERE EXISTS (
    SELECT 1 FROM json_each(o.items_json) item
    JOIN custom_products product ON product.id = json_extract(item.value, '$.productId')
    WHERE LOWER(product.partner_email) = ?
  )` : "";
  if (partnerEmail) params.push(partnerEmail.toLowerCase());
  const row = await db.prepare(`SELECT
    COUNT(*) AS totalOrders,
    COALESCE(SUM(CASE WHEN o.status IN ('pending', 'processing') THEN 1 ELSE 0 END), 0) AS processingOrders,
    COALESCE(SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END), 0) AS completedOrders,
    COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS revenue
    FROM orders o ${scope}`).get(...params);
  const depositRow = partnerEmail ? { n: 0 } : await db.prepare(
    "SELECT COUNT(*) AS n FROM deposits WHERE status = 'review' OR (status = 'pending' AND expires_at >= ?)",
  ).get(now);
  return {
    totalOrders: Number(row.totalOrders),
    processingOrders: Number(row.processingOrders),
    completedOrders: Number(row.completedOrders),
    revenue: Number(row.revenue),
    pendingDeposits: Number(depositRow.n),
    needsAction: Number(row.processingOrders) + Number(depositRow.n),
    updatedAt: now,
  };
}

export async function updateAdminOrder(db, orderId, { status, claimLink }, partnerEmail = null) {
  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId);
  if (!order) {
    const error = new Error("Không tìm thấy đơn hàng.");
    error.status = 404;
    throw error;
  }

  if (partnerEmail) {
    let partnerProductIds = new Set();
    try {
      const products = await db.prepare("SELECT id FROM custom_products WHERE LOWER(partner_email) = ?").all(partnerEmail.toLowerCase());
      partnerProductIds = new Set((products || []).map(p => p.id));
    } catch {}
    let items = [];
    try { items = JSON.parse(order.items_json); } catch {}
    if (!items.some(it => partnerProductIds.has(it.productId))) {
      throw Object.assign(new Error("Bạn không có quyền quản lý đơn hàng này."), { status: 403 });
    }
  }

  const nextStatus = status || order.status;
  // Đơn đã hoàn tiền không mở lại để tránh trừ ví và dùng mã thêm lần nữa.
  if (order.status === "cancelled" && nextStatus !== "cancelled") {
    throw Object.assign(
      new Error("Đơn đã hủy không thể mở lại. Hãy tạo đơn mới."),
      { status: 409 },
    );
  }
  if (
    !["pending", "processing", "completed", "cancelled"].includes(nextStatus)
  ) {
    const error = new Error("Trạng thái đơn hàng không hợp lệ.");
    error.status = 400;
    throw error;
  }
  const completedAt =
    nextStatus === "completed" ? order.completed_at || Date.now() : null;
  const nextClaimLink = claimLink !== undefined ? claimLink : order.claim_link;

  await db
    .prepare(
      "UPDATE orders SET status = ?, claim_link = ?, completed_at = ? WHERE id = ?",
    )
    .run(nextStatus, nextClaimLink, completedAt, orderId);

  if (order.status !== "cancelled" && nextStatus === "cancelled") {
    try {
      const items = JSON.parse(order.items_json);
      for (const item of (items || [])) {
        const qty = Number(item.quantity) || 1;
        await db.prepare(`
          UPDATE product_inventory SET
            stock = stock + ?,
            sold_count = MAX(0, sold_count - ?),
            updated_at = ?
          WHERE product_id = ? AND variant_id = ''
        `).run(qty, qty, Date.now(), item.productId);
        if (item.variantId) {
          await db.prepare(`
            UPDATE product_inventory SET
              stock = stock + ?,
              sold_count = MAX(0, sold_count - ?),
              updated_at = ?
            WHERE product_id = ? AND variant_id = ?
          `).run(qty, qty, Date.now(), item.productId, item.variantId);
        }
      }
    } catch {}
  }

  return {
    id: order.id,
    pricing: await orderPricing(db, order.id),
    userId: order.user_id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerNote: order.customer_note,
    items: JSON.parse(order.items_json),
    total: order.total,
    paymentMethod: order.payment_method,
    hasLogItems: Boolean(order.has_log_items),
    discordAccount: order.discord_account,
    discordPassword: order.discord_password,
    discordToken: order.discord_token || null,
    backupCodes: order.backup_codes,
    serverInvite: order.server_invite,
    claimLink: nextClaimLink,
    status: nextStatus,
    createdAt: order.created_at,
    completedAt,
    messages: await getOrderMessages(db, order.id),
  };
}

export async function getAnnouncement(db) {
  const row = await db
    .prepare(
      "SELECT id, content, is_active, updated_at FROM site_announcements WHERE id = 'current'",
    )
    .get();
  return row
    ? {
        content: row.content,
        is_active: Boolean(row.is_active),
        updated_at: row.updated_at,
      }
    : {
        content:
          "Chào bạn, đây là VietNam Legacy. Shop bán Discord Nitro Boost, Nitro Trial, Decor Gift/Log và nhận setup server Discord.",
        is_active: true,
        updated_at: 0,
      };
}

export async function saveAnnouncement(
  db,
  content,
  is_active = 1,
  now = Date.now(),
) {
  const cleanContent = String(content ?? "").trim();
  if (cleanContent.length > 400) {
    throw Object.assign(
      new Error("Nội dung thông báo tối đa 400 ký tự."),
      { status: 400 },
    );
  }
  if (is_active && !cleanContent) {
    const error = new Error("Nội dung thông báo không được để trống.");
    error.status = 400;
    throw error;
  }
  await db
    .prepare(
      `INSERT INTO site_announcements (id, content, is_active, updated_at)
     VALUES ('current', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       is_active = excluded.is_active,
       updated_at = excluded.updated_at`,
    )
    .run(cleanContent, is_active ? 1 : 0, now);

  return await getAnnouncement(db);
}

export async function getBankSettings(db, config = {}) {
  let row = null;
  try {
    row = await db
      .prepare("SELECT * FROM payment_settings WHERE id = 'primary'")
      .get();
  } catch {
    // If table doesn't exist yet
  }

  const fallback = config.bank || {};
  const isFallbackLive = config.paymentsMode === "live";

  if (row) {
    const bankCode = (row.bank_code || fallback.code || "").trim();
    const bankGateway = (row.bank_gateway || fallback.gateway || "").trim();
    const accountNumber = (row.account_number || fallback.accountNumber || "").trim();
    const accountName = (row.account_name || fallback.accountName || "").trim();
    const webhookSecret = (row.webhook_secret || config.webhookSecret || "").trim();
    const autoCredit = row.auto_credit !== 0;
    const isActive = Boolean(row.is_active);
    const enabled = isActive && Boolean(bankCode && accountNumber && accountName && bankGateway);

    return {
      enabled,
      isActive,
      webhookSecret,
      autoCredit,
      bank: {
        code: bankCode,
        transferPrefix: isBankMatch("VietinBank", bankGateway, bankCode) ? "SEVQR" : "",
        gateway: bankGateway,
        accountNumber,
        accountName,
      },
      updatedAt: row.updated_at,
    };
  }

  const hasFallbackBank = Boolean(
    fallback.code && fallback.accountNumber && fallback.accountName && fallback.gateway,
  );
  return {
    enabled: isFallbackLive && hasFallbackBank,
    isActive: isFallbackLive && hasFallbackBank,
    webhookSecret: config.webhookSecret || "",
    autoCredit: true,
    bank: {
      code: fallback.code || "",
      transferPrefix: isBankMatch("VietinBank", fallback.gateway, fallback.code) ? "SEVQR" : "",
      gateway: fallback.gateway || "",
      accountNumber: fallback.accountNumber || "",
      accountName: fallback.accountName || "",
    },
    updatedAt: 0,
  };
}

export async function saveBankSettings(db, data = {}, now = Date.now()) {
  const bankCode = String(data.bankCode || "").trim().toUpperCase();
  const bankGateway = String(data.bankGateway || "").trim();
  const accountNumber = String(data.accountNumber || "").trim().replace(/\s+/g, "");
  const accountName = String(data.accountName || "").trim().toUpperCase();
  const isActive = data.isActive ? 1 : 0;
  const webhookSecret = data.webhookSecret != null ? String(data.webhookSecret).trim() : null;
  const autoCredit = data.autoCredit !== false ? 1 : 0;

  if (isActive) {
    if (!bankCode || !/^[A-Za-z0-9]{2,20}$/.test(bankCode)) {
      const err = new Error(
        "Mã ngân hàng (VietQR code/BIN) không hợp lệ (từ 2 đến 20 ký tự, ví dụ: MB, VCB, TCB, ICB, 970422).",
      );
      err.status = 400;
      throw err;
    }
    if (!accountNumber || !/^\d{4,32}$/.test(accountNumber)) {
      const err = new Error(
        "Số tài khoản ngân hàng phải gồm từ 4 đến 32 chữ số.",
      );
      err.status = 400;
      throw err;
    }
    if (!accountName || accountName.length < 2 || accountName.length > 80) {
      const err = new Error(
        "Vui lòng nhập tên chủ tài khoản (in hoa không dấu).",
      );
      err.status = 400;
      throw err;
    }
    if (!bankGateway || bankGateway.length < 2 || bankGateway.length > 80) {
      const err = new Error(
        "Vui lòng nhập tên ngân hàng (ví dụ: MB Bank, Vietcombank...).",
      );
      err.status = 400;
      throw err;
    }
  }

  await db
    .prepare(
      `INSERT INTO payment_settings (id, bank_code, bank_gateway, account_number, account_name, webhook_secret, auto_credit, is_active, updated_at)
       VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         bank_code = excluded.bank_code,
         bank_gateway = excluded.bank_gateway,
         account_number = excluded.account_number,
         account_name = excluded.account_name,
         webhook_secret = CASE WHEN ? THEN excluded.webhook_secret ELSE payment_settings.webhook_secret END,
         auto_credit = excluded.auto_credit,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
    )
    .run(bankCode, bankGateway, accountNumber, accountName, webhookSecret ?? "", autoCredit, isActive, now, webhookSecret !== null ? 1 : 0);

  const currentSettings = await getBankSettings(db);
  return currentSettings;
}

export async function getAdminDeposits(
  db,
  { status = "all", search = "", limit = 100 } = {},
) {
  let query = `
    SELECT d.id, d.user_id, d.code, d.amount, d.status, d.created_at, d.expires_at, d.credited_at,
           u.email AS user_email
    FROM deposits d
    JOIN users u ON u.id = d.user_id
  `;
  const conditions = [];
  const params = [];
  const now = Date.now();

  if (status && status !== "all") {
    if (status === "expired") {
      conditions.push(
        "(d.status = 'expired' OR (d.status = 'pending' AND d.expires_at < ?))",
      );
      params.push(now);
    } else if (status === "pending") {
      conditions.push("d.status = 'pending' AND d.expires_at >= ?");
      params.push(now);
    } else {
      conditions.push("d.status = ?");
      params.push(status);
    }
  }

  if (search) {
    const term = `%${search.trim().toUpperCase()}%`;
    const termRaw = `%${search.trim().toLowerCase()}%`;
    conditions.push("(UPPER(d.code) LIKE ? OR LOWER(u.email) LIKE ?)");
    params.push(term, termRaw);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY d.created_at DESC LIMIT ?";
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

  const rows = await db.prepare(query).all(...params);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    code: r.code,
    amount: r.amount,
    status:
      r.status === "pending" && r.expires_at < now ? "expired" : r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    creditedAt: r.credited_at,
  }));
}

export async function manualCreditDeposit(db, depositId, now = Date.now()) {
  return db.transaction(async (tx) => {
    const deposit = await tx
      .prepare("SELECT * FROM deposits WHERE id = ?")
      .get(depositId);
    if (!deposit) {
      const err = new Error("Không tìm thấy yêu cầu nạp.");
      err.status = 404;
      throw err;
    }
    if (deposit.status === "credited") {
      const err = new Error("Yêu cầu nạp này đã được cộng tiền vào ví.");
      err.status = 409;
      throw err;
    }

    const transactionId = `MANUAL-${now}-${randomBytes(4).toString("hex")}`;
    const reference = `MANUAL-${deposit.code}`;

    await tx
      .prepare(
        "INSERT INTO bank_events (transaction_id, reference, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(transactionId, reference, deposit.id, deposit.amount, "credited", now);

    await tx
      .prepare(
        "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        deposit.user_id,
        deposit.id,
        transactionId,
        deposit.amount,
        now,
      );

    await tx
      .prepare(
        "UPDATE deposits SET status = 'credited', credited_at = ? WHERE id = ?",
      )
      .run(now, deposit.id);

    return {
      success: true,
      depositId: deposit.id,
      code: deposit.code,
      amount: deposit.amount,
      status: "credited",
      creditedAt: now,
    };
  });
}

export async function cancelDeposit(db, depositId, now = Date.now()) {
  const deposit = await db
    .prepare("SELECT * FROM deposits WHERE id = ?")
    .get(depositId);
  if (!deposit) {
    const err = new Error("Không tìm thấy yêu cầu nạp.");
    err.status = 404;
    throw err;
  }
  if (deposit.status === "credited") {
    const err = new Error("Không thể hủy yêu cầu nạp đã cộng tiền vào ví.");
    err.status = 400;
    throw err;
  }
  await db
    .prepare("UPDATE deposits SET status = 'expired' WHERE id = ?")
    .run(deposit.id);
  return { success: true, depositId: deposit.id, status: "expired" };
}

export async function revokeCreditDeposit(db, depositId, targetStatus = "review", now = Date.now()) {
  return db.transaction(async (tx) => {
    const deposit = await tx
      .prepare("SELECT * FROM deposits WHERE id = ?")
      .get(depositId);
    if (!deposit) {
      const err = new Error("Không tìm thấy yêu cầu nạp.");
      err.status = 404;
      throw err;
    }
    if (deposit.status !== "credited") {
      const err = new Error("Chỉ có thể thu hồi yêu cầu nạp đang ở trạng thái 'Đã cộng tiền'.");
      err.status = 400;
      throw err;
    }

    // 1. Remove ledger entry from wallet_ledger (this immediately drops user's balance)
    await tx
      .prepare("DELETE FROM wallet_ledger WHERE deposit_id = ?")
      .run(deposit.id);

    // 2. Mark any related bank events as revoked
    await tx
      .prepare("UPDATE bank_events SET outcome = 'revoked' WHERE deposit_id = ?")
      .run(deposit.id);

    // 3. Update deposit status back to target status (review, expired, or pending)
    const validStatuses = ["review", "expired", "pending"];
    const newStatus = validStatuses.includes(targetStatus) ? targetStatus : "review";
    await tx
      .prepare("UPDATE deposits SET status = ?, credited_at = NULL WHERE id = ?")
      .run(newStatus, deposit.id);

    const userBalance = await balance(tx, deposit.user_id);

    return {
      success: true,
      depositId: deposit.id,
      code: deposit.code,
      revokedAmount: deposit.amount,
      status: newStatus,
      newBalance: userBalance,
    };
  });
}

export const DEFAULT_GUIDES = [
  {
    id: "main",
    title: "Hướng dẫn mua hàng tại VietNam Legacy",
    subtitle: "Chọn sản phẩm, nạp tiền vào ví và theo dõi đơn hàng",
    category: "guide",
    coverImage: "assets/vnl-banner.png",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    images: ["assets/vnl-banner.png"],
    steps: [
      {
        title: "Bước 1: Chọn sản phẩm & Gói cần mua",
        description:
          "Duyệt qua danh mục Discord Nitro, Decor hoặc dịch vụ bạn cần. Chọn gói thời hạn phù hợp và hình thức nhận (Link quà tặng Gift hoặc Nạp qua tài khoản Log).",
      },
      {
        title: "Bước 2: Nạp tiền ví qua mã QR ngân hàng",
        description:
          "Mở Ví cá nhân tại góc trên trang web, nhập số tiền cần nạp và dùng app ngân hàng quét mã VietQR tự động. Tiền sẽ được cộng vào ví ngay sau khi chuyển khoản.",
      },
      {
        title: "Bước 3: Đặt đơn và nhận hàng",
        description:
          "Bấm 'Mua ngay' hoặc 'Thanh toán' giỏ hàng. Xem link quà tặng trong mục 'Đơn hàng của tôi' khi shop giao hàng. Cần hỗ trợ thì nhắn shop trên Discord.",
      },
    ],
    content:
      "Bạn cần setup server hoặc làm bot Discord riêng? Nhắn shop trên Discord để trao đổi yêu cầu và báo giá.",
    views: 1250,
    isActive: true,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  },
  {
    id: "huong-dan-nap-tien-vietqr",
    title: "Hướng dẫn nạp tiền ví tự động bằng VietQR & Ngân hàng",
    subtitle: "Nạp tiền vào ví bằng mã VietQR của đơn nạp",
    category: "guide",
    coverImage: "assets/vnl-banner.png",
    videoUrl: "",
    images: ["assets/vnl-banner.png"],
    steps: [
      {
        title: "Bước 1: Mở ví cá nhân",
        description:
          "Bấm vào biểu tượng Ví cá nhân ở góc trên bên phải website VietNam Legacy.",
      },
      {
        title: "Bước 2: Nhập số tiền & Quét mã QR",
        description:
          "Nhập số tiền cần nạp (tối thiểu 10.000đ). Hệ thống sẽ tạo mã VietQR chuẩn với nội dung chuyển khoản tự động.",
      },
      {
        title: "Bước 3: Nhận tiền vào ví tức thì",
        description:
          "Dùng ứng dụng ngân hàng quét mã và xác nhận chuyển tiền. Số dư sẽ tự động cập nhật vào tài khoản sau 5 - 15 giây.",
      },
    ],
    content:
      "Lưu ý giữ nguyên nội dung chuyển khoản do hệ thống tạo sẵn để việc cộng tiền diễn ra hoàn toàn tự động.",
    views: 890,
    isActive: true,
    createdAt: 1710005000000,
    updatedAt: 1710005000000,
  },
  {
    id: "phan-biet-gift-va-log",
    title: "Phân biệt nhận hàng qua Gift và Nạp trực tiếp qua Log",
    subtitle: "Nên chọn nhận link quà tặng Discord hay nạp trực tiếp qua tài khoản?",
    category: "tips",
    coverImage: "assets/vnl-banner.png",
    videoUrl: "",
    images: ["assets/vnl-banner.png"],
    steps: [
      {
        title: "1. Hình thức Gift (Link quà tặng)",
        description:
          "Shop gửi link claim quà tặng chính thức từ Discord. Bạn chỉ cần bấm 'Accept' để nhận gói vào nick. Hoàn toàn không cần cung cấp mật khẩu.",
      },
      {
        title: "2. Hình thức Log (Nạp Acc)",
        description:
          "Bạn cung cấp tài khoản, mật khẩu và 3 mã dự phòng 2FA. Đội ngũ kỹ thuật viên của shop sẽ đăng nhập nạp trực tiếp, giá thành tiết kiệm hơn đáng kể.",
      },
    ],
    content:
      "Tất cả các gói nạp tại VietNam Legacy dù là Gift hay Log đều được cam kết bảo hành full thời hạn và hỗ trợ tận tình.",
    views: 640,
    isActive: true,
    createdAt: 1710010000000,
    updatedAt: 1710010000000,
  },
  {
    id: "cach-lay-ma-du-phong-discord",
    title: "Cách lấy 8 mã dự phòng (Backup Codes) bảo mật Discord",
    subtitle: "Bảo vệ tài khoản và lấy mã xác thực 2 bước cho gói nạp Log",
    category: "tips",
    coverImage: "assets/vnl-banner.png",
    videoUrl: "",
    images: ["assets/vnl-banner.png"],
    steps: [
      {
        title: "Bước 1: Mở Cài đặt người dùng",
        description:
          "Mở ứng dụng Discord trên máy tính hoặc điện thoại -> Bấm vào biểu tượng bánh răng Cài đặt (User Settings).",
      },
      {
        title: "Bước 2: Tìm mục Xác thực hai yếu tố",
        description:
          "Chọn 'Tài khoản của tôi' (My Account) -> Kéo xuống phần Xác thực hai yếu tố (2FA) -> Bấm nút 'Xem mã dự phòng' (View Backup Codes).",
      },
      {
        title: "Bước 3: Sao chép mã",
        description:
          "Nhập mật khẩu Discord khi được yêu cầu, sau đó sao chép ít nhất 3 mã dự phòng và dán vào form đặt đơn của shop.",
      },
    ],
    content:
      "Mỗi mã dự phòng gồm 8 ký tự số và chỉ có thể sử dụng 1 lần duy nhất, đảm bảo tài khoản của bạn luôn được an toàn.",
    views: 420,
    isActive: true,
    createdAt: 1710015000000,
    updatedAt: 1710015000000,
  },
];

export const DEFAULT_SHOPPING_GUIDE = DEFAULT_GUIDES[0];

function formatGuideRow(row, includeOwner = false) {
  if (!row) return null;
  let images = [];
  try {
    images = JSON.parse(row.image_urls_json || "[]");
    if (!Array.isArray(images)) images = [];
  } catch {
    images = [];
  }
  let steps = [];
  try {
    steps = JSON.parse(row.steps_json || "[]");
    if (!Array.isArray(steps)) steps = [];
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    ...(includeOwner ? { partnerEmail: row.partner_email || null } : {}),
    title: row.title || DEFAULT_SHOPPING_GUIDE.title,
    subtitle: row.subtitle ?? "",
    category: row.category || "guide",
    coverImage: row.cover_image ?? "",
    videoUrl: row.video_url ?? "",
    images,
    steps,
    content: row.content ?? "",
    views: Number(row.views || 0),
    isActive: Boolean(row.is_active),
    createdAt: Number(row.created_at || row.updated_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

async function ensureDefaultGuides(db) {
  try {
    const row = await db.prepare("SELECT COUNT(*) as count FROM shopping_guides").get();
    if (row && Number(row.count) > 0) return;
    for (const guide of DEFAULT_GUIDES) {
      await db.prepare(
        `INSERT OR IGNORE INTO shopping_guides (id, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        guide.id,
        guide.title,
        guide.subtitle,
        guide.category,
        guide.coverImage,
        guide.videoUrl,
        JSON.stringify(guide.images),
        JSON.stringify(guide.steps),
        guide.content,
        guide.views,
        guide.isActive ? 1 : 0,
        guide.createdAt,
        guide.updatedAt,
      );
    }
  } catch {
    // If table doesn't exist
  }
}

export async function getShoppingGuide(db, id = null) {
  await ensureDefaultGuides(db);
  let row = null;
  const targetId = id ? String(id).trim() : null;
  try {
    if (targetId) {
      row = await db
        .prepare(
          "SELECT id, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at FROM shopping_guides WHERE id = ? AND is_active = 1",
        )
        .get(targetId);
      if (row) {
        await db.prepare("UPDATE shopping_guides SET views = views + 1 WHERE id = ?").run(targetId).catch(() => {});
        row.views = (row.views || 0) + 1;
      }
    } else {
      row = await db
        .prepare(
          "SELECT id, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at FROM shopping_guides WHERE id = 'main' AND is_active = 1",
        )
        .get();
      if (!row) {
        row = await db
          .prepare(
            "SELECT id, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at FROM shopping_guides WHERE is_active = 1 LIMIT 1",
          )
          .get();
      }
    }
  } catch {
    // If error querying
  }
  if (!row && targetId) {
    throw Object.assign(new Error("Không tìm thấy bài hướng dẫn đang hiển thị."), { status: 404 });
  }
  if (!row) {
    return { ...DEFAULT_SHOPPING_GUIDE };
  }
  return formatGuideRow(row);
}

export async function listShoppingGuides(db, includeInactive = false, caller = null) {
  await ensureDefaultGuides(db);
  try {
    const rows = await db
      .prepare(
        `SELECT id, partner_email, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at
         FROM shopping_guides
         WHERE (${includeInactive ? "1 = 1" : "is_active = 1"})
         ${caller?.role === "partner" ? "AND LOWER(partner_email) = ?" : ""}
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .all(...(caller?.role === "partner" ? [caller.email.toLowerCase()] : []));
    return (rows || []).map(row => formatGuideRow(row, includeInactive));
  } catch {
    return caller?.role === "partner" ? [] : DEFAULT_GUIDES;
  }
}

export async function saveShoppingGuide(db, data, now = Date.now()) {
  const title = String(data.title || "").trim();
  if (!title) {
    const err = new Error("Tiêu đề hướng dẫn không được để trống.");
    err.status = 400;
    throw err;
  }
  if (title.length > 200) {
    const err = new Error("Tiêu đề quá dài (tối đa 200 ký tự).");
    err.status = 400;
    throw err;
  }

  let id = data.id ? String(data.id).trim().toLowerCase() : "main";
  if (id === "new") {
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    id = slug ? `${slug}-${randomUUID()}` : `guide-${randomUUID()}`;
  }

  const subtitle = String(data.subtitle || "").trim().slice(0, 300);
  const category = ["guide", "tips", "news", "other"].includes(data.category) ? data.category : "guide";
  const coverImage = String(data.coverImage || data.cover_image || "").trim().slice(0, 2_000_000);
  const videoUrl = String(data.videoUrl || data.video_url || "").trim().slice(0, 1000);
  const content = String(data.content || "").trim().slice(0, 10000);
  const isActive =
    data.isActive !== false && data.is_active !== false && data.isActive !== 0;

  let images = [];
  if (Array.isArray(data.images)) {
    images = data.images
      .map((url) => String(url || "").trim())
      .filter((url) => url.length > 0 && url.length <= 2_000_000)
      .slice(0, 30);
  } else if (typeof data.images === "string") {
    images = data.images
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && url.length <= 2_000_000)
      .slice(0, 30);
  }

  let steps = [];
  if (Array.isArray(data.steps)) {
    steps = data.steps
      .map((s) => ({
        title: String(s.title || "").trim().slice(0, 150),
        description: String(s.description || "").trim().slice(0, 1000),
      }))
      .filter((s) => s.title.length > 0 || s.description.length > 0)
      .slice(0, 30);
  }

  const createdAt = Number(data.createdAt || data.created_at || now);

  await db
    .prepare(
      `INSERT INTO shopping_guides (id, title, subtitle, category, cover_image, video_url, image_urls_json, steps_json, content, views, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         category = excluded.category,
         cover_image = excluded.cover_image,
         video_url = excluded.video_url,
         image_urls_json = excluded.image_urls_json,
         steps_json = excluded.steps_json,
         content = excluded.content,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`,
    )
    .run(
      id,
      title,
      subtitle,
      category,
      coverImage,
      videoUrl,
      JSON.stringify(images),
      JSON.stringify(steps),
      content,
      isActive ? 1 : 0,
      createdAt,
      now,
    );

  return {
    id,
    title,
    subtitle,
    category,
    coverImage,
    videoUrl,
    images,
    steps,
    content,
    views: Number(data.views || 0),
    isActive,
    createdAt,
    updatedAt: now,
  };
}

export async function deleteShoppingGuide(db, id) {
  const guideId = String(id || "").trim();
  if (!guideId) throw new Error("ID bài viết không hợp lệ.");
  await db.prepare("DELETE FROM shopping_guides WHERE id = ?").run(guideId);
  return { success: true, id: guideId };
}

export async function toggleShoppingGuideStatus(db, id, isActive, now = Date.now()) {
  const guideId = String(id || "").trim();
  if (!guideId) throw new Error("ID bài viết không hợp lệ.");
  await db
    .prepare("UPDATE shopping_guides SET is_active = ?, updated_at = ? WHERE id = ?")
    .run(isActive ? 1 : 0, now, guideId);
  return { success: true, id: guideId, isActive: Boolean(isActive) };
}

export async function listPartners(db) {
  let rows = [];
  try {
    rows = await db.prepare(
      `SELECT p.*, u.email as user_email
       FROM partners p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    ).all();
  } catch {
    return [];
  }

  let customProducts = [];
  try {
    customProducts = await db.prepare("SELECT id, partner_email FROM custom_products").all();
  } catch {}
  const productsByPartner = new Map();
  for (const cp of customProducts) {
    if (cp.partner_email) {
      const email = cp.partner_email.toLowerCase();
      productsByPartner.set(email, (productsByPartner.get(email) || 0) + 1);
    }
  }

  // Calculate order counts & revenue
  let orders = [];
  try {
    orders = await db.prepare("SELECT id, items_json, total, status FROM orders").all();
  } catch {}
  const ordersByPartner = new Map();
  const revenueByPartner = new Map();

  for (const o of orders) {
    let items = [];
    try { items = JSON.parse(o.items_json); } catch {}
    const seenPartners = new Set();
    for (const item of items) {
      const prod = customProducts.find(p => p.id === item.productId);
      if (prod && prod.partner_email) {
        const email = prod.partner_email.toLowerCase();
        seenPartners.add(email);
        if (o.status === "completed") {
          // Đơn hàng lưu giá bán trong price/subtotal; unitPrice dành cho dữ liệu cũ.
          const itemTotal = item.subtotal ?? ((item.price ?? item.unitPrice ?? 0) * (item.quantity ?? 1));
          revenueByPartner.set(email, (revenueByPartner.get(email) || 0) + itemTotal);
        }
      }
    }
    for (const email of seenPartners) {
      ordersByPartner.set(email, (ordersByPartner.get(email) || 0) + 1);
    }
  }

  return rows.map(r => {
    const email = r.email.toLowerCase();
    return {
      id: r.id,
      userId: r.user_id,
      email: r.email,
      name: r.name,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      productCount: productsByPartner.get(email) || 0,
      productsCount: productsByPartner.get(email) || 0,
      orderCount: ordersByPartner.get(email) || 0,
      ordersCount: ordersByPartner.get(email) || 0,
      totalRevenue: revenueByPartner.get(email) || 0,
      revenue: revenueByPartner.get(email) || 0,
    };
  });
}

export async function savePartner(db, { email, name, password, isActive = true }, now = Date.now()) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw Object.assign(new Error("Email đối tác không hợp lệ."), { status: 400 });
  }
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
    throw Object.assign(new Error("Tên đối tác phải từ 2 đến 100 ký tự."), { status: 400 });
  }

  return db.transaction(async (tx) => {
    let user = await tx.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    if (!user) {
      const pass = String(password || "").trim();
      if (!pass || pass.length < 6) {
        throw Object.assign(new Error("Mật khẩu khởi tạo cho đối tác tối thiểu 6 ký tự."), { status: 400 });
      }
      const hashed = await passwordHash(pass);
      const userId = randomUUID();
      await tx.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(userId, cleanEmail, hashed, now);
      user = { id: userId, email: cleanEmail };
    } else {
      if (password && String(password).trim().length >= 6) {
        const hashed = await passwordHash(String(password).trim());
        await tx.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashed, user.id);
      }
    }

    const partnerId = randomUUID();
    await tx.prepare(
      `INSERT INTO partners (id, user_id, email, name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`
    ).run(partnerId, user.id, cleanEmail, cleanName, isActive ? 1 : 0, now, now);

    const partner = await tx.prepare("SELECT * FROM partners WHERE LOWER(email) = ?").get(cleanEmail);
    return {
      id: partner.id,
      userId: user.id,
      email: partner.email,
      name: partner.name,
      isActive: Boolean(partner.is_active),
      createdAt: partner.created_at,
      updatedAt: partner.updated_at,
    };
  });
}

export async function togglePartnerStatus(db, partnerId, isActive, now = Date.now()) {
  const partner = await db.prepare("SELECT * FROM partners WHERE id = ?").get(partnerId);
  if (!partner) throw Object.assign(new Error("Không tìm thấy đối tác."), { status: 404 });
  await db.prepare("UPDATE partners SET is_active = ?, updated_at = ? WHERE id = ?").run(isActive ? 1 : 0, now, partnerId);
  if (!isActive) {
    await db.prepare("DELETE FROM admin_tokens WHERE user_id = ?").run(partner.user_id);
  }
  return { id: partnerId, isActive: Boolean(isActive) };
}

export async function deletePartner(db, partnerId) {
  const partner = await db.prepare("SELECT * FROM partners WHERE id = ?").get(partnerId);
  if (!partner) throw Object.assign(new Error("Không tìm thấy đối tác."), { status: 404 });
  await db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM partners WHERE id = ?").run(partnerId);
    await tx.prepare("DELETE FROM admin_tokens WHERE user_id = ?").run(partner.user_id);
    await tx.prepare("UPDATE custom_products SET partner_email = NULL WHERE LOWER(partner_email) = ?").run(partner.email.toLowerCase());
  });
  return { id: partnerId, deleted: true };
}

export async function createAdminToken(db, userId, role = "partner", now = Date.now()) {
  const rawToken = "vnl_ptn_" + randomBytes(24).toString("hex");
  const tokenHash = digest(rawToken);
  const expiresAt = now + 30 * 24 * 3600 * 1000;
  await db.prepare("INSERT INTO admin_tokens (token_hash, user_id, role, expires_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, role, expiresAt);
  return rawToken;
}

export async function getAdminUserFromToken(db, token, masterAdminPassword, now = Date.now()) {
  if (!token) return null;
  if (masterAdminPassword && equal(token, masterAdminPassword)) {
    return { role: "admin", email: "admin@vietnamlegacy.com", name: "Quản trị viên" };
  }
  const tokenHash = digest(token);
  try {
    const row = await db.prepare(
      `SELECT t.user_id, t.role, t.expires_at, u.email, p.name as partner_name, p.is_active as partner_active
       FROM admin_tokens t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN partners p ON LOWER(p.email) = LOWER(u.email)
       WHERE t.token_hash = ? AND t.expires_at > ?`
    ).get(tokenHash, now);
    if (!row) return null;
    if (row.partner_active === 0) return null;
    return {
      role: row.role || "partner",
      userId: row.user_id,
      email: row.email,
      name: row.partner_name || row.email,
    };
  } catch {
    return null;
  }
}


