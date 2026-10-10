# GalimotoYanga

A car marketplace for Malawi, modelled on how BE FORWARD works but only for **cars already in the country**: duty paid, on the road, ready to view. Buyers browse stock by make, price, body type and district, then **reserve a car with a refundable deposit** paid by **Airtel Money** or **TNM Mpamba**. A **Rent a car** tab lists cars for hire by the day, with or without a driver. Dealers, car hire businesses and private sellers list their own cars.

The name means "my car" in Chichewa.

| Folder | What | Stack |
| --- | --- | --- |
| `api/` | REST API: listings, search, enquiries, reservations, rentals, escrow ledger, payments, timers, admin | NestJS 10 (TypeScript), PostgreSQL 16 + PostGIS |
| `web/` | Website for buyers, renters, sellers and admins (works on phones, works without JavaScript) | SvelteKit 2 / Svelte 5, server-rendered |

## What the site does

- **Buy a car**: stock list with filters (make, model, body, price, year, mileage, transmission, fuel, 2WD/4WD, district, dealer or private, price down), sort, stock numbers (GM10001), save, compare up to 4, recently viewed, similar cars.
- **Reserve with a deposit**: 5% of the price (MWK 50,000 to 500,000). The car is held for 3 days. The buyer pays the balance to the seller in person and taps "I bought the car"; the deposit, less a 1% fee, goes to the seller. If the hold lapses or the seller cancels, the deposit is refunded in full.
- **Rent a car**: search by dates (only cars free on every day show), self-drive or with a driver, pay the full hire up front. Booked dates are blocked by a database constraint, so double-booking is impossible. Owners are paid after the car is returned, less 10%.
- **Enquiries**: signed-in buyers see the seller's number and WhatsApp, or message through the site.
- **Sellers**: sign up as a dealer or private seller, list cars with up to 20 photos (shrunk on the phone before upload), edit, lower the price (shows a "Price down" badge), pause, mark sold, see views, enquiries, open orders and money held.
- **Admin**: listing review queue, seller verification (verified sellers' listings go live without review), orders, problem resolution (release, refund or split), payments with retry, ledger balances, users.
- **Problems**: either side can report a problem on an order; the money stays held until an admin decides.

## Put it online (Render, free)

`render.yaml` describes the deployment: one free web service (API + website in one container, see `Dockerfile` and `deploy/start.sh`) and one free PostgreSQL database in Frankfurt. Pushing to `main` redeploys.

1. https://dashboard.render.com → **New → Blueprint** → this repository → **Apply**.
2. Open the service URL. (The service is still called `fundi` from this repository's first version; renaming it in Render changes the URL.)

It runs in **demo mode** (`DEMO_MODE=true`): 6 demo sellers and 31 cars are loaded, sign-in codes appear on screen, and payments are simulated. Admin: `0999 000 001`. Demo seller numbers: `0888 000 202` to `0888 000 207`.

Free-tier limits: the service sleeps after 15 minutes idle, the free database expires after 30 days, and uploaded photos are lost on each deploy (demo photos are restored on start). For real users: a paid instance with a disk or S3 storage, `DEMO_MODE=false`, and SMS and PayChangu keys.

## Run it locally

```bash
docker compose up --build        # website http://localhost:3001, API http://localhost:3000
```

Or without Docker (Node 22, PostgreSQL 16 with PostGIS 3):

```bash
createdb fundi && psql fundi -c "CREATE EXTENSION postgis; CREATE EXTENSION btree_gist"
cd api && cp .env.example .env && npm install && DEMO_MODE=true npm run dev     # http://localhost:3000
cd web && cp .env.example .env && npm install && npm run dev                    # http://localhost:5173
```

## Payments: PayChangu (Airtel Money and TNM Mpamba)

1. Create a PayChangu account; copy the **test** secret key and add the webhook `https://<your-host>/api/webhooks/paychangu`, copying its secret.
2. Set `PAYMENTS_DRIVER=paychangu`, `PAYCHANGU_SECRET_KEY`, `PAYCHANGU_WEBHOOK_SECRET` (and `DEMO_MODE=false`).
3. Sandbox wallets: Airtel `0990000000` succeeds, `0990000001` fails; TNM `0899817565` succeeds, `0899817566` fails.

How money moves (`api/src/payments/`): every payment is a double-entry ledger posting across `cash`, `escrow`, `seller_payable`, `buyer_refundable` and `fee_revenue`, and must sum to zero. Webhooks are signature-checked and re-verified with PayChangu; a scheduler polls pending charges; failed payouts retry with back-off.

> Before taking real money, confirm with the Reserve Bank of Malawi whether holding deposits needs a licence or a trust account with a partner bank.

## Configuration

All settings are in `api/.env.example`. Main ones: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PHONES`, `DEMO_MODE`, `DEPOSIT_PERCENT` / `DEPOSIT_MIN_MWK` / `DEPOSIT_MAX_MWK`, `SALE_FEE_PERCENT`, `RENTAL_COMMISSION_PERCENT`, `RESERVATION_HOLD_HOURS`, `AUTO_COMPLETE_HOURS`, `MAX_UPLOAD_MB`. SMS: `SMS_DRIVER=africastalking` with `AT_*` keys (`log` prints to the console).

Website: `API_URL` (how the site server reaches the API), `PUBLIC_API_URL` (photo URLs), `ORIGIN` (the site's public URL), `BODY_SIZE_LIMIT` (form upload size, 64M in the containers).

## Tests

```bash
cd api && npm test                       # 23 end-to-end tests against a real PostGIS database
cd web && node tests/walkthrough.mjs     # 77 checks through the real website (API in DEMO_MODE + website running)
```

The walkthrough browses and filters stock, signs in, saves and compares, sends an enquiry and a reply, reserves and pays a deposit, completes the sale with payout, books and cancels a rental with refund, signs up a new private seller who lists a car with a photo, has an admin approve it, lowers the price, and pauses it. CI runs both on every push and builds the Docker images.

## Project layout

```
api/migrations/        schema (010_galimoto.sql) and makes, models, places (011)
api/demo-photos/       placeholder photos for demo cars
api/src/vehicles/      listings, search with facets, favourites
api/src/orders/        reservations and rentals: state machine, fees, timers
api/src/inquiries/     buyer–seller messages
api/src/sellers/       dealer and private seller accounts
api/src/payments/      PayChangu driver, ledger, webhooks, reconciliation
api/src/admin/         moderation, verification, disputes, payments, users
web/src/routes/        /, /cars, /rent, /cars/[stock], /compare, /favorites, /messages, /orders,
                       /sell, /seller, /seller/cars/*, /admin/*, /how-it-works
```

## Before launch

- [ ] Replace the placeholder photos with real listings (some show number plates, a lodge's branding and people).
- [ ] Real privacy notice and terms (placeholders at `/privacy` and `/terms`); data-protection registration.
- [ ] RBM guidance on holding deposits.
- [ ] S3-compatible storage for photos; production database backups.
- [ ] Final name and logo.
