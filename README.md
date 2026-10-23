# Gashur Energy Dispatch Log

An internal mobile app for Gashur Energy Limited's office and dispatch staff. It registers fuel-haulage trips, follows each one from depot to customer to payment, and shows the business on a dashboard.

Built with Expo (SDK 57), React Native and TypeScript, with Supabase for the database and staff sign-in. It runs on a phone through Expo Go and in a web browser.

Data is shared across the company. Every signed-in staff member sees the same trips, fleet and clients, and each record shows who created and last changed it. Dispatchers can add and edit; only managers can delete records or clear a fuel-loss flag. The database enforces these rules, not just the app.

The app keeps a copy of the company data on the device, so screens open instantly and changes save immediately, even offline. Changes sync to Supabase in the background, and other staff's changes arrive live.

Without a Supabase project configured, the app runs as a local demo: no sign-in, and a month of sample trips (Ugandan depots and customers, amounts in US dollars) stored only on the device.

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

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free plan is enough).
2. In the project's **SQL Editor**, paste and run [`supabase/migrations/20261022000000_init.sql`](supabase/migrations/20261022000000_init.sql). It creates the tables, access rules and live updates.
3. Under **Authentication → Sign In / Providers**, turn off **Allow new users to sign up** (accounts are invite-only), and under Email turn off **Confirm email**.
4. Add staff under **Authentication → Users → Add user → Create new user**, with an email and password. Everyone starts as a dispatcher. To make someone a manager, run in the SQL Editor:
   ```sql
   update public.profiles set role = 'manager' where email = 'person@example.com';
   ```
5. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **Publishable key** from **Project Settings → API Keys**. Never use the secret (service_role) key in the app.
6. Restart `npx expo start` so it picks up the new settings, then sign in.
7. For **Forgot password?** on the sign-in screen: under **Authentication → Emails → Templates → Reset password**, replace the message body with the contents of [`supabase/templates/reset-password.html`](supabase/templates/reset-password.html), so the email contains a code instead of a link. Supabase's built-in email only reaches members of your Supabase team, a few per hour; for real staff, set up custom SMTP under **Authentication → Emails → SMTP Settings** (Gmail: host `smtp.gmail.com`, port 587, the Gmail address as username, and a Google app password; editing the template also requires custom SMTP).
8. For the **Staff** screen (managers add people and change roles in the app): run [`supabase/migrations/20261023000000_staff_admin.sql`](supabase/migrations/20261023000000_staff_admin.sql) in the SQL Editor, then under **Edge Functions → Deploy a new function → Via Editor** create a function named `staff-admin` with the code from [`supabase/functions/staff-admin/index.ts`](supabase/functions/staff-admin/index.ts).

The database starts empty. A manager can fill it with the sample month from **Account → Load demo data** (tap your initials in the top bar).

To reset the local demo (without Supabase), delete the app's storage: reinstall or clear Expo Go's data on a phone, or delete the `gashur:v3` key under DevTools → Application → Local Storage in a browser.

## Checks

There is no automated test suite. Before committing, run:

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

## Project layout

- `src/app/`: screens, using Expo Router's file-based routing. The `(tabs)` folder holds the four tabs; trip detail, the trip form, notifications and the edit forms sit outside it.
- `src/lib/store.ts`: the data types, demo data, and every action that changes data. It is the on-device cache the screens read.
- `src/lib/sync.ts`: sends local changes to Supabase and pulls everyone else's. `src/lib/session.ts` handles sign-in.
- `supabase/migrations/`: the database schema and access rules.
- `src/lib/calc.ts`: everything calculated from the data, such as the figures above, statuses, dashboard totals and reminders, plus formatting.
- `src/components/`: shared UI pieces.

Do not run `npm run reset-project`. It is left over from the Expo template and moves the app's source into `example/`.

## Not yet built

- A company email domain for sign-in emails (reset codes are sent through a Gmail account for now)
