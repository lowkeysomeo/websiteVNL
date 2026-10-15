import { randomUUID } from "node:crypto";

export const DEFAULT_CONTACTS = [
  {
    id: "zalo-cn",
    platform: "zalo",
    name: "Zalo Cá Nhân (Hỗ trợ)",
    url: "https://zalo.me",
    badge: "CN",
    active: true,
  },
  {
    id: "zalo-gr-1",
    platform: "zalo",
    name: "Nhóm Zalo Khách Hàng 1",
    url: "https://zalo.me",
    badge: "GR",
    active: true,
  },
  {
    id: "zalo-gr-2",
    platform: "zalo",
    name: "Nhóm Zalo Khách Hàng 2",
    url: "https://zalo.me",
    badge: "GR",
    active: true,
  },
  {
    id: "facebook-cn",
    platform: "facebook",
    name: "Facebook Cá Nhân Admin",
    url: "https://facebook.com",
    badge: "CN",
    active: true,
  },
  {
    id: "facebook-gr",
    platform: "facebook",
    name: "Nhóm Facebook Cộng Đồng",
    url: "https://facebook.com",
    badge: "GR",
    active: true,
  },
  {
    id: "telegram-gr",
    platform: "telegram",
    name: "Kênh / Nhóm Telegram",
    url: "https://t.me",
    badge: "GR",
    active: true,
  },
];

export const VALID_PLATFORMS = [
  "zalo",
  "facebook",
  "telegram",
  "discord",
  "phone",
  "messenger",
  "other",
];

export async function getContactsSettings(db) {
  let row = null;
  try {
    row = await db
      .prepare(
        "SELECT data_json, updated_at FROM catalog_item_overrides WHERE item_key = 'system:contact_buttons'",
      )
      .get();
  } catch {
    // Bỏ qua nếu bảng chưa sẵn sàng
  }

  if (!row?.data_json) {
    return {
      enabled: true,
      items: DEFAULT_CONTACTS.map((item) => ({ ...item })),
      updatedAt: null,
    };
  }

  try {
    const data = JSON.parse(row.data_json);
    return {
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      items: Array.isArray(data.items)
        ? data.items
        : DEFAULT_CONTACTS.map((item) => ({ ...item })),
      updatedAt: row.updated_at || null,
    };
  } catch {
    return {
      enabled: true,
      items: DEFAULT_CONTACTS.map((item) => ({ ...item })),
      updatedAt: row.updated_at || null,
    };
  }
}

export async function saveContactsSettings(db, data = {}, now = Date.now()) {
  const enabled = data.enabled !== undefined ? Boolean(data.enabled) : true;
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const validatedItems = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i] || {};
    const name = String(item.name || "").trim().slice(0, 80);
    const url = String(item.url || "").trim().slice(0, 500);

    if (!name) {
      throw Object.assign(
        new Error(`Mục liên hệ #${i + 1} phải có tên hiển thị.`),
        { status: 400 },
      );
    }
    if (!url) {
      throw Object.assign(
        new Error(`Mục liên hệ "${name}" chưa có link liên kết.`),
        { status: 400 },
      );
    }

    let platform = String(item.platform || "other").toLowerCase().trim();
    if (!VALID_PLATFORMS.includes(platform)) {
      platform = "other";
    }

    const badge = String(item.badge || "")
      .trim()
      .toUpperCase()
      .slice(0, 8);

    const active = item.active !== undefined ? Boolean(item.active) : true;
    const id = String(item.id || "").trim() || `contact-${randomUUID().slice(0, 8)}`;

    validatedItems.push({
      id,
      platform,
      name,
      url,
      badge,
      active,
    });
  }

  const payload = JSON.stringify({
    enabled,
    items: validatedItems,
  });

  await db
    .prepare(
      `INSERT INTO catalog_item_overrides (item_key, data_json, updated_at)
       VALUES ('system:contact_buttons', ?, ?)
       ON CONFLICT(item_key) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
    )
    .run(payload, now);

  return {
    enabled,
    items: validatedItems,
    updatedAt: now,
  };
}
