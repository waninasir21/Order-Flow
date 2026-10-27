# OrderFlow — Decisions Log

## 2026-10-21 — Turborepo over plain npm workspaces

I chose Turborepo because the project will have three apps and shared packages, and I want one command (`turbo run dev`, `build`, `typecheck`) to work across all of them, with caching so unchanged packages aren't rebuilt. `--filter` also lets me run only the backend, which matters on an i3/8GB laptop. Honest tradeoff: with only the backend built so far, the benefit is mostly ahead of me. Plain workspaces would have worked for week 1.

## 2026-10-21 — Prisma over TypeORM / Drizzle

Prisma generates TypeScript types straight from `schema.prisma`, so resolvers and seed code are type-checked against the real database shape. Migrations are plain SQL files committed to git, and Prisma Studio gave me a quick visual check of the data. Tradeoff: Drizzle sits closer to raw SQL and is lighter, while Prisma adds a generated client and an engine. I picked Prisma for developer experience and because it's widely used in job listings.

## 2026-10-21 — SDL-first GraphQL schema

I wrote the schema as plain SDL because it reads as a contract between backend and frontends, and I already work with SDL-style schemas on the client side with Apollo. Tradeoff: resolver types aren't generated yet, so they're typed by hand until I add GraphQL codegen into `shared-types`.

## 2026-10-21 — Enums for `Role` and `OrderStatus` in the DB from day one

Avoids a migration later when auth (week 2) and order approval (week 6) depend on them.

## 2026-10-21 — Cloud Postgres/Redis from day one, no local Docker

Matches the i3/8GB hardware constraint; same instances reused for deployment in week 8.

## 2026-10-21 — Decimal in the database, Float in GraphQL for price

Prices are stored as `Decimal(10,2)` to avoid floating-point errors, but GraphQL has no decimal type, so the resolver converts with `toNumber()`. That's fine for display. Before any arithmetic on totals (order totals in week 2), I'll compute with Decimal or integer paise on the server, not JS floats.

_Follow-up (week 2):_ the order `total` is summed with Prisma's `Decimal` (`priceAtOrder × quantity`) and converted to a number only at the very end, so the arithmetic itself is exact. The client still receives a `Float`.

## 2026-10-21 — bcryptjs over bcrypt / argon2

I used `bcryptjs` for password hashing because it's pure JavaScript, so it installs on Windows without a native build step. Tradeoff: it's slower than native `bcrypt`, and argon2 is the newer recommendation. For this project's login volume the speed difference doesn't matter, and I'd revisit it for a production system. Cost factor is 10. Login also compares against a dummy hash when the phone number doesn't exist, so response time doesn't reveal which numbers are registered.

## 2026-10-21 — DB-backed refresh tokens with rotation and reuse detection

Access tokens are short-lived JWTs (15 minutes), signed with a secret from `.env`. Refresh tokens are random opaque strings, not JWTs, and only their SHA-256 hash is stored in a `RefreshToken` table, so a database leak doesn't expose usable tokens. Each token works once: refreshing revokes it and issues a new pair. If a revoked token is presented again, I treat it as stolen and revoke all of that employee's tokens. The spend step is an atomic `updateMany ... where revokedAt is null`, so two concurrent requests can't both succeed. Tradeoff: this needs a database read on every refresh and means the mobile app must serialise refresh calls, because two parallel refreshes would log the user out.

## 2026-10-21 — Order status state machine, with restock on reject

Allowed transitions: PLACED → APPROVED or REJECTED, and APPROVED → FULFILLED. REJECTED and FULFILLED are final. The rules live in one file (`orderStatus.ts`) and all changes go through one service function, which is where week 6's subscription event will be published. The update only applies if the status is still what was read, so two admins can't both change the same order. Rejecting an order puts the reserved stock back in the same transaction, because stock is deducted when an order is placed, not when it's approved. Without this, rejected orders would permanently lose inventory.

## 2026-10-21 — Atomic conditional stock decrement instead of check-then-update

When placing an order, each product is updated with a single statement: decrement stock where stock is at least the requested quantity. If no row matches, the transaction rolls back with an INSUFFICIENT_STOCK error. A separate "read stock, check, then write" would let two reps ordering the last units at the same time both pass the check and oversell. The whole order (stock changes plus order and items) is one transaction, so a failure can never leave a half-created order or a stock deduction without an order. Tradeoff: stock is reserved at placement time, so unapproved orders hold inventory until an admin rejects them.

