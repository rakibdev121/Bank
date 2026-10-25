# Nirapod Bank — Digital Banking Demo

A premium, mobile-first digital banking prototype for Bangladesh. Built as a **learning / demo application** using virtual money only.

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
- Admin dashboard (append `#admin` to URL)
- Light & dark themes
- Fully interactive client-side state

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Lucide React icons
- Recharts (spending overview)
- Flask + SQLite backend, React Context

## How it works now (real backend)

1. Customer registers with name, phone, email (Gmail), password -> status **pending**
2. Admin approves in `#admin` -> customer can log in (pending/rejected/suspended users are blocked with a clear message)
3. Customer opens **Cards** -> applies for a bank account (savings/current) -> admin approves -> account number is issued
4. Customer applies for a card (Visa / Mastercard, debit / credit) -> admin approves (sets credit limit for credit cards) -> card is issued

## Getting Started

### Backend (Flask + SQLite) — works in Termux, only needs `flask`

```bash
cd backend
pip install -r requirements.txt
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

## Important

DEMO / LEARNING PROTOTYPE. Card numbers are generated test numbers (no real payment network, no CVV stored).
Send money, savings and demo top-up are still client-side only and are **not saved on the server yet**.

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


