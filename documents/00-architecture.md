# OrderFlow — Project Architecture & Reference

> Read this file first, always. Every weekly doc assumes you've read this one.
> If you only ever send me (Claude) one file to re-establish context, send this one.

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

## 3. Tech stack (final)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo | Simple, fast, good docs |
| Backend runtime | Node.js + TypeScript | Matches frontend language, one skillset |
| API | Apollo Server (GraphQL) | You already know Apollo on the client |
| Database | PostgreSQL (Neon or Supabase, free tier, used from day one — no local Docker) | Industry standard relational DB; cloud-from-day-one avoids running Docker Desktop on modest hardware |
| ORM | Prisma | Type-safe, great migrations, good DX |
| Cache | Redis (Upstash, free tier, used from day one) | Product catalog caching |
| Auth | JWT (access + refresh tokens) | Standard, portable across web/mobile |
| Mobile | React Native + Expo | Your existing strength |
| Mobile state | Zustand + Apollo Client | Matches your current stack |
| Mobile local storage | MMKV (+ SQLite for offline queue) | MMKV you know; SQLite for structured offline data |
| Web | Next.js (App Router) + TypeScript | Modern React patterns, server components |
| Web forms | React Hook Form + Zod | Type-safe validation |
| Web charts | Recharts | Simple, composable |
| Testing | Jest + React Testing Library | Standard for both frontends |
| CI | GitHub Actions | Free, you've done Bitbucket CI before — transferable |
| Deploy — backend | Railway or Render | Free/cheap Postgres + Node hosting |
| Deploy — web | Vercel | Native Next.js hosting |
| Deploy — mobile | EAS | You already know this |

## 4. Monorepo structure

```
orderflow/
├── apps/
│   ├── backend/          # Apollo Server + Prisma
│   ├── mobile/            # Expo app
│   └── web/               # Next.js app
├── packages/
│   ├── shared-types/      # TypeScript types shared across all 3 apps
│   └── config/            # Shared eslint/tsconfig base
├── docker-compose.yml     # Local Postgres + Redis
├── turbo.json
└── package.json
```

**Why `shared-types` matters for your resume/interviews:** it's a concrete,
explainable example of monorepo architecture — "the backend's GraphQL schema
generates types that both frontends import directly, so a schema change is a
type error at build time in both apps, not a runtime bug."

## 4a. Local development setup (hardware-aware)

No local Docker Compose, no local Postgres/Redis containers. From week 1
onward, `DATABASE_URL` and `REDIS_URL` in `.env` point directly at your free
Neon/Supabase Postgres instance and your free Upstash Redis instance —
the same ones used later for deployment. This is a deliberate choice, not
just a shortcut: it removes Docker Desktop's overhead (its own VM layer)
from your machine entirely, which matters on an i3/8GB laptop.

For mobile testing, use a physical Android phone via Expo Go for day-to-day
development, not the Android Studio emulator — the emulator is the single
heaviest thing you could run on this hardware (often wants 2-4GB of RAM
alone, plus CPU virtualization overhead). Only use EAS cloud builds (week 8)
when you need an actual installable APK — that build runs on Expo's
servers, not your laptop.

Practical rule while developing: don't run the backend, web dev server,
*and* mobile dev server simultaneously unless you're actively testing a
cross-app flow (like week 6's real-time test). Run only what you're
currently working on.

## 5. Data model (Prisma schema, conceptual)

Core entities and relations:

```
Outlet
 ├── id, name, address, ownerName, phone
 └── orders: Order[]

Employee (sales rep or admin)
 ├── id, name, phone, role (REP | ADMIN)
 └── assignedOutlets: Outlet[]

Product
 ├── id, name, sku, price, stockQuantity

Order
 ├── id, outletId, employeeId, status (PLACED | APPROVED | REJECTED | FULFILLED)
 ├── createdAt, updatedAt
 └── items: OrderItem[]

OrderItem
 ├── id, orderId, productId, quantity, priceAtOrder
```

This is intentionally close to what you already touch at work
(`OrderCard`, SAP ID, SKU list, outlets, employees) — reuse that mental
model, don't invent a new domain.

## 6. Auth model

- JWT access token (short-lived, ~15 min) + refresh token (long-lived, stored
  securely — MMKV on mobile, httpOnly cookie on web).
- Role-based access: `REP` can create orders for their assigned outlets only;
  `ADMIN` can see/approve/reject all orders and manage products.
- Same backend auth resolvers serve both mobile and web — no duplicated logic.

## 7. Real-time model

- GraphQL subscriptions (via `graphql-ws` or Apollo's subscription transport)
  over WebSockets.
- Event: `orderStatusChanged(orderId)` — fired when an admin approves/rejects
  on web; mobile app subscribed to its own outlet's orders gets a live push
  notification.

## 8. Offline model (mobile)

- Orders created while offline are written to a local SQLite queue table
  (`pending_orders`) instead of firing the GraphQL mutation directly.
- A sync manager watches network state (`@react-native-community/netinfo`)
  and flushes the queue when connectivity returns, in order, with retry +
  conflict handling (e.g., stock ran out server-side after order was queued).
- UI shows optimistic state ("pending sync") until confirmed.

## 9. Weekly milestones (quick index)

| Week | File | Milestone |
|---|---|---|
| 1 | `week-1-backend-foundation.md` | Query real data from GraphQL Playground |
| 2 | `week-2-auth-order-flow.md` | Authenticated order placement via GraphQL |
| 3 | `week-3-mobile-connected.md` | Place an order from the Expo app |
| 4 | `week-4-offline-first-mobile.md` | Airplane-mode order syncs on reconnect |
| 5 | `week-5-web-dashboard-read.md` | View orders/inventory on web dashboard |
| 6 | `week-6-web-dashboard-write-realtime.md` | Approve on web, live update on mobile |
| 7 | `week-7-analytics-polish.md` | Charts, dark mode, polish pass |
| 8 | `week-8-testing-cicd-deploy.md` | Tests + CI + live deployed links |

## 10. Conventions to hold consistent throughout

- TypeScript strict mode everywhere, no `any` without a comment explaining why.
- One PR-sized commit per meaningful change, written as if a reviewer will
  read it (this is a portfolio — commit history is part of the pitch).
- Keep a running `DECISIONS.md` at the repo root: every non-trivial choice
  ("Prisma over TypeORM because...", "SQLite over MMKV for offline queue
  because...") gets one dated paragraph. This becomes your interview answer
  material almost verbatim later — do not skip this.
- Each week ends with a tagged git commit/branch (`week-1-done`, etc.) so you
  can always show "here's the state of the project at the end of week N."

## 11. What "done" looks like at the end of week 8

- Two deployed frontends (web + mobile via EAS/Expo Go or a built APK) and a
  deployed backend, all talking to each other live.
- A README at the repo root with: one-paragraph pitch, architecture diagram,
  local setup steps, and links to the live deployments.
- A `DECISIONS.md` log.
- CI passing on the main branch.
- Test coverage on at least the core order-placement and auth flows.

## 12. How to use these docs with Claude later

If you come back to continue this project and want help, paste this file
plus the specific week's file you're working on. That's enough context for
a full pick-up — no need to re-explain the project from scratch.
