import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { openStore, createOrder } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import {
  DEFAULT_LEGIT_CHANNEL_ID,
  DEFAULT_LEGIT_TEMPLATE,
  renderLegitTemplateText,
  maskCustomerName,
  maskEmail,
  buildLegitFeedbackEmbed,
  getDiscordSettings,
  saveDiscordSettings,
  sendDiscordLegitFeedbackNotification,
  sendDiscordLegitFeedbackTestNotification,
} from "../server/discord.js";

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
            Host: "localhost:3000",
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
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              rawText: data,
            });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  const adminHeaders = {
    "X-Admin-Key": config.adminPassword,
  };

  return { db, config, origin, server, request, adminHeaders };
}

test("DEFAULT_LEGIT_CHANNEL_ID: kênh Discord mặc định là 1562154223783907560", () => {
  assert.equal(DEFAULT_LEGIT_CHANNEL_ID, "1562154223783907560");
});

test("maskCustomerName & maskEmail: ẩn danh bảo mật thông tin khách hàng", () => {
  assert.equal(maskCustomerName("Nguyễn Hoàng Nam"), "Nguyễn ***");
  assert.equal(maskCustomerName("John Doe"), "John ***");
  assert.equal(maskCustomerName("Alex"), "Al***");
  assert.equal(maskCustomerName("Vy"), "V*");
  assert.equal(maskCustomerName(""), "Khách hàng");
  assert.equal(maskCustomerName(null), "Khách hàng");

  assert.equal(maskEmail("khachhang@gmail.com"), "kh***@gmail.com");
  assert.equal(maskEmail("admin@vietnamlegacy.com"), "ad***@vietnamlegacy.com");
  assert.equal(maskEmail("a@domain.com"), "a***@domain.com");
  assert.equal(maskEmail("invalid-email"), "N/A");
  assert.equal(maskEmail(null), "N/A");
});

test("buildLegitFeedbackEmbed: tạo embed check legit chuẩn uy tín và không làm lộ thông tin nhạy cảm", () => {
  const sampleOrder = {
    id: "VNL-TEST9999",
    customerName: "Nguyễn Văn Test",
    customerEmail: "khachhang@example.com",
    customerNote: "Giao nhanh giúp em",
    discordAccount: "secret_account_login",
    discordPassword: "super_secret_password_123",
    discordToken: "mfa.secret_token_abc_xyz",
    backupCodes: "12345678\n87654321",
    claimLink: "https://discord.gift/SECRET_CLAIM_KEY",
    total: 250000,
    items: [
      {
        productId: "discord-nitro-boost",
        productName: "Discord Nitro Boost 1 Tháng",
        variantName: "Gói bảo hành full",
        quantity: 2,
        price: 125000,
      },
    ],
    completedAt: 1774320000000,
  };

  const payload = buildLegitFeedbackEmbed(
    sampleOrder,
    { legitChannelId: "1562154223783907560" },
    "https://vietnamlegacy.com",
  );

  assert.ok(payload.content.includes("VNL-TEST9999"));
  assert.ok(payload.content.includes("[LEGIT CHECK]"));
  assert.equal(payload.embeds.length, 1);

  const embed = payload.embeds[0];
  assert.equal(embed.color, 0x22c55e); // Xanh lá legit check
  assert.ok(embed.title.includes("LEGIT CHECK"));
  assert.ok(embed.footer.text.includes("1562154223783907560"));

  // Kiểm tra tuyệt đối không làm lộ mật khẩu, token, backup codes, claim link
  const embedString = JSON.stringify(embed);
  assert.ok(!embedString.includes("super_secret_password_123"));
  assert.ok(!embedString.includes("secret_account_login"));
  assert.ok(!embedString.includes("mfa.secret_token_abc_xyz"));
  assert.ok(!embedString.includes("SECRET_CLAIM_KEY"));

  // Kiểm tra thông tin khách hàng đã được che
  assert.ok(embedString.includes("Nguyễn ***"));
  assert.ok(embedString.includes("kh***@example.com"));
  assert.ok(embedString.includes("250.000₫"));
  assert.ok(embedString.includes("Discord Nitro Boost 1 Tháng"));
  assert.ok(embedString.includes("(Gói bảo hành full) x2"));
});

