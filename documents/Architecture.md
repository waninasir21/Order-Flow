# OrderFlow — Project Architecture & Reference

> Read this file first, always. Every weekly doc assumes you've read this one.
> If you only ever send me (Claude) one file to re-establish context, send this one.
>
> **Last updated: end of week 8 (2026-10-29).** This file started as the plan and now describes what
> was actually built. Where the build differs from the original plan, the difference is called out
> (look for **Changed from plan**) and the reasoning is in [`../DECISIONS.md`](../DECISIONS.md).

## 1. What this project is

OrderFlow is a mini B2B ordering & inventory platform, modeled loosely on real
FMCG distribution apps (like the one you work on professionally). It exists
purely as a learning + resume project — the goal is breadth: full-stack
ownership of a backend, a mobile app, and a web dashboard sharing one system.

**The story, in one line:** Field reps use a mobile app to place orders at
outlets. Admins use a web dashboard to manage inventory and approve orders.
Both talk to one shared GraphQL backend in real time.

## 2. Why this project (context for future-you or future-Claude)

- You (Nasir) are a React Native/Expo developer (Apollo GraphQL, Zustand,
  TypeScript, MMKV) working on a production multi-flavor retailer app.
- This project deliberately reuses what you already know (Apollo client, RN,
  Zustand, EAS, CI concepts) and extends into what you don't yet: GraphQL
  server, Postgres/Prisma, Next.js, monorepo tooling, deployment, testing.
- Built over 8 weeks, one deployable milestone per week.

## 3. Tech stack (as built)

| Layer                | Planned                           | As built                                                                                                                   | Note                                                                                                                                                                                                                             |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo             | Turborepo                         | **Turborepo** + npm workspaces                                                                                             | `turbo run typecheck lint test` across all apps; a Husky pre-commit hook runs typecheck + lint                                                                                                                                   |
| Backend runtime      | Node.js + TypeScript              | Node.js 22 + TypeScript (strict)                                                                                           |                                                                                                                                                                                                                                  |
| API                  | Apollo Server (GraphQL)           | **Apollo Server 4 on Express**, SDL-first schema, plus **graphql-ws** for subscriptions on the same port/path (`/graphql`) |                                                                                                                                                                                                                                  |
| Database             | PostgreSQL (Neon or Supabase)     | **PostgreSQL on Neon**                                                                                                     | no local Docker for development                                                                                                                                                                                                  |
| ORM                  | Prisma                            | **Prisma 6**, migrations committed                                                                                         |                                                                                                                                                                                                                                  |
| Cache                | Redis (Upstash)                   | **Not used**                                                                                                               | **Changed from plan.** No feature needed it: pub/sub is in memory and idempotency is a database constraint. `REDIS_URL` is documented as unused. A Redis-backed pub/sub is the production gap for running more than one instance |
| Auth                 | JWT (access + refresh)            | **15-min JWT (HS256) + opaque, single-use refresh tokens** (SHA-256 hash stored, rotation, reuse revokes every session)    | bcryptjs for passwords                                                                                                                                                                                                           |
| Mobile               | React Native + Expo               | **Expo SDK 58, Expo Router**                                                                                               | tested on a phone with Expo Go                                                                                                                                                                                                   |
| Mobile state         | Zustand + Apollo Client           | Zustand (session) + **Apollo Client 3.14**                                                                                 | cart is component-local `useState`                                                                                                                                                                                               |
| Mobile local storage | MMKV (+ SQLite for queue)         | **expo-secure-store** (tokens) + **expo-sqlite** (offline queue)                                                           | **Changed from plan.** MMKV needs native code Expo Go lacks; SecureStore keeps credentials in the OS keystore                                                                                                                    |
| Web                  | Next.js (App Router) + TypeScript | **Next.js 16** (App Router, Server Components, Server Actions, Cache Components), Tailwind 4                               | the browser never calls the backend; tokens live in httpOnly cookies                                                                                                                                                             |
| Web forms            | React Hook Form + Zod             | **Plain controlled inputs with small hand-written validators**                                                             | **Changed from plan.** The only form beyond login is one inline stock editor; the library would have been heavier than the problem. Server Actions re-validate                                                                   |
| Web charts           | Recharts                          | **Recharts 3**                                                                                                             | colors come from the same theme tokens as the page; each chart has a data table alternative                                                                                                                                      |
| Testing              | Jest + React Testing Library      | **Jest everywhere**: ts-jest (backend), jest-expo + RN Testing Library (mobile), next/jest + RTL (web)                     | 204 tests, see `10-testing.md`                                                                                                                                                                                                   |
| CI                   | GitHub Actions                    | **GitHub Actions**, one workflow, three jobs                                                                               | `.github/workflows/ci.yml`                                                                                                                                                                                                       |
| Deploy — backend     | Railway or Render                 | **Render (Docker)**; `railway.json` also provided                                                                          | `render.yaml` Blueprint, `apps/backend/Dockerfile`                                                                                                                                                                               |
| Deploy — web         | Vercel                            | **Vercel**, root directory `apps/web`                                                                                      |                                                                                                                                                                                                                                  |
| Deploy — mobile      | EAS                               | **EAS internal-distribution Android APK**                                                                                  | no store release, no iOS build                                                                                                                                                                                                   |

