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
export function verifyWebhook(
  headers = {},
  raw = Buffer.alloc(0),
  secret = "",
  now = Date.now(),
  queryToken = null,
) {
  if (!secret) return false;
  const cleanSecret = String(secret).trim();
  if (!cleanSecret) return false;

  // 1. Check API Key in Authorization header (case-insensitive prefix: Apikey, apikey, Bearer, bearer, or direct token)
  const authHeader = String(
    headers["authorization"] || headers["Authorization"] || "",
  ).trim();
  if (authHeader) {
    const authMatch = authHeader.match(/^(?:apikey|bearer|token)\s+(.+)$/i);
    const tokenCandidate = authMatch ? authMatch[1].trim() : authHeader;
    if (tokenCandidate && equal(tokenCandidate, cleanSecret)) return true;
  }

  // 2. Check X-API-Key, X-Sepay-Api-Key, or other common auth headers
  const headerKeys = [
    "x-api-key",
    "x-sepay-api-key",
    "x-api_key",
    "apikey",
    "api-key",
    "secret",
    "x-secret",
    "x-webhook-secret",
  ];
  for (const k of headerKeys) {
    const val = String(headers[k] || headers[k.toUpperCase()] || "").trim();
    if (val && equal(val, cleanSecret)) return true;
  }

  // 3. Check Query token (URL: /api/payments/webhook?token=... or ?apiKey=... or ?secret=...)
  if (queryToken && typeof queryToken === "string") {
    if (equal(queryToken.trim(), cleanSecret)) return true;
  }

  // 4. Check HMAC SHA-256 signature (SePay webhook with HMAC signature enabled)
  const timestamp =
    headers["x-sepay-timestamp"] ||
    headers["X-SePay-Timestamp"] ||
    headers["X-SEPAY-TIMESTAMP"];
  const signature =
    headers["x-sepay-signature"] ||
    headers["X-SePay-Signature"] ||
    headers["X-SEPAY-SIGNATURE"];
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
    if (equal(expected, signature || "")) {
      return true;
    }
  }

  // 5. Check if payload itself contains the secret or apiKey
  try {
    if (raw && raw.length > 0) {
      const parsed = JSON.parse(raw.toString("utf8"));
      if (parsed && typeof parsed === "object") {
        const bodySecret = String(
          parsed.apiKey ||
            parsed.api_key ||
            parsed.secret ||
            parsed.token ||
            "",
        ).trim();
        if (bodySecret && equal(bodySecret, cleanSecret)) return true;
      }
    }
  } catch {
    // Ignore JSON parse errors for non-JSON or partial bodies
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