test("Cài đặt Discord: lưu và đọc cấu hình Webhook Check Legit (Channel ID 1562154223783907560)", async () => {
  const db = await openStore(":memory:");

  // Ban đầu chưa có cấu hình
  const initial = await getDiscordSettings(db);
  assert.equal(initial.feedbackWebhookUrl, "");
  assert.equal(initial.legitChannelId, "1562154223783907560");
  assert.equal(initial.feedbackEnabled, true);

  // Lưu cấu hình
  const saved = await saveDiscordSettings(db, {
    enabled: true,
    webhookUrl: "https://discord.com/api/webhooks/1111/admin-token",
    adminId: "604729446649298963",
    feedbackEnabled: true,
    feedbackWebhookUrl: "https://discord.com/api/webhooks/2222/legit-token",
    legitChannelId: "1562154223783907560",
  });

  assert.equal(saved.feedbackWebhookUrl, "https://discord.com/api/webhooks/2222/legit-token");
  assert.equal(saved.legitChannelId, "1562154223783907560");
  assert.equal(saved.feedbackEnabled, true);

  // Đọc lại từ DB
  const reloaded = await getDiscordSettings(db);
  assert.equal(reloaded.feedbackWebhookUrl, "https://discord.com/api/webhooks/2222/legit-token");
  assert.equal(reloaded.legitChannelId, "1562154223783907560");

  // Kiểm tra validate lỗi nếu URL hoặc channel ID không đúng format
  await assert.rejects(
    () =>
      saveDiscordSettings(db, {
        feedbackWebhookUrl: "ftp://invalid-url",
      }),
    /Webhook Kênh Check Legit không hợp lệ/,
  );

  await assert.rejects(
    () =>
      saveDiscordSettings(db, {
        legitChannelId: "abc_invalid_id",
      }),
    /ID Kênh Check Legit không hợp lệ/,
  );
});

test("sendDiscordLegitFeedbackNotification: gửi feedback khi đơn hoàn thành và xử lý lỗi mạng an toàn", async () => {
  const db = await openStore(":memory:");
  await saveDiscordSettings(db, {
    enabled: true,
    webhookUrl: "https://discord.com/api/webhooks/1111/admin-token",
    feedbackEnabled: true,
    feedbackWebhookUrl: "https://discord.com/api/webhooks/2222/legit-channel-webhook",
    legitChannelId: "1562154223783907560",
  });

  const sampleOrder = {
    id: "VNL-LEGIT123",
    customerName: "Trần Minh Quân",
    customerEmail: "quan@gmail.com",
    total: 150000,
    items: [{ productName: "Game Pass Ultimate 1 Tháng", quantity: 1, price: 150000 }],
    completedAt: Date.now(),
  };

  let capturedUrl = "";
  let capturedBody = null;

  const mockFetchSuccess = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      status: 204,
      text: async () => "",
    };
  };

  const resultSuccess = await sendDiscordLegitFeedbackNotification(
    db,
    sampleOrder,
    "http://localhost:3000",
    mockFetchSuccess,
  );

  assert.equal(resultSuccess.sent, true);
  assert.equal(capturedUrl, "https://discord.com/api/webhooks/2222/legit-channel-webhook");
  assert.ok(capturedBody.embeds[0].title.includes("VIETNAM LEGACY LEGIT CHECK"));
  assert.ok(capturedBody.embeds[0].footer.text.includes("1562154223783907560"));

  // Khi gặp lỗi mạng, hàm không ném crash mà trả về status an toàn
  const mockFetchError = async () => ({
    ok: false,
    status: 500,
    text: async () => "Internal Discord Server Error",
  });

  const resultError = await sendDiscordLegitFeedbackNotification(
    db,
    sampleOrder,
    "http://localhost:3000",
    mockFetchError,
  );

  assert.equal(resultError.sent, false);
  assert.equal(resultError.status, 500);
});