## 2026-10-21 — Errors carry a machine-readable code; permissions are enforced on the server

Every error the API throws sets `extensions.code` (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_STOCK`), so clients branch on the code and never parse message text. The mobile app uses this to refresh an expired token and to decide whether a failed order should be retried. Authorization lives only in the resolvers and services (`requireAuth`, `requireRole`, outlet-assignment checks), never in the app's UI. Reps see only their assigned outlets and their own orders; an admin may place an order for any outlet, acting on behalf of a rep.

## 2026-10-22 — Tokens stored in expo-secure-store instead of MMKV

The architecture doc planned MMKV, but `react-native-mmkv` needs native code that Expo Go doesn't include, and I develop on a physical phone with Expo Go to keep an i3/8GB laptop usable (no emulator, no custom dev build). `expo-secure-store` works in Expo Go and keeps the tokens in the OS keychain/keystore, which is a better home for credentials than a plain key-value store anyway. It's async, so Zustand's `persist` middleware loads the session after launch; a `hydrated` flag makes the route guard wait for it so signed-in users never see a login flash. Everything goes through one file (`src/lib/secureStorage.ts`), so switching to MMKV later means rewriting only that file. Tradeoff: SecureStore keys and values are small and slower than MMKV, which is fine for two tokens and a user record.

## 2026-10-22 — The session lives on the device, the control over it lives on the server

The phone has to hold something to prove who it is on every request, so the tokens must be stored there. The server stores only a hash of each refresh token (so it can check a presented token but can never hand it back), plus expiry and revocation state. That split gives the server the control (logout, rotation, reuse detection, expiry) and the device the proof. It also makes the app open while offline. I rejected server-only sessions with cookies because they would still need a client-side cookie, and cookies are awkward in React Native.

## 2026-10-22 — Skipping the web target for the mobile app

`expo-secure-store` has no web implementation, so the app crashes if opened in the browser (the `w` option in the Expo terminal). I briefly wrote a `localStorage` fallback, then dropped it: `localStorage` isn't secure storage, and the web client is the Next.js dashboard in week 5, which will keep its refresh token in an httpOnly cookie. The mobile app is tested on the phone only.

## 2026-10-22 — Route guard at the layout level

Every screen under `app/(app)/` is protected by one check in that folder's `_layout.tsx` (redirect to `/login` if there is no session), instead of a check in each screen. The login screen also redirects to the app if a session already exists. One place to get right, and a new screen added to the folder is protected automatically.

## 2026-10-22 — Single-flight token refresh in the Apollo error link

When a request fails with `UNAUTHENTICATED`, the error link refreshes the token once and retries the original operation once. All requests that fail at the same moment wait on the same in-flight refresh promise, because refresh tokens are single-use and two parallel refreshes would look like token theft and log the user out. The refresh uses a plain `fetch` rather than Apollo so it can't recurse into the same link, and failed `Login` operations are excluded (a wrong password is also `UNAUTHENTICATED`). If the refresh fails because the phone is offline, the session is kept; if the server rejects it, the session is cleared. On sign-out the whole Apollo cache is cleared so the next user on the phone never sees the previous user's data.

## 2026-10-22 — Cart state is component-local, not Zustand

The cart exists only on the place-order screen and should disappear when the screen closes, so it's plain `useState`. A Zustand store would only be worth it if several screens shared the cart or it had to survive navigation. Auth is a Zustand store because many screens and the Apollo link read it.

## 2026-10-22 — After creating an order: update the cache by hand, evict products

The new order is put at the top of the cached Orders list with `cache.modify`, so the list updates with no network round trip and no pull-to-refresh. Stock changed on the server, so instead of patching the cached products I evict them and let the screens refetch; the server is the source of truth for stock. Tradeoff: `cache.modify` means I must keep the mutation's selection identical to the list's fields (they share one `OrderFields` fragment), whereas `refetchQueries` would be simpler but costs a round trip and can't work offline. Only the unfiltered `orders` field is updated; per-outlet views filter on the device.

## 2026-10-22 — The API URL comes from the Expo dev server's host

A phone can't reach the laptop at `localhost`. In dev the app reuses the host from Expo's `hostUri` (the laptop's LAN IP, which the phone already uses to reach Metro) with port 4000. `EXPO_PUBLIC_API_URL` overrides it for tunnel mode or a deployed backend. Windows Firewall may need to allow Node on port 4000 for private networks.

## 2026-10-22 — SQLite over MMKV-as-JSON-array for the offline queue

The queue is a table (`pending_orders`) rather than one JSON array under a key. Each change touches one row instead of rewriting the whole array, a crash can't leave a half-written array, rows can be ordered and updated by id, and it's the more realistic pattern for an outbox. Tradeoff: more code and an async API. It also doesn't depend on MMKV, which doesn't run in Expo Go (see the storage decision above).

## 2026-10-22 — The local UUID is also the server's idempotency key

Each queued order gets a UUID when it's created. The same value is stored as the queue row's id and sent to the server as `clientId`. The server has `unique(employeeId, clientId)` on orders and, for a repeated `clientId`, returns the existing order instead of creating a new one (a race between two identical requests is resolved by the unique constraint, and the losing transaction, including its stock changes, rolls back). This matters because "treat SYNCING as retryable after the app is killed" is unsafe otherwise: the server may already have created the order and only the response was lost, and a blind retry would create it twice and deduct stock twice. It also solves the local-versus-server ID problem in the UI: the server order carries the `clientId`, so the list hides the local copy as soon as the real one appears, and there's never a duplicate or a gap. Tradeoff: a backend change and a migration, but it turns "hope the retry is safe" into a guarantee.

## 2026-10-22 — Sequential sync, and a failed order doesn't block the rest

Queued orders are sent one at a time, oldest first, with `await` in a loop. Parallel sends would race on the same stock and could land out of order. If one order is definitively refused, it's marked FAILED and the loop carries on with the next, because orders are independent and one out-of-stock product shouldn't hold back unrelated orders. A single-flight guard stops two sync runs from overlapping, and sync is triggered on launch, on going back online, and on returning to the foreground.

## 2026-10-22 — Two kinds of failure: unknown outcome versus definitive refusal

If a send gets no answer (offline, timeout, unreachable, HTTP 5xx), the outcome is unknown, so the order stays queued and is retried (after 15 seconds, or when connectivity returns). If the server answers with a refusal (any GraphQL error such as `INSUFFICIENT_STOCK`, or a 4xx), retrying won't change the answer, so the order is marked FAILED with the server's message and the user chooses Retry or Discard. `UNAUTHENTICATED` after a failed token refresh counts as retry-later, not failure. The same classification decides whether a foreground order is queued or the error is shown immediately.

## 2026-10-22 — Online-or-queue, with a request timeout and no reliance on `isInternetReachable`

The hook sends the order immediately unless NetInfo says the phone has no connection at all; if the request fails without an answer, the order is queued instead. So a phone on Wi-Fi with a dead backend also works, not just airplane mode. I ignore NetInfo's `isInternetReachable` because it pings a public server and would read as offline on a LAN-only dev setup. A 15-second timeout, implemented with `Promise.race` rather than depending on how Apollo surfaces an aborted request, stops a dead connection hanging the screen; a timed-out request may still have reached the server, which is safe because of the idempotency key.

## 2026-10-22 — Queue state: write order and crash recovery

Enqueue writes to SQLite first and updates memory second, so the app only says "saved" once the order is really on disk. Status changes and removals update memory first and SQLite right after, so a quick Cancel tap and the sync loop always see the same state. On each app launch, rows left in SYNCING (the app was killed mid-send) go back to PENDING; the idempotency key makes resending them safe. After a successful send the order is already in the Apollo cache before the local row is deleted, so the order can't vanish from the list in between.

## 2026-10-22 — Queued orders belong to the user who created them

Each row stores the employee id, and the sync loop and the order lists only touch the signed-in employee's rows, so one user's orders are never sent under another user's login. Signing out with unsynced orders shows a warning; the orders stay on the phone and are sent the next time that employee signs in.

## 2026-10-22 — Known limitations of the offline feature (deliberate scope cuts)

- The outlet and product lists live only in Apollo's in-memory cache, so after force-closing the app while offline, queued orders still show and sync later but new orders can't be placed until the app has been online once. Persisting the cache is the follow-up.
- A synced order's server `createdAt` is when it synced, not when the rep tapped Place order; the order of orders is preserved but the times aren't. A `clientCreatedAt` field would fix it.
- Pending orders can be cancelled but not edited.
- GraphQL types on the mobile app are hand-written until codegen goes into `shared-types`.

## 2026-10-24 — Web session in two httpOnly cookies, not localStorage

The week 5 doc allowed either. I used cookies: `of_at` (access token, 14 minutes) and `of_rt` (refresh token, 7 days), both `httpOnly`, `SameSite=Lax`, and `Secure` in production builds. JavaScript on the page can't read either, so an XSS bug can't steal a session. I checked this in a browser: the tokens are absent from `document.cookie`, `localStorage`, `sessionStorage` and the HTML. The trade-off I'm consciously accepting is that cookies are sent automatically, which opens the door to CSRF, where localStorage tokens (attached by my own code) don't have that problem. What limits it: `SameSite=Lax`; every mutation is a Next.js Server Action, which only accepts `POST` and rejects a request whose `Origin` doesn't match the host (documented in Next's data-security guide); and the only state-changing `GET` is `/auth/expired`, which just clears cookies, so the worst a hostile link can do is sign an admin out. The other cost is complexity: server components can't write cookies, so refreshing an expired session has to happen in `proxy.ts` and server actions.

## 2026-10-24 — The browser never calls the backend: server components and plain `fetch`, no Apollo Client on the web

The doc suggested `@apollo/experimental-nextjs-app-support` or a simpler client-only setup. I chose neither: server components, server actions and the proxy call the GraphQL API directly from the Next.js server with `fetch` (`lib/backend.ts` is the only place that does). That keeps tokens out of browser JavaScript, means there is no CORS to configure (the doc's listed pitfall simply doesn't arise), and the browser receives rendered HTML for a read-only dashboard. Trade-offs: no normalized client cache, and hand-written response types until codegen goes into `shared-types`. **Open question for week 6:** live updates need a WebSocket subscription from the browser, and the browser can't read the httpOnly cookie to authenticate it. Options are a short-lived token endpoint, proxying the WebSocket through Next, or a small client-side Apollo setup just for subscriptions. I'll decide that deliberately then instead of discovering it.

## 2026-10-24 — Single-flight token refresh in the proxy

Refresh tokens are single-use and reuse revokes the whole session (week 2). One page load fires several requests at once (prefetches, RSC fetches, server actions), so when the access cookie expires they all carry the same refresh token, and a naive implementation would refresh twice, look like token theft, and log the admin out. `refreshSession` keeps a map from refresh token to its in-flight promise, so everyone with the same token awaits one backend call and gets the same new pair; a finished result is kept 10 seconds for requests that were already in flight when the cookies rotated. An "unavailable" result is deliberately not kept, so "Try again" works as soon as the backend is back. Tested with 8 parallel requests carrying an expired session: exactly one backend refresh, no reuse detection, all eight succeeded. Limit: the map lives in one server process, so several instances would each refresh; the production fix is a short reuse grace window on the backend or a Redis lock. A backend outage never logs anyone out: only a definitive rejection from the backend clears the cookies.

## 2026-10-24 — Admin-only is enforced on the server in three places; the proxy is not the security boundary

A rep who signs in on the web gets no cookies and the refresh token the backend just issued is revoked (`loginAction`). Every page and the user menu call `getAdmin()` (a `me` query, memoized per request with React's `cache`), so even a rep's token or hand-made cookies is refused and cleared. And the backend scopes data by role regardless of what the UI does. The proxy only checks that a cookie exists, so it can redirect early, but I don't rely on it: a proxy-only check is a known mistake with this architecture. I tested the "rep gets into the dashboard" case by planting a real rep token in the cookies; it's rejected with an explanation. Cost: one extra small query per page, which is cheap next to the safety.

## 2026-10-24 — Orders table filters, sorts and pages in the browser, with the state in the URL

All orders are loaded and the table filters by status, searches, sorts (outlet, total, date) and pages (10 per page) client-side. For tens to hundreds of orders this is instant and needs no extra backend work. The state lives in the URL (`?status=PLACED&sort=total&page=2`) so Back from a detail page returns to the same view and a filtered list can be shared; only non-default values are written, with `history.replaceState` so changing a filter doesn't re-render the page on the server. The page maps results to a small row shape so the browser gets only what the table shows. When the list gets large, this moves to the backend: `orders(status:)` already filters, and paging and sorting would need adding. I decided on pagination now instead of letting the table silently become unusable as seed data grows.

## 2026-10-24 — React Server Components with Suspense and Cache Components for instant navigation

Each page renders its static title immediately and streams the data-dependent part behind `<Suspense>` with a skeleton; the sidebar highlight and user menu stream in the same way. Next prefetches the static part, so moving between Orders and Inventory feels instant while real data loads. Two consequences I accepted: an unknown order id shows the correct "Order not found" screen inside the dashboard but with HTTP 200 (the status is sent before `notFound()` runs; Next documents this and adds `noindex`, which doesn't matter for a login-protected admin page), and the user menu catches backend outages itself, because an error boundary can't catch an error thrown by its own segment's layout and would otherwise take the whole shell down.

## 2026-10-24 — `order(id)` on the backend, returning NOT_FOUND for someone else's order

The detail page needs one order, and fetching the whole list to pick one would be wasteful. A rep asking for another rep's order gets `NOT_FOUND`, not `FORBIDDEN`, so the API never confirms that someone else's order id exists. Both the dashboard and the mobile app can use it.

## 2026-10-24 — Fixed locale and time zone, and line totals computed in whole paise

`lib/format.ts` pins `en-IN` and `Asia/Kolkata`, because a time zone that differs between the Next.js server and the browser makes the server HTML and the client render disagree (hydration mismatches). Line totals are `round(price × 100) × quantity / 100`, so 3 × ₹142.50 shows ₹427.50 and never ₹427.49999. The order total shown is the backend's value, which it computed with `Decimal`.

## 2026-10-24 — No status history yet, and the UI says so

The backend stores only the current status, so the detail page's timeline shows "Placed" and "Last updated" plus a note that history isn't recorded, instead of faking one. A real history needs a status-event table written in `changeOrderStatus`, which is the single place status changes, so week 6 is the natural time to add it alongside approve/reject.

## 2026-10-24 — How I verified week 5 without the real database, and what that doesn't prove

The sandbox can't reach my Neon database, so I tested the dashboard in a real Chromium browser against a mock backend that copies the real backend's rules (single-use refresh tokens with reuse detection, rep-scoped orders, errors as HTTP 200 with `extensions.code`). 70 checks cover login and role refusal, cookie flags, filtering, sorting, paging, the detail page, the refresh race, a revoked session, a backend outage with and without an expired cookie, and phone width. I also validated every GraphQL document the web and mobile apps send against the real `schema.ts`. This proves the dashboard's logic and that its queries match the real schema; it doesn't prove the real backend's `order(id)` resolver or the real data, which is what the milestone test against my own database does.

## 2026-10-26 — In-memory PubSub now; a Redis-backed one is the production gap

Subscription events go through `graphql-subscriptions`' in-process `PubSub` (`src/pubsub.ts`). That works because exactly one Node process serves both the mutation and every WebSocket. With two instances behind a load balancer, an admin's approval handled by instance A would never reach a phone connected to instance B, and nothing would error: the live update would just sometimes not arrive. A production version swaps in `graphql-redis-subscriptions` (same `publish` / `asyncIterableIterator` interface, so only `pubsub.ts` changes) so every instance sees every event. There is also no replay: an event published while a phone is disconnected is gone, which is why the app refetches its orders list every time its socket (re)connects.

## 2026-10-26 — Publish after the commit, and a failed publish never fails the mutation

`changeOrderStatus` publishes `orderStatusChanged` only after the database transaction has committed. Publishing inside it could announce a change that then rolls back (for example when the conditional update loses a race). If the publish itself throws, the error is logged and the mutation still succeeds: the status change is real and already saved, and returning an error would make the admin retry into an "invalid transition". Because every status change goes through that one function, there is exactly one place that publishes.

## 2026-10-26 — Subscriptions authenticate at connect time, and the server closes the socket when the token expires

A browser or React Native WebSocket can't send an `Authorization` header, so the access token travels in graphql-ws `connectionParams` and is checked once, in `onConnect` (no valid token: the handshake is refused). A socket can then outlive a 15-minute token for hours, so the server closes it when the token expires, and the delivery filter also refuses to send on an expired token as a backstop. Two details came from reading graphql-ws's client: close code **4401 is treated as fatal and never retried**, so the server uses **4408**, which is retried; and the phone's `connectionParams` is an async function that refreshes the access token first if it expires within 30 seconds, so each reconnect arrives with a fresh token. Visibility matches the `orders` query: a rep receives only their own orders, an admin receives all, and `outletId` narrows either.

## 2026-10-26 — Optimistic UI on the web with `useOptimistic`, and the rollback is automatic

The week's doc says "update the Apollo cache immediately", but the dashboard deliberately has no Apollo (decision of 2026-10-24: server components and plain `fetch`). The equivalent is React's `useOptimistic` inside a transition: it lays a temporary value over the server data while the Server Action runs, then drops it when the transition ends. On success the action has called `refresh()`, so the real data already shows the confirmed value in the same render (no flash); on failure the real data is unchanged, so the UI snaps back to the old status by itself. The reason I prefer this over a hand-written "remember the old value and restore it on error" is that there is no restore code to forget or get wrong. The buttons are disabled while a request is in flight, so two clicks can't race. A `CONFLICT` or `BAD_USER_INPUT` answer (another admin got there first) also triggers `refresh()` so the screen shows the truth along with the message. Reject asks for confirmation first because it returns stock and can't be undone.

## 2026-10-26 — Server Actions are public endpoints, so they re-check and re-validate

`updateOrderStatusAction` and `updateProductStockAction` call `getAdmin()` first and validate their arguments (id length, status in the known list, stock a whole number from 0 to 1,000,000) before touching the backend. The backend does the same checks again; neither side trusts the other. The button list (`lib/transitions.ts`) copies the backend's state machine so invalid moves aren't offered; the backend stays the authority and it moves to `packages/shared-types` when that package exists.

## 2026-10-26 — The web dashboard does not subscribe this week

The milestone is the direction web to phone, and the web already reflects its own actions via `refresh()`. Making the dashboard itself live (a second admin's approval appearing without a reload) needs the access token in the browser, but the tokens are httpOnly cookies on purpose. The clean options are (a) a Route Handler on the web server that holds the subscription using the cookie and streams events to the browser over Server-Sent Events, keeping the token out of JavaScript, or (b) a short-lived token minted by the server for the WebSocket. I'd pick (a); it also removes the optimistic-versus-subscription double render the doc warns about, because there would be one source of change. Left for later on purpose.

## 2026-10-26 — Local notifications only; real push is out of scope

When an order's status changes while the rep has the app open, the app schedules a local notification (`expo-notifications`) on the phone. That is all it does: it can't reach a rep whose app is closed, because nothing is running to receive the event. Real push means the server sending through the Expo Push service to a stored device token (a new table, token registration and rotation, delivery receipts), a sensible stretch goal. Remote push also doesn't work in Expo Go on Android (SDK 53+), so local-only keeps the whole milestone testable on a normal Expo Go phone. The package is also loaded lazily inside try/catch (`realtime/notifications.ts`): on my phone's Expo Go build a top-level import threw `Cannot find native module 'ExpoTopicSubscriptionModule'` while the app was starting and broke every screen. A feature that is allowed to be absent must not be able to crash startup.

## 2026-10-26 — Mobile cache updates are written explicitly and deduplicated

The event carries the same fields as the Orders list, so it is written straight into the Apollo cache (`writeFragment`), and an order the phone hasn't loaded joins the top of the list. If the cached copy already has that status, nothing is written and no notification is shown. That is the doc's "check whether the incoming data actually differs" rule, and it covers the real duplicate source here: an event racing the catch-up refetch after a reconnect. The subscription runs once for the whole signed-in app (`LiveUpdates`, next to `SyncManager`), and its effect unsubscribes and cancels any pending retry on unmount, so logging out cannot leave a second listener behind.

## 2026-10-26 — `updateProductStock` sets an absolute number

An admin enters "stock is now 40", which is how a stock-take or a delivery is naturally described, so the mutation sets the value instead of applying a delta. Order placement decrements atomically in a single statement, so it can't be lost halfway through by this write; the remaining race is human (an order arriving between the admin reading the number and saving), and the next order simply deducts from the new value. The backend rejects negatives, non-integers and anything above 1,000,000. Stock edits aren't logged anywhere yet, so there is no history of who changed what.

## 2026-10-26 — WebSockets behind a reverse proxy (note for week 8)

Subscriptions work locally because the phone connects straight to Node. Many proxies and load balancers close idle connections after 30-60 seconds, don't forward the `Upgrade` header unless told to, or time out long-lived requests. Deployment needs WebSocket support turned on, a long idle timeout, and the `/graphql` path routed to the same process for HTTP and `ws://`. The phone's endless backoff reconnect and refetch-on-reconnect mean a dropped connection heals itself, but they can't fix a proxy that never allows the upgrade.

## 2026-10-26 — How I verified week 6 without the real database, and what that doesn't prove

The sandbox can't run Prisma's query engine, so the real server code (Express, Apollo, graphql-ws, resolvers, services) ran against an in-memory stand-in for the database. 17 backend checks passed: anonymous sockets refused; a rep receives only their own orders; the `outletId` filter; invalid transitions publish nothing; non-admins refused; stock validation and `NOT_FOUND`; the socket closing with 4408 at token expiry; a client reconnecting with a refreshed token and receiving events again; unsubscribing stops delivery. The dashboard ran in Chromium against a mock backend (18 checks: optimistic badge before the response, buttons disabled in flight, rollback with an error message, confirmation on reject, detail page, inline stock edit with validation and rollback). The phone's cache logic ran against a real Apollo cache (7 checks), and all 17 GraphQL documents validate against the real schema. **Not verified:** the real database path (the `updatedAt` write on `updateMany`, Neon latency), and anything that needs a physical phone: the actual WebSocket from Expo Go, the notification permission prompt and banner. That is the side-by-side test in `docs/08-realtime.md`.

## 2026-10-27 — Analytics are aggregated in the database, by dedicated resolvers

`ordersPerDay`, `topProducts` and `analyticsSummary` are backend queries that return finished numbers; the dashboard only draws them. `ordersPerDay` is one raw SQL statement (grouping, day boundaries and zero-filling all happen in Postgres, so a day with no orders is a row with `0` and the chart has no gaps); `topProducts` uses Prisma's `groupBy` on order items, sorted and limited in the database. The alternative, sending every order to the browser and counting there, works for 50 orders and falls over at 50,000, and it would also have meant two copies of the counting logic (web and, later, mobile). All three queries are admin-only because they cover every rep's orders, and `days` / `limit` are capped (90 / 20) so a request can't ask the database for an unbounded result.

## 2026-10-27 — A "day" is an Indian day, independent of the database's time zone

Prisma stores `createdAt` as a timestamp without a time zone, in UTC. An order placed at 11:50 pm IST is already tomorrow in UTC, so grouping by the raw column would put late-evening orders on the wrong bar. The SQL declares the column as UTC, converts it to `Asia/Kolkata` (`ANALYTICS_TIME_ZONE` in the environment overrides it), and converts the range start the other way, so the answer does not depend on the database session's own `TimeZone` setting either. It is the same zone the dashboard already formats dates in, so a bar and the orders table agree about which day an order belongs to.

## 2026-10-27 — Best sellers exclude rejected orders; the summary card reuses the chart's numbers

A rejected order returns its stock, so counting its units as "sold" would overstate demand; `topProducts` skips `REJECTED` orders (approved, fulfilled and still-pending ones count) and says so on the page. "Orders this week" is computed by summing the same `ordersPerDay(7)` the chart uses, so the card and the chart cannot disagree. The low-stock threshold (10) is defined in two places (backend and web) because there is no shared package yet; both carry a comment pointing at the other.

## 2026-10-27 — Dark mode on the web: a three-way toggle on top of CSS variables

Every color is a CSS variable with a light and a dark value, so components never branch on theme. The toggle cycles System, Light, Dark; "System" follows the operating system and is the default. The choice is stored in `localStorage` and applied through `<html data-theme>`, and a tiny script in `<head>` sets the attribute before the first paint so a saved "Dark" never flashes light. The dark values appear twice in the CSS (once under `prefers-color-scheme`, guarded by `:not([data-theme="light"])`, and once under `[data-theme="dark"]`) because CSS can't share one rule between a media query and an attribute selector; picking Light must beat a dark OS, which is what the `:not` guard does.

## 2026-10-27 — Charts take their colors from the same tokens, and have a data table instead of a keyboard layer

Recharts writes colors into SVG attributes, where CSS variables are not reliable, so the chart components read the real token values with `getComputedStyle` and re-read them when the theme changes (`useResolvedTheme`). The test checks the line color, tick color, page background and tooltip actually change between modes. For accessibility the chart is `aria-hidden` and followed by a visually-hidden `<table>` with the same numbers; Recharts' own keyboard layer is switched off, because axe flagged a focusable SVG inside an `aria-hidden` region. The visually-hidden styles sit on a wrapping `<div>`, not on the `<table>`, because a table ignores a 1 px width and made the whole page scroll sideways on a phone.

## 2026-10-27 — Loading, error and empty states: one pattern per layer

Loading: each page paints its title immediately and streams its data behind `<Suspense>` with a skeleton shaped like the content (web), or shows a spinner until the first data arrives while keeping already-cached data on screen during a refresh (mobile). Errors: a failed query shows a plain-language message and a Try again button, never a raw error; Next's `error.tsx` catches a dashboard page, `global-error.tsx` catches a broken root layout, and on the phone expo-router's per-route boundary plus a whole-app class boundary show the same `CrashScreen`. Empty states say what the place is for and what to do next ("No orders yet. Orders you place show up here, and their status updates live..."), with a button where there is a next step. The analytics page swaps a chart for an empty state when the range holds no orders instead of drawing a flat line.

## 2026-10-27 — Mobile theming mirrors the web palette, follows the system only

`theme/tokens.ts` holds a light and a dark palette with the same intent and (deliberately) the same values as the web CSS variables; screens read them through `useTheme()` / `useThemedStyles()` and no component contains a hex value. The navigation theme (headers, tab bar, screen backgrounds) is fed from the same palette, otherwise those would stay light in dark mode. The phone follows the OS setting live; there is no in-app toggle. The reason is scope: the web needed one because a desktop browser's setting is easy to forget, while a phone's dark mode is a system-wide choice people already make. Adding one means persisting a third value and is straightforward if wanted. The palettes were checked for WCAG AA contrast (4.5:1 for text pairs, 3:1 for the accent used in graphics) in both modes.

## 2026-10-27 — Lint on every app, and the commit hook runs it

Week 7's polish only holds if it stays polished, so backend and mobile now have ESLint like the web, and the pre-commit hook (`typecheck` plus `lint` across all apps) refuses a commit that fails either. The accessibility pass on the web was also run through axe-core on every page in both themes; it found three real problems that the earlier manual review had not (a link directly inside a `<dl>`, a 404 page with no `<h1>`, and the focusable chart SVG), all fixed.

## 2026-10-27 — How I verified week 7, and what that doesn't prove

The `ordersPerDay` SQL ran against a real PostgreSQL 16 server (table created by hand, since Prisma's engines can't run here) with orders at 23:50 and 00:10 IST, on the first day of the range and 20 days back; every day's count matched the hand-computed answer and the output was byte-identical with the session time zone set to Los Angeles and to Tokyo. The dashboard ran in Chromium against a mock backend: 22 checks on the analytics page (both charts, ranges, theme toggle, chart colors in both modes, reload persistence, OS dark mode, no sideways scroll at 390 px, keyboard focus, empty and error states, 404) plus the 18 week-6 checks as a regression, and axe reported zero violations on every page in light and dark. Types and lint pass on all three apps. **Not verified:** `topProducts` and `analyticsSummary` against a real database (Prisma can't run here; the logic is a plain `groupBy` and three counts), and anything on a physical phone: the dark palette on screen, the error boundary, the Android TalkBack reading of the labels. That is the cold demo run in `docs/09-demo-checklist.md`.
