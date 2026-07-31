# Week 7 — Analytics + Polish

> Depends on weeks 5–6 (web dashboard with real, changing order data) and
> weeks 3–4 (mobile app). This week has no new backend architecture — it's
> about making the whole thing feel like a finished product, which matters
> more than it sounds for a resume project (first impressions of a demo/repo
> screenshot).

## Goal for the week

Add an analytics view, and do a genuine polish pass across both frontends:
loading states, error boundaries, empty states, dark mode, and shared
visual consistency.

## Tasks, in order

### 1. Backend: analytics queries
- `ordersPerDay(days: Int): [{ date, count }]` — simple aggregation query
  (Prisma `groupBy` or raw SQL if you want the practice).
- `topProducts(limit: Int): [{ product, totalQuantityOrdered }]`.
- Keep these as dedicated resolvers rather than computing on the frontend
  from raw order data — a good example of "push aggregation to the data
  layer" if asked about it later.

### 2. Web: analytics dashboard page
- Recharts line chart for orders-per-day.
- Recharts bar chart for top products.
- A few summary stat cards (total orders this week, pending approvals
  count, low-stock product count).

### 3. Loading states
- Audit every screen on both web and mobile: does it show a skeleton/spinner
  while data loads, or a jarring blank flash? Fix the ones that don't.

### 4. Error boundaries
- Web: a top-level error boundary (Next.js `error.tsx`) plus per-query error
  handling with a retry button, not just a raw error dump.
- Mobile: a React error boundary component wrapping the app, plus
  per-screen handling for failed queries.

### 5. Empty states
- Orders list with zero orders, inventory with zero products, an outlet
  with no assigned rep yet — each should show a deliberate, designed empty
  state, not just an empty table/list.

### 6. Dark mode + shared design tokens
- Web: implement dark mode (Tailwind's `dark:` variant or CSS variables).
- Mobile: you already do theming at work — apply the same discipline here
  (a `useTheme()`-style hook, color tokens, not inline hex values).
- Where reasonable, keep the color palette conceptually consistent between
  web and mobile (doesn't need to be pixel-identical, but same intent).

### 7. Accessibility pass
- Web: check tab order, focus states, alt text on any icons/images, form
  labels correctly associated with inputs.
- Mobile: check `accessibilityLabel` on key interactive elements (buttons,
  the order-status badges).

## Milestone (must be true before moving to week 8)

A cold demo test: close everything, relaunch both apps from scratch, and
walk through the full flow (login → place order → approve on web → see
live update on mobile → view analytics) without hitting a single blank
flash, unhandled error, or obviously unfinished-looking screen.

## Things to write down in DECISIONS.md this week

- Any notable UX decisions in the empty/error/loading states.
- Whether analytics aggregation lives in the DB layer or is computed
  client-side, and why.

## Common pitfalls

- Polishing web thoroughly and forgetting mobile gets the same treatment (or
  vice versa) — the two should feel like siblings, not like different
  projects at different maturity levels.
- Dark mode implemented only visually but breaking chart readability
  (Recharts colors not adapting) — test analytics charts in both modes
  specifically.
- Treating this week as "nice to have, can skip if time is short" — for a
  resume project, a rough-but-complete-feeling demo beats a technically
  more impressive but visually unfinished one in an interview setting.

## What later weeks depend on from this week

Week 8's README and repo presentation will reference this polished state
directly (screenshots, demo GIF) — this is genuinely the week that makes
week 8's presentation possible, don't compress it to zero.
