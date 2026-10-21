# Week 1 — Backend Foundation

> Read `00-architecture.md` first if you haven't. This week has no
> dependencies on other weeks — it's the starting point.

## Goal for the week

Stand up the monorepo, local database, and a bare-bones GraphQL API that
returns real data from Postgres. No auth, no frontend yet — just prove the
backend skeleton works end to end.

## Prerequisites

- Node.js LTS installed
- A free Neon or Supabase account (Postgres) and a free Upstash account
  (Redis) — no Docker Desktop needed, see `00-architecture.md` section 4a
  for why
- A GitHub repo created (`orderflow`)

## Tasks, in order

### 1. Monorepo scaffold
- `npx create-turbo@latest orderflow` (or manually scaffold per the structure
  in `00-architecture.md` section 4 if you want more control/learning).
- Create `apps/backend`, `apps/mobile`, `apps/web`, `packages/shared-types`,
  `packages/config` even if some are empty for now.
- Root `package.json` with workspaces, root `tsconfig.json` base.

### 2. Cloud Postgres + Redis (no local Docker)
- Create a free Neon or Supabase project — grab the connection string it
  gives you.
- Create a free Upstash Redis database — grab its connection URL/token.
- Put both in `apps/backend/.env` as `DATABASE_URL` and `REDIS_URL`.
- This is the same setup you'll deploy with in week 8 — no "swap it out
  later" step, which also means no local Docker Desktop overhead to worry
  about on modest hardware (see `00-architecture.md` section 4a).
- Confirm connectivity with a simple `npx prisma db pull` or similar once
  Prisma is set up in the next step.

### 3. Prisma setup
- Inside `apps/backend`: `npm install prisma @prisma/client`,
  `npx prisma init`.
- Confirm `DATABASE_URL` in `.env` points to your Neon/Supabase instance
  (set in the previous step).
- Write `schema.prisma` with the models from `00-architecture.md` section 5:
  `Outlet`, `Employee`, `Product`, `Order`, `OrderItem`.
- Decide and note in `DECISIONS.md`: enum types for `Role` and `OrderStatus`
  now, so you don't need a migration later to add them.
- `npx prisma migrate dev --name init` — this creates your first migration
  and the actual tables.
- `npx prisma studio` to visually confirm tables exist; manually add 2-3 rows
  of seed data per table (or write a `seed.ts` script — better long-term
  habit, and you'll need seed data again in later weeks).

### 4. Apollo Server skeleton
- `npm install @apollo/server graphql`.
- Define a minimal GraphQL schema (SDL or code-first, your choice — note the
  choice in `DECISIONS.md`) covering:
  - `type Outlet { id, name, address, ownerName, phone }`
  - `type Product { id, name, sku, price, stockQuantity }`
  - `Query { outlets: [Outlet!]!, products: [Product!]! }`
- Write resolvers that call `prisma.outlet.findMany()` /
  `prisma.product.findMany()`.
- Start the server (`apollo-server-standalone` or Express + `expressMiddleware`
  — Express is a better long-term choice since you'll add auth middleware
  next week).

### 5. Verify end to end
- Run the backend, open GraphQL Playground/Apollo Sandbox at the local URL.
- Run a query for `outlets` and `products` and get your seeded rows back.

## Milestone (must be true before moving to week 2)

You can open GraphQL Playground, run:
```graphql
query {
  outlets { id name address }
  products { id name sku price stockQuantity }
}
```
and see real rows come back from your local Postgres container.

## Things to write down in DECISIONS.md this week

- Why Turborepo (or whatever you chose) over a plain npm workspace setup.
- Why Prisma over an alternative (TypeORM, Drizzle) — even a one-line reason
  is enough; you'll be asked this in interviews.
- Code-first vs SDL-first GraphQL schema choice and why.

## Common pitfalls

- Forgetting to add `apps/backend/.env` to `.gitignore` — commit an
  `.env.example` instead.
- Prisma client not regenerating after schema changes — always run
  `npx prisma generate` after editing `schema.prisma` (migrate does this
  automatically, but if you only edit and don't migrate, do it manually).
- Free-tier Postgres instances (Neon/Supabase) can auto-suspend after a
  period of inactivity — the first query after a while may be slow to wake
  it up. Not a bug, just note it if a request seems to hang briefly on a
  cold start.

## What next week depends on from this week

Week 2 adds auth and the order-creation mutation directly on top of this
schema and server — so make sure the `Employee` model already has a
`passwordHash` field even if you don't use it yet, to avoid a schema
migration mid-week-2.
