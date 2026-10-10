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
export function verifyWebhook(headers, raw, secret, now = Date.now()) {
  if (!secret || secret.length < 32) return false;
  const timestamp = headers["x-sepay-timestamp"];
  if (
    typeof timestamp !== "string" ||
    !/^\d{10,11}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest("hex");
  return equal(expected, headers["x-sepay-signature"] || "");
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
