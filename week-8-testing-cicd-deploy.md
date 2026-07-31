# Week 8 — Testing, CI/CD, Deployment

> Depends on the whole project being functionally complete through week 7.
> This is the week that turns "a project on my laptop" into "a resume line
> with live links" — do not skip it, per `00-architecture.md` section 10.

## Goal for the week

Tests on the core flows, a green CI pipeline, and all three apps actually
deployed and reachable by a stranger with a link.

## Tasks, in order

### 1. Backend tests
- Unit tests (Jest) for the trickiest logic: order status transitions,
  stock-check validation, JWT verification helper.
- Integration tests for the core resolvers (`createOrder`, `login`,
  `updateOrderStatus`) against a real (test) Postgres instance — either a
  separate Docker Compose test DB or a transaction-rollback-per-test
  pattern; document which and why.

### 2. Mobile tests
- Jest + React Native Testing Library.
- At minimum: the login form validation, the offline queue logic from week
  4 (this is the highest-value test in the whole project — it's the
  trickiest code, and a passing test for it is a strong interview artifact),
  and one rendering test for the order card statuses.

### 3. Web tests
- Jest + React Testing Library.
- At minimum: the orders table renders correctly given mock data, the
  approve/reject buttons call the right mutation, form validation on the
  inventory edit.

### 4. CI pipeline (GitHub Actions)
- One workflow file, roughly:
  - Job 1: lint + typecheck across all workspaces (`turbo run lint typecheck`).
  - Job 2: run backend tests (spin up Postgres as a service container in the
    workflow).
  - Job 3: run mobile + web tests.
- Runs on every push and PR to `main`.
- Add a status badge to your root README once it's green.

### 5. Deploy backend
- Railway or Render: connect the repo, point at `apps/backend`, provision a
  managed Postgres and Redis add-on (or point at your existing ones if
  they're already hosted).
- Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`) in
  the platform's dashboard, not committed anywhere.
- Confirm the deployed GraphQL endpoint responds to a query from Playground/
  Postman.

### 6. Deploy web
- Vercel: connect the repo, set the root directory to `apps/web`.
- Set `NEXT_PUBLIC_GRAPHQL_URL` (and WebSocket URL for subscriptions) to
  point at the deployed backend, not localhost.
- Confirm login and the full orders/analytics flow work against the live
  backend, not just locally.

### 7. Deploy mobile
- EAS build (you already know this from work) — build a preview or internal
  distribution APK/IPA pointed at the deployed backend URL.
- At minimum, an EAS internal distribution link others can install to test;
  a full app store submission is out of scope unless you want the extra
  polish (icon, splash screen, store listing) — note your choice.

### 8. README + decisions log finalize
- Root `README.md`: one-paragraph pitch, architecture diagram (can be a
  simple image export of the structural diagram from earlier in this
  project's planning, or a fresh one), local setup steps, live links
  (web dashboard URL, backend GraphQL endpoint, EAS build link), and a
  short GIF/screenshots of the app in use.
- Finalize `DECISIONS.md` — read back through it, make sure every week's
  entries are actually there; this file is your interview cheat sheet.

## Milestone (project complete)

A stranger can: read your README, open the deployed web dashboard link, log
in with a demo account you've documented, see real orders and analytics —
and separately install the EAS build and place an order that shows up live
on the web dashboard. CI is green on `main`.

## Things to write down in DECISIONS.md this week

- Test strategy (unit vs integration split, what you deliberately did not
  test and why — an honest scoping note is fine and expected).
- Any deployment gotchas you hit (WebSocket support on your chosen host,
  environment variable handling, CORS in production) — these are exactly
  the kind of "real-world" details that make a portfolio project credible
  in an interview.

## Common pitfalls

- Secrets committed to the repo at any point in git history — if this
  happened, rotate the secrets, don't just delete the file (it's still in
  history).
- WebSocket subscriptions failing in production due to the hosting
  platform's proxy not supporting persistent connections by default — check
  your host's docs for WebSocket support specifically, it's not universal.
- CORS misconfigured for the production web origin — a very common "works
  locally, breaks in prod" issue; test the deployed web app against the
  deployed backend explicitly, don't assume local success generalizes.
- Treating deployment as an afterthought done in the last hour — budget real
  time for it; it reliably takes longer than expected the first time.

## After this week

You have a genuinely complete, demoable, deployed full-stack project
covering backend API design, auth, real-time systems, offline-first mobile
architecture, a web dashboard, testing, and CI/CD — plus a decisions log
that turns almost every choice into a ready-made interview answer.
