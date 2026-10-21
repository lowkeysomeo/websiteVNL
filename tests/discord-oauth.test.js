import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { openStore, createOrder, getAdminOrders } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import {
  getDiscordAuthorizeUrl,
  computeDiscordAvatarUrl,
  syncDiscordUser,
  exchangeDiscordCode,
  fetchDiscordUser,
} from "../server/discord-oauth.js";
import { getDiscordSettings, saveDiscordSettings } from "../server/discord.js";
import { passwordHash, digest } from "../server/security.js";

async function creditWallet(db, userId, amount = 500000) {
  const depositId = randomUUID();
  const txId = "TX-" + randomBytes(8).toString("hex");
  const code = "VNL" + randomBytes(6).toString("hex").toUpperCase();
  await db
    .prepare(
      "INSERT INTO deposits (id, user_id, code, amount, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(depositId, userId, code, amount, "credited", Date.now(), Date.now() + 86400000);
  await db
    .prepare(
      "INSERT INTO bank_events (transaction_id, deposit_id, amount, outcome, received_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(txId, depositId, amount, "credited", Date.now());
  await db
    .prepare(
      "INSERT INTO wallet_ledger (id, user_id, deposit_id, transaction_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, depositId, txId, amount, Date.now());
}

async function setupTestApp(overrides = {}, fetchFn = globalThis.fetch) {
  const db = await openStore(":memory:");
  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "testadminsecret",
    ...overrides,
  });

  const server = createApp(db, config, { fetchFn });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  async function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        `${origin}${path}`,
        {
          method,
          headers: {
            Origin: config.origin,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(payload),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString();
            let data = null;
            try {
              data = JSON.parse(raw);
            } catch {
              data = raw;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data,
              raw,
            });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    db,
    config,
    server,
    origin,
    request,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test("Discord OAuth Unit: getDiscordAuthorizeUrl tạo đúng query parameters", () => {
  const urlStr = getDiscordAuthorizeUrl({
    clientId: "123456789012345678",
    redirectUri: "https://shop.vietnamlegacy.com/api/auth/discord/callback",
    state: "randomstate123",
  });
  const url = new URL(urlStr);
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.pathname, "/api/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "123456789012345678");
  assert.equal(url.searchParams.get("redirect_uri"), "https://shop.vietnamlegacy.com/api/auth/discord/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "identify email");
  assert.equal(url.searchParams.get("state"), "randomstate123");
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("Discord OAuth Unit: computeDiscordAvatarUrl trả URL avatar hoặc default avatar cdn", () => {
  const avatarUrl = computeDiscordAvatarUrl("123456789012345678", "abcdef123456");
  assert.equal(avatarUrl, "https://cdn.discordapp.com/avatars/123456789012345678/abcdef123456.png");

  const defaultAvatar = computeDiscordAvatarUrl("604729446649298963", null);
  assert.match(defaultAvatar, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);

  assert.equal(computeDiscordAvatarUrl("", null), null);
});

test("Discord OAuth Unit: syncDiscordUser - tạo tài khoản mới, cập nhật hoặc tự động liên kết", async () => {
  const db = await openStore(":memory:");
  try {
    // 1. Tạo user mới từ Discord
    const discordUser1 = {
      id: "777888999111222333",
      username: "gamer_pro",
      global_name: "Gamer Pro VN",
      email: "gamerpro@example.com",
      avatar: "hash123",
    };
    const createdUser = await syncDiscordUser(db, discordUser1);
    assert.ok(createdUser.id);
    assert.equal(createdUser.email, "gamerpro@example.com");
    assert.equal(createdUser.discord_id, "777888999111222333");
    assert.equal(createdUser.discord_username, "gamer_pro");
    assert.equal(createdUser.discord_global_name, "Gamer Pro VN");

    // 2. Đăng nhập lại với discord_id tương tự -> cập nhật username/avatar
    const updatedUser = await syncDiscordUser(db, {
      ...discordUser1,
      username: "gamer_pro_v2",
      global_name: "Pro VN Master",
      avatar: "hash456",
    });
    assert.equal(updatedUser.id, createdUser.id);
    assert.equal(updatedUser.discord_username, "gamer_pro_v2");
    assert.equal(updatedUser.discord_global_name, "Pro VN Master");

    // 3. User có sẵn email trong hệ thống -> tự động liên kết khi đăng nhập Discord bằng email đó
    const manualUserId = randomUUID();
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(manualUserId, "existing@example.com", "hashpw", now);

    const linkedByEmail = await syncDiscordUser(db, {
      id: "555666777888999000",
      username: "discord_existing",
      global_name: "Existing Person",
      email: "existing@example.com",
      avatar: null,
    });
    assert.equal(linkedByEmail.id, manualUserId);
    assert.equal(linkedByEmail.discord_id, "555666777888999000");
    assert.equal(linkedByEmail.discord_username, "discord_existing");

    // 4. Liên kết thủ công cho người dùng đang đăng nhập
    const userToLink = randomUUID();
    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userToLink, "linktarget@example.com", "hashpw", now);

    const manualLinked = await syncDiscordUser(
      db,
      {
        id: "111222333444555666",
        username: "manual_discord_user",
        global_name: "Manual User",
        email: "other@example.com",
        avatar: null,
      },
      userToLink,
    );
    assert.equal(manualLinked.id, userToLink);
    assert.equal(manualLinked.discord_id, "111222333444555666");

    // 5. Thử liên kết Discord ID đã bị tài khoản khác dùng -> báo lỗi conflict
    await assert.rejects(
      async () => {
        await syncDiscordUser(
          db,
          {
            id: "111222333444555666", // đã dùng bởi userToLink
            username: "hacker",
            global_name: "Hacker",
            email: "hacker@example.com",
          },
          manualUserId,
        );
      },
      /Tài khoản Discord này đã được liên kết với một người dùng khác/,
    );
  } finally {
    db.close();
  }
});

test("Discord OAuth HTTP API: luồng ủy quyền, callback, đăng nhập và liên kết tài khoản", async () => {
  // Chuẩn bị Mock fetch cho Discord API
  const mockFetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr === "https://discord.com/api/oauth2/token") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-access-token-999",
          token_type: "Bearer",
          expires_in: 604800,
          refresh_token: "mock-refresh-token",
          scope: "identify email",
        }),
      };
    }
    if (urlStr === "https://discord.com/api/users/@me") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "1562154223783907560",
          username: "vnlegacy_buyer",
          global_name: "VN Legacy Buyer",
          avatar: "abc123avatar",
          email: "buyer_oauth@example.com",
          verified: true,
        }),
      };
    }
    return { ok: false, status: 404, text: async () => "Not found" };
  };

  const app = await setupTestApp({}, mockFetch);
  try {
    // 1. Kiểm tra khi chưa cấu hình Client ID / Secret
    const preRes = await app.request("GET", "/api/auth/discord");
    assert.equal(preRes.status, 302);
    assert.match(preRes.headers.location, /discord_auth_error=/);

    // 2. Admin cấu hình Discord OAuth
    await saveDiscordSettings(app.db, {
      enabled: true,
      oauthEnabled: true,
      clientId: "998877665544332211",
      clientSecret: "very_secret_key_discord_123",
      redirectUri: `${app.origin}/api/auth/discord/callback`,
    });

    // 3. GET /api/session thông báo discordAuthEnabled: true
    const sessionRes = await app.request("GET", "/api/session");
    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.body.discordAuthEnabled, true);

    // 4. Khách bấm nút Đăng nhập Discord: GET /api/auth/discord
    const authRedirect = await app.request("GET", "/api/auth/discord");
    assert.equal(authRedirect.status, 302);
    assert.match(authRedirect.headers.location, /^https:\/\/discord\.com\/api\/oauth2\/authorize\?/);

    const setCookieHeader = authRedirect.headers["set-cookie"];
    assert.ok(setCookieHeader);
    const stateCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader.find((c) => c.startsWith("vnl_discord_oauth_state="))
      : setCookieHeader;
    assert.ok(stateCookie);
    const matchState = stateCookie.match(/vnl_discord_oauth_state=([^;]+)/);
    assert.ok(matchState);
    const [stateToken] = matchState[1].split(":");

    // 5. Discord chuyển hướng về callback với mã code và state
    const callbackRes = await app.request(
      "GET",
      `/api/auth/discord/callback?code=mock_code_abc&state=${stateToken}`,
      null,
      {
        Cookie: `vnl_discord_oauth_state=${matchState[1]}`,
      },
    );

    assert.equal(callbackRes.status, 302);
    assert.match(callbackRes.headers.location, /\/\?discord_auth=success/);

    // Kiểm tra Set-Cookie tạo session mới cho khách
    const cbCookies = callbackRes.headers["set-cookie"];
    assert.ok(cbCookies);
    const sessionCookie = Array.isArray(cbCookies)
      ? cbCookies.find((c) => c.startsWith("vnl_session="))
      : cbCookies;
    assert.ok(sessionCookie);
    const sessionToken = sessionCookie.match(/vnl_session=([^;]+)/)[1];

    // 6. Kiểm tra phiên đăng nhập đã lưu đúng thông tin Discord của buyer
    const loggedSessionRes = await app.request("GET", "/api/session", null, {
      Cookie: `vnl_session=${sessionToken}`,
    });
    assert.equal(loggedSessionRes.status, 200);
    assert.ok(loggedSessionRes.body.user);
    assert.equal(loggedSessionRes.body.user.discordId, "1562154223783907560");
    assert.equal(loggedSessionRes.body.user.discordUsername, "vnlegacy_buyer");
    assert.equal(loggedSessionRes.body.user.discordGlobalName, "VN Legacy Buyer");
    assert.ok(loggedSessionRes.body.user.discordAvatar);

    // 7. Khách hàng nạp ví và đặt đơn -> Đơn hàng tự động lưu và hiển thị thông tin Buyer Discord
    const buyerUserId = loggedSessionRes.body.user.id;
    await creditWallet(app.db, buyerUserId, 500000);

    const orderRes = await app.request(
      "POST",
      "/api/orders",
      {
        name: "Buyer Test VN",
        email: "buyer_oauth@example.com",
        note: "Test buyer discord tag",
        items: [
          {
            productId: "nitro",
            variantId: "boost_gift_1m",
            quantity: 1,
          },
        ],
      },
      {
        Cookie: `vnl_session=${sessionToken}`,
        "X-CSRF-Token": loggedSessionRes.body.csrfToken,
      },
    );
    assert.equal(orderRes.status, 201);
    assert.ok(orderRes.body.order?.id);
    const createdOrderId = orderRes.body.order.id;

    // 8. Admin lấy danh sách đơn: đơn hàng chứa buyerDiscord đầy đủ
    const adminOrdersRes = await app.request("GET", "/api/admin/orders", null, {
      "X-Admin-Key": "testadminsecret",
    });
    assert.equal(adminOrdersRes.status, 200);
    const createdOrder = adminOrdersRes.body.orders.find((o) => o.id === createdOrderId);
    assert.ok(createdOrder);
    assert.ok(createdOrder.buyerDiscord);
    assert.equal(createdOrder.buyerDiscord.id, "1562154223783907560");
    assert.equal(createdOrder.buyerDiscord.username, "vnlegacy_buyer");
    assert.equal(createdOrder.buyerDiscord.globalName, "VN Legacy Buyer");

    // 9. Khách hủy liên kết Discord: POST /api/auth/discord/unlink
    const unlinkRes = await app.request("POST", "/api/auth/discord/unlink", {}, {
      Cookie: `vnl_session=${sessionToken}`,
      "X-CSRF-Token": loggedSessionRes.body.csrfToken,
    });
    assert.equal(unlinkRes.status, 200);
    assert.equal(unlinkRes.body.success, true);

    const postUnlinkSession = await app.request("GET", "/api/session", null, {
      Cookie: `vnl_session=${sessionToken}`,
    });
    assert.equal(postUnlinkSession.body.user.discordId, null);
    assert.equal(postUnlinkSession.body.user.discordUsername, null);
  } finally {
    await app.close();
  }
});
