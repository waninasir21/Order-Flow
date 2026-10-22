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
