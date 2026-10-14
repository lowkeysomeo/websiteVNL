import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
await mkdir(output, { recursive: true });
const files = [
  "index.html",
  "styles.css",
  "products.js",
  "app.js",
  "hero3d.js",
  "cursor.js",
  "intro.js",
  "local-entry.js",
  "wallet.js",
  "wallet.css",
  "admin.html",
  "admin.js",
  "admin-pricing.js",
  "admin.css",
  "favicon.ico",
];
for (const file of files)
  await copyFile(new URL(file, root), new URL(file, output));
// Copy only public asset formats, never project files or the local database.
async function assets(relative) {
  await mkdir(new URL(relative + "/", output), { recursive: true });
  for (const entry of await readdir(new URL(relative + "/", root), {
    withFileTypes: true,
  })) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await assets(name);
    else if (
      entry.isFile() &&
      [".png", ".svg", ".js", ".json", ".webp", ".woff2"].includes(
        path.extname(entry.name),
      )
    )
      await copyFile(new URL(name, root), new URL(name, output));
  }
}
await assets("assets");
