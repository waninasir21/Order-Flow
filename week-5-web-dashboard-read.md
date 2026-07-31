# Week 5 — Web Dashboard (Read Side)

> Depends on Week 2's backend (auth, orders, products queries) — does not
> depend on weeks 3/4 (mobile) at all, other than wanting real data to look
> at, which your seed script + week 3 testing will have already produced.

## Goal for the week

A Next.js admin dashboard that logs in and displays real orders and
inventory from the same backend the mobile app uses — read-only this week,
write actions come in week 6.

## Tasks, in order

### 1. Next.js scaffold
- `npx create-next-app@latest apps/web` (TypeScript, App Router, Tailwind —
  or your own CSS approach, your call).
- Install Apollo Client for Next.js (`@apollo/client`, `@apollo/experimental-nextjs-app-support` or a simpler client-only setup if you want to avoid
  server-component GraphQL complexity in week 1 of web work — note the
  choice, it's a legitimate trade-off to discuss).

### 2. Auth flow (web)
- Login page: same `login` mutation as mobile, same backend.
- Store the access token: httpOnly cookie is the more "correct" approach for
  web (mitigates XSS token theft) — if that adds too much complexity this
  week, a documented "I used localStorage for simplicity, here's the
  trade-off vs httpOnly cookies" note in `DECISIONS.md` is a perfectly fine
  and honest interview answer too. Pick one, document why.
- Protect dashboard routes: redirect to `/login` if no valid token
  (middleware.ts or a layout-level check).

### 3. Orders list page
- `orders` query (as admin — should return all orders, not just one rep's).
- A data table: outlet name, rep name, item count, status badge, created
  date.
- Client-side filter by status, sort by date/outlet (or server-side if you
  want the harder version — note which you did).

### 4. Order detail view
- Click into an order: full line-item breakdown (product, quantity, price
  at time of order), outlet info, rep info, status history if you're
  tracking it.

### 5. Inventory / products page
- `products` query rendered as a table: name, SKU, price, stock quantity.
- Simple low-stock visual indicator (e.g. red badge if `stockQuantity < 10`)
  — no editing yet, that's week 6.

### 6. Basic layout
- Shared dashboard shell: sidebar nav (Orders, Inventory), header with
  logged-in admin name and logout button.

## Milestone (must be true before moving to week 6)

Log into the web dashboard as an admin and see the exact same orders your
mobile app created in weeks 3–4, correctly listed with accurate status and
line items — proving both frontends genuinely share one backend and one
source of truth.

## Things to write down in DECISIONS.md this week

- Cookie vs localStorage token storage decision and the security trade-off
  you're consciously accepting.
- Client-side vs server-side filtering/sorting for the orders table, and why.
- Whether you used React Server Components for the initial data fetch or
  kept everything client-side with Apollo — either is fine, know why you
  picked it.

## Common pitfalls

- CORS errors from the backend rejecting requests from your Next.js dev
  origin — configure Apollo Server's CORS to allow your web app's origin
  (and later, your deployed Vercel domain).
- Forgetting role checks: make sure a `REP`-role token can't successfully
  hit admin-only queries even if they somehow got into the dashboard UI —
  test this deliberately by logging in as a rep on the web dashboard.
- Table performance/UX falling apart with more than ~10 rows because of no
  pagination — decide now whether you're doing simple client-side pagination
  or deferring it; don't let it silently become unusable as your seed data
  grows.

## What later weeks depend on from this week

Week 6 adds write actions (approve/reject) directly onto this orders list
and detail view, plus a live subscription — keep the orders list component
structured so an action button and a live-updating badge can slot in without
a rewrite.
