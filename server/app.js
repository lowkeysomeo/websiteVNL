import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./config.js";
import { balance, processTransfer } from "./store.js";
import {
  digest,
  token,
  equal,
  passwordHash,
  checkPassword,
  verifyWebhook,
  createLimiter,
} from "./security.js";

const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function readBody(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 16384) throw fail(413, "Yêu cầu quá lớn.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function parse(raw) {
  try {
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw fail(400, "Dữ liệu JSON không hợp lệ.");
  }
}
function depositView(row) {
  return {
    id: row.id,
    code: row.code,
    amount: row.amount,
    status:
      row.status === "pending" && row.expires_at < Date.now()
        ? "expired"
        : row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    creditedAt: row.credited_at,
  };
}

export function createApp(db, config) {
  function paymentDetails(deposit) {
    return {
      deposit: depositView(deposit),
      bank: { ...config.bank },
      qrUrl: `https://img.vietqr.io/image/${encodeURIComponent(config.bank.code)}-${encodeURIComponent(config.bank.accountNumber)}-compact2.png?${new URLSearchParams({ amount: String(deposit.amount), addInfo: deposit.code, accountName: config.bank.accountName })}`,
    };
  }
  const allow = createLimiter();
  const cookieName = config.production ? "__Host-vnl_session" : "vnl_session";
  const cookie = (value, age) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.production ? "; Secure" : ""}`;
  const dummyHash = passwordHash(token());
  function session(req) {
    const raw = String(req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return db
      .prepare(
        "SELECT s.*, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE token_hash = ? AND expires_at > ?",
      )
      .get(digest(raw), Date.now());
  }
  function requireSession(req) {
    const value = session(req);
    if (!value) throw fail(401, "Vui lòng đăng nhập.");
    return value;
  }
  function sameOrigin(req) {
    if (req.headers.origin !== config.origin)
      throw fail(403, "Nguồn yêu cầu không hợp lệ.");
  }
  function protect(req) {
    sameOrigin(req);
    const value = requireSession(req);
    if (!equal(value.csrf_token, req.headers["x-csrf-token"] || ""))
      throw fail(403, "Phiên không hợp lệ. Vui lòng tải lại trang.");
    return value;
  }
  function startSession(res, userId) {
    const raw = token();
    const csrf = token();
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    db.prepare(
      "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
    ).run(digest(raw), userId, csrf, Date.now() + SESSION_AGE);
    res.setHeader("Set-Cookie", cookie(raw, SESSION_AGE / 1000));
    return csrf;
  }

  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://img.vietqr.io; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (config.production)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, config.origin);
      const route = url.pathname;
      const ip = req.socket.remoteAddress || "unknown";
      if (route.startsWith("/api/")) {
        if (!allow(`request:${ip}`, 180, 60000))
          throw fail(429, "Quá nhiều yêu cầu. Vui lòng thử lại sau.");
        if (req.method === "GET" && route === "/api/health")
          return json(200, { ok: true });
        if (req.method === "GET" && route === "/api/session") {
          const current = session(req);
          return json(200, {
            user: current ? { email: current.email } : null,
            csrfToken: current?.csrf_token ?? null,
            balance: current ? balance(db, current.user_id) : null,
            paymentsEnabled: config.paymentsMode === "live",
            bank: {
              name: config.bank.gateway,
              accountNumber: config.bank.accountNumber,
              accountName: config.bank.accountName,
            },
          });
        }
        if (req.method === "POST" && route === "/api/webhooks/sepay") {
          if (config.paymentsMode !== "live")
            throw fail(503, "Nạp tiền chưa được kích hoạt.");
          const raw = await readBody(req);
          if (!verifyWebhook(req.headers, raw, config.webhookSecret))
            throw fail(401, "Chữ ký webhook không hợp lệ.");
          const result = processTransfer(db, parse(raw), config.bank);
          return json(200, { success: true, outcome: result.outcome });
        }
        if (
          req.method === "POST" &&
          ["/api/auth/register", "/api/auth/login"].includes(route)
        ) {
          sameOrigin(req);
          if (
            !String(req.headers["content-type"] || "").startsWith(
              "application/json",
            )
          )
            throw fail(415, "Yêu cầu JSON.");
          if (!allow(`auth:${ip}`, 15, 15 * 60000))
            throw fail(
              429,
              "Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.",
            );
          const body = parse(await readBody(req));
          const email = String(body.email || "")
            .trim()
            .toLowerCase();
          const password = body.password;
          if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof password !== "string" ||
            password.length < 10 ||
            password.length > 128
          )
            throw fail(
              400,
              "Nhập email hợp lệ và mật khẩu từ 10 đến 128 ký tự.",
            );
          if (!allow(`auth-email:${digest(email)}`, 15, 15 * 60000))
            throw fail(429, "Vui lòng thử lại sau 15 phút.");
          let user = db
            .prepare("SELECT * FROM users WHERE email = ?")
            .get(email);
          if (route.endsWith("/register")) {
            if (user)
              throw fail(
                409,
                "Không thể đăng ký email này. Nếu đã có tài khoản, hãy đăng nhập.",
              );
            const hash = await passwordHash(password);
            user = { id: randomUUID(), email };
            try {
              db.prepare(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
              ).run(user.id, email, hash, Date.now());
            } catch (error) {
              if (
                error.code === "ERR_SQLITE_ERROR" &&
                db.prepare("SELECT id FROM users WHERE email = ?").get(email)
              )
                throw fail(409, "Không thể đăng ký email này.");
              throw error;
            }
          } else {
            const valid = await checkPassword(
              password,
              user?.password_hash || (await dummyHash),
            );
            if (!user || !valid)
              throw fail(401, "Email hoặc mật khẩu không đúng.");
          }
          const previous = session(req);
          if (previous)
            db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
              previous.token_hash,
            );
          const csrfToken = startSession(res, user.id);
          return json(route.endsWith("/register") ? 201 : 200, {
            user: { email },
            csrfToken,
            balance: balance(db, user.id),
          });
        }
        if (req.method === "POST" && route === "/api/auth/logout") {
          const current = protect(req);
          db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
            current.token_hash,
          );
          res.setHeader("Set-Cookie", cookie("", 0));
          return json(200, { ok: true });
        }
        if (req.method === "GET" && route === "/api/wallet") {
          const current = requireSession(req);
          const deposits = db
            .prepare(
              "SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
            )
            .all(current.user_id)
            .map(depositView);
          return json(200, { balance: balance(db, current.user_id), deposits });
        }
        if (req.method === "POST" && route === "/api/deposits") {
          const current = protect(req);
          if (config.paymentsMode !== "live")
            throw fail(503, "Shop chưa mở nạp tiền. Vui lòng quay lại sau.");
          if (!allow(`deposit:${current.user_id}`, 10, 3600000))
            throw fail(429, "Tối đa 10 yêu cầu nạp mỗi giờ.");
          const { amount } = parse(await readBody(req));
          if (
            !Number.isSafeInteger(amount) ||
            amount < 10000 ||
            amount > 10000000
          )
            throw fail(400, "Số tiền nạp từ 10.000 đến 10.000.000 đồng.");
          const now = Date.now();
          db.prepare(
            "UPDATE deposits SET status = 'expired' WHERE user_id = ? AND status = 'pending' AND expires_at < ?",
          ).run(current.user_id, now);
          const pending = db
            .prepare(
              "SELECT COUNT(*) AS count FROM deposits WHERE user_id = ? AND status = 'pending'",
            )
            .get(current.user_id).count;
          if (pending >= 3)
            throw fail(
              409,
              "Bạn đã có 3 yêu cầu chờ chuyển khoản. Hãy dùng yêu cầu đã tạo.",
            );
          const deposit = {
            id: randomUUID(),
            user_id: current.user_id,
            code: "VNL" + randomBytes(6).toString("hex").toUpperCase(),
            amount,
            status: "pending",
            created_at: now,
            expires_at: now + 86400000,
            credited_at: null,
          };
          db.prepare(
            "INSERT INTO deposits (id, user_id, code, amount, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            deposit.id,
            current.user_id,
            deposit.code,
            amount,
            now,
            deposit.expires_at,
          );
          return json(201, paymentDetails(deposit));
        }
        const match = route.match(/^\/api\/deposits\/([a-f0-9-]{36})$/);
        if (req.method === "GET" && match) {
          const current = requireSession(req);
          const row = db
            .prepare("SELECT * FROM deposits WHERE id = ? AND user_id = ?")
            .get(match[1], current.user_id);
          if (!row) throw fail(404, "Không tìm thấy yêu cầu nạp.");
          return json(200, {
            ...paymentDetails(row),
            balance: balance(db, current.user_id),
          });
        }
        throw fail(404, "Không tìm thấy chức năng.");
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw fail(405, "Phương thức không được hỗ trợ.");
      const relative = route === "/" ? "index.html" : route.slice(1);
      // Never expose backend code, environment files, databases or arbitrary project files.
      if (
        ![
          "index.html",
          "styles.css",
          "products.js",
          "app.js",
          "wallet.js",
          "wallet.css",
        ].includes(relative) &&
        !/^assets\/[a-zA-Z0-9_-]+\.(svg|png)$/.test(relative)
      )
        throw fail(404, "Không tìm thấy trang.");
      const bytes = await readFile(path.join(root, relative));
      res.writeHead(200, {
        "Content-Type": types[path.extname(relative)],
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      const status = error.status || (error.code === "ENOENT" ? 404 : 500);
      if (status === 500)
        console.error("Request failed:", error.code || error.name);
      if (!res.headersSent)
        json(status, {
          error:
            status === 500
              ? "Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại."
              : error.message,
          success: false,
        });
      else res.end();
    }
  });
}
