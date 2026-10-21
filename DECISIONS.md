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

## 2026-10-21 — bcryptjs over bcrypt / argon2

I used `bcryptjs` for password hashing because it's pure JavaScript, so it installs on Windows without a native build step. Tradeoff: it's slower than native `bcrypt`, and argon2 is the newer recommendation. For this project's login volume the speed difference doesn't matter, and I'd revisit it for a production system. Cost factor is 10. Login also compares against a dummy hash when the phone number doesn't exist, so response time doesn't reveal which numbers are registered.

## 2026-10-21 — DB-backed refresh tokens with rotation and reuse detection

Access tokens are short-lived JWTs (15 minutes), signed with a secret from `.env`. Refresh tokens are random opaque strings, not JWTs, and only their SHA-256 hash is stored in a `RefreshToken` table, so a database leak doesn't expose usable tokens. Each token works once: refreshing revokes it and issues a new pair. If a revoked token is presented again, I treat it as stolen and revoke all of that employee's tokens. The spend step is an atomic `updateMany ... where revokedAt is null`, so two concurrent requests can't both succeed. Tradeoff: this needs a database read on every refresh and means the mobile app must serialise refresh calls, because two parallel refreshes would log the user out.

## 2026-10-21 — Order status state machine, with restock on reject

Allowed transitions: PLACED → APPROVED or REJECTED, and APPROVED → FULFILLED. REJECTED and FULFILLED are final. The rules live in one file (`orderStatus.ts`) and all changes go through one service function, which is where week 6's subscription event will be published. The update only applies if the status is still what was read, so two admins can't both change the same order. Rejecting an order puts the reserved stock back in the same transaction, because stock is deducted when an order is placed, not when it's approved. Without this, rejected orders would permanently lose inventory.

## 2026-10-21 — Atomic conditional stock decrement instead of check-then-update

When placing an order, each product is updated with a single statement: decrement stock where stock is at least the requested quantity. If no row matches, the transaction rolls back with an INSUFFICIENT_STOCK error. A separate "read stock, check, then write" would let two reps ordering the last units at the same time both pass the check and oversell. The whole order (stock changes plus order and items) is one transaction, so a failure can never leave a half-created order or a stock deduction without an order. Tradeoff: stock is reserved at placement time, so unapproved orders hold inventory until an admin rejects them.
