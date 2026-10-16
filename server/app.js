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
  getUserPurchaseStats,
  getAdminOrders,
  getAdminStats,
  updateAdminOrder,
  getAnnouncement,
  saveAnnouncement,
  getBankSettings,
  saveBankSettings,
  getAdminDeposits,
  manualCreditDeposit,
  revokeCreditDeposit,
  cancelDeposit,
  getShoppingGuide,
  listShoppingGuides,
  saveShoppingGuide,
  deleteShoppingGuide,
  toggleShoppingGuideStatus,
  listPartners,
  savePartner,
  togglePartnerStatus,
  deletePartner,
  createAdminToken,
  getAdminUserFromToken,
} from "./store.js";
import {
  getCatalog,
  quoteOrder,
  savePrices,
  listPromotions,
  savePromotion,
  setPromotionEnabled,
  deletePromotion,
  createCustomProduct,
  updateProduct,
  addCustomVariant,
  updateVariant,
  toggleProductStatus,
  deleteProduct,
  toggleVariantStatus,
  deleteVariant,
  getCategories,
  saveCategories,
  saveCatalogOrder,
  getInventory,
  updateInventory,
} from "./pricing.js";
import {
  digest,
  token,
  equal,
  passwordHash,
  checkPassword,
  verifyWebhook,
  createLimiter,
} from "./security.js";
import {
  getDiscordSettings,
  saveDiscordSettings,
  getPartnerDiscordSettings,
  savePartnerDiscordSettings,
  sendDiscordOrderNotification,
  sendDiscordTestNotification,
  sendPartnerDiscordTestNotification,
} from "./discord.js";
import {
  getContactsSettings,
  saveContactsSettings,
} from "./contacts.js";

const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function readBody(req, limit = 1048576) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw fail(413, "Yêu cầu quá lớn.");
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