test("HTTP PATCH /api/admin/orders/:id: Tự động gửi feedback check legit về kênh 1562154223783907560 khi hoàn thành đơn", async () => {
  const sentWebhooks = [];
  const mockFetch = async (url, opts) => {
    sentWebhooks.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 204, text: async () => "" };
  };

  const { db, server, request, adminHeaders } = await setupTestApp({}, mockFetch);

  try {
    // Cấu hình Webhook Discord & Legit Channel
    await saveDiscordSettings(db, {
      enabled: true,
      webhookUrl: "https://discord.com/api/webhooks/admin/order-created",
      feedbackEnabled: true,
      feedbackWebhookUrl: "https://discord.com/api/webhooks/legit/channel-1562154223783907560",
      legitChannelId: "1562154223783907560",
    });

    // Tạo user và nạp tiền
    const userId = randomUUID();
    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId, "testcustomer@gmail.com", "hash", Date.now());
    await creditWallet(db, userId, 500000);

    // Tạo đơn hàng mới
    const order = await createOrder(db, {
      userId,
      customerName: "Lê Hoàng Phúc",
      customerEmail: "testcustomer@gmail.com",
      items: [
        {
          productId: "discord-nitro-boost",
          quantity: 1,
        },
      ],
      total: 125000,
      paymentMethod: "wallet",
    });

    assert.ok(order.id);
    sentWebhooks.length = 0; // reset webhooks

    // Chuyển đơn sang completed (hoàn thành đơn)
    const patchRes = await request(
      "PATCH",
      `/api/admin/orders/${order.id}`,
      {
        status: "completed",
        claimLink: "https://discord.gift/claim-test-123",
      },
      adminHeaders,
    );

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.order.status, "completed");

    // Kiểm tra đã có webhook gửi về kênh Check Legit
    const legitWebhookCall = sentWebhooks.find((call) =>
      call.url.includes("legit/channel-1562154223783907560"),
    );

    assert.ok(legitWebhookCall, "Phải gửi webhook về kênh check legit");
    const embed = legitWebhookCall.body.embeds[0];
    assert.ok(embed.title.includes("VIETNAM LEGACY LEGIT CHECK"));
    assert.ok(embed.footer.text.includes("1562154223783907560"));
    assert.ok(embed.fields.some((f) => f.value.includes("Lê ***")));
    assert.ok(embed.fields.some((f) => f.value.includes("te***@gmail.com")));

    // Cập nhật lại claim link của đơn đã completed không gửi trùng webhook lần nữa
    sentWebhooks.length = 0;
    const patchAgainRes = await request(
      "PATCH",
      `/api/admin/orders/${order.id}`,
      {
        claimLink: "https://discord.gift/claim-updated-456",
      },
      adminHeaders,
    );

    assert.equal(patchAgainRes.status, 200);
    assert.equal(sentWebhooks.length, 0, "Không gửi lặp lại webhook nếu đơn đã completed");
  } finally {
    server.close();
  }
});

test("HTTP POST /api/admin/discord/test: hỗ trợ gửi tin thử nghiệm check legit về kênh 1562154223783907560", async () => {
  let testedUrl = "";
  let testedBody = null;

  const mockFetch = async (url, opts) => {
    testedUrl = url;
    testedBody = JSON.parse(opts.body);
    return { ok: true, status: 204, text: async () => "" };
  };

  const { server, request, adminHeaders } = await setupTestApp({}, mockFetch);

  try {
    const testRes = await request(
      "POST",
      "/api/admin/discord/test",
      {
        type: "feedback",
        feedbackWebhookUrl: "https://discord.com/api/webhooks/test/legit-1562154223783907560",
        legitChannelId: "1562154223783907560",
      },
      adminHeaders,
    );

    assert.equal(testRes.status, 200);
    assert.equal(testRes.body.success, true);
    assert.ok(testRes.body.message.includes("1562154223783907560"));
    assert.equal(testedUrl, "https://discord.com/api/webhooks/test/legit-1562154223783907560");
    assert.ok(testedBody.content.includes("TEST CHECK LEGIT"));
    assert.ok(testedBody.content.includes("1562154223783907560"));
  } finally {
    server.close();
  }
});

