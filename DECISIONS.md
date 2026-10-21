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
