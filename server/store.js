import { quoteOrder } from "./pricing.js";
import { randomUUID, randomBytes } from "node:crypto";
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

// The event, ledger entry and deposit status commit together. A retry cannot add money twice.
export async function processTransfer(db, event, bank, now = Date.now()) {
  const id = String(event.id ?? "");
  if (
    !/^\d{1,30}$/.test(id) ||
    !Number.isSafeInteger(event.transferAmount) ||
    event.transferAmount <= 0 ||
    event.transferAmount > 1000000000
  ) {
    const error = new Error("Dữ liệu giao dịch không hợp lệ.");
    error.status = 400;
    throw error;
  }
  const reference =
    typeof event.referenceCode === "string" && event.referenceCode.trim()
      ? event.referenceCode.trim().slice(0, 160)
      : null;
  const codes = new Set();
  const explicit = String(event.code || "").toUpperCase();
  if (/^VNL[A-F0-9]{12}$/.test(explicit)) codes.add(explicit);
  for (const match of String(event.content || "")
    .toUpperCase()
    .matchAll(/(?:^|[^A-Z0-9])(VNL[A-F0-9]{12})(?=$|[^A-Z0-9])/g))
    codes.add(match[1]);
  const code = codes.size === 1 ? [...codes][0] : null;
  const gateway = (value) =>
    String(value || "")
      .normalize("NFKC")
      .replace(/\s/g, "")
      .toLowerCase();
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
    if (event.transferType !== "in") outcome = "outgoing";
    else if (
      String(event.accountNumber || "") !== bank.accountNumber ||
      gateway(event.gateway) !== gateway(bank.gateway)
    )
      outcome = "wrong_account";
    else if (deposit) {
      if (deposit.status === "credited") outcome = "already_paid";
      else if (deposit.status !== "pending" || deposit.expires_at < now)
        outcome = "review";
      else if (deposit.amount !== event.transferAmount) outcome = "review";
      else outcome = "credited";
    }
    await db
      .prepare(
        "INSERT INTO bank_events (transaction_id, reference, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        reference,
        deposit?.id ?? null,
        event.transferAmount,
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
          event.transferAmount,
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
    return { outcome };
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

    const orderId = "VNL-" + randomBytes(4).toString("hex").toUpperCase();
    const initialStatus = paymentMethod === "wallet" ? "processing" : "pending";

    await tx
      .prepare(
        `INSERT INTO orders (
        id, user_id, customer_name, customer_email, customer_note,
        items_json, total, payment_method, has_log_items,
        discord_account, discord_password, backup_codes, server_invite, claim_link,
        status, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
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
export async function getUserOrders(db, userId) {
  const rows = await db
    .prepare(
      "SELECT o.id, o.customer_name, o.customer_email, o.customer_note, o.items_json, o.total, o.payment_method, o.has_log_items, o.server_invite, o.claim_link, o.status, o.created_at, o.completed_at, op.snapshot_json AS pricing_json FROM orders o LEFT JOIN order_pricing op ON op.order_id = o.id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50",
    )
    .all(userId);
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
    claimLink: row.claim_link,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

// Admin order view: Full credentials only visible to admin
export async function getAdminOrders(
  db,
  { status, limit = 50, offset = 0 } = {},
) {
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
  query += " ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return (await db.prepare(query).all(...params)).map((row) => ({
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
    backupCodes: row.backup_codes,
    serverInvite: row.server_invite,
    claimLink: row.claim_link,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

export async function updateAdminOrder(db, orderId, { status, claimLink }) {
  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId);
  if (!order) {
    const error = new Error("Không tìm thấy đơn hàng.");
    error.status = 404;
    throw error;
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
    backupCodes: order.backup_codes,
    serverInvite: order.server_invite,
    claimLink: nextClaimLink,
    status: nextStatus,
    createdAt: order.created_at,
    completedAt,
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
          "🔥 Chào mừng bạn đến với VietNam Legacy! Shop cung cấp Discord Nitro Boost, Nitro Trial, Decor Gift/Log và Setup Server uy tín số 1 Việt Nam.",
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
