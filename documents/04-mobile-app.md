# Mobile App (Expo / React Native)

`apps/mobile`. Expo SDK 58, React Native 0.88, React 19, TypeScript (strict), Expo Router,
Apollo Client 3.14, Zustand 5. It's developed and tested on a physical Android phone with
**Expo Go**.

| Concern | Choice |
|---|---|
| Navigation | Expo Router (file-based routes in `app/`) |
| Server data | Apollo Client (queries, mutations, normalized cache) |
| Session state | Zustand + `persist`, stored in `expo-secure-store` |
| Offline queue | `expo-sqlite` (see [05-offline-sync.md](05-offline-sync.md)) |
| Connectivity | `@react-native-community/netinfo` |
| IDs | `expo-crypto` (`randomUUID`) |

## Structure

```
apps/mobile
├── app/                               routes (every file is a screen)
│   ├── _layout.tsx                    root: SafeArea + ApolloProvider + Stack
│   ├── login.tsx                      /login
│   └── (app)/                         everything here requires a session
│       ├── _layout.tsx                auth guard + <SyncManager/> + Stack
│       ├── (tabs)/
│       │   ├── _layout.tsx            tabs, Sign out button, unsynced-orders badge
│       │   ├── index.tsx              Outlets list
│       │   └── orders.tsx             My orders (queued + synced)
│       ├── outlet/[id].tsx            outlet details + its orders + "Place order"
│       └── place-order/[outletId].tsx product picker, quantity steppers, submit
└── src/
    ├── apollo/        client.ts (links, token refresh), orderCache.ts
    ├── stores/        auth.ts (session store)
    ├── offline/       db.ts, outbox.ts, network.ts, sync.ts
    ├── hooks/         useCreateOrder.ts, useOrdersFeed.ts
    ├── components/    ui.tsx, OrderRow.tsx, PendingOrderCard.tsx, SyncManager.tsx
    ├── graphql/       operations.ts (all queries/mutations), types.ts
    ├── lib/           errors.ts, session.ts, secureStorage.ts, sendOrder.ts
    └── config.ts      API URL resolution
```

Import alias: `@/` maps to `src/`. Keep non-route code outside `app/`, because every file in
`app/` becomes a route.

## Screens and routes

| Route | Screen | Notes |
|---|---|---|
| `/login` | Login | Phone + password. Redirects into the app if a session already exists. |
| `/` (tab) | Outlets | The rep's assigned outlets. Pull to refresh. Tap an outlet to open it. |
| `/orders` (tab) | My orders | Queued (local) orders on top, then the server's. Status badges. Badge on the tab = number of unsynced orders. |
| `/outlet/[id]` | Outlet detail | Details, "Place order" button, this outlet's orders. |
| `/place-order/[outletId]` | Place order | Products with price and stock, `−`/`+` steppers (capped at stock), running total, submit. Shows an offline notice when offline. |

## Session and authentication

- State lives in `stores/auth.ts` (Zustand): `accessToken`, `refreshToken`, `employee {id, name, role}`, and `hydrated`.
- It's persisted under the key `orderflow-auth` through `lib/secureStorage.ts` (OS keychain/keystore). SecureStore is async, so the session loads after launch; `hydrated` is false until then.
- **Route guard:** `app/(app)/_layout.tsx` waits for `hydrated`, then redirects to `/login` if there's no session. Because it's in the layout, every screen in that folder is protected. `login.tsx` does the reverse redirect.
- **Login:** the `login` mutation → `setSession(payload)` (persists it) → the redirect lands on the outlets tab.
- **Sign out:** `lib/session.ts` `signOut()` revokes the refresh token on the server (best effort, works offline), then clears the store. Clearing the session also wipes the Apollo cache, so the next user never sees the previous user's data. If orders are unsynced, the Sign out button warns first.
- **Persistence check:** force-close and reopen the app; you should stay signed in.

## Apollo Client (`src/apollo/client.ts`)

Link chain: `errorLink → authLink → httpLink`.

- **authLink** reads the access token from the store on every request, so a refreshed token is used automatically, including on the retry.
- **errorLink** handles `UNAUTHENTICATED`: it refreshes once and retries the operation once. All requests failing at the same time share one in-flight refresh promise ("single-flight"), because refresh tokens are single-use. The `Login` operation is excluded. The refresh is a plain `fetch` so it can't loop back into the same link. If the refresh is rejected, the session is cleared (back to login); if the phone is just offline, the session is kept.
- **Cache clearing** when the refresh token disappears (sign-out or a failed refresh).

### API URL (`src/config.ts`)

A phone can't use `localhost`. In dev the app takes the host from Expo's `hostUri` (the laptop's LAN IP that the phone already uses to reach Metro) and uses port 4000: `http://<laptop-ip>:4000/graphql`. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to override (tunnel mode or a deployed backend). When the server can't be reached, the app's error message prints the exact URL it tried.

### Queries and fetch policies

| Screen | Query | Policy | Why |
|---|---|---|---|
| Outlets | `Outlets` | cache-first (default) | Rarely changes. |
| My orders / Outlet detail | `Orders` | `cache-and-network` | Show cached orders instantly, then confirm. |
| Place order | `Products` | `cache-and-network` | Stock must be fresh when choosing quantities. |

All operations are in `graphql/operations.ts`. The order fields are one shared fragment
(`OrderFields`) so a mutation result has everything the list needs and can be written straight
into the cached list.

## Placing an order

1. The screen collects quantities in component state (the cart is local to the screen).
2. It calls `createOrder({ outletId, outletName, lines })` from `useCreateOrder()` — the **only** place screens place orders.
3. The hook generates a UUID, then either sends it now or queues it (see [05-offline-sync.md](05-offline-sync.md)). The result is `synced` or `queued`; the screen shows "Order placed" or "Saved offline".
4. After a send, the new order is prepended to the cached Orders list (`apollo/orderCache.ts`) and the cached products are evicted, so any screen showing stock refetches.
5. On `INSUFFICIENT_STOCK` the screen shows the server's message, reloads stock and caps the cart to what's left.

## Live updates (week 6)

`LiveUpdates` (mounted next to `SyncManager` while signed in) runs `useOrderUpdates`, one
subscription to `orderStatusChanged` for the whole app. Details are in
[08-realtime.md](08-realtime.md). In short: the Apollo link splits subscriptions onto a graphql-ws
WebSocket (`apollo/client.ts`), an event is written straight into the cache and deduplicated
(`realtime/applyOrderUpdate.ts`), and a local notification is shown (`realtime/notifications.ts`).

## Conventions

- Add Expo packages with `npx expo install <package>` so versions match the SDK.
- Don't edit `android/` or `ios/` (they're generated). Native config goes in `app.json`.
- GraphQL types in `graphql/types.ts` are hand-written for now; codegen into `packages/shared-types` is planned.
- `AGENTS.md` in this folder tells coding assistants to read the Expo docs for the installed SDK before using Expo APIs, because Expo changes APIs between SDKs.
- Web (`w` in the Expo terminal) is not supported; SecureStore doesn't exist there.

## Not built yet

Real-time order updates (week 6), analytics/dark mode (week 7), tests and a store/APK build via EAS (week 8).
