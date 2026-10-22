import { create } from "zustand";
import { getDb } from "./db";

export type SyncStatus = "PENDING" | "SYNCING" | "FAILED";

export interface PendingItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PendingOrder {
  id: string; // local UUID; also the server-side clientId (idempotency key)
  employeeId: string;
  outletId: string;
  outletName: string;
  items: PendingItem[];
  total: number;
  createdAt: string;
  syncStatus: SyncStatus;
  errorMessage: string | null;
}

interface Row {
  id: string;
  employee_id: string;
  outlet_id: string;
  outlet_name: string;
  items: string;
  total: number;
  created_at: string;
  sync_status: SyncStatus;
  error_message: string | null;
}

function fromRow(r: Row): PendingOrder {
  return {
    id: r.id,
    employeeId: r.employee_id,
    outletId: r.outlet_id,
    outletName: r.outlet_name,
    items: JSON.parse(r.items) as PendingItem[],
    total: r.total,
    createdAt: r.created_at,
    syncStatus: r.sync_status,
    errorMessage: r.error_message,
  };
}

interface OutboxState {
  // Oldest first. This in-memory list mirrors the SQLite table so screens re-render
  // when it changes; SQLite is what survives the app being killed.
  rows: PendingOrder[];
  loaded: boolean;
  load: () => Promise<void>;
  enqueue: (
    order: Omit<PendingOrder, "createdAt" | "syncStatus" | "errorMessage">
  ) => Promise<PendingOrder>;
  setStatus: (id: string, status: SyncStatus, errorMessage?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

// If the app was killed mid-sync, rows are stuck at SYNCING. Once per app launch they go
// back to PENDING. Re-sending is safe because the server de-duplicates by clientId.
let coldStartDone = false;

export const useOutbox = create<OutboxState>((set) => ({
  rows: [],
  loaded: false,

  load: async () => {
    const db = await getDb();
    if (!coldStartDone) {
      await db.runAsync(`UPDATE pending_orders SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING'`);
      coldStartDone = true;
    }
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM pending_orders ORDER BY created_at ASC, rowid ASC`
    );
    set({ rows: rows.map(fromRow), loaded: true });
  },

  // Database first, memory second: we only tell the user "saved" once it really is on disk.
  enqueue: async (order) => {
    const full: PendingOrder = {
      ...order,
      createdAt: new Date().toISOString(),
      syncStatus: "PENDING",
      errorMessage: null,
    };
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO pending_orders
        (id, employee_id, outlet_id, outlet_name, items, total, created_at, sync_status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)`,
      [
        full.id,
        full.employeeId,
        full.outletId,
        full.outletName,
        JSON.stringify(full.items),
        full.total,
        full.createdAt,
      ]
    );
    set((s) => ({ rows: [...s.rows, full] }));
    return full;
  },

  // For status changes and removal, memory is updated first (synchronously) so a quick
  // "Cancel" tap and the sync loop always see the same state; SQLite follows right after.
  setStatus: async (id, status, errorMessage) => {
    const message = status === "FAILED" ? (errorMessage ?? "Sync failed") : null;
    set((s) => ({
      rows: s.rows.map((r) => (r.id === id ? { ...r, syncStatus: status, errorMessage: message } : r)),
    }));
    const db = await getDb();
    await db.runAsync(`UPDATE pending_orders SET sync_status = ?, error_message = ? WHERE id = ?`, [
      status,
      message,
      id,
    ]);
  },

  remove: async (id) => {
    set((s) => ({ rows: s.rows.filter((r) => r.id !== id) }));
    const db = await getDb();
    await db.runAsync(`DELETE FROM pending_orders WHERE id = ?`, [id]);
  },
}));
