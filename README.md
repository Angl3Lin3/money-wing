# MoneyWing

A mobile app for sending money from **Canada (CAD)** to **Uganda (UGX)**. Customers pay by card, and the money is delivered to the recipient's **MTN or Airtel Mobile Money** wallet.

This is a fork of the original MoneyWing project. This README explains how to run the app and **everything that has been added since the original version**.

> **Status:** working demo. Customers can sign up, reset a forgotten password, manage recipients, get a quote, create, track, repeat and cancel transfers, get email updates and manage their account. The owner can set the rate and fee and record payouts by hand in the developer area. **Card payment and automatic payouts are not connected yet**, so no real money moves, and the app shows a "Demo version" banner on every screen.

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

2. Create the database and tables (also applies any new database changes; safe to run any time):
   ```bash
   bash backend/scripts/setup-db.sh
   ```

### Starting everything (Mac)

Double-click **`start-dev.command`** in the main folder. It:

1. installs packages if anything changed,
2. creates the database if needed and applies any new database changes,
3. starts the server on `http://localhost:3000`,
4. starts the app and opens it in your browser.

Keep that Terminal window open while you work, and close it to stop everything. Until an email service is set up (see [Emails](#11-emails-and-forgot-password)), emails aren't really sent: signup and reset codes appear in this window as a line starting with 💸, and every email can be read in the developer area's **Emails** tab.

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
  | `CANCELLED` | Cancelled |

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

### 9. Owner controls

In the developer area, so Alex can run the business day to day.

**Rate, fee and limits** (*Owner controls* tab)
- Change the exchange rate, fee and minimum/maximum transfer from a form, with a live preview of what a $100 transfer gives.
- Saved in the database and used by new quotes straight away. The values in `.env` are only the starting defaults until something is saved here.
- Customers already on the review screen are protected by the price lock: if the rate changes, they're shown the new amounts before anything is saved.

**Manual payouts** (*Transfers* tab → tap **Manage** on a transfer)

Until Flutterwave is connected, Alex can send the mobile money himself and record it:

| Button | From status | To status | Needs |
| --- | --- | --- | --- |
| Start sending | Paid | Sending to Uganda | |
| Mark delivered | Paid / Sending / Delivery failed | Delivered | The MTN/Airtel transaction reference |
| Mark failed | Sending to Uganda | Delivery failed | A reason |
| Retry sending | Delivery failed | Sending to Uganda | |
| Cancel transfer | Awaiting payment / Payment processing | Cancelled | |
| Simulate payment *(testing only)* | Awaiting payment / Payment processing | Paid | |

- **Simulate payment** lets you test the payout buttons before Stripe is connected. It's switched off when `NODE_ENV=production`.
- Refunding a paid transfer will come with the Stripe step.
- If two people click at the same time, only the first action goes through.

**Action log**

Every owner action (pricing changes and transfer updates) is saved permanently with who did it and when. It appears under *Recent owner actions* and in each transfer's *History*.

**Database changes:** new `Setting` and `AuditLog` tables and a `CANCELLED` status (`prisma/migrations/20261105230000_owner_controls`). `start-dev.command` applies new database changes automatically every time it starts. Without it, run `bash backend/scripts/setup-db.sh`.

**New endpoints** (all require a developer login): `GET /admin/overview`, `GET /admin/users`, `GET /admin/transactions?status=`, `GET /admin/activity`, `GET /admin/settings`, `PUT /admin/settings/pricing`, `GET /admin/transfer-actions`, `POST /admin/transactions/:id/action`, `GET /admin/audit?targetId=`.

### 10. Customer account extras

**Edit a recipient** (Recipients → **Edit**)
- Fix a name at any time.
- The number and network can be changed only until money has been sent to that person. After that they're locked, so transfer records always show where money actually went. To use a new number, add them as a new recipient.
- Recipients with transfers no longer show a Delete button (deleting them would erase transfer records).

**Your account** (Dashboard → **Your account**)
- See your email, sign-up date, and how many recipients and transfers you have.
- **Change password**: needs the current password; the new one must be at least 8 characters.
- **Log out.**
- **Delete account**: needs the password.
  - If no money ever moved, the account and its data are **deleted**.
  - If the customer has paid transfers, the account is **closed** instead: login is disabled for good, unpaid transfers are cancelled, and the transfer records are kept, because money transfer records must be kept.
  - Closed accounts can't be reopened by signing up again.

**Logins end when an account is gone:** every request now checks that the account still exists and isn't closed, so a deleted or closed account's saved login stops working straight away. *(Changing your password does not yet log out other devices.)*

**New endpoints:** `PUT /transaction/recipients/:id`, `POST /user/change-password`, `POST /user/delete-account`. `GET /user/me` and `GET /transaction/recipients` now include counts.

### 11. Emails and Forgot password

**Emails customers get**

| When | Email |
| --- | --- |
| Signing up / Resend code | 6-digit verification code |
| Forgot password | 6-digit reset code |
| Password changed (from Your account or a reset) | Security alert |
| Transfer created | Receipt with all the amounts |
| Owner marks it **delivered** | "Money delivered", with the mobile money reference |
| Owner marks it **failed** | "Problem with your transfer", with the reason |
| Transfer cancelled | "Transfer cancelled, you haven't been charged" |
| Account deleted / closed | Confirmation |

Each email has the MoneyWing header and a plain-text version. The wording is all in `backend/src/services/email.templates.ts`.

**Sending for real vs. testing**
- **No email service set (the default):** nothing is sent. Codes are printed in the server window, and every email can be read in full in the developer area's **Emails** tab.
- **Email service set** (`SMTP_HOST` etc. in `backend/.env`; see `.env.example` for Gmail, Resend and Mailtrap examples): emails are really sent. The Emails tab then only lists who/what/whether it was sent, never the contents. If the service refuses an email, signup says so instead of silently failing.
- Which service and sender address to use is the **owner's decision**. Sending from the business's own domain (e.g. `hello@moneywingapp.com`) is the most trustworthy, but needs access to the domain's settings.

**Forgot password**
- **Forgot password?** on the login screen → enter email → enter the emailed code and a new password (8+ characters).
- The answer is the same whether or not an account exists, so nobody can use it to check which emails are registered.
- At most one code per minute per account. Codes expire after 10 minutes and work once.

**Code guessing protection:** signup and reset codes stop working after **5 wrong tries** ("Too many wrong tries. Please request a new code."), so a 6-digit code can't be guessed.

### 12. Progress tracker, Send again, Cancel

All on a transfer's screen (Transfer history → tap a transfer).

**Progress tracker**
- Shows the steps **Transfer created → Payment received → Sending to Uganda → Delivered**, with the time of each, and which one it's on now.
- Shows **Delivery problem** (with the reason the owner entered), **Payment failed** or **Cancelled** when that happens. If a failed delivery is retried and succeeds, it ends at Delivered.
- Refreshes by itself every 15 seconds until the transfer is finished.
- Built from the action log: every status change is now recorded with its time, whether it's the owner's buttons, the customer cancelling, or (once connected) Stripe and automatic payouts. Customers never see who on the team made a change.

**Send again**
- Opens Send Money with the same recipient and amount filled in, at **today's** rate.

**Cancel transfer**
- Customers can cancel their own transfer **before paying**: status *Awaiting payment*, or *Payment processing* if no card payment has actually started.
- Once a card payment has started, or the transfer is paid, the button disappears, so nobody can be charged for a cancelled transfer.
- The customer gets a "Transfer cancelled" email, and the cancellation appears in the developer area's action log.

**Also:** automatic payouts (when connected) now email the customer "Money delivered" / "Problem with your transfer", the same as the owner's manual buttons. Payment wording no longer mentions cards ("Payment options are coming soon"), since the payment method is still to be decided.

**New endpoint:** `POST /transaction/:id/cancel`. `GET /transaction/:id` now also returns `timeline`, `canCancel` and `recipientId`.

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
| POST | `/auth/forgot-password` | Email a password reset code (same answer whether or not the account exists) | **New** |
| POST | `/auth/reset-password` | Set a new password with the emailed code | **New** |
| GET | `/user/me` | The logged-in user, with recipient and transfer counts | Changed |
| POST | `/user/change-password` | Change password (needs current password) | **New** |
| POST | `/user/delete-account` | Delete the account, or close it if it has paid transfers | **New** |
| GET | `/transaction/recipients` | List your recipients (newest first) | Changed |
| POST | `/transaction/recipients` | Add a recipient (validates phone and network) | Changed |
| PUT | `/transaction/recipients/:id` | Edit a recipient (number/network locked once money was sent) | **New** |
| DELETE | `/transaction/recipients/:id` | Delete a recipient with no transfers | **New** |
| GET | `/transaction/quote?cadAmount=100` | Fee, rate and UGX for an amount | Changed |
| POST | `/transaction` | Create a transfer (`DRAFT`). Send `expectedUgxAmount` and `expectedFee` for the price lock (returns `409` if they changed) | Changed |
| GET | `/transaction` | List your transfers, newest first. Optional `?limit=20&before=<date>` | **New** |
| GET | `/transaction/:id` | One of your transfers, with its progress timeline and whether it can be cancelled | **New** |
| POST | `/transaction/:id/cancel` | Cancel your own transfer before paying | **New** |
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
| `SMTP_HOST` | For real emails | | Email service's SMTP server. Empty = emails shown in the developer area instead of sent |
| `SMTP_PORT` / `SMTP_SECURE` | | `587` / `false` | Use `465` / `true` for services that require it |
| `SMTP_USER` / `SMTP_PASS` | For real emails | | Email service login (e.g. Gmail address + app password) |
| `EMAIL_FROM` | For real emails | | Sender, e.g. `MoneyWing <hello@yourdomain.com>` |
| `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` | | | Local only: auto-created developer account |
| `STRIPE_SECRET_KEY` | For payments | | Stripe test key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | For payments | | Stripe webhook secret (`whsec_...`) |

The server restarts by itself when you save `.env` or any backend file.

### Demo mode (app)

While MoneyWing isn't live, every screen shows a gold **"Demo version: no real money is sent"** strip, and the dashboard calls the rate a **sample rate**. This is on by default. To turn it off at launch, put `EXPO_PUBLIC_DEMO_MODE=false` in `frontend/.env` (see `frontend/constants/demo.ts`).

The **Developer area** link on the welcome screen only appears while developing, never in a released app.

While in demo mode the welcome screen only lists what the app can do today (card payments are shown as "coming soon").

---

## Project structure

Only the important files are listed. ★ = new.

```
money-wing/
├── start-dev.command            ★ double-click to start everything (Mac)
├── backend/
│   ├── .env.example             ★ settings template
│   ├── scripts/setup-db.sh      ★ creates the database, applies table changes
│   ├── prisma/
│   │   ├── schema.prisma          database tables
│   │   └── migrations/          ★ table changes (init, owner_controls)
│   └── src/
│       ├── index.ts               starts the server (loads .env first)
│       ├── app.ts                 routes, health check, request monitor
│       ├── middleware/
│       │   ├── auth.ts            checks the login (and that the account is open)
│       │   └── admin.ts         ★ developer-area access (ADMIN_EMAILS)
│       ├── routes/
│       │   ├── auth.ts            signup, codes, login
│       │   ├── user.ts            account, change password, delete account
│       │   ├── transaction.ts     recipients, quotes, transfers, history
│       │   ├── admin.ts         ★ developer area + owner controls
│       │   └── webhooks.ts        Stripe callbacks
│       ├── services/
│       │   ├── pricing.service.ts ★ rate, fee, limits (owner-set or defaults), quote maths
│       │   ├── monitor.service.ts ★ recent requests and errors for the Activity tab
│       │   ├── dev-admin.service.ts ★ local developer account from .env
│       │   ├── email.service.ts   ★ sends emails (or keeps them for the Emails tab)
│       │   ├── email.templates.ts ★ the wording of every email
│       │   ├── status-history.service.ts ★ records status changes, builds the progress timeline
│       │   ├── stripe.service.ts
│       │   └── payout.manager.ts  (mock payouts)
│       └── utils/phone.ts       ★ Uganda phone number checks
└── frontend/
    ├── app/                       one file per screen
    │   ├── _layout.tsx            header, fonts, Back/Home buttons
    │   ├── index.tsx              welcome
    │   ├── signup.tsx, otp.tsx
    │   ├── login.tsx            ★
    │   ├── forgot-password.tsx  ★ reset password with an emailed code
    │   ├── dashboard.tsx
    │   ├── recipients.tsx       ★
    │   ├── add-recipient.tsx    ★ add or edit a recipient
    │   ├── send.tsx             ★
    │   ├── review.tsx           ★
    │   ├── transfer/[id].tsx    ★ one transfer's details
    │   ├── history.tsx          ★
    │   ├── profile.tsx          ★ your account, password, delete account
    │   ├── dev-login.tsx        ★ developer area login
    │   ├── dev.tsx              ★ developer area + owner controls
    │   └── api-test.tsx           (now redirects to the developer area)
    ├── components/
    │   ├── ui.tsx               ★ buttons, inputs, cards, text styles
    │   ├── ProgressTracker.tsx  ★ step-by-step transfer progress
    │   ├── Logo.tsx             ★
    │   ├── HeaderNav.tsx        ★ Back and Home buttons
    │   ├── PasswordInput.tsx    ★ Show / Hide
    │   └── RecipientAvatar.tsx  ★
    ├── constants/
    │   ├── theme.ts             ★ colours, fonts, sizes
    │   ├── format.ts            ★ $1,234.50 and 274,400 UGX formatting
    │   ├── networks.ts          ★ MTN/Airtel detection, phone formatting
    │   ├── status.ts            ★ status labels and colours
    │   └── demo.ts              ★ demo mode switch
    └── services/
        ├── api.ts                 all calls to the server
        ├── admin-api.ts         ★ calls for the developer area
        ├── auth-storage.ts      ★ saves the customer and developer logins
        └── alert.ts             ★ popups that work on web and phones
```

---

## How to test

With the app running:

1. **Sign up:** Create account → copy the 💸 code from the Terminal window (or the developer area's **Emails** tab) → Verify. You land on the dashboard.
2. **Stay logged in:** refresh the browser. You're still on the dashboard.
3. **Log out and log in** again.
4. **Recipients:**
   - add `0772 123 456`. MTN is selected automatically.
   - try a duplicate, the wrong network, and `12345`. Each should show an error.
5. **Send money:** pick a recipient and type `100`. Expect a $2.00 fee and **274,400 UGX**. Try `4` and `5000`; both are outside the limits.
6. **Confirm:** Continue → Confirm. You see "Transfer created" and "Awaiting payment".
7. **History:** Dashboard → Transfer history. Your transfer is listed under Today.
8. **Database:** `npx prisma studio` in `backend/` → the **Transaction** table has your transfer with status `DRAFT`.
9. **Edit a recipient:** Recipients → Edit. For someone you've sent money to, the number is locked but the name can change.
10. **Your account:** Dashboard → Your account → change your password, log out, and log in with the new one. Delete a throwaway account to check it's removed.
11. **Developer area:** go to `localhost:8081/dev-login` and log in with your `DEV_ADMIN_EMAIL` account. Check the Overview numbers, run **API checks**, and watch **Activity** while you use the app in another tab.
12. **Owner controls:** change the rate in **Owner controls** and check the Send Money screen uses it. Then, in **Transfers**, tap **Manage** on a transfer: Simulate payment → Start sending → Mark delivered. The customer's history shows **Delivered**, and the action appears in **Recent owner actions**.
13. **Forgot password:** Log in → Forgot password? → enter your email → read the code in the developer area's **Emails** tab → set a new password and log in with it.
14. **Emails:** make a transfer and mark it delivered in Owner controls, then check the **Emails** tab for the receipt and the "Money delivered" email.
15. **Progress tracker:** open a transfer, then in another tab use Owner controls to Simulate payment → Start sending → Mark delivered. The tracker moves along by itself within 15 seconds.
16. **Send again / Cancel:** on an unpaid transfer, tap **Cancel transfer** (it turns to Cancelled and an email appears in the Emails tab). On any transfer, **Send again** opens Send Money already filled in.

---

## Not done yet

- **Card payment** in the app: the backend endpoint exists, but the app's Pay button is disabled. *Next step.*
- **Choosing an email service** for real sending (the owner's decision, ideally from the business's own domain). Everything is built; it only needs the `SMTP_` settings.
- **Real payouts** (Flutterwave). Payouts are simulated.
- **Identity verification (KYC)** before sending. Currently mocked and not enforced.
- **Online hosting** (Heroku or similar) so others can use it without running it locally.
- Legal and compliance work (FINTRAC registration, etc.) is the business owner's responsibility before real money can move.
