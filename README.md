# Gashur Energy Dispatch Log

An internal mobile app for Gashur Energy Limited's office and dispatch staff. It registers fuel-haulage trips, follows each one from depot to customer to payment, and shows the business on a dashboard.

Built with Expo (SDK 57), React Native and TypeScript. It runs on a phone through Expo Go and in a web browser. This is a demo: data is stored on the device, and the app seeds about a month of sample trips (Ugandan depots and customers, amounts in US dollars) on first launch.

## Features

- **Dashboard:** revenue, gross margin, outstanding payments, on-time rate and trips needing review, over the last 7 or 30 days. Includes revenue by client, margin by truck, and alerts for fuel loss, driver licences and truck service, insurance and inspection.
- **Trips:** a searchable list with filters (in transit, needs review, unbilled, overdue, paid).
- **Trip form in three stages:**
  1. *Dispatch:* client, truck, driver, product, route, litres loaded, rate and expected transit time.
  2. *Delivery:* litres delivered, arrival time, trip costs and proof of delivery.
  3. *Billing:* invoice number and date, and payment.
- **Fleet:** trucks and drivers with odometer, service, insurance, inspection and licence dates, colour-coded when due.
- **Clients:** billing contacts, haulage rate and credit terms, with outstanding balances.
- **Notifications:** an alert for every dispatch, delivery, invoice and payment, plus fuel-loss flags and compliance reminders.

## How figures are calculated

| Figure | Rule |
|---|---|
| Loss | Litres loaded − litres delivered |
| Allowed loss | 0.5% of litres loaded; more than this flags the trip for review |
| Shortage charge | Litres lost beyond the allowance × the product's price per litre |
| Revenue (invoice amount) | Litres delivered × the client's rate per litre − shortage charge |
| Margin | Revenue − trip costs (truck fuel, driver allowance, tolls, other) |
| On time | Arrived no later than dispatch time + expected transit hours |
| Overdue | Unpaid once the client's credit days have passed since the invoice date |

## Getting started

You need Node.js and npm. On a phone, install [Expo Go](https://expo.dev/go).

```bash
npm install
npx expo start
```

- **Phone:** scan the QR code shown in the terminal with Expo Go. The phone and computer must be on the same network.
- **Browser:** press `w` in the terminal, or run `npx expo start --web`, then open http://localhost:8081.

Add packages with `npx expo install <package>` so versions match the Expo SDK.

To reset the demo data, delete the app's storage: reinstall or clear Expo Go's data on a phone, or delete the `gashur:v2` key under DevTools → Application → Local Storage in a browser.

## Checks

There is no automated test suite. Before committing, run:

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

## Project layout

- `src/app/`: screens, using Expo Router's file-based routing. The `(tabs)` folder holds the four tabs; trip detail, the trip form, notifications and the edit forms sit outside it.
- `src/lib/store.ts`: the data types, demo data, and every action that changes data.
- `src/lib/calc.ts`: everything calculated from the data, such as the figures above, statuses, dashboard totals and reminders, plus formatting.
- `src/components/`: shared UI pieces.

Do not run `npm run reset-project`. It is left over from the Expo template and moves the app's source into `example/`.

## Not yet built

- Staff login and roles (dispatcher, manager)
- A shared backend: data currently stays on each device
