import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function readConfig(env = process.env) {
  const origin = new URL(
    env.PUBLIC_ORIGIN ||
      (env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  );
  const production = env.NODE_ENV === "production" || env.VERCEL === "1";
  if (production && origin.protocol !== "https:")
    throw new Error("PUBLIC_ORIGIN must use HTTPS in production.");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("PUBLIC_ORIGIN must contain only the website origin.");
  }
  const config = {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 3000),
    origin: origin.origin,
    production,
    databasePath: path.resolve(root, env.DATABASE_PATH || "./data/vnl.sqlite"),
    remoteDatabase: {
      url: env.TURSO_DATABASE_URL || env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN || env.TURSO_DATABASE_AUTH_TOKEN,
    },
    paymentsMode: env.PAYMENTS_MODE || "disabled",
    adminPassword: env.ADMIN_PASSWORD || "",
    bank: {
      code: env.BANK_CODE || "",
      gateway: env.BANK_GATEWAY || "",
      accountNumber: env.BANK_ACCOUNT_NUMBER || "",
      accountName: env.BANK_ACCOUNT_NAME || "",
    },
    webhookSecret: env.SEPAY_WEBHOOK_SECRET || "",
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || "",
    discordAdminId: env.DISCORD_ADMIN_ID || "604729446649298963",
    discordFeedbackWebhookUrl:
      env.DISCORD_FEEDBACK_WEBHOOK_URL || env.DISCORD_LEGIT_WEBHOOK_URL || "",
    discordLegitChannelId:
      env.DISCORD_LEGIT_CHANNEL_ID || "1562154223783907560",
  };
  if (!["disabled", "live"].includes(config.paymentsMode))
    throw new Error("PAYMENTS_MODE must be disabled or live.");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    throw new Error("Invalid PORT.");
  if (config.paymentsMode === "live") {
    if (
      !/^[A-Za-z0-9]{2,20}$/.test(config.bank.code) ||
      !/^\d{5,30}$/.test(config.bank.accountNumber) ||
      !config.bank.accountName.trim() ||
      !config.bank.gateway.trim() ||
      config.webhookSecret.length < 32
    ) {
      throw new Error(
        "Bank configuration and a webhook secret of at least 32 characters are required.",
      );
    }
    if (!production)
      throw new Error("Live payments require NODE_ENV=production and HTTPS.");
  }
  return config;
}
