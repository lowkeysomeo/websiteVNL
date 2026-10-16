export const DEFAULT_ADMIN_ID = "604729446649298963";

export function formatVND(amount) {
  const numeric = typeof amount === "number" ? amount : Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN").format(numeric) + "₫";
}

export async function getDiscordSettings(db, env = process.env) {
  let row = null;
  try {
    row = await db
      .prepare(
        "SELECT data_json, updated_at FROM catalog_item_overrides WHERE item_key = 'system:discord_notifications'",
      )
      .get();
  } catch {
    // Bỏ qua nếu bảng chưa sẵn sàng
  }

  let saved = null;
  if (row?.data_json) {
    try {
      saved = JSON.parse(row.data_json);
    } catch {
      saved = null;
    }
  }

  const webhookUrl = String(
    saved?.webhookUrl !== undefined
      ? saved.webhookUrl
      : env.DISCORD_WEBHOOK_URL || "",
  ).trim();

  const adminId = String(
    saved?.adminId !== undefined && saved.adminId !== ""
      ? saved.adminId
      : env.DISCORD_ADMIN_ID || DEFAULT_ADMIN_ID,
  ).trim();

  const enabled =
    saved?.enabled !== undefined
      ? Boolean(saved.enabled)
      : Boolean(webhookUrl);

  return {
    enabled,
    webhookUrl,
    adminId: adminId || DEFAULT_ADMIN_ID,
    updatedAt: row?.updated_at || null,
  };
}

export async function saveDiscordSettings(
  db,
  data = {},
  now = Date.now(),
) {
  const webhookUrl = String(data.webhookUrl ?? "").trim();
  const rawAdminId = String(data.adminId ?? "").trim();
  const adminId = rawAdminId || DEFAULT_ADMIN_ID;
  const enabled = Boolean(data.enabled);

  if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
    throw Object.assign(
      new Error(
        "Discord Webhook URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://).",
      ),
      { status: 400 },
    );
  }

  if (adminId && !/^\d{16,22}$/.test(adminId)) {
    throw Object.assign(
      new Error(
        "ID Discord Admin không hợp lệ (phải là chuỗi số từ 16 đến 22 chữ số).",
      ),
      { status: 400 },
    );
  }

  const payload = JSON.stringify({
    enabled,
    webhookUrl,
    adminId,
  });

  await db
    .prepare(
      `INSERT INTO catalog_item_overrides (item_key, data_json, updated_at)
       VALUES ('system:discord_notifications', ?, ?)
       ON CONFLICT(item_key) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
    )
    .run(payload, now);

  return {
    enabled,
    webhookUrl,
    adminId,
    updatedAt: now,
  };
}

export function buildOrderEmbed(order, settings = {}, origin = "") {
  const adminId = String(settings.adminId || DEFAULT_ADMIN_ID).trim();
  const ping = adminId ? `<@${adminId}>` : "";
  const content = `🔔 ${ping} **Có đơn hàng mới tại VietNam Legacy!** (Mã: \`${order.id || "N/A"}\`)`.trim();

  const items = Array.isArray(order.items) ? order.items : [];
  let itemSummary = items
    .map((item) => {
      const pName = item.productName || item.productId || "Sản phẩm";
      const vName = item.variantName || item.variantId || "";
      const qty = item.quantity || 1;
      const price = formatVND((item.price || 0) * qty);
      return `• **${pName}**${vName ? ` (${vName})` : ""} x${qty}: ${price}`;
    })
    .join("\n");

  if (!itemSummary) {
    itemSummary = "Không có thông tin chi tiết mặt hàng.";
  }
  if (itemSummary.length > 1024) {
    itemSummary = itemSummary.slice(0, 1020) + "...";
  }

  const fields = [
    {
      name: "👤 Khách hàng",
      value: `**${order.customerName || "Khách hàng"}**\nEmail: \`${order.customerEmail || "N/A"}\``,
      inline: true,
    },
    {
      name: "💰 Tổng thanh toán",
      value: `**${formatVND(order.total || 0)}**\nPhương thức: \`${order.paymentMethod === "wallet" ? "Ví tài khoản shop" : order.paymentMethod || "wallet"}\``,
      inline: true,
    },
    {
      name: `📦 Mặt hàng (${items.length})`,
      value: itemSummary,
      inline: false,
    },
  ];

  if (order.customerNote && String(order.customerNote).trim()) {
    fields.push({
      name: "📝 Ghi chú của khách",
      value: String(order.customerNote).trim().slice(0, 1024),
      inline: false,
    });
  }

  if (order.hasLogItems) {
    let logInfo = `**Tài khoản:** \`${order.discordAccount || "Chưa cung cấp"}\`\n`;
    logInfo += `**Mật khẩu:** ||${order.discordPassword || "Chưa cung cấp"}||\n`;
    if (order.backupCodes) {
      logInfo += `**Mã dự phòng (2FA / Backup Codes):**\n\`\`\`\n${order.backupCodes}\n\`\`\``;
    }
    fields.push({
      name: "🔐 Thông tin Nạp Acc (Log)",
      value: logInfo.slice(0, 1024),
      inline: false,
    });
  }

  if (order.serverInvite && String(order.serverInvite).trim()) {
    fields.push({
      name: "🔗 Link Server Boost",
      value: String(order.serverInvite).trim().slice(0, 1024),
      inline: false,
    });
  }

  const embed = {
    title: `🛒 Đơn hàng mới: ${order.id || "N/A"}`,
    url: origin ? `${origin}/admin.html` : undefined,
    color: 0x8b5cf6, // VietNam Legacy purple
    description: `Khách hàng **${order.customerName || "Khách"}** vừa hoàn tất đơn hàng qua ví shop! Vui lòng kiểm tra và xử lý đơn.`,
    fields,
    timestamp: new Date(order.createdAt || Date.now()).toISOString(),
    footer: {
      text: "VietNam Legacy Store • Quản trị đơn hàng",
    },
  };

  if (order.decorImage) {
    const imgStr = String(order.decorImage).trim();
    if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
      embed.image = { url: imgStr };
      fields.push({
        name: "🖼️ Ảnh mẫu Decor",
        value: `[Xem ảnh gốc](${imgStr})`,
        inline: false,
      });
    } else {
      fields.push({
        name: "🖼️ Ảnh mẫu Decor",
        value: "[Khách tải lên ảnh trực tiếp: Xem chi tiết trong Admin]",
        inline: false,
      });
    }
  }

  return {
    content,
    embeds: [embed],
  };
}

