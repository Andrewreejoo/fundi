# Fundi Malawi

A marketplace for hands-on services in Malawi: customers find, book and pay verified fundis (plumbers, welders, tailors, salon workers, mechanics, carpenters, crafts makers and more) near them, and pay with **Airtel Money** or **TNM Mpamba**, held in **escrow** until the job is done.

This repository contains three apps that share one API:

| Folder | What | Stack |
| --- | --- | --- |
| `api/` | REST API, escrow ledger, payments, timers, admin endpoints | NestJS 10 (TypeScript), PostgreSQL 16 + PostGIS |
| `web/` | Customer website (works on phones), fundi dashboard, admin dashboard | SvelteKit 2 / Svelte 5, server-rendered, works without JavaScript |
| `mobile/` | Android app for customers and fundis, Chichewa first, offline cache | Flutter (Android first; iOS later from the same code) |

The USSD channel is **not built yet** (deliberately deferred). The API is ready for it: bookings already carry a `channel` field and every rule lives server-side.

---

## Put it online (Render, free)

`render.yaml` describes the whole deployment: one free web service (API + website in one container, see `Dockerfile` and `deploy/start.sh`) and one free PostgreSQL database in Frankfurt.

1. Sign in at https://dashboard.render.com with GitHub.
2. **New → Blueprint**, choose this repository, click **Apply**. The first build takes about 5 to 10 minutes.
3. Open the `fundi` service's URL (`https://fundi-xxxx.onrender.com`).

It starts in **demo mode** (`DEMO_MODE=true`): sign-in codes appear on screen, payments are simulated, and 9 demo fundis are loaded. Admin: `0999 000 001`. The Android app uses `https://<that URL>/api` as its `API_URL`.

Free-tier limits: the service sleeps after 15 minutes idle (first visit then takes about a minute), the free database expires after 30 days, and uploaded photos are lost on restart (no disk on the free plan). For real users: a paid instance with a disk or S3 storage, `DEMO_MODE=false`, and SMS + PayChangu keys in the service's Environment tab.

## Quick start (Docker)

```bash
docker compose up --build
docker compose exec api node dist/db/seed.js     # optional: 9 demo fundis (refuses to run in production)
```

- Website: http://localhost:3001
- API: http://localhost:3000/health

By default the compose file runs with **simulated payments** and **SMS codes shown on screen** (`DEV_OTP_ECHO=true`) so you can click through without any accounts. Sign in as admin with `0999 000 001`.

## Quick start (without Docker)

Needs Node 22 and PostgreSQL 16 with PostGIS 3.

```bash
createdb fundi && psql fundi -c "CREATE EXTENSION postgis"

cd api
cp .env.example .env          # then edit, see "Configuration"
npm install
npm run seed                  # migrations + 9 demo fundis in Lilongwe, Blantyre and Mzuzu
npm run dev                   # http://localhost:3000

cd ../web
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## Turning on real (sandbox) mobile money — PayChangu

The API talks to [PayChangu](https://developer.paychangu.com), which connects to both Airtel Money and TNM Mpamba.

1. Create a PayChangu account and copy the **test** secret key from Dashboard → Settings → API & Webhooks.
2. In the same screen, add the webhook URL `https://<your-api-host>/webhooks/paychangu` and copy the webhook secret. (For local testing, expose your API with a tunnel such as `cloudflared tunnel --url http://localhost:3000`.)
3. In `api/.env`:
   ```
   PAYMENTS_DRIVER=paychangu
   PAYCHANGU_SECRET_KEY=<test secret key>
   PAYCHANGU_WEBHOOK_SECRET=<webhook secret>
   ```
4. Pay with PayChangu's sandbox wallets: Airtel `0990000000` (succeeds), `0990000001` (fails); TNM `0899817565` (succeeds), `0899817566` (fails).

Going live = swap in live keys after PayChangu's compliance check. Nothing else changes.

**How money moves** (all in `api/src/payments/`):

- **Collect**: customer approves a PIN prompt on their phone → money lands in Fundi's PayChangu balance → ledger: `cash +total, escrow −job, fee_revenue −protection fee`.
- **Release** (customer confirms, or 48 h after "marked done" with no complaint): payout to the fundi's wallet, less commission.
- **Refund / split**: admin resolves a dispute; the API pays each side its share.
- Every posting is double-entry and must sum to zero, or nothing is written. The admin dashboard shows ledger balances; their sum must always be MWK 0.
- Webhooks are verified (HMAC-SHA256 of the raw body, `Signature` header) and charges are re-checked with PayChangu's verify endpoint before any money is credited. A scheduler also polls pending charges, so a lost webhook never loses a payment.
- Failed payouts are retried up to 5 times with back-off, with a new charge id each time; admins can retry manually.

> **Legal check before going live:** confirm with the Reserve Bank of Malawi whether holding customer funds (escrow) needs a payment-system licence or a trust account with a partner bank. PayChangu does not advertise a native escrow product, so this build holds funds in the merchant balance and tracks ownership in its own ledger.

