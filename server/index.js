import { readConfig } from "./config.js";
import { openStore } from "./store.js";
import { createApp } from "./app.js";

const config = readConfig();
const db = await openStore(config.databasePath, config.remoteDatabase);
const server = createApp(db, config);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(config.port, config.host, () =>
  console.log(
    `VietNam Legacy running on port ${config.port}; deposits: ${config.paymentsMode}`,
  ),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
