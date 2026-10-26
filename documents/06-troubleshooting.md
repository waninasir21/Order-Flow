# Troubleshooting

Most problems here were actually hit while building the project. In the **Web dashboard** section, items marked *(reproduced)* were reproduced while building it; items marked *(expected)* follow from how the code behaves but haven't been hit on your machine yet.

## Database / Prisma

**`Environment variable not found: DATABASE_URL`** (Prisma command fails)
`apps/backend/.env` is missing, misnamed, or in the wrong folder. It must be exactly `.env` (not `.env.txt`; Notepad can add the extension, check with `dir -Force`), in `apps\backend` next to `package.json`, with a real connection string (not the `USER:PASSWORD@HOST` placeholder). Create it with `Copy-Item .env.example .env`.

**`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ... src\win\async.c`**
Harmless Node/libuv message when a Prisma command exits on Windows. Read the output above it for the actual result.

**TypeScript: `Module '"@prisma/client"' has no exported member 'PrismaClient'` / `'Role'`, or `Parameter 'o' implicitly has an 'any' type` in `seed.ts`**
The Prisma client hasn't been generated (npm install doesn't do it). Run `npx prisma generate` in `apps\backend` (`migrate dev` does it too). The implicit-`any` error is a knock-on of the missing types. If the editor still shows red but `npx tsc --noEmit` is clean, restart VS Code's TS server (Ctrl+Shift+P → "TypeScript: Restart TS Server").

**`migrate dev` hangs or errors with a pooled Neon URL**
Use the direct connection string (hostname without `-pooler`).

**First request after a while is slow**
Neon's free tier suspends when idle; the first query wakes it. Not a bug.

**Prisma "update available" banner / `package.json#prisma is deprecated`**
Ignore. The project is on Prisma 6 on purpose.

## TypeScript configuration

