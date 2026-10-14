import http from "node:http";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { root } from "./config.js";

const origin = "http://127.0.0.1:3201";

function isRunning() {
  return new Promise(resolve => {
    const request = http.get(origin + "/api/health", { timeout: 500 }, response => {
      let body = "";
      response.on("data", chunk => { body += chunk; });
      response.on("error", () => resolve(false));
      response.on("end", () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).ok === true); }
        catch { resolve(false); }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

if (process.argv.includes("--serve")) {
  const envFile = root + "/.env";
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  // Bản chạy trên máy dùng dữ liệu hiện có; cổng nạp tiền thật luôn đóng.
  Object.assign(process.env, {
    HOST: "127.0.0.1", PORT: "3201", PUBLIC_ORIGIN: origin,
    NODE_ENV: "development", PAYMENTS_MODE: "disabled",
  });
  await import("./index.js");
} else {
  try {
    if (!(await isRunning())) {
      const server = spawn(process.execPath, [fileURLToPath(import.meta.url), "--serve"], {
        cwd: root, detached: true, windowsHide: true, stdio: "ignore",
      });
      server.on("error", () => {});
      server.unref();
      const deadline = Date.now() + 10000;
      let ready = false;
      while (Date.now() < deadline) {
        if (await isRunning()) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!ready) throw new Error("Chưa mở được cửa hàng. Kiểm tra Node.js 24 trở lên và cổng 3201 có đang được ứng dụng khác sử dụng không.");
    }
    console.log("Cửa hàng đã sẵn sàng: " + origin);
    if (process.platform === "win32") {
      const browser = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Start-Process '${origin}/'`], { windowsHide: true, stdio: "ignore" });
      browser.on("error", () => console.log("Mở địa chỉ trên trong trình duyệt để xem cửa hàng."));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