## SMS (sign-in codes and notifications) — Africa's Talking

`SMS_DRIVER=log` prints messages to the API console. For real SMS set `SMS_DRIVER=africastalking`, `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` and `AT_BASE_URL=https://api.africastalking.com`. SMS is outbound only (two-way SMS is limited in Malawi).

## Configuration

All API settings are in `api/.env.example` with comments. The important ones:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL with PostGIS |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Long random strings. The API refuses to start in production with dev defaults. |
| `ADMIN_PHONES` | Comma-separated numbers that get the admin role on sign-in |
| `DEV_OTP_ECHO` | Shows the SMS code on screen. Development only; refused in production. |
| `COMMISSION_PERCENT` (8), `PROTECTION_FEE_PERCENT` (2), `PROTECTION_FEE_MIN_MWK` (200) | Marketplace economics |
| `ESCROW_DEFAULT_MIN_MWK` (20000) | Escrow is on by default at or above this price |
| `INSTANT_REPLY_HOURS`, `QUOTE_REPLY_HOURS`, `PAY_WINDOW_MINUTES`, `AUTO_CONFIRM_HOURS` | Booking timers |
| `ID_IMAGE_RETENTION_DAYS` (90) | ID photos and selfies are deleted after this; the decision is kept |

Website (`web/.env`): `API_URL` (how the site server reaches the API), `PUBLIC_API_URL` (photo URLs for browsers), `ORIGIN` (the site's own public URL, required by the Node server for form posts).

## Tests

```bash
cd api && npm test                       # 23 end-to-end tests against a real PostGIS database
cd web && node tests/walkthrough.mjs     # 47 checks through the real website (needs API + web running, demo data)
cd mobile && flutter test                # unit tests
```

The API tests cover sign-in (OTP, PIN, refresh rotation, rate limits), provider onboarding and listing moderation, geo search radius widening, instant and quote bookings, escrow collect → confirm → payout with exact fee maths, dispute split 60/40, expiry and auto-confirm timers, provider cancellation refunds, ID verification with private files, webhook signature checks, and that the ledger always balances to zero.

CI (`.github/workflows/ci.yml`) runs all of the above on every push, builds both Docker images, and builds release APKs for Android (download them from the run's **Artifacts**). Set the repository variable `API_URL` to your public API so the APK points at it.

## Mobile app

```bash
cd mobile
./tool/setup_android.sh          # generates android/ and adds permissions (run once)
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000     # emulator → API on your laptop
flutter build apk --release --split-per-abi --dart-define=API_URL=https://api.yourdomain.mw
```

- Phone number + SMS code, then an optional 4-digit PIN. Tokens are kept in Android secure storage.
- Customer mode: categories, area picker (GPS or district → area list), search with filters, provider profiles, booking, Airtel/TNM payment with live status, confirm, rate, report a problem, call the fundi after acceptance.
- Fundi mode: 5-step sign-up (one question per screen with a Listen button), availability toggle, earnings and escrow, accept/decline/quote, start, mark done, add services with photos (resized on the phone), ID + selfie verification.
- Offline: catalog, searches, profiles and bookings are cached; "mark done", "confirm" and ratings made offline are queued and sent when the connection returns.
- Voice prompts: drop recorded Chichewa MP3s into `mobile/assets/audio/` (see the README there).
- Release signing: replace the debug signing config in `android/app/build.gradle` with your upload key before publishing to Play Store.

## Project layout

```
api/
  migrations/            SQL schema + reference data (categories, places)
  src/auth/              OTP, PIN, JWT access/refresh
  src/providers/         onboarding, listings, verification, geo search (PostGIS)
  src/bookings/          state machine (state.ts), fees, actions, timers
  src/payments/          PayChangu driver, double-entry ledger, webhooks, reconciliation
  src/admin/             overview, verification queue, moderation, disputes, users, payouts
  src/scheduler/         minute sweeper: expiries, auto-confirm, payment reconciliation, ID purge
  test/                  end-to-end tests
web/src/routes/          pages: /, /search, /fundi/[id], /book/[id], /bookings, /provider, /become-a-fundi, /admin/*
mobile/lib/              Flutter app (api/, state/, screens/, ui/, l10n/)
```

## Before launch (not done in this build)

- [ ] Native-speaker review of all Chichewa strings (`web/src/lib/i18n.ts`, `mobile/lib/l10n/strings.dart`); add Tumbuka.
- [ ] RBM guidance on escrow; data-protection registration with MACRA, DPIA, DPO; real privacy notice and terms (placeholders at `/privacy`, `/terms`).
- [ ] Production hosting decision under the Data Protection Act's cross-border rule; S3-compatible storage for uploads (currently local disk).
- [ ] USSD channel (next phase), NRB ID checks, Typesense search, iOS build, Redis for USSD sessions.
- [ ] Record the Chichewa voice prompts; replace the app icon.
- [ ] Field-agent tooling beyond the API (`POST /providers` with `forPhone` already lets agents register fundis).
