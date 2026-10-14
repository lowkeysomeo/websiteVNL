import { DatabaseSync } from "node:sqlite";
export function createLocalClient(filename) {
  const native = new DatabaseSync(filename);
  native.exec(
    "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
  );
  let tail = Promise.resolve();
  const enqueue = (action) => {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  };
  const execute = ({ sql, args = [] }) => {
    const statement = native.prepare(sql);
    if (statement.columns().length) return { rows: statement.all(...args) };
    return { rows: [], ...statement.run(...args) };
  };
  return {
    execute(statement) {
      return enqueue(() => execute(statement));
    },
    executeMultiple(sql) {
      return enqueue(() => native.exec(sql));
    },
    close() {
      native.close();
    },
    async transaction() {
      let release;
      const previous = tail;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        native.exec("BEGIN IMMEDIATE");
      } catch (error) {
        release();
        throw error;
      }
      let closed = false;
      const finish = (sql) => {
        if (!closed) {
          try {
            native.exec(sql);
          } catch (error) {
            if (native.isTransaction) native.exec("ROLLBACK");
            throw error;
          } finally {
            closed = true;
            release();
          }
        }
      };
      return {
        get closed() {
          return closed;
        },
        async execute(statement) {
          return execute(statement);
        },
        async executeMultiple(sql) {
          native.exec(sql);
        },
        async commit() {
          finish("COMMIT");
        },
        async rollback() {
          finish("ROLLBACK");
        },
        close() {
          finish("ROLLBACK");
        },
      };
    },
  };
}
