# Testing

Three apps, three test setups, one rule: **test the code that is easy to get wrong and expensive
to get wrong**, not every line. This page says what is covered, how to run it, and (just as
important) what is *not* covered.

| Where | Tool | Tests | What they prove |
|---|---|---|---|
| `apps/backend/tests/unit` | Jest + ts-jest | 71 | state machine, JWT helper, guards, order-service logic (stock check, merging, races) with Prisma faked |
| `apps/backend/tests/integration` | Jest + ts-jest, **real Postgres** | 53 | `login`, token rotation, `createOrder`, `updateOrderStatus`, subscriptions' visibility, stock edits, analytics, against real SQL |
| `apps/mobile/__tests__` | jest-expo + React Native Testing Library | 34 | offline queue (18), login form (7), order and pending-order cards (9) |
| `apps/web/__tests__` | next/jest + React Testing Library (jsdom) | 46 | orders table, approve/reject calls, inventory edit validation, auto-refresh, dashboard-vs-backend state machine |

## Running them

```powershell
npm test -w @orderflow/mobile        # no setup needed
npm test -w @orderflow/web           # no setup needed
npm run test:unit -w @orderflow/backend   # no setup needed
```

The backend **integration** tests need a throwaway Postgres. Pick one:

**A. Docker (if you have it):**

```powershell
cd apps\backend
npm run test:db:up          # starts Postgres on localhost:5433 (see docker-compose.test.yml)
npm run test:db:migrate     # applies prisma/migrations to it
npm run test:integration
npm run test:db:down        # when finished
```

**B. No Docker: a second Neon database** (this project's rule is "no local Docker"). In the Neon
console create a database called `orderflow_test` in your project, copy its **direct** connection
string, then:

```powershell
cd apps\backend
$env:DATABASE_URL = "postgresql://...neon.tech/orderflow_test?sslmode=require"
npx prisma migrate deploy
npm run test:integration
```

A variable already set in your shell wins over `.env.test`. The suite **refuses to run unless the
database name contains `test`**, because every test starts with `TRUNCATE` on all tables. Pointing it
at your dev database would wipe your data, and the guard exists so a stray `DATABASE_URL` can't do that.
(Neon is slower than local Docker: expect the integration suite to take a minute or two instead of
half a minute.)

## Backend

**Unit tests** fake Prisma and test the service's own decisions: validation happens before any
database call, duplicate lines merge, the stock check is a *conditional* decrement, a lost
idempotency race returns the winner's order, a rejected order restocks every line, a failed
broadcast does not fail the mutation. The state machine is tested as the full 4×4 matrix.
The JWT tests include the attacks that matter: expired, wrong secret, tampered role, `alg: none`, wrong
HMAC algorithm.

**Integration tests** run the real GraphQL schema, resolvers and services against real Postgres
(no HTTP in between: `graphql()` is called with the context the HTTP layer would build). They cover
what fakes cannot: that `updateMany ... WHERE stockQuantity >= qty` really cannot oversell
(12 concurrent orders for 5 units → exactly 5 succeed), that a shortage on line 2 rolls back line 1,
that six identical `clientId` requests produce one order and one stock deduction, that refresh-token
reuse revokes every session, that two admins racing approve/reject produce exactly one winner and
consistent stock, and that analytics SQL buckets days in IST.

**Why TRUNCATE between tests, not a rollback per test?** The rollback pattern wraps each test in one
transaction and rolls it back. Our services open their own interactive transactions
(`prisma.$transaction`) and the most valuable tests are *concurrency* tests, where several
connections must commit independently. An outer transaction would hide exactly the behaviour we want
to see. So each test starts from empty tables (`TRUNCATE ... RESTART IDENTITY CASCADE`) in a disposable
database, and the integration project runs one test file at a time.

## Mobile

The offline queue is the most valuable test in the project, so it runs against a **real SQLite
engine** (Node's built-in `node:sqlite` stands in for `expo-sqlite`), which means the app's actual
`CREATE TABLE`, `INSERT`, `UPDATE ... WHERE` and ordering SQL run for real. Only two things are faked:
the network call and "is the phone online". "Relaunching the app" is simulated by re-importing all the
modules against the same database. Covered: persistence before "saved", FIFO and one-at-a-time sending,
overlapping `syncOutbox()` calls, offline/signed-out/other-user guards, network failure vs definitive
refusal (timeout, 5xx and expired session stay queued; stock errors and 4xx become FAILED), the
15-second retry, and recovery of an order stuck at SYNCING with the **same** `clientId`.

## Web

The orders table, the approve/reject buttons (Reject asks first), the inventory editor's validation
(negative, decimal, empty, above the maximum, error clears while typing, Enter submits, Escape cancels)
and the auto-refresh. Server Actions are mocked at the module boundary: these tests check that the
UI calls the right action with the right arguments and shows the result. One test imports the
backend's `ALLOWED_TRANSITIONS` and fails if the dashboard's button rules ever drift from it.

## Mutation spot-checks

After writing the tests, the code was deliberately broken in several places (drop the stock guard, skip
the restock on reject, skip the idempotent lookup, stop the queue filtering by user, treat network errors
as failures, remove the "already running" guard, skip the reject confirmation, send the wrong status) and
the tests were checked to fail. One weak test (overlapping sync calls) was found this way and strengthened.

## What is deliberately not tested

- **The WebSocket transport.** Subscription *visibility rules* are tested, but not the graphql-ws server
  over a real socket (connection rejection, the 4408 close at token expiry, the client reconnect). Those were
  exercised by hand in week 6 and are in the `08-realtime.md` checklist; there is no automated test.
- **Web session handling:** `proxy.ts`, cookie refresh and the login Server Action are untested. They are
  the part of the web app most worth an end-to-end test (Playwright) if you add one.
- **Mobile screens and navigation** beyond the login form and the two cards (place-order flow, tabs), the
  Apollo token-refresh link, push/local notifications, and anything that needs a real device.
- **No end-to-end test** that drives phone → backend → web. The milestone checklist (`09-demo-checklist.md`) is that test, done by a person.
- **No load or performance testing**, no security testing beyond the auth cases above.
- **Backend unit tests fake Prisma**, so on their own they prove logic, not SQL; the integration suite
  exists for that reason.
- **CORS configuration** is not tested.
