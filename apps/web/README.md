# OrderFlow web dashboard

Next.js 16 (App Router, React Server Components, Cache Components) admin dashboard. Read-only in
week 5: orders list, order detail, inventory. It talks to the same GraphQL backend as the mobile
app. Full documentation: [`docs/07-web-dashboard.md`](../../docs/07-web-dashboard.md).

## Run

```powershell
# 1. backend running in another terminal:  cd apps\backend ; npm run dev
cd apps\web
Copy-Item .env.example .env.local      # only needed if the backend isn't at localhost:4000
npm run dev                            # http://localhost:3000
```

Sign in as the seeded admin: phone `9900000001`, password `password123`. Reps are rejected on
purpose: this dashboard is for administrators.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | production build and server |

## Notes

- The browser never talks to the backend. Server components, server actions and the proxy call it
  server-side, so there is no CORS to configure and the tokens stay in httpOnly cookies.
- `AGENTS.md` (written by Next) tells coding assistants to read the docs bundled in
  `node_modules/next/dist/docs/`, because this Next version differs from older training data.
