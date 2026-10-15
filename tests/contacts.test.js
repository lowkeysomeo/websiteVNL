import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openStore } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import {
  DEFAULT_CONTACTS,
  VALID_PLATFORMS,
  getContactsSettings,
  saveContactsSettings,
} from "../server/contacts.js";

async function setupTestApp(overrides = {}) {
  const db = await openStore(":memory:");
  const config = readConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    PUBLIC_ORIGIN: "http://localhost:3000",
    ADMIN_PASSWORD: "testadminsecret",
    ...overrides,
  });

  const server = createApp(db, config);
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
            } catch {
              json = data;
            }
            resolve({ status: res.statusCode, headers: res.headers, body: json });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }

  return { db, config, request, close };
}

test("contacts: default items and platforms", () => {
  assert.equal(Array.isArray(DEFAULT_CONTACTS), true);
  assert.equal(DEFAULT_CONTACTS.length, 6);
  assert.equal(DEFAULT_CONTACTS[0].platform, "zalo");
  assert.equal(DEFAULT_CONTACTS[0].badge, "CN");
  assert.equal(DEFAULT_CONTACTS[1].badge, "GR");
  assert.ok(VALID_PLATFORMS.includes("zalo"));
  assert.ok(VALID_PLATFORMS.includes("facebook"));
  assert.ok(VALID_PLATFORMS.includes("telegram"));
  assert.ok(VALID_PLATFORMS.includes("discord"));
});

test("contacts: getContactsSettings returns default contacts initially", async () => {
  const db = await openStore(":memory:");
  try {
    const res = await getContactsSettings(db);
    assert.equal(res.enabled, true);
    assert.equal(res.items.length, 6);
    assert.equal(res.items[0].name, "Zalo Cá Nhân (Hỗ trợ)");
  } finally {
    await db.close();
  }
});

test("contacts: saveContactsSettings validates and persists items correctly", async () => {
  const db = await openStore(":memory:");
  try {
    const updated = await saveContactsSettings(db, {
      enabled: true,
      items: [
        {
          id: "zalo-custom",
          platform: "ZALO",
          name: "  Admin Zalo VIP  ",
          url: "https://zalo.me/0987654321",
          badge: "vip",
          active: true,
        },
        {
          id: "",
          platform: "unknown_platform",
          name: "Nhóm Chat",
          url: "https://example.com/group",
          badge: "gr1",
          active: false,
        },
      ],
    });

    assert.equal(updated.enabled, true);
    assert.equal(updated.items.length, 2);
    assert.equal(updated.items[0].name, "Admin Zalo VIP");
    assert.equal(updated.items[0].platform, "zalo");
    assert.equal(updated.items[0].badge, "VIP");
    assert.equal(updated.items[0].active, true);

    // Unknown platform should fallback to "other"
    assert.equal(updated.items[1].platform, "other");
    assert.equal(updated.items[1].badge, "GR1");
    assert.equal(updated.items[1].active, false);
    assert.ok(updated.items[1].id.startsWith("contact-"));

    // Verify reading back from db
    const read = await getContactsSettings(db);
    assert.equal(read.items.length, 2);
    assert.equal(read.items[0].name, "Admin Zalo VIP");
  } finally {
    await db.close();
  }
});

test("contacts: saveContactsSettings throws on invalid input", async () => {
  const db = await openStore(":memory:");
  try {
    await assert.rejects(
      async () => {
        await saveContactsSettings(db, {
          items: [{ name: "", url: "https://zalo.me" }],
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /phải có tên hiển thị/);
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await saveContactsSettings(db, {
          items: [{ name: "Zalo Shop", url: "   " }],
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /chưa có link liên kết/);
        return true;
      },
    );
  } finally {
    await db.close();
  }
});

test("contacts: public GET /api/contacts returns only active items when enabled", async () => {
  const app = await setupTestApp();
  try {
    // Save settings with 1 active and 1 inactive item
    await saveContactsSettings(app.db, {
      enabled: true,
      items: [
        {
          id: "c1",
          platform: "zalo",
          name: "Zalo Hoạt Động",
          url: "https://zalo.me/1",
          badge: "CN",
          active: true,
        },
        {
          id: "c2",
          platform: "facebook",
          name: "Facebook Đã Tắt",
          url: "https://fb.com/2",
          badge: "GR",
          active: false,
        },
      ],
    });

    const res = await app.request("GET", "/api/contacts");
    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, true);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].id, "c1");

    // When disabled globally
    await saveContactsSettings(app.db, {
      enabled: false,
      items: [
        {
          id: "c1",
          platform: "zalo",
          name: "Zalo Hoạt Động",
          url: "https://zalo.me/1",
          badge: "CN",
          active: true,
        },
      ],
    });

    const resDisabled = await app.request("GET", "/api/contacts");
    assert.equal(resDisabled.status, 200);
    assert.equal(resDisabled.body.enabled, false);
    assert.equal(resDisabled.body.items.length, 0);
  } finally {
    await app.close();
  }
});

test("contacts: admin API endpoints require auth and allow updates", async () => {
  const app = await setupTestApp();
  try {
    // Unauthorized GET
    const unauthGet = await app.request("GET", "/api/admin/contacts");
    assert.equal(unauthGet.status, 401);

    // Unauthorized PUT
    const unauthPut = await app.request("PUT", "/api/admin/contacts", { enabled: true, items: [] });
    assert.equal(unauthPut.status, 401);

    // Admin login
    const authRes = await app.request("POST", "/api/admin/auth", {
      password: "testadminsecret",
    });
    assert.equal(authRes.status, 200);
    const adminKey = authRes.body.adminKey;
    const adminHeaders = {
      "x-admin-key": adminKey,
      origin: app.config.origin,
    };

    // Authorized GET returns full list including inactive items
    const getRes = await app.request("GET", "/api/admin/contacts", null, adminHeaders);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.success, true);
    assert.equal(Array.isArray(getRes.body.settings.items), true);

    // Authorized PUT updates items
    const putRes = await app.request(
      "PUT",
      "/api/admin/contacts",
      {
        enabled: true,
        items: [
          {
            id: "zalo-admin-1",
            platform: "zalo",
            name: "Zalo Cá Nhân Admin",
            url: "https://zalo.me/admin",
            badge: "CN",
            active: true,
          },
          {
            id: "telegram-shop",
            platform: "telegram",
            name: "Kênh Telegram Thông Báo",
            url: "https://t.me/vnlegacy",
            badge: "GR",
            active: true,
          },
        ],
      },
      adminHeaders,
    );

    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.success, true);
    assert.equal(putRes.body.settings.items.length, 2);
    assert.equal(putRes.body.settings.items[0].name, "Zalo Cá Nhân Admin");
    assert.equal(putRes.body.settings.items[1].name, "Kênh Telegram Thông Báo");

    // Public API now reflects the 2 updated items
    const publicRes = await app.request("GET", "/api/contacts");
    assert.equal(publicRes.status, 200);
    assert.equal(publicRes.body.items.length, 2);
  } finally {
    await app.close();
  }
});
