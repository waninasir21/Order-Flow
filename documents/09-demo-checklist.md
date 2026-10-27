# Cold demo checklist (week 7 milestone)

The goal: walk through the whole product from a cold start without a blank flash, an unhandled error
or an unfinished-looking screen. Do it once in light mode and once in dark mode on both devices.

## Cold start

1. Close everything: Metro, the backend, the web dev server, Expo Go (swipe it away).
2. Start the backend (`apps\backend`, `npm run dev`), the web app (`apps\web`, `npm run dev`) and Expo
   (`apps\mobile`, `npx expo start`). Open the app from the QR code.

## Walkthrough

| # | Do | Expect |
|---|---|---|
| 1 | Open the web dashboard signed out | the login page, no flash of the dashboard |
| 2 | Sign in as `9900000001` / `password123` | Orders page: the title appears instantly, a skeleton, then the table |
| 3 | Phone: sign in as a rep (`9900000002`) | outlets list; a spinner, never a blank screen |
| 4 | Place an order with two products | confirmation, order on the Orders tab as PLACED |
| 5 | Web: open that order, click **Approve** | badge flips at once; the phone's badge changes by itself within a couple of seconds |
| 6 | Web: **Analytics** | four cards and two charts; the cards match the numbers on Orders and Inventory |
| 7 | Web: 7 / 14 / 30 days | the line chart redraws; the URL changes |
| 8 | Web: toggle theme to Dark | whole page, charts, tooltips follow; reload keeps it |
| 9 | Phone: switch the phone to dark mode | the app follows without a restart |

## Empty and error states (each should look designed, never raw)

- Web: filter Orders by a status with no orders; search for something that doesn't exist; open `/nope`.
- Web: stop the backend and reload a page: "Couldn't load this page" and Try again; restart and click it.
- Phone: stop the backend and pull to refresh: your cached orders stay, no crash.
- Phone: airplane mode, place an order: it queues and shows "Waiting to send".

## Accessibility spot checks

- Web: press Tab on any page: the first stop is "Skip to content", every stop has a visible outline.
- Phone: turn on TalkBack (Android) and swipe through the Orders tab: status badges read "Status:
  Approved"; buttons say what they do.

Anything that fails is a bug to fix before week 8.
