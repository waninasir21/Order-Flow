import * as SQLite from "expo-sqlite";

// One shared connection, opened lazily. The table is created on first open, so there is
// no separate migration step to forget. If the schema ever changes, add a version check here.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((e) => {
      dbPromise = null; // let the next call try again
      throw e;
    });
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("orderflow.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pending_orders (
      id            TEXT PRIMARY KEY NOT NULL,  -- local UUID, also sent to the server as clientId
      employee_id   TEXT NOT NULL,              -- whose order this is (never sync another user's)
      outlet_id     TEXT NOT NULL,
      outlet_name   TEXT NOT NULL,              -- for display while offline
      items         TEXT NOT NULL,              -- JSON: [{productId, name, price, quantity}]
      total         REAL NOT NULL,              -- display only; the server prices the real order
      created_at    TEXT NOT NULL,              -- ISO timestamp, defines sync order
      sync_status   TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | SYNCING | FAILED
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pending_orders_created ON pending_orders (created_at);
  `);
  return db;
}
