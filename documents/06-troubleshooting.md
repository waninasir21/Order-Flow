# Troubleshooting

Every problem here was actually hit while building the project.

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
