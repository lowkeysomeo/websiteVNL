import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function adaptClient(client) {
  let transactionQueue = Promise.resolve();
  const db = {
    prepare(sql) {
      const execute = (args) => client.execute({ sql, args });
      return {
        async get(...args) {
          return (await execute(args)).rows[0];
        },
        async all(...args) {
          return (await execute(args)).rows;
        },
        async run(...args) {
          return execute(args);
        },
      };
    },
    exec(sql) {
      return client.executeMultiple(sql);
    },
    close() {
      client.close();
    },
    async transaction(action) {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      let tx;
      try {
        // The database write lock also serializes transactions across Vercel instances.
        tx = await client.transaction("write");
        const result = await action(adaptClient(tx));
        await tx.commit();
        return result;
      } catch (error) {
        if (tx && !tx.closed) await tx.rollback();
        throw error;
      } finally {
        tx?.close();
        release();
      }
    },
  };
  return db;
}

export async function openStore(filename, remote = {}) {
  let remoteUrl = String(remote.url || "").trim();
  let remoteAuthToken = String(remote.authToken || "").trim();

  if (remoteUrl && !/^(libsql|https):\/\//i.test(remoteUrl)) {
    remoteUrl = `libsql://${remoteUrl}`;
  }

  if (process.env.VERCEL && !remoteUrl)
    throw new Error(
      "TURSO_DATABASE_URL is required on Vercel; local wallets are disabled.",
    );
  let client;
  if (remoteUrl) {
    if (!remoteAuthToken)
      throw new Error("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    const { createClient } = await import("@libsql/client/web");
    client = createClient({ url: remoteUrl, authToken: remoteAuthToken });
  } else {
    if (filename !== ":memory:")
      mkdirSync(path.dirname(filename), { recursive: true });
    const { createLocalClient } = await import("./local-database.js");
    client = createLocalClient(filename);
  }
  const db = adaptClient(client);
  try {
    const schema = await readFile(
      new URL("./schema.sql", import.meta.url),
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.exec(schema);
      const userCols = await tx.prepare("PRAGMA table_info(users)").all();
      if (!userCols.some((c) => c.name === "discord_id"))
        await tx.exec("ALTER TABLE users ADD COLUMN discord_id TEXT;");
      if (!userCols.some((c) => c.name === "discord_username"))
        await tx.exec("ALTER TABLE users ADD COLUMN discord_username TEXT;");
      if (!userCols.some((c) => c.name === "discord_global_name"))
        await tx.exec("ALTER TABLE users ADD COLUMN discord_global_name TEXT;");
      if (!userCols.some((c) => c.name === "discord_avatar"))
        await tx.exec("ALTER TABLE users ADD COLUMN discord_avatar TEXT;");
      await tx.exec("CREATE INDEX IF NOT EXISTS users_discord_id ON users(discord_id);");

      const columns = await tx.prepare("PRAGMA table_info(orders)").all();
      if (!columns.some((column) => column.name === "server_invite"))
        await tx.exec("ALTER TABLE orders ADD COLUMN server_invite TEXT;");
      if (!columns.some((column) => column.name === "decor_image"))
        await tx.exec("ALTER TABLE orders ADD COLUMN decor_image TEXT;");
      if (!columns.some((column) => column.name === "discord_token"))
        await tx.exec("ALTER TABLE orders ADD COLUMN discord_token TEXT;");
      const guideCols = await tx.prepare("PRAGMA table_info(shopping_guides)").all();
      if (guideCols.length && !guideCols.some((c) => c.name === "partner_email"))
        await tx.exec("ALTER TABLE shopping_guides ADD COLUMN partner_email TEXT;");
      if (guideCols.length && !guideCols.some((c) => c.name === "category"))
        await tx.exec("ALTER TABLE shopping_guides ADD COLUMN category TEXT DEFAULT 'guide';");
      if (guideCols.length && !guideCols.some((c) => c.name === "cover_image"))
        await tx.exec("ALTER TABLE shopping_guides ADD COLUMN cover_image TEXT DEFAULT '';");
      if (guideCols.length && !guideCols.some((c) => c.name === "views"))
        await tx.exec("ALTER TABLE shopping_guides ADD COLUMN views INTEGER DEFAULT 0;");
      if (guideCols.length && !guideCols.some((c) => c.name === "created_at"))
        await tx.exec("ALTER TABLE shopping_guides ADD COLUMN created_at INTEGER DEFAULT 0;");
      const payCols = await tx.prepare("PRAGMA table_info(payment_settings)").all();
      if (payCols.length && !payCols.some((c) => c.name === "webhook_secret"))
        await tx.exec("ALTER TABLE payment_settings ADD COLUMN webhook_secret TEXT DEFAULT '';");
      if (payCols.length && !payCols.some((c) => c.name === "auto_credit"))
        await tx.exec("ALTER TABLE payment_settings ADD COLUMN auto_credit INTEGER DEFAULT 1;");
      const prodCols = await tx.prepare("PRAGMA table_info(custom_products)").all();
      if (prodCols.length && !prodCols.some((c) => c.name === "partner_email"))
        await tx.exec("ALTER TABLE custom_products ADD COLUMN partner_email TEXT DEFAULT NULL;");
      if (prodCols.length && !prodCols.some((c) => c.name === "requires_token"))
        await tx.exec("ALTER TABLE custom_products ADD COLUMN requires_token INTEGER NOT NULL DEFAULT 0;");
      const msgCols = await tx.prepare("PRAGMA table_info(order_messages)").all();
      if (msgCols.length === 0) {
        await tx.exec(`CREATE TABLE IF NOT EXISTS order_messages (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id),
          sender_role TEXT NOT NULL CHECK(sender_role IN ('admin','partner','customer')),
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS order_messages_order ON order_messages(order_id, created_at);`);
      }
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