export async function getPartnerDiscordSettings(db, partnerEmail) {
  if (!partnerEmail || typeof partnerEmail !== "string") {
    return {
      enabled: false,
      webhookUrl: "",
      discordId: "",
      adminId: "",
      partnerEmail: "",
      updatedAt: null,
    };
  }
  const cleanEmail = partnerEmail.trim().toLowerCase();
  let row = null;
  try {
    row = await db
      .prepare(
        "SELECT data_json, updated_at FROM catalog_item_overrides WHERE item_key = ?",
      )
      .get("partner:discord:" + cleanEmail);
  } catch {
    // Bỏ qua nếu bảng chưa sẵn sàng
  }

  let saved = null;
  if (row?.data_json) {
    try {
      saved = JSON.parse(row.data_json);
    } catch {
      saved = null;
    }
  }

  const webhookUrl = String(saved?.webhookUrl ?? "").trim();
  const discordId = String(saved?.discordId ?? saved?.adminId ?? "").trim();
  const enabled = Boolean(saved?.enabled && webhookUrl);

  return {
    enabled,
    webhookUrl,
    discordId,
    adminId: discordId, // alias for admin card UI reuse
    partnerEmail: cleanEmail,
    updatedAt: row?.updated_at || null,
  };
}

export async function savePartnerDiscordSettings(
  db,
  partnerEmail,
  data = {},
  now = Date.now(),
) {
  if (!partnerEmail || typeof partnerEmail !== "string") {
    throw Object.assign(new Error("Email đối tác không hợp lệ."), { status: 400 });
  }
  const cleanEmail = partnerEmail.trim().toLowerCase();
  const webhookUrl = String(data.webhookUrl ?? "").trim();
  const rawId = String(data.discordId ?? data.adminId ?? "").trim();
  const enabled = Boolean(data.enabled);

  if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
    throw Object.assign(
      new Error(
        "Discord Webhook URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://).",
      ),
      { status: 400 },
    );
  }

  if (rawId && !/^\d{16,22}$/.test(rawId)) {
    throw Object.assign(
      new Error(
        "ID Discord không hợp lệ (phải là chuỗi số từ 16 đến 22 chữ số).",
      ),
      { status: 400 },
    );
  }

  const payload = JSON.stringify({
    enabled,
    webhookUrl,
    discordId: rawId,
  });

  await db
    .prepare(
      `INSERT INTO catalog_item_overrides (item_key, data_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(item_key) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
    )
    .run("partner:discord:" + cleanEmail, payload, now);

  return {
    enabled,
    webhookUrl,
    discordId: rawId,
    adminId: rawId,
    partnerEmail: cleanEmail,
    updatedAt: now,
  };
}

export function buildPartnerOrderEmbed(
  order,
  partnerEmail,
  partnerItems = [],
  settings = {},
  origin = "",
) {
  const discordId = String(settings.discordId || settings.adminId || "").trim();
  const ping = discordId ? `<@${discordId}>` : "";
  const content = `🔔 ${ping} **Có đơn hàng dịch vụ mới dành cho bạn tại VietNam Legacy!** (Mã: \`${order.id || "N/A"}\`)`.trim();

  const items = Array.isArray(partnerItems) ? partnerItems : [];
  let itemSummary = items
    .map((item) => {
      const pName = item.productName || item.productId || "Dịch vụ đối tác";
      const vName = item.variantName || item.variantId || "";
      const qty = item.quantity || 1;
      const price = formatVND((item.price || 0) * qty);
      return `• **${pName}**${vName ? ` (${vName})` : ""} x${qty}: ${price}`;
    })
    .join("\n");

  if (!itemSummary) {
    itemSummary = "Không có thông tin chi tiết mặt hàng.";
  }
  if (itemSummary.length > 1024) {
    itemSummary = itemSummary.slice(0, 1020) + "...";
  }

  const partnerRevenue = items.reduce(
    (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
    0,
  );

  const fields = [
    {
      name: "👤 Khách hàng",
      value: `**${order.customerName || "Khách hàng"}**\nEmail: \`${order.customerEmail || "N/A"}\``,
      inline: true,
    },
    {
      name: "💰 Doanh thu phần bạn",
      value: `**${formatVND(partnerRevenue)}**\n(Tổng đơn shop: ${formatVND(order.total || 0)})`,
      inline: true,
    },
    {
      name: `📦 Dịch vụ cần xử lý (${items.length})`,
      value: itemSummary,
      inline: false,
    },
  ];

  if (order.customerNote && String(order.customerNote).trim()) {
    fields.push({
      name: "📝 Ghi chú của khách",
      value: String(order.customerNote).trim().slice(0, 1024),
      inline: false,
    });
  }

  const hasLog = items.some(
    (it) => it.deliveryType === "log" || it.productId === "decor-log",
  );
  if (hasLog && (order.discordAccount || order.discordPassword)) {
    let logInfo = `**Tài khoản:** \`${order.discordAccount || "Chưa cung cấp"}\`\n`;
    logInfo += `**Mật khẩu:** ||${order.discordPassword || "Chưa cung cấp"}||\n`;
    if (order.backupCodes) {
      logInfo += `**Mã dự phòng (2FA / Backup Codes):**\n\`\`\`\n${order.backupCodes}\n\`\`\``;
    }
    fields.push({
      name: "🔐 Thông tin Nạp Acc (Log)",
      value: logInfo.slice(0, 1024),
      inline: false,
    });
  }

  if (order.serverInvite && String(order.serverInvite).trim()) {
    fields.push({
      name: "🔗 Link Server Boost / Discord",
      value: String(order.serverInvite).trim().slice(0, 1024),
      inline: false,
    });
  }

  const embed = {
    title: `🛒 Đơn dịch vụ mới: ${order.id || "N/A"}`,
    url: origin ? `${origin}/admin.html` : undefined,
    color: 0x06b6d4, // Cyan/Sky for Partner
    description: `Khách hàng **${order.customerName || "Khách"}** vừa thanh toán thành công đơn hàng chứa dịch vụ do bạn cung cấp! Vui lòng vào trang quản trị đối tác để kiểm tra và xử lý đơn.`,
    fields,
    timestamp: new Date(order.createdAt || Date.now()).toISOString(),
    footer: {
      text: `VietNam Legacy Store • Kênh thông báo Đối tác (${partnerEmail})`,
    },
  };

  if (order.decorImage) {
    const imgStr = String(order.decorImage).trim();
    if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
      embed.image = { url: imgStr };
      fields.push({
        name: "🖼️ Ảnh mẫu yêu cầu",
        value: `[Xem ảnh gốc](${imgStr})`,
        inline: false,
      });
    } else {
      fields.push({
        name: "🖼️ Ảnh mẫu yêu cầu",
        value: "[Khách tải lên ảnh trực tiếp: Xem chi tiết trong Admin đối tác]",
        inline: false,
      });
    }
  }

  return {
    content,
    embeds: [embed],
  };
}

export async function sendPartnerDiscordTestNotification(
  db,
  partnerEmail,
  params = {},
  fetchFn = globalThis.fetch,
) {
  if (!partnerEmail || typeof partnerEmail !== "string") {
    throw Object.assign(new Error("Email đối tác không hợp lệ."), { status: 400 });
  }
  const cleanEmail = partnerEmail.trim().toLowerCase();
  const currentSettings = await getPartnerDiscordSettings(db, cleanEmail);
  const webhookUrl = String(
    params.webhookUrl || currentSettings.webhookUrl || "",
  ).trim();
  const rawId = String(
    params.discordId !== undefined
      ? params.discordId
      : (params.adminId !== undefined ? params.adminId : currentSettings.discordId),
  ).trim();

  if (!webhookUrl) {
    throw Object.assign(
      new Error("Vui lòng nhập Discord Webhook URL trước khi thử nghiệm."),
      { status: 400 },
    );
  }

  if (!/^https?:\/\//i.test(webhookUrl)) {
    throw Object.assign(
      new Error(
        "Discord Webhook URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://).",
      ),
      { status: 400 },
    );
  }

  if (rawId && !/^\d{16,22}$/.test(rawId)) {
    throw Object.assign(
      new Error(
        "ID Discord không hợp lệ (phải là chuỗi số từ 16 đến 22 chữ số).",
      ),
      { status: 400 },
    );
  }

  const ping = rawId ? `<@${rawId}>` : "";
  const content = `🔔 ${ping} **Thông báo thử nghiệm từ VietNam Legacy Store (Dành cho Đối tác)!**`.trim();

  const payload = {
    content,
    embeds: [
      {
        title: "🧪 Kiểm tra kết nối Discord Webhook Đối tác",
        description: `Hệ thống gửi thông báo đơn hàng dịch vụ của **VietNam Legacy Store** đã kết nối thành công tới Discord của đối tác (\`${cleanEmail}\`)!\nKhi có khách hàng đặt dịch vụ của bạn, bạn sẽ nhận được thông báo chi tiết ngay tại đây.`,
        color: 0x57f287, // Discord Green
        fields: [
          {
            name: "🤝 Đối tác",
            value: `\`${cleanEmail}\``,
            inline: true,
          },
          {
            name: "👤 Mention Discord",
            value: rawId ? `<@${rawId}> (\`${rawId}\`)` : "Không cấu hình tag",
            inline: true,
          },
          {
            name: "📌 Trạng thái",
            value: "Hoạt động bình thường (Ready)",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `VietNam Legacy Store • Test Webhook Đối tác (${cleanEmail})`,
        },
      },
    ],
  };

  const res = await fetchFn(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw Object.assign(
      new Error(
        `Discord trả về lỗi ${res.status}: ${errText || "Không thể gửi webhook"}`,
      ),
      { status: 502 },
    );
  }

  return {
    success: true,
    message: "Gửi thông báo thử nghiệm đối tác thành công! Hãy kiểm tra kênh Discord.",
  };
}

export async function sendDiscordOrderNotification(
  db,
  order,
  origin = "",
  fetchFn = globalThis.fetch,
) {
  const result = { sent: false, partnerResults: [] };

  // 1. Gửi thông báo tới Discord Admin của Shop
  try {
    const settings = await getDiscordSettings(db);
    if (settings.enabled && settings.webhookUrl) {
      const payload = buildOrderEmbed(order, settings, origin);
      const res = await fetchFn(settings.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(
          `[Discord Webhook Warning] Status ${res.status}: ${errText}`,
        );
        result.adminError = errText;
      } else {
        result.sent = true;
      }
    } else {
      result.reason = "disabled_or_not_configured";
    }
  } catch (err) {
    console.error("[Discord Webhook Error]", err.message);
    result.error = err.message;
  }

  // 2. Gửi thông báo tới Discord của các Đối tác (nếu đơn có mặt hàng của đối tác)
  try {
    let customProds = [];
    try {
      customProds = await db
        .prepare(
          "SELECT id, partner_email FROM custom_products WHERE partner_email IS NOT NULL AND partner_email != ''",
        )
        .all();
    } catch {
      // Bỏ qua nếu bảng chưa tồn tại
    }

    const productPartnerMap = new Map(
      (customProds || []).map((p) => [
        p.id,
        String(p.partner_email).trim().toLowerCase(),
      ]),
    );

    const partnerGroups = new Map(); // partnerEmail -> items[]
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const pEmail =
        (item.partnerEmail
          ? String(item.partnerEmail).trim().toLowerCase()
          : null) || productPartnerMap.get(item.productId);
      if (pEmail) {
        if (!partnerGroups.has(pEmail)) {
          partnerGroups.set(pEmail, []);
        }
        partnerGroups.get(pEmail).push(item);
      }
    }

    for (const [pEmail, pItems] of partnerGroups.entries()) {
      try {
        const pSettings = await getPartnerDiscordSettings(db, pEmail);
        if (pSettings.enabled && pSettings.webhookUrl) {
          const partnerPayload = buildPartnerOrderEmbed(
            order,
            pEmail,
            pItems,
            pSettings,
            origin,
          );
          const pRes = await fetchFn(pSettings.webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(partnerPayload),
            signal: AbortSignal.timeout(8000),
          });
          if (!pRes.ok) {
            const pErrText = await pRes.text().catch(() => "");
            console.error(
              `[Partner Discord Webhook Warning] (${pEmail}) Status ${pRes.status}: ${pErrText}`,
            );
            result.partnerResults.push({
              partnerEmail: pEmail,
              sent: false,
              status: pRes.status,
              error: pErrText,
            });
          } else {
            result.partnerResults.push({
              partnerEmail: pEmail,
              sent: true,
            });
          }
        }
      } catch (pErr) {
        console.error(
          `[Partner Discord Webhook Error] (${pEmail})`,
          pErr.message,
        );
        result.partnerResults.push({
          partnerEmail: pEmail,
          sent: false,
          error: pErr.message,
        });
      }
    }
  } catch (err) {
    console.error("[Partner Discord Webhook Processing Error]", err.message);
  }

  return result;
}

