# OrderFlow — Documentation

OrderFlow is a mini B2B ordering and inventory platform. Field reps place orders for outlets
from a mobile app; admins follow them on a web dashboard (read-only in week 5, approvals in week 6).
Both talk to one shared GraphQL backend.

This folder documents what has been built so far (weeks 1–5). The architecture and the weekly
plans are in `00-architecture.md` and `week-N-*.md`; the reasoning behind every non-obvious
choice is in [`../DECISIONS.md`](../DECISIONS.md).

## Status

| Week | Milestone | State |
|---|---|---|
| 1 | Backend foundation: monorepo, Postgres, Prisma, GraphQL | Done |
| 2 | Auth (JWT + rotating refresh tokens) and order flow | Done |
| 3 | Expo mobile app connected to the backend | Done |
| 4 | Offline-first orders: SQLite queue and sync | Built; airplane-mode test is the milestone |
| 5 | Web dashboard, read side (Next.js): orders, order detail, inventory | Built and browser-tested against a mock backend; the milestone test against your real data is yours to run |
| 6 | Web write side (approve/reject, stock editing) + real-time order updates to the phone | Built; tested against stand-ins. The side-by-side test on your machine and phone is the milestone |
| 7–8 | Analytics, tests/CI/deploy | Not started |

## Documents

| File | Read it when you want to... |
|---|---|
| [01-setup-and-build.md](01-setup-and-build.md) | set up the project, run it, typecheck it, build it |
| [02-database-prisma.md](02-database-prisma.md) | understand the data model, migrations, seeding, Neon |
| [03-backend-api.md](03-backend-api.md) | use or change the GraphQL API, auth, permissions, order rules |
| [04-mobile-app.md](04-mobile-app.md) | understand the Expo app's structure, session, Apollo setup |
| [05-offline-sync.md](05-offline-sync.md) | understand or test the offline order queue |
| [06-troubleshooting.md](06-troubleshooting.md) | fix an error (the ones we have hit are listed; web ones are marked) |
| [07-web-dashboard.md](07-web-dashboard.md) | understand the web dashboard: architecture, cookie session, pages, tests |
| [08-realtime.md](08-realtime.md) | understand or test live updates: subscriptions, auth, reconnect, notifications |

## Repository layout

```
orderflow/
├── apps/
│   ├── backend/            Express + Apollo Server + Prisma (GraphQL API)
│   │   ├── prisma/         schema.prisma, migrations/, seed.ts
│   │   └── src/            index, schema, pubsub, context, config, errors, auth/, resolvers/, services/
│   ├── mobile/             Expo (React Native) app, Expo Router
│   │   ├── app/            screens (file-based routes)
│   │   └── src/            apollo/, stores/, offline/, realtime/, hooks/, components/, graphql/, lib/
│   └── web/                Next.js admin dashboard (App Router, Tailwind v4)
│       └── src/            proxy.ts, app/ (login, (dashboard)/orders|inventory), components/, lib/
├── packages/
│   ├── shared-types/       (placeholder; GraphQL codegen later)
│   └── config/             (placeholder)
├── docs/                   this folder
├── DECISIONS.md            dated log of decisions and tradeoffs
├── turbo.json              Turborepo tasks
├── tsconfig.base.json      shared TypeScript settings (backend)
└── package.json            npm workspaces root
```

## Seeded test accounts (development only)

`npm run seed` (in `apps/backend`) creates these. The password for all of them is `password123`.

| Role | Phone | Outlets |
|---|---|---|
| ADMIN | 9900000001 | all |
| REP (Rep One) | 9900000002 | Sharma General Store, Lakshmi Provisions |
| REP (Rep Two) | 9900000003 | Khan Kirana |
