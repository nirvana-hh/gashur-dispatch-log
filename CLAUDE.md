# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Gashur Dispatch Log: an internal app for Gashur Energy Limited's office and dispatch staff to register fuel-haulage trips, watch them on a dashboard, and get notified about each trip. Expo SDK 57, React Native 0.86, TypeScript (strict), Expo Router, React Compiler enabled (`app.json` → `experiments.reactCompiler`). Developed and demoed on a phone via Expo Go; npm is the package manager. Money is in US dollars (`Currency` in `calc.ts`), demo places are in Uganda, volumes in litres.

There is no test suite. Verification is `npx tsc --noEmit` plus `npx expo lint`; to confirm the app actually bundles, use `npx expo export --platform ios` (or `android`, `web`) with `--output-dir` pointed outside the repo.

The app is also tested in Chrome: `npx expo start --web` (or press `w` in a running `npx expo start`), served at http://localhost:8081. `app.json` sets `web.output` to `"single"` on purpose: with static rendering the seed data would be generated once on the server and again in the browser with different timestamps.

Typed routes are on (`experiments.typedRoutes`). Route types in `.expo/types/` are regenerated only while `npx expo start` runs, so after adding or renaming a screen, start the dev server once before `tsc`, or new `href`s fail to typecheck.

Do not run `npm run reset-project`: it is left over from the template and moves `src/` and `scripts/` into `example/`, wiping out the app.

## Architecture

- **[src/lib/store.ts](src/lib/store.ts) holds the data and every write.** It defines the types (`Trip`, `Truck`, `Driver`, `Client`, `AppNotification`), product and depot lists, and the action functions (`dispatchTrip`, `recordDelivery`, `recordInvoice`, `setPaid`, `markLossReviewed`, `saveTruck`/`saveDriver`/`saveClient`, `markAllRead`, ...). Trip actions also append trip notifications (dispatched, delivered, billed, paid, loss).
- **[src/lib/calc.ts](src/lib/calc.ts) holds everything derived**: per-trip figures (loss, variance against `LossTolerance`, shortage charge, revenue, margin, on-time), trip stage and billing status (overdue comes from the client's `creditDays`), "needs review", dashboard `summarize`, compliance reminders for licenses, service, insurance and inspection, and formatting and date-input helpers. None of this is stored; it's computed on render.
- **The state is one object persisted under the key `gashur:v2`** through [src/lib/persist.ts](src/lib/persist.ts): `expo-sqlite/kv-store`'s synchronous API on native, localStorage on web (`persist.web.ts`). It loads lazily on first read and seeds about a month of demo data relative to the current time if nothing is stored. Changing a stored type means bumping the key or migrating, since old JSON on devices is parsed as-is.
- **Components read through [src/hooks/use-store.ts](src/hooks/use-store.ts)** (`useTrips`, `useTrucks`, `useDrivers`, `useClients`, `useNotifications`, each `useSyncExternalStore` over one slice). There is no context provider or state library. Updates replace only the slices that changed, so unchanged slices keep their array reference; selectors must return a stored reference, never a freshly built array, or `useSyncExternalStore` will loop.
- **Money rules** (all in `computeFigures`): loss = litres loaded − delivered; up to `LossTolerance` (0.5% of loaded) is allowed, and litres beyond it are charged back at `ProductInfo[product].pricePerLitre`. Revenue (the invoice amount) = delivered × the trip's `ratePerLitre` (copied from the client at dispatch) − that shortage charge; margin = revenue − the four delivery costs. Invoice amounts aren't stored, so editing a delivery after invoicing changes them.
- **Trip lifecycle**, in three form stages: dispatch (client, truck, driver, product, route, litres loaded, rate, due time) → delivery (litres delivered, arrival, costs, POD) → billing (invoice, payment). The stage is derived from which of `trip.delivery` / `trip.billing` / `billing.paidAt` are set.
- **Routes** (`src/app/`): the `(tabs)` group holds Dashboard (`index`), Trips (`trips`, with its filter in the `filter` URL param so the dashboard can link to it), Fleet and Clients. Outside the tabs: `trips/[id]` (detail), `trips/form` (the three-stage form, a modal, params `id` and `stage`), `notifications` (opened from the bell), and `edit/truck|driver|client` (pop-up add/edit forms). Header buttons are set in [src/app/(tabs)/_layout.tsx](src/app/(tabs)/_layout.tsx). There is no login screen yet.
- **Styling** is plain `StyleSheet` with no UI kit. Shared pieces are in [src/components/ui.tsx](src/components/ui.tsx). Light/dark colors come from `useTheme()` (`Colors` in [src/constants/theme.ts](src/constants/theme.ts)), spacing from `Spacing`, and the brand orange from `Accent`. Stage, billing, urgency and product colors are defined in `calc.ts` and `store.ts`. Icons go through [src/components/icon.tsx](src/components/icon.tsx), which draws Material Symbols glyphs by code point on every platform so the phone matches the browser; add new icons there by code point (they're listed in `expo-symbols/build/android/symbols.json`). The icon font and the heading font (`HeadingFont`, Poppins, used for page and section titles) load in [src/app/_layout.tsx](src/app/_layout.tsx), which renders nothing until both are ready. List screens share [src/components/search-bar.tsx](src/components/search-bar.tsx) (`SearchBar`, `matchesQuery`).

## Lint gotcha

The React Compiler lint rules flag impure calls such as `Date.now()` made directly in a component body (`react-hooks/purity`). Put time-dependent checks in helpers in `src/lib/calc.ts` (e.g. `isWithinDays`, `dateUrgency`, `nowLocalInput`) and call those from components.

## Web gotcha

Don't wrap a `Pressable` whose `style` is a function (`({ pressed }) => ...`) in `<Link asChild>`: on web the style is dropped and the card renders unstyled. Navigate with `onPress={() => router.push(...)}` instead. React Native Web's `Alert` doesn't render buttons, so confirmations go through `confirmAction`/`showMessage` in `src/lib/confirm.ts`, which uses browser dialogs on web (`confirm.web.ts`).
