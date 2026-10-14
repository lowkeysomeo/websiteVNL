import { readConfig } from "../server/config.js";
import { openStore } from "../server/database.js";
import { createApp } from "../server/app.js";
import { webHandler } from "../server/web-handler.js";

// Reuse connections on warm invocations, without starting a listening server.
let ready;
async function initialize() {
  const config = readConfig();
  const db = await openStore(config.databasePath, config.remoteDatabase);
  return createApp(db, config).listeners("request")[0];
}

async function handler(req, res) {
  try {
    ready ??= initialize().catch((error) => {
      ready = undefined;
      throw error;
    });
    const handle = await ready;
    await handle(req, res);
  } catch (error) {
    // Do not expose database URLs, tokens or provider error details to clients/logs.
    console.error("Backend initialization failed:", error.code || error.name);
    res.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        success: false,
        error: "Tài khoản và ví đang được cấu hình. Vui lòng thử lại sau.",
      }),
    );
  }
}

export default webHandler(handler);