test("HTTP POST /api/admin/orders/:id/send-legit: nút gửi feedback Check Legit thủ công trên đơn hàng", async () => {
  const sentWebhooks = [];
  const mockFetch = async (url, opts) => {
    sentWebhooks.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 204, text: async () => "" };
  };

  const { db, server, request, adminHeaders } = await setupTestApp({}, mockFetch);

  try {
    await saveDiscordSettings(db, {
      enabled: true,
      feedbackEnabled: true,
      feedbackWebhookUrl: "https://discord.com/api/webhooks/legit/channel-1562154223783907560",
      legitChannelId: "1562154223783907560",
    });

    const userId = randomUUID();
    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId, "manualtest@gmail.com", "hash", Date.now());
    await creditWallet(db, userId, 200000);

    const order = await createOrder(db, {
      userId,
      customerName: "Nguyễn Thị Mai",
      customerEmail: "manualtest@gmail.com",
      items: [{ productId: "discord-nitro-boost", quantity: 1 }],
      total: 125000,
      paymentMethod: "wallet",
    });

    const res = await request(
      "POST",
      `/api/admin/orders/${order.id}/send-legit`,
      {},
      adminHeaders,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(sentWebhooks.length, 1);
    assert.ok(sentWebhooks[0].url.includes("1562154223783907560"));
    assert.ok(sentWebhooks[0].body.embeds[0].title.includes("VIETNAM LEGACY LEGIT CHECK"));
  } finally {
    server.close();
  }
});

test("Tùy chỉnh Embed Legit Check: DEFAULT_LEGIT_TEMPLATE và renderLegitTemplateText", () => {
  assert.ok(DEFAULT_LEGIT_TEMPLATE.title.includes("VIETNAM LEGACY LEGIT CHECK"));
  assert.equal(DEFAULT_LEGIT_TEMPLATE.color, "#22c55e");
  assert.equal(DEFAULT_LEGIT_TEMPLATE.showCustomer, true);
  assert.equal(DEFAULT_LEGIT_TEMPLATE.showTotal, true);
  assert.equal(DEFAULT_LEGIT_TEMPLATE.showItems, true);
  assert.equal(DEFAULT_LEGIT_TEMPLATE.showTimestamp, true);

  const text = "Đơn {orderId} của {customerName} ({customerEmail}) có tổng {total} ({itemsCount} món) gửi tới {channelId}";
  const rendered = renderLegitTemplateText(text, {
    orderId: "VNL-TEST01",
    customerName: "Nam",
    customerEmail: "nam@test.com",
    total: "100.000₫",
    itemsCount: 3,
    channelId: "123456",
  });
  assert.equal(rendered, "Đơn VNL-TEST01 của Nam (nam@test.com) có tổng 100.000₫ (3 món) gửi tới 123456");
});

test("Tùy chỉnh Embed Legit Check: buildLegitFeedbackEmbed áp dụng custom template toàn diện", () => {
  const sampleOrder = {
    id: "VNL-CUSTOM-99",
    customerName: "Trần Văn A",
    customerEmail: "tva@gmail.com",
    total: 300000,
    items: [{ productName: "Game Pass", variantName: "1 Tháng", quantity: 1, price: 300000 }],
    completedAt: 1774320000000,
  };

  const customTemplate = {
    title: "🌟 [GIAO DỊCH THÀNH CÔNG] ĐƠN HÀNG {orderId}",
    content: "🔔 Khách hàng {customerName} vừa hoàn tất đơn {orderId}!",
    description: "Cảm ơn bạn đã mua sắm tại shop! Uy tín 100%.",
    color: "#3b82f6",
    statusLabel: "Trạng thái bảo hành",
    statusValue: "Bảo hành trọn đời",
    footerText: "Shop Uy Tín • Channel: {channelId}",
    thumbnailUrl: "https://example.com/logo.png",
    bannerUrl: "https://example.com/banner.png",
    showCustomer: false,
    showTotal: true,
    showItems: true,
    showTimestamp: false,
  };

  const payload = buildLegitFeedbackEmbed(
    sampleOrder,
    { legitChannelId: "1562154223783907560", legitTemplate: customTemplate },
    "https://vietnamlegacy.com",
  );

  assert.equal(payload.content, "🔔 Khách hàng Trần *** vừa hoàn tất đơn VNL-CUSTOM-99!");
  assert.equal(payload.embeds.length, 1);
  const embed = payload.embeds[0];

  assert.equal(embed.title, "🌟 [GIAO DỊCH THÀNH CÔNG] ĐƠN HÀNG VNL-CUSTOM-99");
  assert.equal(embed.description, "Cảm ơn bạn đã mua sắm tại shop! Uy tín 100%.");
  assert.equal(embed.color, 0x3b82f6);
  assert.equal(embed.footer.text, "Shop Uy Tín • Channel: 1562154223783907560");
  assert.equal(embed.thumbnail.url, "https://example.com/logo.png");
  assert.equal(embed.image.url, "https://example.com/banner.png");

  const fieldNames = embed.fields.map((f) => f.name);
  assert.ok(fieldNames.includes("🔖 Mã đơn hàng"));
  assert.ok(!fieldNames.includes("👤 Khách hàng"));
  assert.ok(fieldNames.includes("💰 Tổng thanh toán"));
  assert.ok(fieldNames.includes("📦 Mặt hàng đã bàn giao (1)"));
  assert.ok(fieldNames.includes("Trạng thái bảo hành"));
  assert.ok(!fieldNames.includes("🕒 Thời gian hoàn tất"));
});

