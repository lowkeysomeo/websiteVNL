import {
  randomBytes,
  scrypt,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const passwordOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function equal(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64, passwordOptions);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
export async function checkPassword(password, encoded) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const hash = await derive(password, salt, 64, passwordOptions);
  return equal(hash.toString("hex"), expected);
}
export function verifyWebhook(headers = {}, raw = Buffer.alloc(0), secret = "", now = Date.now(), queryToken = null) {
  if (!secret) return false;
  const cleanSecret = String(secret).trim();
  if (!cleanSecret) return false;

  // 1. Check API Key in Authorization header (SePay default: "Authorization: Apikey <KEY>")
  const authHeader = String(headers["authorization"] || headers["Authorization"] || "").trim();
  if (authHeader) {
    if (authHeader.startsWith("Apikey ")) {
      const apiKey = authHeader.slice(7).trim();
      if (equal(apiKey, cleanSecret)) return true;
    }
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (equal(token, cleanSecret)) return true;
    }
  }

  // 2. Check X-API-Key or X-Sepay-Api-Key headers
  const xApiKey = String(headers["x-api-key"] || headers["x-sepay-api-key"] || headers["X-API-KEY"] || "").trim();
  if (xApiKey && equal(xApiKey, cleanSecret)) return true;

  // 3. Check Query token (URL: /api/payments/webhook?token=... or ?apiKey=...)
  if (queryToken && typeof queryToken === "string") {
    if (equal(queryToken.trim(), cleanSecret)) return true;
  }

  // 4. Check HMAC SHA-256 signature (SePay webhook with HMAC signature enabled)
  const timestamp = headers["x-sepay-timestamp"];
  if (
    typeof timestamp === "string" &&
    /^\d{10,11}$/.test(timestamp) &&
    Math.abs(now / 1000 - Number(timestamp)) <= 300
  ) {
    const expected =
      "sha256=" +
      createHmac("sha256", cleanSecret)
        .update(timestamp + ".")
        .update(raw)
        .digest("hex");
    if (equal(expected, headers["x-sepay-signature"] || "")) {
      return true;
    }
  }

  return false;
}

export function createLimiter() {
  const attempts = new Map();
  return function allowed(key, limit, windowMs) {
    const now = Date.now();
    for (const [entry, value] of attempts)
      if (value.until < now) attempts.delete(entry);
    let value = attempts.get(key);
    if (!value) {
      if (attempts.size >= 10000) return false;
      value = { count: 0, until: now + windowMs };
      attempts.set(key, value);
    }
    value.count += 1;
    return value.count <= limit;
  };
}
