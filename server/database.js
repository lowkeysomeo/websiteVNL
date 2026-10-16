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
  if (process.env.VERCEL && !remote.url)
    throw new Error(
      "TURSO_DATABASE_URL is required on Vercel; local wallets are disabled.",
    );
  let client;
  if (remote.url) {
    if (!/^(libsql|https):\/\//.test(remote.url) || !remote.authToken)
      throw new Error("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
    const { createClient } = await import("@libsql/client/web");
    client = createClient({ url: remote.url, authToken: remote.authToken });
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
      const columns = await tx.prepare("PRAGMA table_info(orders)").all();
      if (!columns.some((column) => column.name === "server_invite"))
        await tx.exec("ALTER TABLE orders ADD COLUMN server_invite TEXT;");
      if (!columns.some((column) => column.name === "decor_image"))
        await tx.exec("ALTER TABLE orders ADD COLUMN decor_image TEXT;");
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
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