## 4. Monorepo structure (as built)

```
orderflow/
├── apps/
│   ├── backend/           # Express + Apollo Server + graphql-ws + Prisma
│   │   ├── prisma/        #   schema.prisma, migrations/, seed.ts
│   │   ├── src/           #   index, schema, pubsub, context, config, errors, orderStatus,
│   │   │                  #   auth/, resolvers/, services/
│   │   ├── tests/         #   unit/ (no database), integration/ (real Postgres), helpers/
│   │   ├── Dockerfile, docker-compose.test.yml, .env.example, .env.test
│   ├── mobile/            # Expo app (app/ = screens, src/ = offline, realtime, apollo, stores, theme)
│   │   └── __tests__/
│   └── web/               # Next.js dashboard (src/app/(dashboard)/orders|inventory|analytics)
│       └── __tests__/
├── packages/
│   ├── shared-types/      # placeholder: types are still written by hand in each app
│   └── config/            # placeholder
├── docs/                  # this folder: setup, API, offline sync, realtime, testing, deployment
├── .github/workflows/ci.yml
├── .husky/pre-commit      # typecheck + lint before every commit
├── render.yaml, railway.json
├── DECISIONS.md, README.md
├── turbo.json, tsconfig.base.json, package.json
```

**Changed from plan.** There is no root `docker-compose.yml` (the plan's "local Postgres + Redis"). The only
compose file is `apps/backend/docker-compose.test.yml`, an optional disposable Postgres for the integration tests.

**Honest note on `shared-types`:** the idea (the schema generates types that both frontends import, so a schema
change is a type error at build time) is still the right architecture, but it is **not implemented**. Today each
app hand-writes its GraphQL types, and the web dashboard's button rules are a copy of the backend's state
machine, guarded by a test that fails if they drift. Adding GraphQL codegen into `packages/shared-types` is the
natural next step.

## 4a. Local development setup (hardware-aware)

No local Docker for development. From week 1 onward, `DATABASE_URL` in `apps/backend/.env` points directly at
the free Neon Postgres instance (this is a deliberate choice for an i3/8GB laptop: it removes Docker Desktop's VM
layer). `REDIS_URL` is no longer needed (see section 3).

For mobile testing, use a physical Android phone via Expo Go for day-to-day development, not the Android Studio
emulator. Only use EAS cloud builds when you need an installable APK; that build runs on Expo's servers.

Practical rule while developing: don't run the backend, web dev server, _and_ mobile dev server simultaneously
unless you're actively testing a cross-app flow (like the real-time test).

**Integration tests need their own database** (they empty every table before each test, and refuse to run unless
the database name contains `test`). Use a second Neon database, or Docker if you have it. See `10-testing.md`.

## 5. Data model (Prisma schema)

```
Outlet
 ├── id, name, address, ownerName, phone
 ├── employees: Employee[]   (many-to-many with Employee)
 └── orders: Order[]

Employee (sales rep or admin)
 ├── id, name, phone (unique), passwordHash, role (REP | ADMIN)
 ├── outlets: Outlet[]       (the outlets a rep may order for)
 └── refreshTokens: RefreshToken[]

RefreshToken
 └── id, employeeId, tokenHash (unique, SHA-256), expiresAt, revokedAt

Product
 └── id, name, sku (unique), price Decimal(10,2), stockQuantity

Order
 ├── id, outletId, employeeId, status (PLACED | APPROVED | REJECTED | FULFILLED)
 ├── clientId (optional; unique together with employeeId; the idempotency key)
 ├── createdAt, updatedAt
 └── items: OrderItem[]

OrderItem
 └── id, orderId, productId, quantity, priceAtOrder Decimal(10,2)   (price snapshot)
```

Added since the plan: `RefreshToken` (week 2), `Order.clientId` with a unique `(employeeId, clientId)` (week 4,
for safe offline retries), and the `FULFILLED` status. **Not in the schema:** an order status history and an
audit log (see the limitations below).

## 6. Auth model

- JWT access token (15 min, HS256) + opaque refresh token (7 days, single-use). The server stores only the
  SHA-256 hash of each refresh token. Refreshing revokes the old token and issues a new pair; presenting a
  revoked token revokes all of that employee's sessions.
- **Changed from plan:** the mobile app keeps tokens in `expo-secure-store` (not MMKV). The web dashboard keeps
  them in two httpOnly cookies (`of_at`, `of_rt`); JavaScript on the page cannot read them.
- Role-based access, enforced **on the server only** (`requireAuth`, `requireRole`): `REP` can see and create
  orders for their assigned outlets only; `ADMIN` can see everything, approve/reject orders and edit stock.
  A rep asking for another rep's order gets `NOT_FOUND`, not `FORBIDDEN`.
- Same backend auth resolvers serve both mobile and web — no duplicated logic. The web dashboard is admin-only
  and refuses reps in three places (login, every page, and the backend's own scoping).
- Not built: login rate limiting, failed-attempt lockout.

## 7. Real-time model

- GraphQL subscriptions with `graphql-ws` over WebSockets, on the same port and path as HTTP GraphQL.
- Event: `orderStatusChanged(outletId)` — fired after an admin approves/rejects/fulfils an order (published
  **after** the database commit). Reps receive only their own orders; admins receive all; `outletId` narrows.
  The access token travels in the connection parameters, and the server closes the socket (code 4408) when the
  token expires so the client refreshes and reconnects.
- The mobile app holds the subscription, updates its Apollo cache, and shows a **local** notification while the
  app is open. Remote push is not built.
- **Changed from plan:** the web dashboard does **not** subscribe. Its Orders page re-fetches every 10 s while the
  tab is visible, because the tokens are httpOnly cookies the browser cannot use for a WebSocket.
- Pub/sub is **in memory**, so the backend must run as one instance until it is swapped for a Redis-backed one.

## 8. Offline model (mobile)

- Orders placed offline (or when the server doesn't answer) are written to a local SQLite table
  (`pending_orders`) before the app says "saved".
- A sync manager sends them **one at a time, oldest first**, on launch, when the phone comes back online, and
  when the app returns to the foreground. A single-flight guard stops overlapping runs.
- Each queued order's UUID is also sent to the server as `clientId`; the server returns the existing order for a
  repeated `clientId`, so retrying is always safe, even after the app was killed mid-send.
- Two failure kinds: **no answer** (offline, timeout, 5xx) stays queued and is retried; **a refusal** (for
  example out of stock) is marked FAILED and the user chooses Retry or Discard.
- Queued orders belong to the employee who created them. The UI shows "Waiting to send" until confirmed.
- Known limits: product and outlet lists are not persisted across a force-close while offline; a synced order's
  `createdAt` is the sync time; pending orders can be cancelled but not edited.

## 9. Weekly milestones (quick index)

| Week | Plan file                                | Milestone                                 | State                                                                                                                              | Docs       |
| ---- | ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1    | `week-1-backend-foundation.md`           | Query real data from GraphQL Playground   | Done                                                                                                                               | `02`, `03` |
| 2    | `week-2-auth-order-flow.md`              | Authenticated order placement via GraphQL | Done                                                                                                                               | `03`       |
| 3    | `week-3-mobile-connected.md`             | Place an order from the Expo app          | Done                                                                                                                               | `04`       |
| 4    | `week-4-offline-first-mobile.md`         | Airplane-mode order syncs on reconnect    | Done                                                                                                                               | `05`       |
| 5    | `week-5-web-dashboard-read.md`           | View orders/inventory on web dashboard    | Done                                                                                                                               | `07`       |
| 6    | `week-6-web-dashboard-write-realtime.md` | Approve on web, live update on mobile     | Done                                                                                                                               | `07`, `08` |
| 7    | `week-7-analytics-polish.md`             | Charts, dark mode, polish pass            | Done                                                                                                                               | `07`, `09` |
| 8    | `week-8-testing-cicd-deploy.md`          | Tests + CI + live deployed links          | Tests, CI and deploy configs built and tested; **live deployment and first green CI run are the milestone and need your accounts** | `10`, `11` |

Also: `06-troubleshooting.md` (errors we have hit), `12-interview-cheatsheet.md` (interview preparation).

## 10. Conventions to hold consistent throughout

- TypeScript strict mode everywhere, no `any` without a comment explaining why.
- One PR-sized commit per meaningful change, written as if a reviewer will
  read it (this is a portfolio — commit history is part of the pitch). The pre-commit hook enforces
  typecheck + lint.
- Keep a running `DECISIONS.md` at the repo root: every non-trivial choice
  ("Prisma over TypeORM because...", "SQLite over MMKV for offline queue
  because...") gets one dated paragraph. This becomes your interview answer
  material almost verbatim later — do not skip this.
- Each week ends with a tagged git commit (`week-1-done`, … `week-8-done`) so you
  can always show "here's the state of the project at the end of week N."
- Never commit secrets. If one ever was committed, rotate it; deleting the file does not remove it from history.

## 11. What "done" looks like at the end of week 8

Built and verified locally:

- [x] Test coverage on the core order-placement and auth flows (and more): 71 backend unit, 53 backend
      integration (real Postgres), 34 mobile, 46 web tests.
- [x] CI workflow (`.github/workflows/ci.yml`): lint + typecheck, backend tests with a Postgres service
      container, mobile + web tests. Runs on push and pull request to `main`.
- [x] A `DECISIONS.md` log with an entry for every week, including test strategy and deployment gotchas.
- [x] A README at the repo root: pitch, architecture diagram, local setup, deployment and test instructions.
- [x] Deployment configs: `apps/backend/Dockerfile`, `render.yaml`, `railway.json`, `apps/mobile/eas.json`,
      and the step-by-step in `11-deployment.md`.

Needs your accounts (the milestone):

- [ ] **CI green on `main`** (first run after you push).
- [ ] **Backend deployed** (Render + Neon demo database, seeded) and its `/health` and GraphQL endpoint verified.
- [ ] **Web deployed** (Vercel, root directory `apps/web`, `BACKEND_GRAPHQL_URL` set) and login + orders +
      analytics verified against the live backend.
- [ ] **Mobile EAS preview APK** built against the deployed backend URL.
- [ ] **README live links, demo password and screenshots** filled in (the `TODO` markers).
- [ ] The cross-app check: an order placed from the APK appears on the live dashboard, and approving it changes
      the badge on the phone.

## 11a. Known limitations and the production roadmap (honest scope)

Deliberately not built, with the fix in one line each:

- **Redis-backed pub/sub** — needed before running more than one backend instance.
- **Audit log and order status history** — a table written inside the same transaction as each change.
- **Login rate limiting and lockout** — `express-rate-limit` or a Redis sliding window, plus a failed-attempt counter.
- **GraphQL query-cost limiting** — `graphql-query-complexity` or persisted queries.
- **Remote push notifications** — Expo push service plus stored device tokens.
- **Live web dashboard** — a server-side subscription streamed to the browser (Server-Sent Events).
- **Generated shared types** — GraphQL codegen into `packages/shared-types`.
- **Not tested:** the WebSocket transport, web session handling, real devices, load; no end-to-end suite.
- **Database resilience** — connection pooling, a proven restore, a migration rollback policy.
