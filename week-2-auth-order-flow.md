# Week 2 — Auth + Core Order Flow

> Depends on Week 1 being complete: working Prisma schema, Apollo Server
> returning real outlet/product data. Read `00-architecture.md` sections 5–6
> before starting.

## Goal for the week

Add authentication and let an authenticated user place an order with line
items. By the end of this week the API is functionally the whole backend
data flow — mobile and web will just be UIs on top of this from week 3 on.

## Tasks, in order

### 1. Employee auth fields + password handling
- Confirm `Employee` model has `passwordHash`, `role` (`REP` | `ADMIN`).
- `npm install bcrypt` (or `argon2` — note choice in `DECISIONS.md`).
- Write a `register` mutation (or a seed script — for a small project, a
  seed script that creates a few employees with known passwords is often
  enough; you decide, note it).

### 2. JWT issuing
- `npm install jsonwebtoken`.
- `login(phone, password): AuthPayload` mutation — verifies password,
  returns `{ accessToken, refreshToken, employee }`.
- Access token: short expiry (~15 min), payload includes `employeeId`, `role`.
- Refresh token: longer expiry (~7–30 days), stored server-side too if you
  want revocation (a `RefreshToken` table) — optional but a good talking
  point ("I implemented refresh token rotation with server-side revocation").

### 3. Auth middleware / context
- In Apollo Server's `context` function, read the `Authorization: Bearer`
  header, verify the JWT, attach `{ employeeId, role }` to context.
- Write a small helper `requireAuth(context)` and `requireRole(context, role)`
  that resolvers call at the top — throw a GraphQL `AuthenticationError` or
  `ForbiddenError` if it fails.

### 4. Order creation mutation
- `createOrder(outletId, items: [{productId, quantity}]): Order`
- Resolver logic:
  1. `requireAuth` — must be a logged-in `REP` (or `ADMIN` acting on behalf,
     your call — note it).
  2. Verify the outlet is assigned to this employee (unless admin).
  3. For each item, verify `stockQuantity` is sufficient.
  4. Create the `Order` + nested `OrderItem`s in a single Prisma transaction
     (`prisma.$transaction`) so you never get a half-created order.
  5. Decrement `stockQuantity` on each product in the same transaction.
  6. Set initial `status: PLACED`.
- Add an `orders(outletId?, status?): [Order!]!` query with resolvers to
  fetch a rep's own orders or (for admin) all orders.

### 5. Order status transitions
- `updateOrderStatus(orderId, status): Order` mutation — `ADMIN` only.
- Enforce valid transitions in code (e.g. `PLACED → APPROVED | REJECTED`,
  `APPROVED → FULFILLED`) — reject invalid jumps with a clear error message.
  This state-machine discipline is a good interview talking point.

## Milestone (must be true before moving to week 3)

Using GraphQL Playground with an `Authorization` header:
1. `login` as a rep, get a token.
2. `createOrder` with real product IDs and quantities.
3. `orders` query shows the order you just placed, with correct `status: PLACED`.
4. Logging in as `ADMIN` and calling `updateOrderStatus` moves it to
   `APPROVED`, and a `REP` attempting the same mutation gets a permission error.

## Things to write down in DECISIONS.md this week

- bcrypt vs argon2, and why.
- Whether refresh tokens are revocable (DB-backed) or stateless, and why.
- Your order status state machine — draw it out as a comment or diagram in
  the repo; you'll reuse this exact logic conceptually in week 6.

## Common pitfalls

- Forgetting the transaction around order + stock decrement — without it, a
  crash mid-mutation can create an order with no matching stock deduction.
  This is worth deliberately testing (kill the server mid-request once, see
  what state you're left in) — a strong interview story if you do.
- JWT secret hardcoded instead of read from `.env` — use `.env` from day one.
- Not handling the "insufficient stock" case gracefully — return a clear
  GraphQL error, don't let the mutation silently fail or throw a raw DB error.

## What later weeks depend on from this week

- Week 3 (mobile) calls `login` and `createOrder` directly — no changes
  expected to these mutations' shape.
- Week 6 (web write side + real-time) calls `updateOrderStatus` and needs
  the resulting status change to be broadcastable via subscription — keep
  that in mind when structuring the resolver (a clean single point where
  status changes, ready to also `pubsub.publish(...)` from, is ideal).