**`Option 'moduleResolution=node10' is deprecated...`** (`tsconfig.json`)
Newer TypeScript flags the old mode. `tsconfig.base.json` should use `"module": "node16"`, `"moduleResolution": "node16"` and `"types": ["node"]` (newer TypeScript doesn't load `@types/node` automatically, which otherwise causes `Cannot find name 'process'`).

**`npm start` in the backend can't find `dist/index.js`**
`tsc` writes `dist/src/index.js`. In `apps/backend/package.json` set `"main": "dist/src/index.js"` and `"start": "node dist/src/index.js"`.

## Backend / API

**"You must be logged in" / `UNAUTHENTICATED` in Apollo Sandbox**
The access token expired (15 min) or you re-seeded (new IDs, old tokens invalid). Log in again and replace the `Authorization: Bearer <token>` header. Remember the space after `Bearer`.

**A GraphQL error but HTTP 200 and no crash**
Normal. GraphQL errors travel in the `errors` array. The `stacktrace` field only appears in development.

**IDs you copied stopped working**
`npm run seed` deletes everything and creates new IDs. Re-query `outlets` / `products`.

**`FORBIDDEN: This action requires the ADMIN role`**
Expected when a rep calls `updateOrderStatus`. Log in as `9900000001` to approve orders.

**Server exits at startup: `Missing required environment variable JWT_SECRET`**
Add `JWT_SECRET` to `apps/backend/.env`.

## Mobile app

**`ExpoSecureStore.default.setValueWithKeyAsync is not a function`**
You opened the app in the browser (the `w` option). SecureStore has no web version. Use Expo Go on the phone and don't press `w`.

**The phone can't reach the backend** ("Can't reach the server at http://...")
Check, in order: the backend is running (`npm run dev` in `apps\backend`, and `http://localhost:4000/health` works on the laptop); the phone and laptop are on the same Wi-Fi; Windows Firewall allows Node on port 4000 for private networks; the URL in the error message matches your laptop's current IP. If the automatic address is wrong, set `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000/graphql` in `apps\mobile\.env` and restart Expo.

**Expo Go says the project is incompatible / SDK mismatch**
Update Expo Go from the Play Store. The app is on Expo SDK 58.

**Logged out unexpectedly**
The refresh token was rejected (expired, revoked, already used) or the database was re-seeded. Sign in again. Two parallel refresh requests would also cause this; the app serialises them, so if it recurs, that's a bug to look at.

**Changes don't appear after editing**
Press `r` in the Expo terminal to reload. After installing a package, restart `npx expo start`.

**Expo packages show version warnings**
Install Expo-related packages with `npx expo install <package>`, and run `npx expo install --fix` to repair mismatches.

**Both backend and Expo started at once and the laptop crawls**
You ran the root `npm run dev`. Use the two-terminal workflow in [01-setup-and-build.md](01-setup-and-build.md).

## Web dashboard

**`Cannot find name 'PageProps'` from `tsc`, or red squiggles on `PageProps` in the editor** *(reproduced)*
Next generates its route types on demand. Run `npm run typecheck` in `apps\web` (it runs `next typegen` first), not a bare `npx tsc --noEmit`. The editor errors clear after `next typegen`, `next dev` or `next build` has run once, and a "TypeScript: Restart TS Server".

**"Couldn't load this page" with a Try again button** *(reproduced)*
The Next.js server can't reach the backend: it isn't running, or Neon's free tier is waking up (a few seconds). You are still signed in; the cookies are kept. Start the backend (`npm run dev` in `apps\backend`) and click **Try again**. If the backend is elsewhere, set `BACKEND_GRAPHQL_URL` in `apps\web\.env.local` and restart `npm run dev`.

**Sent back to `/login` with "Your session ended"** *(reproduced)*
Expected whenever the backend rejects the session: the refresh token expired (7 days), you re-seeded the database (every employee and token is replaced), you changed `JWT_SECRET`, or you signed out in another tab. Sign in again.

**"This dashboard is for administrators" / "That account isn't an administrator"** *(reproduced)*
Expected for rep accounts: the dashboard is admin-only on purpose. Sign in with `9900000001` / `password123`. Reps use the mobile app.

**"Can't reach the server" on the login form** *(reproduced)*
Same cause as above: the backend isn't reachable from the Next.js server. Check `http://localhost:4000/health`.

**Signed in, but every page bounces back to `/login`** *(expected)*
Most likely the browser dropped the session cookies. Production builds (`npm run build` then `npm start`) mark cookies `Secure`, and a browser only accepts those on `https` or on `localhost`. If you open the production build through a LAN address such as `http://192.168.x.x:3000`, add `COOKIE_SECURE="false"` to `apps\web\.env.local` and restart. `npm run dev` doesn't have this problem. In the browser's developer tools (Application → Cookies) you should see `of_at` and `of_rt`, both HttpOnly.

**Port 3000 is already in use** *(expected)*
Run `npm run dev -- -p 3001`.

**After pulling new code the dashboard behaves oddly** *(expected)*
Stop `npm run dev`, delete `apps\web\.next`, and start it again (`Remove-Item -Recurse -Force .next`).

**The order list doesn't include an order just placed on the phone** *(expected)*
The dashboard has no live updates yet (week 6). Reload the page. An order placed offline shows up only after the phone has synced it, with the sync time as its date.

## Offline queue

**Placed an order offline but it never syncs**
Check the phone is actually online and the backend is reachable. A queued order retries when the phone goes online, when the app returns to the foreground, and every 15 s after a failed send. Make sure you're signed in as the employee who created it (queued orders belong to one employee). The order's card on the Orders tab shows its current state.

**A card says "Sync failed"**
The server refused the order; the card shows why (for example insufficient stock). Fix the cause (restock, or change the order) then tap **Retry**, or **Discard**.

**Can't place a new order after reopening the app offline**
The outlet/product lists are cached in memory only. Open the app online once, then go offline. (Known limitation.)

**Airplane-mode test: the app reloads and shows an error**
Expo Go loads the app's code from the laptop. Don't reload or shake the app while offline; toggle airplane mode with the app already running.

## Git

**`.env` shows up in `git status`**
Stop and don't commit. The root `.gitignore` must be next to the root `package.json` and contain `.env`. If a `.env` was ever committed, rotate the database password in Neon, because it's in the history.

## Real-time (week 6)

**The phone doesn't update when I approve on the web**
Check the backend console printed `Subscriptions ready at ws://…`. The phone connects to the same host
as the HTTP API (`src/config.ts`), so if queries work but updates don't, something between the phone
and laptop is blocking WebSockets (a VPN, a hotspot with client isolation). Pull to refresh still works.
Also check you are signed in as the rep who placed that order: reps only receive their own orders.

**No notification banner**
You may have denied the permission: enable notifications for Expo Go in the phone's settings. The
badge still changes without it.

**Order changes only after ~15 minutes' delay, or stops updating after a long idle**
The socket reconnects with a refreshed token; if the refresh token itself has expired (7 days) or was
revoked you are logged out. Sign in again.

**`Cannot find module 'graphql-ws'` / `ws` on the backend**
Run `npm install` at the repo root; week 6 added `graphql-ws`, `graphql-subscriptions`, `ws` and
`@graphql-tools/schema` to the backend and `graphql-ws` and `expo-notifications` to the phone.

**Red screen: `Cannot find native module 'ExpoTopicSubscriptionModule'`, then "Route ./(app)/_layout.tsx is missing the required default export"**
`expo-notifications` was imported at startup and this Expo Go build doesn't contain one of its native modules. The app now loads it lazily (`src/realtime/notifications.ts`) and carries on without banners if it is missing. Live status updates don't depend on it.

**Metro: `Failed to start watch mode` or `Cannot read properties of undefined (reading 'get')` (DependencyGraph)**
Metro's file watcher didn't become ready within 4 minutes. Stop all node processes, delete `apps\web\.next`, keep `apps\mobile\metro.config.js` (it stops Metro watching the web app and backend), and if it persists exclude the project folder from Windows Defender real-time scanning.
