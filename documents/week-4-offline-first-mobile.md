# Week 4 — Offline-First Mobile

> Depends on Week 3: a working online order-placement flow via a single
> `useCreateOrder()`-style hook. This is flagged as the hardest week in
> `00-architecture.md` — budget extra time, don't compress it.

## Goal for the week

Orders placed while offline get queued locally and sync automatically when
connectivity returns, with optimistic UI the whole time.

## Tasks, in order

### 1. Local queue storage
- `npm install expo-sqlite` (or use `react-native-mmkv` if you prefer
  storing a JSON array — SQLite is the better learning choice since it's a
  more realistic "offline queue" pattern and gives you a reason to write
  real SQL).
- Create a `pending_orders` table: `id (local uuid), outletId, items (json),
  createdAt, syncStatus (PENDING | SYNCING | FAILED)`.

### 2. Network awareness
- `npm install @react-native-community/netinfo`.
- A small `useNetworkStatus()` hook or a Zustand slice tracking
  `isConnected`.

### 3. Intercept order creation
- In your `useCreateOrder()` hook from week 3: check network status first.
  - **Online:** call the `createOrder` mutation as before.
  - **Offline:** write a row into `pending_orders` with a local UUID instead,
    and immediately update the UI as if the order was placed (optimistic),
    tagged visually as "pending sync" (e.g. a badge on the order card).

### 4. Sync manager
- A background effect (e.g. in your app root or a dedicated
  `SyncManager` component) that:
  1. Watches for `isConnected` flipping from false → true.
  2. Reads all `PENDING` rows from `pending_orders`, in creation order.
  3. For each, calls the real `createOrder` mutation.
     - On success: delete the local row, replace the optimistic local order
       with the real server order (matching by local UUID stored alongside).
     - On failure (e.g. stock ran out server-side): mark the row `FAILED`,
       surface a clear message to the user rather than silently dropping it.
  4. Process one at a time, sequentially — don't fire all pending orders in
     parallel (risk of overwhelming stock-check race conditions).

### 5. UI treatment for pending/failed state
- Order history screen shows three visual states: synced (normal),
  pending sync (subtle badge, still editable/cancelable), failed (clear
  error, retry button).
- A manual "retry sync" action for `FAILED` rows, not just automatic.

### 6. Deliberate testing
- Turn on airplane mode, place 2–3 orders, confirm they show as "pending
  sync" and exist in the local SQLite table.
- Turn airplane mode off, confirm the sync manager fires and all orders
  land correctly in Postgres in the original order.
- Simulate a failure case: manually set a product's stock to 0 in
  `prisma studio` while an order for it is queued offline, then reconnect —
  confirm you get a clean `FAILED` state, not a crash.

## Milestone (must be true before moving to week 5)

Airplane-mode test above passes cleanly, including the deliberate failure
case. This is your strongest "I actually understand distributed systems
edge cases" interview story from the whole project — don't skip the failure
test to save time.

## Things to write down in DECISIONS.md this week

- SQLite vs MMKV-as-JSON-array for the offline queue, and why.
- How you handle the "local UUID vs server ID" reconciliation problem —
  this is a genuinely subtle bit of state management worth documenting
  clearly for your own future reference.
- Sequential vs parallel sync processing, and why you chose one.

## Common pitfalls

- Firing all queued mutations in parallel — causes race conditions on stock
  checks and out-of-order syncing; process sequentially with `await` in a
  loop, not `Promise.all`.
- Losing the mapping between the local optimistic order and the eventual
  server order, causing duplicate entries in the UI — keep the local UUID
  attached to the order object until the swap is confirmed complete.
- Not handling app kill mid-sync — if the app is force-closed while syncing,
  confirm on next launch the sync manager picks up remaining `PENDING`/
  `SYNCING` rows correctly (treat `SYNCING` as retryable on cold start).

## What later weeks depend on from this week

Nothing downstream directly depends on the offline mechanism, but the
optimistic-UI pattern you build here (pending/synced/failed states) is worth
reusing visually in week 7's polish pass for consistency.
