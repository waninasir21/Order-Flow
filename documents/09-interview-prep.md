# 09 — Interview Prep & Production Hardening Roadmap

> Read `00-architecture.md` first. This file is what you review the night
> before an interview that references this project — not a build doc.

## Part 1 — What to fold into the actual 8-week build (cheap, high-signal)

These three are worth actually building, not just talking about, because
they're bounded in scope and make the existing weeks better rather than
longer.

### Audit log
- Add during **Week 2**: an `AuditLog` table (`actorId, action, entityType,
  entityId, before, after, timestamp`).
- Every mutating resolver writes one row inside the same transaction as the
  actual change (`updateOrderStatus`, `updateProductStock`, `createOrder`).
- Retrofit cost is small if added from week 2 onward — expensive only if
  bolted on at the end across every resolver at once.

### Auth hardening
- Add during **Week 2**, alongside the JWT work:
  - Rate limiting on `login` (`express-rate-limit` or a Redis sliding window).
  - Failed-login counter + temporary lockout on the `Employee` model.
  - Refresh token rotation: every refresh invalidates the old token and
    issues a new one; detect reuse of an already-rotated token as a
    compromise signal and revoke the whole session.
- Self-contained — doesn't ripple into other weeks.

### Idempotency on order creation
- Add during **Week 2** (mutation) and **Week 4** (offline queue uses it).
- Client generates a UUID per order attempt; backend stores seen keys
  (Redis with TTL, or a DB table) and returns the cached result on retry
  instead of re-executing.
- This is the fix for: "offline order times out mid-request, client retries
  on reconnect, and now there are two orders in Postgres."

## Part 2 — Documented roadmap, not built (talk fluently, don't build)

These change the *shape* of the project (add real weeks, real infra, real
edge-case testing) with a return-on-time that's low relative to a job
search timeline. Know them well enough to whiteboard, don't feel obligated
to implement them.

### Distributed pub/sub (Redis-backed)
- **Problem it solves:** in-memory `PubSub` only reaches clients connected
  to the same backend instance — a subscription client on instance A never
  hears about a mutation handled by instance B.
- **Fix:** Redis pub/sub channel shared across instances; WebSocket-aware
  load balancer or sticky sessions in front of multiple backend instances.
- **Why not built:** requires actually running multiple instances locally
  to prove it, which is real infra work with low interview-demo payoff
  compared to a working live app.

### GraphQL query cost limiting
- **Problem it solves:** an open GraphQL API with no depth/complexity limit
  is a denial-of-service vector — a deeply nested query can overload the DB.
- **Fix:** `graphql-query-complexity` (or similar) rejecting queries above a
  threshold, or persisted-queries-only (client sends a hash, server has a
  pre-approved query allowlist).

### Full chaos / edge-case testing
- **Problem it solves:** happy-path tests don't catch concurrent approvals
  on the same order, network partition mid-sync, or malformed input.
- **Fix:** deliberate concurrency tests (two approvals firing simultaneously
  — does the state machine correctly reject the second?), fault injection
  on the sync manager.
- **Why not built:** cost isn't a fixed add-on, it multiplies the test-writing
  time across every remaining week.

### Database resilience
- Connection pooling (PgBouncer or host-managed pooling).
- Verified backup/restore (most managed Postgres gives you backups for
  free — the real work is *proving* restore works, not just trusting it).
- A documented migration rollback strategy (Prisma migrations are
  forward-only by default; either write manual rollback SQL per migration
  or explicitly adopt "roll forward only" as policy and say why).

### General abuse protection
- Global rate limiting beyond just `login` (Redis-backed token bucket
  across all mutations).

## Part 3 — Likely interview questions and how to answer them

**"Walk me through the architecture."**
Use the one-line pitch from `00-architecture.md` section 2, then the stack
table (section 3). Draw the monorepo structure if given a whiteboard.

**"How would you scale this to handle 10x the traffic?"**
Talk through Part 2's Redis pub/sub point specifically — this is almost
exactly what this question is testing for. Also mention read replicas and
connection pooling from the database resilience item.

**"What happens if two admins approve the same order at the same time?"**
Be honest: name it as a known gap (not deliberately handled with, say, a DB
row lock or optimistic concurrency check), then describe the fix — a
`WHERE status = 'PLACED'` guard on the update query so only the first
concurrent request succeeds, the second gets zero rows affected and returns
a clear "already handled" error. This is a good one to actually go build if
you have an extra hour before an interview — it's small and it's exactly
the kind of gap interviewers probe for.

**"How do you handle a mobile client that goes offline mid-order?"**
Walk through the Week 4 offline queue, local SQLite table, sync manager,
and the idempotency key fix from Part 1 — this is your strongest story in
the whole project, told in full it's a 90-second answer that covers state
management, distributed systems thinking, and UX all at once.

**"Is this production-ready?"**
Give the honest answer, not a defensive one: "No — it demonstrates the
right patterns (transactional writes, role-based auth, real-time sync,
offline-first mobile) but I scoped out production hardening like
distributed pub/sub, query cost limiting, and chaos testing to fit the
timeline. Here's what I'd add for a real production version," then list
2-3 items from Part 2. This answer signals more seniority than claiming
it's production-ready and getting picked apart on follow-up questions.

**"Why GraphQL over REST?"**
Talk about avoiding over/under-fetching across two very different clients
(mobile wants lean payloads, web wants richer nested data) with one schema,
plus the shared-types win from the monorepo.

**"Why Prisma / why Postgres / why Turborepo?"** etc.
Pull directly from your own `DECISIONS.md` — that file is written exactly
so these answers don't require you to remember reasoning months later.

## Part 4 — The one thing to never do in an interview

Don't imply this ran in production with real users. It's accurate and
completely fine to say "self-directed project, deployed and fully
functional, built to learn X/Y/Z" — that's a legitimate and common resume
project framing. Overstating it invites the one follow-up question
("how many concurrent users did it handle in prod?") that has no good answer.
