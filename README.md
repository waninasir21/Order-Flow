# OrderFlow — Documentation

OrderFlow is a mini B2B ordering and inventory platform. Field reps place orders for outlets
from a mobile app; admins approve them (web dashboard, coming in Tasks 5–6). Both talk to one
shared GraphQL backend.

## Status

| Task | Milestone                                               | State      |
| ---- | ------------------------------------------------------- | ---------- |
| 1    | Backend foundation: monorepo, Postgres, Prisma, GraphQL | Done       |
| 2    | Auth (JWT + rotating refresh tokens) and order flow     | Done       |
| 3    | Expo mobile app connected to the backend                | Done       |
| 4    | Offline-first orders: SQLite queue and sync             | Done       |
| 5–8  | Web dashboard, real-time, analytics, tests/CI/deploy    | InProgress |

## Documents

| File                                                     | Read it when you want to...                                   |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [01-setup-and-build.md](documents\01-setup-and-build.md) | set up the project, run it, typecheck it, build it            |
| [02-database-prisma.md](documents\02-database-prisma.md) | understand the data model, migrations, seeding, Neon          |
| [03-backend-api.md](documents\03-backend-api.md)         | use or change the GraphQL API, auth, permissions, order rules |
| [04-mobile-app.md](documents\04-mobile-app.md)           | understand the Expo app's structure, session, Apollo setup    |
| [05-offline-sync.md](documents\05-offline-sync.md)       | understand or test the offline order queue                    |
| [06-troubleshooting.md](documents\06-troubleshooting.md) | fix an error (every one we have actually hit is listed)       |

## Repository layout

```
orderflow/
├── apps/
│   ├── backend/            Express + Apollo Server + Prisma (GraphQL API)
│   │   ├── prisma/         schema.prisma, migrations/, seed.ts
│   │   └── src/            index, schema, context, config, errors, auth/, resolvers/, services/
│   ├── mobile/             Expo (React Native) app, Expo Router
│   │   ├── app/            screens (file-based routes)
│   │   └── src/            apollo/, stores/, offline/, hooks/, components/, graphql/, lib/
│   └── web/                (empty until Task 5)
├── packages/
│   ├── shared-types/       (placeholder; GraphQL codegen later)
│   └── config/             (placeholder)
├── documents/              all documents
├── DECISIONS.md            dated log of decisions and tradeoffs
├── turbo.json              Turborepo tasks
├── tsconfig.base.json      shared TypeScript settings (backend)
└── package.json            npm workspaces root
```

## Seeded test accounts (development only)

`npm run seed` (in `apps/backend`) creates these. The password for all of them is `password123`.

| Role          | Phone      | Outlets                                  |
| ------------- | ---------- | ---------------------------------------- |
| ADMIN         | 9900000001 | all                                      |
| REP (Rep One) | 9900000002 | Sharma General Store, Lakshmi Provisions |
| REP (Rep Two) | 9900000003 | Khan Kirana                              |