test("HTTP API Admin: Lưu và tải cấu hình tùy chỉnh legitTemplate qua PUT/GET /api/admin/discord", async () => {
  const { db, server, request, adminHeaders } = await setupTestApp();

  try {
    const customTemplate = {
      title: "🔥 SHOP LEGIT CHECK {orderId}",
      content: "Đơn mới {orderId}",
      description: "Mô tả tùy chỉnh",
      color: "#ec4899",
      statusLabel: "Chứng thực",
      statusValue: "Đã xác nhận",
      footerText: "Chân trang {channelId}",
      showCustomer: true,
      showTotal: false,
      showItems: true,
      showTimestamp: true,
    };

    const putRes = await request(
      "PUT",
      "/api/admin/discord",
      {
        enabled: true,
        webhookUrl: "https://discord.com/api/webhooks/test/admin",
        feedbackEnabled: true,
        feedbackWebhookUrl: "https://discord.com/api/webhooks/test/legit",
        legitChannelId: "1562154223783907560",
        legitTemplate: customTemplate,
      },
      adminHeaders,
    );

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.success, true);
    assert.equal(putRes.body.settings.legitTemplate.title, "🔥 SHOP LEGIT CHECK {orderId}");
    assert.equal(putRes.body.settings.legitTemplate.color, "#ec4899");
    assert.equal(putRes.body.settings.legitTemplate.showTotal, false);

    const getRes = await request("GET", "/api/admin/discord", null, adminHeaders);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.settings.legitTemplate.title, "🔥 SHOP LEGIT CHECK {orderId}");
    assert.equal(getRes.body.settings.legitTemplate.color, "#ec4899");
    assert.equal(getRes.body.settings.legitTemplate.showTotal, false);
    assert.equal(getRes.body.settings.legitTemplate.showCustomer, true);
  } finally {
    server.close();
  }
});

test("HTTP API Admin: Gửi thử nghiệm Check Legit với custom legitTemplate", async () => {
  let testedPayload = null;
  const mockFetch = async (url, opts) => {
    testedPayload = JSON.parse(opts.body);
    return { ok: true, status: 204, text: async () => "" };
  };

  const { server, request, adminHeaders } = await setupTestApp({}, mockFetch);

  try {
    const customTemplate = {
      title: "🧪 EMBED TEST TÙY CHỈNH",
      color: "#f59e0b",
      statusLabel: "Trạng thái test",
      statusValue: "Thành công 100%",
    };

    const res = await request(
      "POST",
      "/api/admin/discord/test",
      {
        type: "feedback",
        feedbackWebhookUrl: "https://discord.com/api/webhooks/test/custom-legit",
        legitChannelId: "1562154223783907560",
        legitTemplate: customTemplate,
      },
      adminHeaders,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(testedPayload);
    assert.equal(testedPayload.embeds[0].title, "🧪 EMBED TEST TÙY CHỈNH");
    assert.equal(testedPayload.embeds[0].color, 0xf59e0b);
    const fieldNames = testedPayload.embeds[0].fields.map((f) => f.name);
    assert.ok(fieldNames.includes("Trạng thái test"));
  } finally {
    server.close();
  }
});