export async function sendDiscordTestNotification(
  db,
  params = {},
  fetchFn = globalThis.fetch,
) {
  const currentSettings = await getDiscordSettings(db);
  const webhookUrl = String(
    params.webhookUrl || currentSettings.webhookUrl || "",
  ).trim();
  const rawAdminId = String(
    params.adminId !== undefined ? params.adminId : currentSettings.adminId,
  ).trim();
  const adminId = rawAdminId || DEFAULT_ADMIN_ID;

  if (!webhookUrl) {
    throw Object.assign(
      new Error("Vui lòng nhập Discord Webhook URL trước khi thử nghiệm."),
      { status: 400 },
    );
  }

  if (!/^https?:\/\//i.test(webhookUrl)) {
    throw Object.assign(
      new Error(
        "Discord Webhook URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://).",
      ),
      { status: 400 },
    );
  }

  if (adminId && !/^\d{16,22}$/.test(adminId)) {
    throw Object.assign(
      new Error(
        "ID Discord Admin không hợp lệ (phải là chuỗi số từ 16 đến 22 chữ số).",
      ),
      { status: 400 },
    );
  }

  const ping = adminId ? `<@${adminId}>` : "";
  const content = `🔔 ${ping} **Thông báo thử nghiệm từ VietNam Legacy Store!**`.trim();

  const payload = {
    content,
    embeds: [
      {
        title: "🧪 Kiểm tra kết nối Discord Webhook",
        description:
          "Hệ thống gửi thông báo đơn hàng của **VietNam Legacy Store** đã kết nối thành công tới Discord của bạn!\nKhi có khách hàng tạo đơn hàng mới, bạn sẽ nhận được thông báo chi tiết ngay tại đây.",
        color: 0x57f287, // Discord Green
        fields: [
          {
            name: "👑 Admin Mention",
            value: adminId ? `<@${adminId}> (\`${adminId}\`)` : "Không cấu hình",
            inline: true,
          },
          {
            name: "📌 Trạng thái",
            value: "Hoạt động bình thường (Ready)",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "VietNam Legacy Store • Test Webhook",
        },
      },
    ],
  };

  const res = await fetchFn(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw Object.assign(
      new Error(
        `Discord trả về lỗi ${res.status}: ${errText || "Không thể gửi webhook"}`,
      ),
      { status: 502 },
    );
  }

  return {
    success: true,
    message: "Gửi thông báo thử nghiệm thành công! Hãy kiểm tra kênh Discord.",
  };
}
