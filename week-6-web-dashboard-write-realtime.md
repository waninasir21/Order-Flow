# Week 6 — Web Dashboard (Write Side) + Real-Time

> Depends on Week 5's orders/inventory read UI, and Week 2's backend
> `updateOrderStatus` mutation. This is the week the "shared backend"
> architecture really pays off — approve on web, watch it update live on
> mobile.

## Goal for the week

Admins can approve/reject orders and edit inventory from the web dashboard,
and those changes propagate live to the mobile app via GraphQL subscriptions
— no manual refresh needed anywhere.

## Tasks, in order

### 1. Backend: subscriptions setup
- Add a subscriptions transport to Apollo Server (`graphql-ws` over a
  WebSocket server, commonly layered on top of your existing Express/HTTP
  server).
- Add an in-memory `PubSub` instance (fine for a single-instance learning
  project — note in `DECISIONS.md` that a production version would need
  a Redis-backed PubSub for multi-instance deployments; knowing that
  limitation and naming it is itself a good interview signal).
- Define `Subscription { orderStatusChanged(outletId: ID): Order! }`.
- In the `updateOrderStatus` resolver (from week 2), after successfully
  updating the DB, call `pubsub.publish('ORDER_STATUS_CHANGED', { order })`.

### 2. Backend: inventory update mutation
- `updateProductStock(productId, stockQuantity): Product` — admin only.
- Basic validation (no negative stock).

### 3. Web: approve/reject actions
- On the order detail (or list) view: buttons for Approve/Reject, calling
  `updateOrderStatus`.
- Disable invalid transitions in the UI to match the backend's state
  machine (e.g. don't show "Approve" on an already-`FULFILLED` order).
- Optimistic UI update on click (update the Apollo cache immediately, roll
  back on error).

### 4. Web: inventory editing
- Editable stock quantity field (inline edit or a small modal) calling
  `updateProductStock`.

### 5. Mobile: subscribe to status changes
- Subscribe to `orderStatusChanged` for the rep's outlets on the orders
  history screen (or app-wide, your call).
- On event: update the Apollo cache directly so the order's status badge
  changes without a manual refetch.
- Trigger a local push notification (Expo Notifications, local — no need
  for a full push server this week) when a status change arrives while the
  rep is using the app; note in `DECISIONS.md` that a "real" push
  notification (via Expo Push service, arriving even when the app is
  closed) is a valid stretch goal but out of scope for this week if time is
  tight.

### 6. End-to-end real-time test
- Have the web dashboard and the Expo app open side by side (two windows/
  devices). Approve an order on web, watch the mobile order card update its
  status live without touching the phone.

## Milestone (must be true before moving to week 7)

The side-by-side test above works reliably: an admin action on web updates
the corresponding order on mobile within a second or two, with no manual
refresh on either side.

## Things to write down in DECISIONS.md this week

- In-memory PubSub now vs Redis-backed PubSub for production — name the gap
  explicitly, don't just silently accept it.
- Optimistic UI + rollback strategy on the web write actions.
- Whether you did full push notifications or local-only, and why.

## Common pitfalls

- WebSocket connection failing in production-like environments due to
  reverse proxy/load balancer config — you'll hit a milder version of this
  in week 8 deployment; note it now so it's not a surprise later.
- Forgetting to unsubscribe on component unmount (mobile or web) — causes
  memory leaks and duplicate event handling; make sure your subscription
  hooks clean up properly.
- Race condition: the optimistic UI update on web and the subscription event
  arriving back for the *same* change causing a double-render or flicker —
  test explicitly and dedupe if it happens (usually by checking if the
  incoming subscription data actually differs before re-rendering).

## What later weeks depend on from this week

Week 7's analytics charts will read from the same `orders`/`products` data
this week's mutations affect — no new dependency, just make sure your order
status changes are consistently recorded (e.g. an `updatedAt` timestamp) so
"orders per day" style charts have something meaningful to plot.
