# MoneyWing

A mobile app for sending money from **Canada (CAD)** to **Uganda (UGX)**. Customers pay by card, and the money is delivered to the recipient's **MTN or Airtel Mobile Money** wallet.

This is a fork of the original MoneyWing project. This README explains how to run the app and **everything that has been added since the original version**.

> **Status:** working demo. You can sign up, add recipients, get a quote, and create a transfer. **Card payment and real payouts are not connected yet**, so no real money moves.

---

## Contents

1. [How the app is built](#how-the-app-is-built)
2. [Running it on your computer](#running-it-on-your-computer)
3. [What's new](#whats-new)
4. [API reference](#api-reference)
5. [Configuration (.env)](#configuration-env)
6. [Project structure](#project-structure)
7. [How to test](#how-to-test)
8. [Not done yet](#not-done-yet)

---

## How the app is built

| Part | Technology | Folder |
| --- | --- | --- |
| App (what users see) | React Native + Expo (runs on iPhone, Android and in a web browser) | `frontend/` |
| Server | Node.js + Express, written in TypeScript | `backend/` |
| Database | PostgreSQL, accessed with Prisma | `backend/prisma/` |

The app never talks to the database directly. It sends requests to the server (for example `POST /auth/login`), and the server does the work and replies.

The original project ran its server on Heroku. **That Heroku server has been deleted**, so for now everything runs locally on your own computer.

---

## Running it on your computer

### What you need

- **Node.js** 18 or newer
- **PostgreSQL**: on a Mac, the easiest option is [Postgres.app](https://postgresapp.com) (open it and click *Initialize*)

### First-time setup

1. Create the backend settings file:
   ```bash
   cd backend
   cp .env.example .env
   ```
   Open `.env` and set:
   - `DATABASE_URL`: with Postgres.app this is `postgresql://YOUR_MAC_USERNAME@localhost:5432/moneywing`
   - `JWT_SECRET`: any long random text (run `openssl rand -hex 32` to make one)

2. Create the database and tables:
   ```bash
   bash backend/scripts/setup-db.sh
   ```

### Starting everything (Mac)

Double-click **`start-dev.command`** in the main folder. It:

1. installs packages if anything changed,
2. sets up the database the first time,
3. starts the server on `http://localhost:3000`,
4. starts the app and opens it in your browser.

Keep that Terminal window open while you work. **Signup codes appear in this window** as a line starting with 💸, because emails aren't sent yet. Close the window to stop everything.

> If macOS says it can't open the file, right-click it → **Open** → **Open** (only needed once).

### Starting everything (Windows / manually)

Use two terminals:

```bash
# Terminal 1: server
cd backend
npm install
npm run dev
```

```bash
# Terminal 2: app
cd frontend
npm install
npx expo start --web
```

### Seeing what's in the database

```bash
cd backend
npx prisma studio
```

This opens a page in your browser showing every table (users, recipients, transactions), where you can view or delete rows.

---

## What's new

### 1. Runs locally again

The original backend could not start on a normal computer.

- **Fixed a startup crash:** settings from `.env` were loaded *after* the code that needed them. They now load first (`backend/src/index.ts`).
- **Stripe keys are optional:** the server used to refuse to start without them. Now it starts and only the payment features are unavailable until keys are added.
- **Health check:** `GET /` answers `{"status":"ok"}`, so the app's API test screen can confirm the server is running.
- **The app points at your computer:** `frontend/app/constants/config.ts` uses `http://localhost:3000` instead of the deleted Heroku server.
- **One-click start and database setup scripts:** `start-dev.command` and `backend/scripts/setup-db.sh`.
- **`.env.example`:** a template listing every setting.

### 2. Accounts and login

- **Login screen.** It used to say "coming soon". Logging in with an account that was never verified sends a new code and opens the verify screen.
- **Stays logged in.** The login token is saved on the device (the phone's secure keychain, or the browser's storage on web) and sent with every request.
- **Skips the welcome screen** when you're already logged in.
- **Log out** button on the dashboard.
- **Resend code** button on the verify screen.
- **Unverified emails can sign up again.** Before, a failed signup locked that email address forever ("already exists").
- **Emails are not case-sensitive** (`Email@Test.com` = `email@test.com`).
- **Safer codes:** 6-digit codes now use a secure random generator.
- **Show / Hide button** on password fields.
- **Error messages show up in the browser.** React Native's popups don't work on web, so errors used to disappear silently.

### 3. Recipients

Screens: **Recipients** (list) and **Add Recipient**.

- Add people in Uganda with a name, mobile number and network (MTN or Airtel).
- **The network is picked automatically** from the phone number as you type, and you can still change it.
- **Phone numbers are checked and tidied.** `0772 123 456`, `772123456` and `+256 772 123 456` are all accepted and saved as `+256772123456`.
- The server rejects invalid numbers, a number that doesn't match the chosen network, and duplicates.
- **Delete** a recipient. Blocked if they already have transfers, because deleting them would also delete those money records.
- **Send** button on each recipient jumps straight to Send Money with them selected.

> ⚠️ **Confirm:** network prefixes are set to MTN = 076/077/078 and Airtel = 070/074/075 in `backend/src/utils/phone.ts`.

### 4. Send money: amount and quote

Screen: **Send Money**.

- Choose a recipient and type an amount in CAD.
- **The quote updates as you type:** fee, amount converted, exchange rate, and exactly how many UGX the recipient gets.
- **Pricing lives in one place:** `backend/src/services/pricing.service.ts`. Before, the rate and fee were copy-pasted in two places.
- **Rate, fee and limits can be changed from `.env`** without editing code (see [Configuration](#configuration-env)).
- **Money maths is done in cents**, so there are no rounding errors like `$1.9999999`. UGX amounts are whole shillings.
- **Amounts are validated:** no letters, negatives, or more than 2 decimals, and the minimum and maximum limits are applied.

> ⚠️ **Confirm:** the rate (2,800 UGX per CAD), fee (2%) and limits ($5 to $3,000) are placeholders.

### 5. Review, confirm and transfer details

Screens: **Review Transfer** and **Transfer**.

- **Review** shows the recipient and all amounts one last time before **Confirm**.
- **Confirm** saves the transfer with status `DRAFT` (created, not paid).
- **Price lock:** if the rate or fee changes between viewing and confirming, nothing is saved. The screen shows the new amounts and asks you to check again.
- **Double-tap protection:** tapping Confirm twice creates only one transfer.
- **Transfer screen:** amount, status, a reference number (e.g. `MW-3F2A9C1B`), date, recipient and price breakdown. A greyed-out **Pay with card** button marks where payment will go.
- **Statuses are shown in plain words:**

  | Database status | Shown to customer |
  | --- | --- |
  | `DRAFT` | Awaiting payment |
  | `PAYMENT_PENDING` | Payment processing |
  | `FUNDED` | Paid |
  | `PAYOUT_PENDING` | Sending to Uganda |
  | `COMPLETED` | Delivered |
  | `PAYOUT_FAILED` | Delivery failed |
  | `FAILED` | Failed |

### 6. Transfer history

Screen: **Transfer History** (from the dashboard).

- Every transfer, newest first, grouped by day (Today, Yesterday, then dates).
- Each row shows the recipient, time, reference, status badge, UGX received and CAD paid.
- Tap a transfer to see its details.
- Loads 20 at a time, with a **Load older transfers** button.

### 7. New look and navigation

- **Official MoneyWing brand**, matching the website:
  - orange `#FC4C02` buttons
  - blue `#004C97` header and accents
  - gold `#FFC72C` accent
  - light grey backgrounds
  - **Carlito** font. The brand font is Calibri, but Calibri can't be bundled into an app, so we use Carlito, a free font made to match it.
  - rounded white cards and labeled inputs
- **MoneyWing logo** on the welcome screen. The wing is used as the app icon and browser tab icon.
- **Home button** (the wing, top right) on every screen.
- **‹ Back button** (top left) whenever there's a previous screen.
- **Dashboard:** greeting, today's exchange rate, a large **Send money** button, and links to Recipients and Transfer history.
- All colours, fonts and sizes live in `frontend/constants/theme.ts`, and shared pieces (buttons, inputs, cards) in `frontend/components/ui.tsx`. New screens should use these so everything stays consistent.

### 8. Developer area

A private area for the team to check how the app is working, separate from the customer app (it has a dark header).

**Getting in**
1. Sign up in the app as normal and verify the account.
2. Add that email to `ADMIN_EMAILS` in `backend/.env`, for example `ADMIN_EMAILS="you@example.com,teammate@example.com"`, and save.
3. Open **Developer area** at the bottom of the welcome screen (only shown while developing), or go to `/dev-login` (e.g. `http://localhost:8081/dev-login`).

**Shortcut for local development:** instead of steps 1–2, set `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` in `backend/.env`. When the server starts it creates that account (already verified) and lets it into the developer area. This only works locally; it's switched off when `NODE_ENV=production`, so a simple password can't protect a real server. Each teammate sets their own in their own `.env`.

Anyone not listed is refused, even with a valid customer account. If `ADMIN_EMAILS` is empty, nobody gets in. The developer login is stored separately from the customer login, so you can be logged into both.

**Tabs** (refresh automatically every 15 seconds):

| Tab | Shows |
| --- | --- |
| Overview | Server and database health, user and transfer counts, paid volume, transfers by status, current rate/fee/limits, and which settings are configured. Secret keys show only "set" or "missing", never their values |
| API checks | Runs the server, login, quotes, recipients and database checks, with response times (replaces the old API test screen) |
| Transfers | Latest transfers from all customers, filterable by status |
| Users | Latest sign-ups with verification status and counts. Passwords are never sent |
| Activity | Requests and server errors in the last hour, average response time, and a live list of recent requests and errors |

The activity log is kept in memory and clears when the server restarts. It never stores request contents, passwords or tokens, and ids in paths are hidden.

**New endpoints** (all require a developer login): `GET /admin/overview`, `GET /admin/users`, `GET /admin/transactions?status=`, `GET /admin/activity`.

---

## API reference

All endpoints except signup, login and the health check need the header `Authorization: Bearer <token>`.

| Method | Endpoint | What it does | New? |
| --- | --- | --- | --- |
| GET | `/` | Health check | **New** |
| POST | `/auth/signup` | Create an account (or restart signup for an unverified email) and send a code | Changed |
| POST | `/auth/resend-otp` | Send a new code | **New** |
| POST | `/auth/verify-otp` | Verify the code; returns a login token | Changed |
| POST | `/auth/login` | Log in; returns a login token | Changed |
| GET | `/user/me` | The logged-in user | |
| GET | `/transaction/recipients` | List your recipients (newest first) | Changed |
| POST | `/transaction/recipients` | Add a recipient (validates phone and network) | Changed |
| DELETE | `/transaction/recipients/:id` | Delete a recipient with no transfers | **New** |
| GET | `/transaction/quote?cadAmount=100` | Fee, rate and UGX for an amount | Changed |
| POST | `/transaction` | Create a transfer (`DRAFT`). Send `expectedUgxAmount` and `expectedFee` for the price lock (returns `409` if they changed) | Changed |
| GET | `/transaction` | List your transfers, newest first. Optional `?limit=20&before=<date>` | **New** |
| GET | `/transaction/:id` | One of your transfers | **New** |
| POST | `/transaction/:id/payment-intent` | Start a Stripe card payment | Not used by the app yet |
| POST | `/webhooks/stripe` | Stripe tells the server a payment succeeded or failed | Not used yet |

---

## Configuration (.env)

The settings file is `backend/.env`. **It holds secrets and is never committed to git.** `backend/.env.example` lists every option.

| Setting | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | | Postgres connection |
| `JWT_SECRET` | Yes | | Signs login tokens. Any long random text |
| `PORT` | | `3000` | Server port |
| `PAYOUT_PROVIDER` | | `mock` | Payout service (only `mock` exists so far) |
| `EXCHANGE_RATE_UGX_PER_CAD` | | `2800` | Exchange rate |
| `FEE_PERCENT` | | `2` | Fee as a percent of the amount |
| `MIN_SEND_CAD` | | `5` | Smallest transfer |
| `MAX_SEND_CAD` | | `3000` | Largest transfer |
| `ADMIN_EMAILS` | For developer area | | Comma-separated emails allowed into the developer area |
| `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` | | | Local only: auto-created developer account |
| `STRIPE_SECRET_KEY` | For payments | | Stripe test key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | For payments | | Stripe webhook secret (`whsec_...`) |

The server restarts by itself when you save `.env` or any backend file.

### Demo mode (app)

While MoneyWing isn't live, every screen shows a gold **"Demo version: no real money is sent"** strip, and the dashboard calls the rate a **sample rate**. This is on by default. To turn it off at launch, put `EXPO_PUBLIC_DEMO_MODE=false` in `frontend/.env` (see `frontend/constants/demo.ts`).

The **Developer area** link on the welcome screen only appears while developing, never in a released app.

---

## Project structure

Only the important files are listed. ★ = new.

```
money-wing/
├── start-dev.command            ★ double-click to start everything (Mac)
├── backend/
│   ├── .env.example             ★ settings template
│   ├── scripts/setup-db.sh      ★ creates the database and tables
│   ├── prisma/
│   │   ├── schema.prisma          database tables
│   │   └── migrations/          ★ table definitions for teammates
│   └── src/
│       ├── index.ts               starts the server (loads .env first)
│       ├── app.ts                 routes + health check
│       ├── routes/
│       │   ├── auth.ts            signup, codes, login
│       │   ├── transaction.ts     recipients, quotes, transfers, history
│       │   └── webhooks.ts        Stripe callbacks
│       ├── services/
│       │   ├── pricing.service.ts ★ rate, fee, limits, quote maths
│       │   ├── stripe.service.ts
│       │   └── payout.manager.ts  (mock payouts)
│       └── utils/phone.ts       ★ Uganda phone number checks
└── frontend/
    ├── app/                       one file per screen
    │   ├── _layout.tsx            header, fonts, Back/Home buttons
    │   ├── index.tsx              welcome
    │   ├── signup.tsx, otp.tsx
    │   ├── login.tsx            ★
    │   ├── dashboard.tsx
    │   ├── recipients.tsx       ★
    │   ├── add-recipient.tsx    ★
    │   ├── send.tsx             ★
    │   ├── review.tsx           ★
    │   ├── transfer/[id].tsx    ★ one transfer's details
    │   └── history.tsx          ★
    ├── components/
    │   ├── ui.tsx               ★ buttons, inputs, cards, text styles
    │   ├── Logo.tsx             ★
    │   ├── HeaderNav.tsx        ★ Back and Home buttons
    │   ├── PasswordInput.tsx    ★ Show / Hide
    │   └── RecipientAvatar.tsx  ★
    ├── constants/
    │   ├── theme.ts             ★ colours, fonts, sizes
    │   ├── format.ts            ★ $1,234.50 and 274,400 UGX formatting
    │   ├── networks.ts          ★ MTN/Airtel detection, phone formatting
    │   └── status.ts            ★ status labels and colours
    └── services/
        ├── api.ts                 all calls to the server
        ├── auth-storage.ts      ★ saves the login token
        └── alert.ts             ★ popups that work on web and phones
```

---

## How to test

With the app running:

1. **Sign up:** Create account → copy the 💸 code from the Terminal window → Verify. You land on the dashboard.
2. **Stay logged in:** refresh the browser. You're still on the dashboard.
3. **Log out and log in** again.
4. **Recipients:**
   - add `0772 123 456`. MTN is selected automatically.
   - try a duplicate, the wrong network, and `12345`. Each should show an error.
5. **Send money:** pick a recipient and type `100`. Expect a $2.00 fee and **274,400 UGX**. Try `4` and `5000`; both are outside the limits.
6. **Confirm:** Continue → Confirm. You see "Transfer created" and "Awaiting payment".
7. **History:** Dashboard → Transfer history. Your transfer is listed under Today.
8. **Database:** `npx prisma studio` in `backend/` → the **Transaction** table has your transfer with status `DRAFT`.

---

## Not done yet

- **Card payment** in the app: the backend endpoint exists, but the app's Pay button is disabled. *Next step.*
- **Real emails** for signup codes. They only appear in the Terminal.
- **Forgot password.**
- **Real payouts** (Flutterwave). Payouts are simulated.
- **Identity verification (KYC)** before sending. Currently mocked and not enforced.
- **Admin screen** for the owner: set the rate, see all transfers, mark manual payouts.
- **Online hosting** (Heroku or similar) so others can use it without running it locally.
- Legal and compliance work (FINTRAC registration, etc.) is the business owner's responsibility before real money can move.
