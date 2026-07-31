# Week 3 — Mobile App, Connected to the Real Backend

> Depends on Week 2: working `login`, `createOrder`, `orders` query/mutations
> with auth enforced. This is the week you're most at home in (RN/Expo,
> Apollo, Zustand) — move a bit faster here, bank the time for week 4.

## Goal for the week

A real Expo app, not mocked data, that logs in, lists an employee's outlets,
and places an order that lands in your Postgres database.

## Tasks, in order

### 1. Expo app scaffold
- `npx create-expo-app apps/mobile --template` (TypeScript template).
- Install Apollo Client (`@apollo/client`, `graphql`), Zustand, MMKV.
- Set up Expo Router for navigation (`login`, `outlets`, `outlet/[id]`,
  `place-order/[outletId]`).

### 2. Apollo Client setup
- Create an `ApolloClient` instance with an `authLink` that reads the access
  token from MMKV and attaches it as the `Authorization` header.
- Point the `httpLink` at your local backend's URL — for a physical device
  or simulator, use your machine's LAN IP, not `localhost` (a classic Expo
  gotcha — note it in `DECISIONS.md` or just a code comment, you'll forget
  this again next project otherwise).

### 3. Auth flow
- Login screen: phone + password fields, `login` mutation on submit.
- On success: store `accessToken` and `refreshToken` in MMKV, store
  `employee` (id, name, role) in a Zustand store, navigate to the outlets list.
- Basic "logged in" guard on protected routes (Expo Router layout-level
  redirect if no token in MMKV).

### 4. Outlets + product list screens
- `outlets` query (scoped to the logged-in rep) rendered as a list.
- Tapping an outlet navigates to a simple product picker screen —
  `products` query, quantity steppers per product.

### 5. Place order flow
- Collect selected `{productId, quantity}` pairs in local component state or
  a small Zustand "cart" store.
- On submit: call `createOrder` mutation.
- On success: show a confirmation, navigate back, and refetch (or update the
  Apollo cache directly with `cache.modify` — good learning moment for cache
  management beyond what you may have needed at Bizom).

### 6. Order history screen
- `orders` query, render list with outlet name, status badge (reuse the
  visual pattern you already know well from `OrderCard` at work — this is a
  good place to demonstrate that pattern independently, not copy code from
  work).

## Milestone (must be true before moving to week 4)

From the Expo app (simulator or physical device, real network, no mocks):
log in as a rep, view your assigned outlets, place an order with 2+ line
items, and see it appear correctly in `orders` — and confirm it in
`prisma studio` or Postgres directly that the row actually exists.

## Things to write down in DECISIONS.md this week

- Where you put the "cart" state (component-local vs Zustand) and why.
- Whether you used `cache.modify`, `refetchQueries`, or an `update` function
  after the mutation, and the trade-off you picked.

## Common pitfalls

- `localhost` not resolving on physical devices/some simulators — use your
  machine's LAN IP and confirm firewall isn't blocking the port.
- Storing tokens in Zustand only (in-memory) instead of MMKV — app restart
  will silently log the user out; make sure persistence actually works by
  force-closing the app and reopening.
- Apollo cache not updating after a mutation, leaving the UI stale — don't
  just assume it works, actually place an order and check the list updates
  without a manual pull-to-refresh.

## What later weeks depend on from this week

Week 4 builds directly on top of this mobile app's `createOrder` call site —
you'll be intercepting it to route through an offline queue when there's no
network, so keep that mutation call in one clearly identifiable place (e.g.
a `useCreateOrder()` hook) rather than scattered inline in a component.
