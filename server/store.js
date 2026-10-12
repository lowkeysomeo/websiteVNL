import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

export function openStore(filename) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;",
  );
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  return db;
}

export function balance(db, userId) {
  const depositSum = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_ledger WHERE user_id = ?",
    )
    .get(userId).total;
  const orderSpent = db
    .prepare(
      "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE user_id = ? AND payment_method = 'wallet' AND status != 'cancelled'",
    )
    .get(userId).total;
  return depositSum - orderSpent;
}

// The event, ledger entry and deposit status commit together. A retry cannot add money twice.
export function processTransfer(db, event, bank, now = Date.now()) {
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
  db.exec("BEGIN IMMEDIATE");
  try {
    const duplicate = db
      .prepare(
        "SELECT outcome FROM bank_events WHERE transaction_id = ? OR (? IS NOT NULL AND reference = ?)",
      )
      .get(id, reference, reference);
    if (duplicate) {
      db.exec("COMMIT");
      return { outcome: "duplicate" };
    }
    const deposit = code
      ? db.prepare("SELECT * FROM deposits WHERE code = ?").get(code)
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
    db.prepare(
      "INSERT INTO bank_events (transaction_id, reference, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      reference,
      deposit?.id ?? null,
      event.transferAmount,
      outcome,
      now,
    );
    if (outcome === "credited") {
      db.prepare(
        "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        randomUUID(),
        deposit.user_id,
        deposit.id,
        id,
        event.transferAmount,
        now,
      );
      db.prepare(
        "UPDATE deposits SET status = 'credited', credited_at = ? WHERE id = ?",
      ).run(now, deposit.id);
    } else if (outcome === "review" && deposit?.status !== "credited") {
      db.prepare("UPDATE deposits SET status = 'review' WHERE id = ?").run(
        deposit.id,
      );
    }
    db.exec("COMMIT");
    return { outcome };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createOrder(db, orderData) {
  const {
    userId,
    customerName,
    customerEmail,
    customerNote = "",
    items,
    total,
    paymentMethod = "wallet",
    hasLogItems = 0,
    discordAccount = null,
    discordPassword = null,
    backupCodes = null,
    now = Date.now(),
  } = orderData;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (paymentMethod === "wallet") {
      if (!userId) {
        const error = new Error("Vui lòng đăng nhập tài khoản để thanh toán bằng ví.");
        error.status = 401;
        throw error;
      }
      const currentBalance = balance(db, userId);
      if (currentBalance < total) {
        const formattedBalance = new Intl.NumberFormat("vi-VN").format(currentBalance);
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

    db.prepare(
      `INSERT INTO orders (
        id, user_id, customer_name, customer_email, customer_note,
        items_json, total, payment_method, has_log_items,
        discord_account, discord_password, backup_codes, claim_link,
        status, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    ).run(
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
      initialStatus,
      now,
    );

    db.exec("COMMIT");
    return {
      id: orderId,
      userId,
      customerName,
      customerEmail,
      customerNote,
      items,
      total,
      paymentMethod,
      hasLogItems: Boolean(hasLogItems),
      status: initialStatus,
      createdAt: now,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// User-facing order history: NEVER returns discord_password or backup_codes
export function getUserOrders(db, userId) {
  return db
    .prepare(
      "SELECT id, customer_name, customer_email, customer_note, items_json, total, payment_method, has_log_items, claim_link, status, created_at, completed_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(userId)
    .map((row) => ({
      id: row.id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerNote: row.customer_note,
      items: JSON.parse(row.items_json),
      total: row.total,
      paymentMethod: row.payment_method,
      hasLogItems: Boolean(row.has_log_items),
      claimLink: row.claim_link,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
}

// Admin order view: Full credentials only visible to admin
export function getAdminOrders(db, { status, limit = 50, offset = 0 } = {}) {
  let query = "SELECT * FROM orders";
  const params = [];
  if (status && ["pending", "processing", "completed", "cancelled"].includes(status)) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db
    .prepare(query)
    .all(...params)
    .map((row) => ({
      id: row.id,
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
      claimLink: row.claim_link,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
}

export function updateAdminOrder(db, orderId, { status, claimLink }) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    const error = new Error("Không tìm thấy đơn hàng.");
    error.status = 404;
    throw error;
  }
  const nextStatus = status || order.status;
  if (!["pending", "processing", "completed", "cancelled"].includes(nextStatus)) {
    const error = new Error("Trạng thái đơn hàng không hợp lệ.");
    error.status = 400;
    throw error;
  }
  const completedAt = nextStatus === "completed" ? (order.completed_at || Date.now()) : null;
  const nextClaimLink = claimLink !== undefined ? claimLink : order.claim_link;

  db.prepare(
    "UPDATE orders SET status = ?, claim_link = ?, completed_at = ? WHERE id = ?",
  ).run(nextStatus, nextClaimLink, completedAt, orderId);

  return {
    id: order.id,
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
    claimLink: nextClaimLink,
    status: nextStatus,
    createdAt: order.created_at,
    completedAt,
  };
}
