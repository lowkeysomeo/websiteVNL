import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./config.js";
import {
  balance,
  processTransfer,
  createOrder,
  getUserOrders,
  getAdminOrders,
  updateAdminOrder,
  getAnnouncement,
  saveAnnouncement,
} from "./store.js";
import { getCatalog, quoteOrder, savePrices, listPromotions, savePromotion, setPromotionEnabled } from "./pricing.js";
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
  ".json": "application/json",
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
  async function session(req) {
    const raw = String(req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    return await db
      .prepare(
        "SELECT s.*, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE token_hash = ? AND expires_at > ?",
      )
      .get(digest(raw), Date.now());
  }
  async function requireSession(req) {
    const value = await session(req);
    if (!value) throw fail(401, "Vui lòng đăng nhập.");
    return value;
  }
  function sameOrigin(req) {
    if (req.headers.origin !== config.origin)
      throw fail(403, "Nguồn yêu cầu không hợp lệ.");
  }
  async function protect(req) {
    sameOrigin(req);
    const value = await requireSession(req);
    if (!equal(value.csrf_token, req.headers["x-csrf-token"] || ""))
      throw fail(403, "Phiên không hợp lệ. Vui lòng tải lại trang.");
    return value;
  }
  async function startSession(res, userId) {
    const raw = token();
    const csrf = token();
    await db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
    await db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(digest(raw), userId, csrf, Date.now() + SESSION_AGE);
    res.setHeader("Set-Cookie", cookie(raw, SESSION_AGE / 1000));
    return csrf;
  }
  function requireAdmin(req) {
    if (!config.adminPassword) throw fail(503, "Quản trị chưa được cấu hình.");
    const adminKey = req.headers["x-admin-key"] || "";
    if (!equal(adminKey, config.adminPassword)) {
      throw fail(401, "Yêu cầu mật khẩu quản trị viên hợp lệ.");
    }
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
        if (req.method === "GET" && route === "/api/health") {
          await db.prepare("SELECT 1").get();
          return json(200, { ok: true });
        }
        if (req.method === "GET" && route === "/api/session") {
          const current = await session(req);
          return json(200, {
            user: current ? { email: current.email } : null,
            csrfToken: current?.csrf_token ?? null,
            balance: current ? await balance(db, current.user_id) : null,
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
          const result = await processTransfer(db, parse(raw), config.bank);
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
          let user = await db
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
              await db
                .prepare(
                  "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                )
                .run(user.id, email, hash, Date.now());
            } catch (error) {
              if (
                ["ERR_SQLITE_ERROR", "SQLITE_CONSTRAINT_UNIQUE"].includes(
                  error.code,
                ) &&
                (await db
                  .prepare("SELECT id FROM users WHERE email = ?")
                  .get(email))
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
          const previous = await session(req);
          if (previous)
            await db
              .prepare("DELETE FROM sessions WHERE token_hash = ?")
              .run(previous.token_hash);
          const csrfToken = await startSession(res, user.id);
          return json(route.endsWith("/register") ? 201 : 200, {
            user: { email },
            csrfToken,
            balance: await balance(db, user.id),
          });
        }
        if (req.method === "POST" && route === "/api/auth/logout") {
          const current = await protect(req);
          await db
            .prepare("DELETE FROM sessions WHERE token_hash = ?")
            .run(current.token_hash);
          res.setHeader("Set-Cookie", cookie("", 0));
          return json(200, { ok: true });
        }
        if (req.method === "GET" && route === "/api/wallet") {
          const current = await requireSession(req);
          const deposits = (
            await db
              .prepare(
                "SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
              )
              .all(current.user_id)
          ).map(depositView);
          return json(200, {
            balance: await balance(db, current.user_id),
            deposits,
          });
        }
        if (req.method === "POST" && route === "/api/deposits") {
          const current = await protect(req);
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
          await db
            .prepare(
              "UPDATE deposits SET status = 'expired' WHERE user_id = ? AND status = 'pending' AND expires_at < ?",
            )
            .run(current.user_id, now);
          const pending = (
            await db
              .prepare(
                "SELECT COUNT(*) AS count FROM deposits WHERE user_id = ? AND status = 'pending'",
              )
              .get(current.user_id)
          ).count;
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
          await db
            .prepare(
              "INSERT INTO deposits (id, user_id, code, amount, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .run(
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
          const current = await requireSession(req);
          const row = await db
            .prepare("SELECT * FROM deposits WHERE id = ? AND user_id = ?")
            .get(match[1], current.user_id);
          if (!row) throw fail(404, "Không tìm thấy yêu cầu nạp.");
          return json(200, {
            ...paymentDetails(row),
            balance: await balance(db, current.user_id),
          });
        }
        if (req.method === "GET" && route === "/api/catalog") {
          return json(200, { products: await getCatalog(db) });
        }
        if (req.method === "POST" && route === "/api/quote") {
          sameOrigin(req);
          const body = parse(await readBody(req));
          const current = await session(req);
          return json(200, { quote: await quoteOrder(db, body.items, body.couponCode, current?.user_id) });
        }
        if (req.method === "GET" && route === "/api/admin/pricing") {
          requireAdmin(req);
          return json(200, { products: await getCatalog(db), promotions: await listPromotions(db) });
        }
        if (req.method === "PUT" && route === "/api/admin/prices") {
          requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          await savePrices(db, body.prices);
          return json(200, { products: await getCatalog(db) });
        }
        const promotionMatch = route.match(/^\/api\/admin\/promotions\/([a-f0-9-]{36})$/);
        if ((req.method === "POST" && route === "/api/admin/promotions") || (req.method === "PUT" && promotionMatch)) {
          requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(promotionMatch ? 200 : 201, { promotion: await savePromotion(db, body, promotionMatch?.[1]) });
        }
        if (req.method === "PATCH" && promotionMatch) {
          requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(200, { promotion: await setPromotionEnabled(db, promotionMatch[1], body.enabled) });
        }
        if (req.method === "POST" && route === "/api/orders") {
          const current = await protect(req);
          if (!allow(`order:${current.user_id}`, 30, 60000))
            throw fail(429, "Quá nhiều đơn hàng. Vui lòng thử lại sau 1 phút.");
          const body = parse(await readBody(req));
          const { validatedItems, total, hasLogItems, hasBoostItems } =
            await quoteOrder(db, body.items, body.couponCode, current.user_id);

          const customerName = String(body.name || "").trim();
          const customerEmail = String(body.email || "")
            .trim()
            .toLowerCase();
          const customerNote = String(body.note || "")
            .trim()
            .slice(0, 500);

          if (!customerName || customerName.length > 80)
            throw fail(400, "Vui lòng nhập tên người nhận (tối đa 80 ký tự).");
          if (
            !customerEmail ||
            customerEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
          )
            throw fail(400, "Vui lòng nhập email hợp lệ.");

          let discordAccount = null;
          let discordPassword = null;
          let backupCodes = null;
          let serverInvite = null;

          if (hasBoostItems) {
            serverInvite = String(body.serverInvite || "").trim();
            if (
              !serverInvite ||
              !/(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9_-]+|https?:\/\//i.test(
                serverInvite,
              )
            ) {
              throw fail(
                400,
                "Đơn có gói Boost Server. Vui lòng cung cấp link mời vô thời hạn của Server Discord cần boost (VD: https://discord.gg/abcxyz).",
              );
            }
          }

          if (hasLogItems) {
            discordAccount = String(body.discordAccount || "").trim();
            discordPassword = String(body.discordPassword || "").trim();
            backupCodes = String(body.backupCodes || "").trim();

            if (
              !discordAccount ||
              discordAccount.length < 3 ||
              discordAccount.length > 100
            )
              throw fail(
                400,
                "Đơn có gói Nạp Acc (Log). Vui lòng nhập tài khoản Discord (Email/SĐT).",
              );
            if (
              !discordPassword ||
              discordPassword.length < 4 ||
              discordPassword.length > 128
            )
              throw fail(
                400,
                "Đơn có gói Nạp Acc (Log). Vui lòng nhập mật khẩu Discord.",
              );
            const codes = backupCodes
              .split(/[\r\n,;\s]+/)
              .map((c) => c.trim())
              .filter(Boolean);
            if (codes.length < 3)
              throw fail(
                400,
                "Đơn có gói Nạp Acc (Log). Vui lòng cung cấp tối thiểu 3 mã dự phòng Discord (Backup Codes).",
              );
          }

          const order = await createOrder(db, {
            userId: current.user_id,
            customerName,
            customerEmail,
            customerNote,
            requestItems: body.items,
            couponCode: body.couponCode,
            quoteFingerprint: body.quoteFingerprint,
            items: validatedItems,
            total,
            paymentMethod: "wallet",
            hasLogItems,
            discordAccount,
            discordPassword,
            backupCodes,
            serverInvite,
          });

          return json(201, {
            success: true,
            order: {
              id: order.id,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerNote: order.customerNote,
              items: order.items,
              total: order.total,
              pricing: order.pricing,
              paymentMethod: order.paymentMethod,
              hasLogItems: order.hasLogItems,
              serverInvite: order.serverInvite,
              status: order.status,
              createdAt: order.createdAt,
            },
            balance: await balance(db, current.user_id),
          });
        }
        if (req.method === "GET" && route === "/api/orders") {
          const current = await requireSession(req);
          const orders = await getUserOrders(db, current.user_id);
          return json(200, { orders });
        }
        if (req.method === "POST" && route === "/api/admin/auth") {
          if (!config.adminPassword)
            throw fail(503, "Quản trị chưa được cấu hình.");
          if (!allow(`admin-auth:${ip}`, 10, 15 * 60000))
            throw fail(
              429,
              "Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.",
            );
          const body = parse(await readBody(req));
          const pass = String(body.password || "");
          if (!equal(pass, config.adminPassword))
            throw fail(401, "Mật khẩu quản trị không đúng.");
          return json(200, { success: true, adminKey: config.adminPassword });
        }
        if (req.method === "GET" && route === "/api/admin/orders") {
          requireAdmin(req);
          const status = url.searchParams.get("status") || undefined;
          const orders = await getAdminOrders(db, { status });
          return json(200, { orders });
        }
        const adminOrderMatch = route.match(
          /^\/api\/admin\/orders\/([A-Za-z0-9_-]+)$/,
        );
        if (req.method === "PATCH" && adminOrderMatch) {
          requireAdmin(req);
          const body = parse(await readBody(req));
          const updated = await updateAdminOrder(db, adminOrderMatch[1], {
            status: body.status,
            claimLink: body.claimLink,
          });
          return json(200, { success: true, order: updated });
        }
        if (req.method === "GET" && route === "/api/announcement") {
          const ann = await getAnnouncement(db);
          return json(200, { success: true, announcement: ann });
        }
        if (req.method === "GET" && route === "/api/admin/announcement") {
          requireAdmin(req);
          const ann = await getAnnouncement(db);
          return json(200, { success: true, announcement: ann });
        }
        if (req.method === "POST" && route === "/api/admin/announcement") {
          requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          if (typeof body.content !== "string" || typeof body.is_active !== "boolean") throw fail(400, "Nội dung hoặc trạng thái thông báo không hợp lệ.");
          const ann = await saveAnnouncement(db, body.content, body.is_active);
          return json(200, { success: true, announcement: ann });
        }
        throw fail(404, "Không tìm thấy chức năng.");
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw fail(405, "Phương thức không được hỗ trợ.");
      let relative = route === "/" ? "index.html" : route.slice(1);
      if (relative === "admin") relative = "admin.html";
      // Never expose backend code, environment files, databases or arbitrary project files.
      if (
        ![
          "index.html",
          "local-entry.js",
          "styles.css",
          "products.js",
          "app.js",
          "hero3d.js",
          "cursor.js",
          "intro.js",
          "wallet.js",
          "wallet.css",
          "admin.html",
          "admin.js",
          "admin-pricing.js",
          "admin.css",
        ].includes(relative) &&
        !/^assets\/(vendor\/|fonts\/)?[a-zA-Z0-9_.-]+\.(svg|png|js|json)$/.test(
          relative,
        )
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
