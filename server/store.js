import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
  return db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS balance FROM wallet_ledger WHERE user_id = ?",
    )
    .get(userId).balance;
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
