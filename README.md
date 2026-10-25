# Nirapod Bank — Digital Banking

A mobile-first digital banking app for Bangladesh with an admin console (reserve, cash desk, approvals, ledger).

## Features

- Splash screen with brand identity
- Login / Register / OTP / Forgot password flows
- Dashboard with balance (hide/show), quick actions, spending chart, recent activity
- Send Money flow: contact search → amount → review → confirmation
- Transaction history with search & filters
- Transaction receipt detail
- Savings goals with progress and contributions
- Profile, security, password change, notification prefs, theme toggle
- Notifications center
- Admin console (append `#admin` to URL): overview, reserve, cash desk, transactions, approvals
- Light & dark themes

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Lucide React icons
- Recharts (spending overview)
- Flask + SQLite backend, React Context

## How money works

1. Customer registers -> admin approves -> customer opens a bank account (admin approves, account number issued) -> optional Visa/Mastercard card.
2. **Reserve** (Admin -> Reserve): the bank generates e-money into a reserve, e.g. ৳500 Cr or ৳1000 Cr. Every addition/removal is logged.
3. **Cash desk** (Admin -> Cash desk): customer hands over cash -> admin finds the customer by phone / account number, enters the amount, confirms -> the amount moves **from the reserve to the customer's wallet**. Cash withdrawal does the reverse. The reserve can never go below zero.
4. Customers can send money to other customers (flat fee, default ৳10, `TRANSFER_FEE`), save into goals, and see their history. Everything is stored on the server in one ledger (`transactions` table) using integer paisa, with atomic updates and idempotent transfers.
5. **Ledger check**: reserve + wallets + savings + fees must always equal the total ever generated. The admin overview shows "Ledger balanced" (or an alert if not).

Optional env vars: `TRANSFER_FEE` (default 10), `MAX_TRANSFER` (default 500000), `MAX_CASH_OP` (default 10000000).

## Getting Started

### Database: Supabase (Postgres) or local SQLite

Set `DATABASE_URL` to your Supabase **Session pooler** connection string and the backend uses Supabase (tables are created automatically, with Row Level Security enabled). Without `DATABASE_URL` it falls back to local SQLite.

```bash
export DATABASE_URL='postgresql://postgres.xxxx:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'
```

If the password has special characters (`@ # / :`) URL-encode them. If you get an SSL certificate error, add `export DB_SSL_INSECURE=1` as a last resort.

### Backend (Flask) — works in Termux, only needs `flask`

```bash
cd backend
pip install flask pg8000   # (or: pip install -r requirements.txt)
export ADMIN_PASSWORD='choose-a-strong-password'   # admin login: admin@nirapod.local
python app.py                                       # http://localhost:5000
```

If you do not set `ADMIN_PASSWORD`, a random one is printed once on first start.

### Frontend (dev)

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api -> localhost:5000)
```

### Production / Render

```bash
npm install && npm run build          # creates dist/
cd backend && gunicorn app:app        # Flask serves dist/ and /api on one origin
```

Set `SECRET_KEY`, `ADMIN_PASSWORD` (and optionally `ADMIN_EMAIL`, `DB_PATH` on a persistent disk) as environment variables.

### Admin

Open the app and append `#admin` to the URL, then log in with the admin email + password.

## Important before real launch

Cards are generated numbers with no payment network behind them, and there is no SMS/email OTP, KYC document check, 2FA or regulatory licence yet. Running a real money service in Bangladesh needs a Bangladesh Bank licence / bank partnership and a security review.

## Project Structure

```
src/
  components/   # UI primitives, BottomNav
  context/      # App state (balance, txns, savings…)
  data/         # Mock users, transactions, helpers
  pages/        # All screens
  App.jsx       # Routing / navigation
  main.jsx
  index.css     # Tailwind + design tokens
```

## Design System

- Primary: Deep Navy (`#102a43`)
- Accent: Emerald Green (`#10b981`)
- Background: Soft off-white / dark navy
- Typography: Inter
- Mobile-first, max-width container, fixed bottom nav