export function createApp(db, config, { fetchFn = globalThis.fetch } = {}) {
  function paymentDetails(deposit, activeBank) {
    const bank = activeBank || config.bank;
    // VietinBank chỉ gửi giao dịch về SePay khi nội dung có tiền tố SEVQR.
    const transferContent = [bank.transferPrefix, deposit.code].filter(Boolean).join(" ");
    return {
      deposit: depositView(deposit),
      bank: { ...bank },
      transferContent,
      qrUrl: `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${new URLSearchParams({ amount: String(deposit.amount), addInfo: transferContent, accountName: bank.accountName })}`,
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
  async function authenticateAdmin(req) {
    const adminKey = req.headers["x-admin-key"] || "";
    if (!adminKey) return null;
    if (config.adminPassword && equal(adminKey, config.adminPassword)) {
      return { role: "admin", email: "admin@vietnamlegacy.com", name: "Quản trị viên" };
    }
    return await getAdminUserFromToken(db, adminKey, config.adminPassword);
  }

  async function requireAdmin(req) {
    const caller = await authenticateAdmin(req);
    if (!caller) {
      if (!config.adminPassword) throw fail(503, "Quản trị chưa được cấu hình.");
      throw fail(401, "Yêu cầu mật khẩu quản trị viên hợp lệ.");
    }
    if (caller.role !== "admin") {
      throw fail(403, "Chỉ quản trị viên cấp cao mới có quyền thực hiện thao tác này.");
    }
    return caller;
  }

  async function requireAdminOrPartner(req) {
    const caller = await authenticateAdmin(req);
    if (!caller) {
      if (!config.adminPassword) throw fail(503, "Quản trị chưa được cấu hình.");
      throw fail(401, "Yêu cầu đăng nhập quản trị viên hoặc đối tác hợp lệ.");
    }
    return caller;
  }

  async function requireGuideOwnership(tx, id, caller, allowMissing = false) {
    const row = await tx.prepare("SELECT partner_email FROM shopping_guides WHERE id = ?").get(id);
    if (!row) {
      if (allowMissing) return;
      throw fail(404, "Không tìm thấy bài hướng dẫn.");
    }
    if (caller.role === "partner" && String(row.partner_email || "").toLowerCase() !== caller.email.toLowerCase()) {
      throw fail(403, "Bạn chỉ được quản lý bài hướng dẫn của mình.");
    }
  }

  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://img.vietqr.io https://i.ytimg.com https://*.youtube.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; media-src 'self' https: data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
          const bankSettings = await getBankSettings(db, config);
          return json(200, {
            user: current ? { email: current.email } : null,
            csrfToken: current?.csrf_token ?? null,
            balance: current ? await balance(db, current.user_id) : null,
            paymentsEnabled: bankSettings.enabled,
            bank: {
              code: bankSettings.bank.code,
              name: bankSettings.bank.gateway,
              accountNumber: bankSettings.bank.accountNumber,
              accountName: bankSettings.bank.accountName,
            },
          });
        }
        const cleanRoute = route.replace(/\/+$/, "") || "/";
        if (
          req.method === "POST" &&
          (cleanRoute === "/api/webhooks/sepay" ||
            cleanRoute === "/api/payments/webhook" ||
            cleanRoute === "/api/webhook")
        ) {
          const bankSettings = await getBankSettings(db, config);
          if (!bankSettings.enabled && config.paymentsMode !== "live")
            throw fail(503, "Nạp tiền chưa được kích hoạt.");
          const raw = await readBody(req);
          const activeSecret = bankSettings.webhookSecret || config.webhookSecret;
          const queryToken =
            url.searchParams.get("token") ||
            url.searchParams.get("apiKey") ||
            url.searchParams.get("key") ||
            url.searchParams.get("secret") ||
            url.searchParams.get("api_key") ||
            url.searchParams.get("access_token");
          // Chưa có khóa thì dừng nhận giao dịch, không bỏ qua bước xác thực.
          if (!String(activeSecret || "").trim())
            throw fail(503, "Chưa cấu hình khóa xác thực webhook.");
          if (!verifyWebhook(req.headers, raw, activeSecret, Date.now(), queryToken))
            throw fail(401, "Chữ ký hoặc API Key webhook không hợp lệ.");
          const payload = parse(raw);
          if (typeof payload.transferAmount === "string" && /^\d+$/.test(payload.transferAmount.trim())) {
            payload.transferAmount = Number(payload.transferAmount.trim());
          }
          if (typeof payload.amount === "string" && /^\d+$/.test(payload.amount.trim())) {
            payload.amount = Number(payload.amount.trim());
          }
          // Giữ nguyên ID của SePay để lần gửi lại vẫn nhận ra giao dịch cũ.
          const result = await processTransfer(
            db,
            payload,
            bankSettings.bank,
            Date.now(),
            bankSettings.autoCredit,
          );
          console.log(`[Webhook SePay] ID: ${payload.id} | Outcome: ${result.outcome} | Code: ${result.depositCode || "none"} | Amount: ${result.amount}`);
          return json(200, {
            success: true,
            outcome: result.outcome,
            depositCode: result.depositCode,
            amount: result.amount,
          });
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
            purchaseStats: await getUserPurchaseStats(db, current.user_id),
          });
        }
        if (req.method === "POST" && route === "/api/deposits") {
          const current = await protect(req);
          const bankSettings = await getBankSettings(db, config);
          if (!bankSettings.enabled)
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
          return json(201, paymentDetails(deposit, bankSettings.bank));
        }
        const match = route.match(/^\/api\/deposits\/([a-f0-9-]{36})$/);
        if (req.method === "GET" && match) {
          const current = await requireSession(req);
          const row = await db
            .prepare("SELECT * FROM deposits WHERE id = ? AND user_id = ?")
            .get(match[1], current.user_id);
          if (!row) throw fail(404, "Không tìm thấy yêu cầu nạp.");
          const bankSettings = await getBankSettings(db, config);
          return json(200, {
            ...paymentDetails(row, bankSettings.bank),
            balance: await balance(db, current.user_id),
          });
        }
        if (req.method === "GET" && route === "/api/catalog") {
          return json(200, { products: await getCatalog(db), categories: await getCategories(db) });
        }
        if (req.method === "GET" && route === "/api/inventory") {
          return json(200, { success: true, inventory: await getInventory(db) });
        }
        if (req.method === "GET" && route === "/api/categories") {
          return json(200, { categories: await getCategories(db) });
        }
        if (req.method === "POST" && route === "/api/quote") {
          sameOrigin(req);
          const body = parse(await readBody(req));
          const current = await session(req);
          return json(200, { quote: await quoteOrder(db, body.items, body.couponCode, current?.user_id) });
        }
        if (req.method === "GET" && route === "/api/admin/pricing") {
          const caller = await requireAdminOrPartner(req);
          return json(200, {
            products: await getCatalog(db, Date.now(), true),
            promotions: caller.role === "admin"
              ? await listPromotions(db)
              : await listPromotions(db, Date.now(), caller.email),
            categories: await getCategories(db),
            caller,
          });
        }
        if (req.method === "PUT" && route === "/api/admin/catalog/reorder") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const products = await saveCatalogOrder(db, body.productIds);
          return json(200, { products });
        }
        if (req.method === "PUT" && route === "/api/admin/categories") {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const categories = await saveCategories(db, body.categories, Date.now(), caller);
          return json(200, { categories });
        }
        if (req.method === "PUT" && route === "/api/admin/inventory") {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const updated = await updateInventory(db, body, Date.now(), caller);
          return json(200, { success: true, updated, products: await getCatalog(db, Date.now(), true) });
        }
        if (req.method === "PUT" && route === "/api/admin/prices") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          await savePrices(db, body.prices);
          return json(200, { products: await getCatalog(db, Date.now(), true) });
        }
        if (req.method === "POST" && route === "/api/admin/products") {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const product = await createCustomProduct(db, body, Date.now(), null, caller);
          return json(201, { product });
        }
        const productToggleMatch = route.match(/^\/api\/admin\/products\/([a-z0-9_-]+)\/toggle$/);
        if (req.method === "PATCH" && productToggleMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(200, await toggleProductStatus(db, productToggleMatch[1], Boolean(body.isActive), Date.now(), caller));
        }
        const productMatch = route.match(/^\/api\/admin\/products\/([a-z0-9_-]+)$/);
        if (req.method === "PUT" && productMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const product = await updateProduct(db, productMatch[1], body, Date.now(), caller);
          return json(200, { product });
        }
        if (req.method === "DELETE" && productMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          return json(200, await deleteProduct(db, productMatch[1], Date.now(), caller));
        }
        const variantAddMatch = route.match(/^\/api\/admin\/products\/([a-z0-9_-]+)\/variants$/);
        if (req.method === "POST" && variantAddMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const variant = await addCustomVariant(db, variantAddMatch[1], body, Date.now(), caller);
          return json(201, { variant });
        }
        const variantToggleMatch = route.match(/^\/api\/admin\/products\/([a-z0-9_-]+)\/variants\/([a-z0-9_-]+)\/toggle$/);
        if (req.method === "PATCH" && variantToggleMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(200, await toggleVariantStatus(db, variantToggleMatch[1], variantToggleMatch[2], Boolean(body.isActive), Date.now(), caller));
        }
        const variantMatch = route.match(/^\/api\/admin\/products\/([a-z0-9_-]+)\/variants\/([a-z0-9_-]+)$/);
        if (req.method === "PUT" && variantMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const variant = await updateVariant(db, variantMatch[1], variantMatch[2], body, Date.now(), caller);
          return json(200, { variant });
        }
        if (req.method === "DELETE" && variantMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          return json(200, await deleteVariant(db, variantMatch[1], variantMatch[2], caller));
        }
        const promotionMatch = route.match(/^\/api\/admin\/promotions\/([a-f0-9-]{36})$/);
        if ((req.method === "POST" && route === "/api/admin/promotions") || (req.method === "PUT" && promotionMatch)) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(promotionMatch ? 200 : 201, {
            promotion: await savePromotion(db, body, promotionMatch?.[1], Date.now(), caller)
          });
        }
        if (req.method === "PATCH" && promotionMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          return json(200, {
            promotion: await setPromotionEnabled(db, promotionMatch[1], body.enabled, Date.now(), caller)
          });
        }
        if (req.method === "DELETE" && promotionMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          return json(200, await deletePromotion(db, promotionMatch[1], caller));
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
          let decorImage = null;

          if (body.decorImage) {
            decorImage = String(body.decorImage).trim().slice(0, 500000) || null;
          }

          const hasDecorItems = validatedItems.some(
            (item) =>
              item.productId === "decor" ||
              item.productId === "decor-gift" ||
              item.productId === "decor-log" ||
              /decor/i.test(item.productId),
          );

          if (hasDecorItems && !decorImage) {
            throw fail(
              400,
              "Đơn có mặt hàng Discord Decor. Vui lòng tải lên ảnh hoặc nhập link ảnh mẫu Decor bạn cần mua.",
            );
          }

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
            decorImage,
          });

          // Gửi thông báo đơn hàng đến Discord Admin (chạy an toàn, không gián đoạn đơn nếu lỗi)
          try {
            await sendDiscordOrderNotification(
              db,
              {
                ...order,
                discordAccount,
                discordPassword,
                backupCodes,
              },
              config.origin,
              fetchFn,
            );
          } catch (err) {
            console.error("[Discord Order Notification Error]", err);
          }

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
              decorImage: order.decorImage,
              status: order.status,
              createdAt: order.createdAt,
            },
            balance: await balance(db, current.user_id),
          });
        }
        if (req.method === "GET" && route === "/api/orders") {
          const current = await requireSession(req);
          const limit = Number(url.searchParams.get("limit") || 20);
          const offset = Number(url.searchParams.get("offset") || 0);
          if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
              !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
            throw fail(400, "Trang lịch sử mua hàng không hợp lệ.");
          const orders = await getUserOrders(db, current.user_id, { limit, offset });
          const stats = await getUserPurchaseStats(db, current.user_id);
          return json(200, {
            orders, stats, account: { email: current.email },
            pagination: { limit, offset, total: stats.totalOrders, hasMore: offset + orders.length < stats.totalOrders },
          });
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
          if (body.email) {
            const cleanEmail = String(body.email).trim().toLowerCase();
            const pass = String(body.password || "").trim();
            if (!cleanEmail || !pass) {
              throw fail(400, "Vui lòng nhập đầy đủ email và mật khẩu.");
            }
            const partner = await db.prepare("SELECT * FROM partners WHERE LOWER(email) = ?").get(cleanEmail);
            if (!partner) {
              throw fail(401, "Tài khoản đối tác không tồn tại.");
            }
            if (!partner.is_active) {
              throw fail(403, "Tài khoản đối tác đã bị khóa. Vui lòng liên hệ quản trị viên.");
            }
            const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(partner.user_id);
            if (!user) {
              throw fail(401, "Không tìm thấy tài khoản người dùng của đối tác.");
            }
            const valid = await checkPassword(pass, user.password_hash);
            if (!valid) {
              throw fail(401, "Mật khẩu đối tác không chính xác.");
            }
            const token = await createAdminToken(db, user.id, "partner");
            return json(200, {
              success: true,
              ok: true,
              adminKey: token,
              token,
              role: "partner",
              email: partner.email,
              name: partner.name,
            });
          }

          const pass = String(body.password || "");
          if (!equal(pass, config.adminPassword))
            throw fail(401, "Mật khẩu quản trị không đúng.");
          return json(200, {
            success: true,
            ok: true,
            adminKey: config.adminPassword,
            role: "admin",
            email: "admin@vietnamlegacy.com",
            name: "Quản trị viên",
          });
        }
        if (req.method === "GET" && route === "/api/admin/me") {
          const caller = await requireAdminOrPartner(req);
          return json(200, { success: true, user: caller, ...caller });
        }
        if (req.method === "GET" && route === "/api/admin/stats") {
          const caller = await requireAdminOrPartner(req);
          const stats = await getAdminStats(db, {
            partnerEmail: caller.role === "partner" ? caller.email : undefined,
          });
          return json(200, { success: true, stats });
        }
        if (req.method === "GET" && route === "/api/admin/orders") {
          const caller = await requireAdminOrPartner(req);
          const status = url.searchParams.get("status") || undefined;
          const partnerEmail = caller.role === "partner" ? caller.email : undefined;
          const orders = await getAdminOrders(db, { status, partnerEmail });
          return json(200, { orders, role: caller.role, partnerEmail: caller.email });
        }
        const adminOrderMatch = route.match(
          /^\/api\/admin\/orders\/([A-Za-z0-9_-]+)$/,
        );
        if (req.method === "PATCH" && adminOrderMatch) {
          const caller = await requireAdminOrPartner(req);
          const body = parse(await readBody(req));
          const partnerEmail = caller.role === "partner" ? caller.email : undefined;
          const updated = await updateAdminOrder(db, adminOrderMatch[1], {
            status: body.status,
            claimLink: body.claimLink,
          }, partnerEmail);
          return json(200, { success: true, order: updated });
        }
        if (req.method === "GET" && route === "/api/admin/partners") {
          await requireAdmin(req);
          const partners = await listPartners(db);
          return json(200, { success: true, ok: true, partners });
        }
        if (req.method === "POST" && route === "/api/admin/partners") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const partner = await savePartner(db, body);
          return json(201, { success: true, ok: true, partner });
        }
        const partnerToggleMatch = route.match(/^\/api\/admin\/partners\/([a-f0-9-]{36})\/toggle$/);
        if (req.method === "PATCH" && partnerToggleMatch) {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const result = await togglePartnerStatus(db, partnerToggleMatch[1], body.isActive);
          return json(200, { success: true, ok: true, ...result });
        }
        const partnerDeleteMatch = route.match(/^\/api\/admin\/partners\/([a-f0-9-]{36})$/);
        if (req.method === "DELETE" && partnerDeleteMatch) {
          await requireAdmin(req);
          sameOrigin(req);
          const result = await deletePartner(db, partnerDeleteMatch[1]);
          return json(200, { success: true, ok: true, ...result });
        }
        if (req.method === "GET" && route === "/api/announcement") {
          const ann = await getAnnouncement(db);
          return json(200, { success: true, announcement: ann });
        }
        if (req.method === "GET" && route === "/api/admin/announcement") {
          await requireAdmin(req);
          const ann = await getAnnouncement(db);
          return json(200, { success: true, announcement: ann });
        }
        if (req.method === "POST" && route === "/api/admin/announcement") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          if (typeof body.content !== "string" || typeof body.is_active !== "boolean") throw fail(400, "Nội dung hoặc trạng thái thông báo không hợp lệ.");
          const ann = await saveAnnouncement(db, body.content, body.is_active);
          return json(200, { success: true, announcement: ann });
        }
        if (req.method === "GET" && route === "/api/admin/bank") {
          await requireAdmin(req);
          const settings = await getBankSettings(db, config);
          return json(200, { success: true, settings });
        }
        if (req.method === "PUT" && route === "/api/admin/bank") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const settings = await saveBankSettings(db, body);
          return json(200, { success: true, settings });
        }
        if (req.method === "GET" && (route === "/api/admin/discord" || route === "/api/partner/discord")) {
          const caller = await requireAdminOrPartner(req);
          if (caller.role === "partner" || route === "/api/partner/discord") {
            const partnerEmail = caller.role === "partner" ? caller.email : (url.searchParams.get("partnerEmail") || "");
            if (!partnerEmail) throw fail(400, "Vui lòng chỉ định email đối tác.");
            const settings = await getPartnerDiscordSettings(db, partnerEmail);
            return json(200, { success: true, settings, role: "partner" });
          }
          const settings = await getDiscordSettings(db, process.env);
          return json(200, { success: true, settings, role: "admin" });
        }
        if (req.method === "PUT" && (route === "/api/admin/discord" || route === "/api/partner/discord")) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          if (caller.role === "partner" || route === "/api/partner/discord") {
            const partnerEmail = caller.role === "partner" ? caller.email : (body.partnerEmail || "");
            if (!partnerEmail) throw fail(400, "Vui lòng chỉ định email đối tác.");
            const settings = await savePartnerDiscordSettings(db, partnerEmail, body);
            return json(200, { success: true, settings, role: "partner" });
          }
          const settings = await saveDiscordSettings(db, body);
          return json(200, { success: true, settings, role: "admin" });
        }
        if (req.method === "POST" && (route === "/api/admin/discord/test" || route === "/api/partner/discord/test")) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          if (caller.role === "partner" || route === "/api/partner/discord/test") {
            const partnerEmail = caller.role === "partner" ? caller.email : (body.partnerEmail || "");
            if (!partnerEmail) throw fail(400, "Vui lòng chỉ định email đối tác.");
            const result = await sendPartnerDiscordTestNotification(db, partnerEmail, body, fetchFn);
            return json(200, { success: true, ...result, role: "partner" });
          }
          const result = await sendDiscordTestNotification(db, body, fetchFn);
          return json(200, { success: true, ...result, role: "admin" });
        }
        if (req.method === "GET" && route === "/api/contacts") {
          const settings = await getContactsSettings(db);
          const activeItems = settings.enabled
            ? settings.items.filter((item) => item.active)
            : [];
          return json(200, {
            success: true,
            enabled: settings.enabled,
            items: activeItems,
            contacts: activeItems,
          });
        }
        if (req.method === "GET" && route === "/api/admin/contacts") {
          await requireAdmin(req);
          const settings = await getContactsSettings(db);
          return json(200, { success: true, settings });
        }
        if (req.method === "PUT" && route === "/api/admin/contacts") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const settings = await saveContactsSettings(db, body);
          return json(200, { success: true, settings });
        }
        if (req.method === "GET" && route === "/api/admin/deposits") {
          await requireAdmin(req);
          const status = url.searchParams.get("status") || "all";
          const search = url.searchParams.get("search") || "";
          const limit = url.searchParams.get("limit") || 100;
          const deposits = await getAdminDeposits(db, { status, search, limit });
          return json(200, { success: true, deposits });
        }
        const adminDepositCreditMatch = route.match(
          /^\/api\/admin\/deposits\/([a-f0-9-]{36})\/credit$/,
        );
        if (req.method === "POST" && adminDepositCreditMatch) {
          await requireAdmin(req);
          sameOrigin(req);
          const result = await manualCreditDeposit(db, adminDepositCreditMatch[1]);
          return json(200, result);
        }
        const adminDepositRevokeMatch = route.match(
          /^\/api\/admin\/deposits\/([a-f0-9-]{36})\/revoke$/,
        );
        if (req.method === "POST" && adminDepositRevokeMatch) {
          await requireAdmin(req);
          sameOrigin(req);
          let targetStatus = "review";
          try {
            if (req.headers["content-type"]?.includes("application/json")) {
              const body = parse(await readBody(req));
              if (body?.targetStatus) targetStatus = body.targetStatus;
            }
          } catch {
            // Optional body
          }
          const result = await revokeCreditDeposit(db, adminDepositRevokeMatch[1], targetStatus);
          return json(200, result);
        }
        const adminDepositCancelMatch = route.match(
          /^\/api\/admin\/deposits\/([a-f0-9-]{36})\/cancel$/,
        );
        if (req.method === "POST" && adminDepositCancelMatch) {
          await requireAdmin(req);
          sameOrigin(req);
          const result = await cancelDeposit(db, adminDepositCancelMatch[1]);
          return json(200, result);
        }
        if (req.method === "POST" && route === "/api/admin/deposits/simulate") {
          await requireAdmin(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          const code = String(body.code || "").trim().toUpperCase();
          const depositId = String(body.depositId || "").trim();
          let deposit = null;
          if (code) {
            deposit = await db.prepare("SELECT * FROM deposits WHERE code = ?").get(code);
          } else if (depositId) {
            deposit = await db.prepare("SELECT * FROM deposits WHERE id = ?").get(depositId);
          }
          if (!deposit) throw fail(404, "Không tìm thấy yêu cầu nạp tiền.");
          const bankSettings = await getBankSettings(db, config);
          const simEvent = {
            id: String(Date.now()),
            transferAmount: deposit.amount,
            code: deposit.code,
            content: `VNL TEST AUTO CREDIT ${deposit.code}`,
            gateway: bankSettings.bank.gateway || "MB",
            accountNumber: bankSettings.bank.accountNumber || "",
            transferType: "in",
          };
          const result = await processTransfer(db, simEvent, bankSettings.bank, Date.now(), true);
          return json(200, { success: true, result, depositId: deposit.id, code: deposit.code });
        }
        if (req.method === "GET" && route === "/api/guide") {
          const id = url.searchParams.get("id");
          if (id) {
            const guide = await getShoppingGuide(db, id);
            return json(200, { success: true, guide });
          }
          const guide = await getShoppingGuide(db);
          const guides = await listShoppingGuides(db, false);
          return json(200, { success: true, guide, guides });
        }
        const publicGuideMatch = route.match(/^\/api\/guide\/([a-z0-9_-]+)$/);
        if (req.method === "GET" && publicGuideMatch) {
          const guide = await getShoppingGuide(db, publicGuideMatch[1]);
          return json(200, { success: true, guide });
        }
        if (req.method === "GET" && route === "/api/admin/guide") {
          const caller = await requireAdminOrPartner(req);
          const guides = await listShoppingGuides(db, true, caller);
          const guide = guides.find(item => item.id === "main") || guides[0] || null;
          return json(200, { success: true, guide, guides });
        }
        const adminGuideToggleMatch = route.match(/^\/api\/admin\/guide\/([a-z0-9_-]+)\/toggle$/);
        if (req.method === "PATCH" && adminGuideToggleMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req));
          if (typeof body.isActive !== "boolean") throw fail(400, "Trạng thái bài viết không hợp lệ.");
          const result = await db.transaction(async tx => {
            await requireGuideOwnership(tx, adminGuideToggleMatch[1], caller);
            return toggleShoppingGuideStatus(tx, adminGuideToggleMatch[1], body.isActive);
          });
          return json(200, result);
        }
        const adminGuideItemMatch = route.match(/^\/api\/admin\/guide\/([a-z0-9_-]+)$/);
        if (req.method === "DELETE" && adminGuideItemMatch) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const result = await db.transaction(async tx => {
            await requireGuideOwnership(tx, adminGuideItemMatch[1], caller);
            return deleteShoppingGuide(tx, adminGuideItemMatch[1]);
          });
          return json(200, result);
        }
        if (["POST", "PUT"].includes(req.method) && (route === "/api/admin/guide" || adminGuideItemMatch)) {
          const caller = await requireAdminOrPartner(req);
          sameOrigin(req);
          const body = parse(await readBody(req, 15 * 1048576));
          const guideId = adminGuideItemMatch ? adminGuideItemMatch[1] : body.id || (caller.role === "partner" ? "new" : "main");
          // Seed shop guides before the first partner article on a new installation.
          await listShoppingGuides(db, true, caller);
          const guide = await db.transaction(async tx => {
            if (guideId !== "new") await requireGuideOwnership(tx, guideId, caller, caller.role === "admin");
            const saved = await saveShoppingGuide(tx, { ...body, id: guideId });
            if (caller.role === "partner" && guideId === "new") {
              await tx.prepare("UPDATE shopping_guides SET partner_email = ? WHERE id = ?")
                .run(caller.email.toLowerCase(), saved.id);
            }
            return saved;
          });
          return json(200, { success: true, guide });
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
          "sitemap.xml",
          "robots.txt",
          "favicon.ico",
          "local-entry.js",
          "styles.css",
          "products.js",
          "app.js",
          "hero3d.js",
          "bg3d.js",
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
