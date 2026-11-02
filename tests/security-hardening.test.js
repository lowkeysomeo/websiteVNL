import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openStore } from "../server/store.js";
import { readConfig } from "../server/config.js";
import { createApp } from "../server/app.js";
import { createLimiter } from "../server/security.js";

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const headers = { ...(options.headers || {}) };
    let payload = options.body;
    if (payload !== undefined && typeof payload !== "string") {
      payload = JSON.stringify(payload);
    }
    if (payload !== undefined) {
      headers["content-length"] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: options.method || (payload !== undefined ? "POST" : "GET"),
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let body = data;
          try {
            body = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body, raw: data });
        });
      },
    );
    req.on("error", reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

test("createLimiter: Fast O(1) operations, window reset, and rate enforcement", () => {
  const allow = createLimiter();
  const key = "test-ip-1";

  // Allows up to 3 requests
  assert.equal(allow(key, 3, 1000), true);
  assert.equal(allow(key, 3, 1000), true);
  assert.equal(allow(key, 3, 1000), true);
  // Exceeds limit
  assert.equal(allow(key, 3, 1000), false);

  // Different key has independent limit
  assert.equal(allow("test-ip-2", 3, 1000), true);
});

test("Security Headers: Cross-Origin-Opener-Policy, CORP, nosniff, and frame options", async () => {
  const db = await openStore(":memory:");
  const config = {
    ...readConfig(),
    production: true,
  };
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server, "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["cross-origin-opener-policy"], "same-origin");
    assert.equal(res.headers["cross-origin-resource-policy"], "same-origin");
    assert.equal(res.headers["x-frame-options"], "DENY");
    assert.equal(res.headers["x-permitted-cross-domain-policies"], "none");
    assert.match(res.headers["strict-transport-security"], /max-age=31536000/);
  } finally {
    server.close();
  }
});

test("Path traversal: directory traversal attempts return 404", async () => {
  const db = await openStore(":memory:");
  const config = readConfig();
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res1 = await request(server, "/../package.json");
    assert.equal(res1.status, 404);

    const res2 = await request(server, "/assets/../../package.json");
    assert.equal(res2.status, 404);

    const res3 = await request(server, "/server/database.js");
    assert.equal(res3.status, 404);
  } finally {
    server.close();
  }
});

test("Discord Interactions: returns 401 text when signature is invalid or public key missing", async () => {
  const db = await openStore(":memory:");
  const config = readConfig();
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const res = await request(server, "/api/discord/interactions", {
      headers: { "content-type": "application/json" },
      body: { type: 1 },
    });
    assert.equal(res.status, 401);
    assert.match(res.raw, /Invalid request signature/);
  } finally {
    server.close();
  }
});

test("Discord Reply: rejects unauthenticated bot calls with 401", async () => {
  const db = await openStore(":memory:");
  const config = {
    ...readConfig(),
    discordBotToken: "secret_bot_token_12345",
  };
  const server = createApp(db, config);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // Missing token
    const res1 = await request(server, "/api/discord/reply", {
      headers: { "content-type": "application/json" },
      body: { orderId: "VNL-TEST", replyText: "Hello" },
    });
    assert.equal(res1.status, 401);
    assert.equal(res1.body.success, false);

    // Wrong token
    const res2 = await request(server, "/api/discord/reply", {
      headers: {
        "content-type": "application/json",
        "x-bot-token": "wrong_token",
      },
      body: { orderId: "VNL-TEST", replyText: "Hello" },
    });
    assert.equal(res2.status, 401);
    assert.equal(res2.body.success, false);
  } finally {
    server.close();
  }
});
