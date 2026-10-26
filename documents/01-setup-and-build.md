# Setup, Run and Build

Commands are for **Windows PowerShell**, run from the repo root unless a folder is shown.

## Prerequisites

- Node.js LTS and npm
- Git
- A free **Neon** account (Postgres). Upstash (Redis) is not used yet.
- **Expo Go** on a physical Android phone, kept up to date. The app targets Expo SDK 58, and an old Expo Go refuses it with an "incompatible SDK" error.
- The laptop and the phone on the **same Wi-Fi**.

No Docker, no Android emulator (deliberate: see `DECISIONS.md`).

## First-time setup

```powershell
# 1. Install everything for all workspaces (backend, mobile, packages)
npm install

# 2. Backend environment
cd apps\backend
Copy-Item .env.example .env
notepad .env          # fill in DATABASE_URL and JWT_SECRET (see below)

# 3. Create the tables, then add test data
npx prisma migrate dev
npm run seed
```

One `npm install` at the root is enough. Do not run it separately inside `apps\backend` or `apps\mobile`.

### Environment variables

`apps/backend/.env` (never committed; `.env.example` is the template):

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string. For migrations prefer the **direct** string (hostname without `-pooler`). |
| `JWT_SECRET` | yes | Secret that signs access tokens. The server refuses to start without it. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `REDIS_URL` | not yet | Upstash URL. Nothing reads it until the caching step. |
| `PORT` | no | API port, default `4000`. |

`apps/mobile/.env` (optional):

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | Full API URL, e.g. `http://192.168.1.50:4000/graphql`. Only needed if the automatic LAN address doesn't work (tunnel mode, deployed backend). |

`apps/web/.env.local` (optional; copy `apps/web/.env.example`):

| Variable | Meaning |
|---|---|
| `BACKEND_GRAPHQL_URL` | Where the GraphQL backend is. Default `http://localhost:4000/graphql`, so you only set it for another host. Read on the server only; the browser never calls the backend. |
| `COOKIE_SECURE` | `"false"` to send the session cookies over plain http on a non-localhost address (see troubleshooting). Production builds mark cookies `Secure` by default; `next dev` does not. |

Never paste a connection string or secret into chat, an issue or a commit.

## Running it day to day

Use only the terminals you need. The backend is always first.

```powershell
# Terminal 1 — backend (always)
cd apps\backend
npm run dev                      # GraphQL at http://localhost:4000/graphql

# Terminal 2 — EITHER the mobile app ...
cd apps\mobile
npx expo start                   # scan the QR code with Expo Go

# ... OR the web dashboard
cd apps\web
npm run dev                      # http://localhost:3000, sign in as 9900000001 / password123
```

- Open `http://localhost:4000/graphql` in a browser for Apollo Sandbox. `http://localhost:4000/health` returns `{"ok":true}`.
- **Run web and mobile together only when testing a cross-app flow** (week 6's real-time test). Each is heavy on an i3/8GB laptop.
- **Do not press `w`** in the Expo terminal (the mobile app's web target is unsupported, see troubleshooting). The web dashboard is its own app in `apps\web`.
- **Do not use the root `npm run dev`**: it starts every app at once, which an i3/8GB laptop doesn't need. From the root, use `npm run dev:backend` or `npm run dev:web` instead.
- Windows Firewall may ask to allow Node on port 4000. Allow it on private networks, or the phone can't reach the API.

## Script reference

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | `turbo run dev` for all apps (avoid, see above) |
| root | `npm run dev:backend` | backend dev server only |
| root | `npm run dev:web` | web dashboard dev server only |
| root | `npm run typecheck` | typecheck every workspace that has the task |
| root | `npm run build` | `turbo run build` |
| `apps/backend` | `npm run dev` | `tsx watch src/index.ts` (auto-restart on change) |
| `apps/backend` | `npm run typecheck` | `tsc --noEmit` |
| `apps/backend` | `npm run build` | compile TypeScript to `dist/` |
| `apps/backend` | `npm start` | run the compiled server (see "Production-style build") |
| `apps/backend` | `npm run seed` | wipe and re-seed the database (**deletes all data**) |
| `apps/backend` | `npx prisma studio` | browse the database in a browser |
| `apps/mobile` | `npx expo start` | dev server for Expo Go |
| `apps/mobile` | `npm run typecheck` | `tsc --noEmit` |
| `apps/web` | `npm run dev` | Next.js dev server (Turbopack) on port 3000 |
| `apps/web` | `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `apps/web` | `npm run lint` | ESLint |
| `apps/web` | `npm run build` | production build (also typechecks) |
| `apps/web` | `npm start` | serve the production build (run `build` first) |

Use `npx expo install <package>` (not `npm install`) to add Expo-related packages in `apps/mobile`: it picks the version that matches the Expo SDK.

## Checks before every commit

```powershell
cd apps\backend; npx tsc --noEmit        # must print nothing
cd ..\mobile;   npx tsc --noEmit         # must print nothing
cd ..\web;      npm run typecheck        # must print no errors
cd ..\web;      npm run lint             # must print nothing
git status                               # no .env files; migrations and package-lock.json included
```

Optional deeper checks for the mobile app:

```powershell
npx expo-doctor                                              # dependency/config health
npx expo export --platform android --output-dir ..\..\tmp-export   # proves Metro can bundle it
Remove-Item -Recurse ..\..\tmp-export                        # delete the output afterwards
```

## Production-style build of the backend

```powershell
cd apps\backend
npm run build        # writes dist/src/index.js (and dist/prisma/seed.js)
npm start            # node dist/src/index.js
```

`tsc` keeps the `src/` folder in its output because `rootDir` is the backend root (the seed script lives outside `src/`). The `start` script and `main` field in `apps/backend/package.json` must therefore point at `dist/src/index.js`.

For a deployment, apply migrations with `npx prisma migrate deploy` (never `migrate dev`, which can prompt and reset data), set the environment variables on the host, and run the compiled server. Deployment itself is week 8 and isn't set up yet.

## Mobile builds

- **Development:** Expo Go on a phone. Nothing is compiled on the laptop.
- **Installable APK / store builds:** done in the cloud with EAS, planned for week 8. Not configured yet.
- Native folders (`android/`, `ios/`) don't exist and shouldn't be edited by hand; native settings go in `app.json` and config plugins.
- Anything with native code that Expo Go doesn't bundle needs a development build. All current dependencies work in Expo Go.

## Git hygiene

- `.env` is git-ignored; commit only `.env.example`.
- Commit `apps/backend/prisma/migrations/` (the migration history is part of the project) and `package-lock.json`.
- One focused commit per change. Tag the end of each week: `git tag week-N-done` then `git push origin week-N-done`.

## Checks before every commit (week 6)

`git commit` first runs `.husky/pre-commit`, which runs `npx turbo run typecheck lint`: TypeScript
for the backend, mobile and web, and ESLint for the web. If anything fails, git aborts the commit and
prints the errors; the commit only happens when everything passes. Turborepo caches results, so a
second run with unchanged code takes a few seconds (a cold run takes about 40).

- Run the same checks by hand: `npm run check` (or `npm run typecheck`, `npm run lint`).
- The hook is installed by `npm install` (the root `prepare` script runs `husky`). After cloning, run `npm install` once.
- Emergency bypass: `git commit --no-verify`. Use it rarely; a red commit is a red commit.
- Only the web app has a linter so far; backend and mobile are covered by typecheck only.
