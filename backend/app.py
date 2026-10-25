"""Nirapod Bank backend (Flask + SQLite).

Flow:
  customer registers  -> status 'pending'
  admin approves      -> customer can log in
  customer applies for a bank account -> admin approves -> account number active
  customer applies for a card (Visa / Mastercard, debit / credit) -> admin approves -> card issued

DEMO / LEARNING PROJECT: card numbers are generated test numbers, no real
payment network, no real money.
"""
import os
import re
import random
import secrets
import sqlite3
import ssl
import time
from urllib.parse import unquote, urlparse
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import wraps

from flask import Flask, g, jsonify, request, send_from_directory
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "nirapod.db"))
DATABASE_URL = os.environ.get("DATABASE_URL")  # Supabase/Postgres; if unset, local SQLite is used
USE_PG = bool(DATABASE_URL)
DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "dist"))
TOKEN_MAX_AGE = 60 * 60 * 12  # 12 hours
HASH_METHOD = "pbkdf2:sha256:600000"


def _load_secret():
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    path = os.path.join(BASE_DIR if USE_PG else os.path.dirname(DB_PATH), ".secret_key")
    if os.path.exists(path):
        return open(path).read().strip()
    key = secrets.token_hex(32)
    with open(path, "w") as f:
        f.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
serializer = URLSafeTimedSerializer(_load_secret(), salt="nirapod-auth")

# ------------------------------------------------------------------ database
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | suspended
  reason TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_type TEXT NOT NULL,               -- savings | current
  account_number TEXT UNIQUE,
  balance_paisa BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  reason TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  network TEXT NOT NULL,                    -- visa | mastercard
  card_type TEXT NOT NULL,                  -- debit | credit
  number TEXT,
  expiry TEXT,
  holder TEXT NOT NULL,
  credit_limit_paisa BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | blocked
  reason TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reserve (
  id INTEGER PRIMARY KEY,
  balance_paisa BIGINT NOT NULL DEFAULT 0,
  fees_paisa BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,                       -- cash_in | cash_out | transfer | savings_in | savings_out | reserve_add | reserve_remove
  from_account_id INTEGER REFERENCES accounts(id),
  to_account_id INTEGER REFERENCES accounts(id),
  amount_paisa BIGINT NOT NULL,
  fee_paisa BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  admin_id INTEGER,
  idem_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_paisa BIGINT NOT NULL,
  saved_paisa BIGINT NOT NULL DEFAULT 0,
  deadline TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS txn_from_idx ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS txn_to_idx ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS txn_created_idx ON transactions(created_at);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_account ON accounts(user_id) WHERE status IN ('pending','approved');
CREATE UNIQUE INDEX IF NOT EXISTS one_open_card ON cards(user_id, network, card_type) WHERE status IN ('pending','approved');
"""

# Supabase exposes public tables through its REST API. RLS on + no policies = that API
# cannot read these tables; this server connects directly and is not affected.
RLS = [f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY" for t in ("users", "accounts", "cards", "audit", "reserve", "transactions", "savings_goals", "notifications")]


class Row(dict):
    """dict that also supports row[0], like sqlite3.Row."""

    def __getitem__(self, k):
        return list(self.values())[k] if isinstance(k, int) else super().__getitem__(k)


class Cursor:
    def __init__(self, cur):
        self.cur = cur

    def _rows(self, raw):
        names = [c[0] for c in self.cur.description]
        return [Row(zip(names, r)) for r in raw]

    @property
    def rowcount(self):
        return self.cur.rowcount

    def fetchone(self):
        raw = self.cur.fetchone()
        return self._rows([raw])[0] if raw else None

    def fetchall(self):
        return self._rows(self.cur.fetchall())


class DB:
    """Same tiny interface for SQLite and Postgres (pg8000): execute / commit / rollback / close."""

    def __init__(self):
        if USE_PG:
            import pg8000.dbapi

            u = urlparse(DATABASE_URL)
            ctx = ssl.create_default_context()
            if os.environ.get("DB_SSL_INSECURE") == "1":  # only if certificate verification fails
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
            self.conn = pg8000.dbapi.connect(
                user=unquote(u.username or ""), password=unquote(u.password or ""),
                host=u.hostname, port=u.port or 5432,
                database=(u.path or "/postgres").lstrip("/") or "postgres", ssl_context=ctx,
            )
        else:
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql, args=()):
        cur = self.conn.cursor()
        if USE_PG:
            sql = sql.replace("?", "%s")
        cur.execute(sql, tuple(args))
        return Cursor(cur)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def is_unique_violation(exc):
    if isinstance(exc, sqlite3.IntegrityError):
        return True
    if USE_PG and exc.args and isinstance(exc.args[0], dict):
        return exc.args[0].get("C") == "23505"
    return False


def get_db():
    if "db" not in g:
        g.db = DB()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db():
    if not USE_PG:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = DB()
    schema = SCHEMA.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY") if USE_PG else SCHEMA
    for stmt in [x.strip() for x in schema.split(";") if x.strip()] + (RLS if USE_PG else []):
        db.execute(stmt)
    db.commit()
    if not db.execute("SELECT 1 FROM reserve WHERE id=1").fetchone():
        db.execute("INSERT INTO reserve (id, balance_paisa, fees_paisa) VALUES (1, 0, 0)")
        db.commit()
    has_admin = db.execute("SELECT 1 FROM users WHERE role='admin'").fetchone()
    if not has_admin:
        email = os.environ.get("ADMIN_EMAIL", "admin@nirapod.local").lower()
        phone = os.environ.get("ADMIN_PHONE", "+8801700000000")
        password = os.environ.get("ADMIN_PASSWORD")
        generated = False
        if not password:
            password = secrets.token_urlsafe(10)
            generated = True
        db.execute(
            "INSERT INTO users (name, phone, email, password_hash, role, status, created_at, decided_at)"
            " VALUES (?,?,?,?, 'admin', 'approved', ?, ?)",
            ("Nirapod Admin", phone, email, generate_password_hash(password, method=HASH_METHOD), now(), now()),
        )
        db.commit()
        print("=" * 60)
        print(f"Admin created -> login: {email}")
        if generated:
            print(f"Generated admin password (shown once): {password}")
            print("Set ADMIN_PASSWORD to choose your own.")
        print("=" * 60)
    db.close()
    print("Database:", "Postgres (Supabase)" if USE_PG else f"SQLite ({DB_PATH})")


# ------------------------------------------------------------------- helpers
PHONE_RE = re.compile(r"^(?:\+?88)?(01[3-9]\d{8})$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
DUMMY_HASH = generate_password_hash("dummy-password", method=HASH_METHOD)


def normalize_phone(raw):
    digits = re.sub(r"[\s\-()]", "", raw or "")
    m = PHONE_RE.match(digits)
    return "+88" + m.group(1) if m else None


def err(message, status=400, code=None):
    body = {"error": message}
    if code:
        body["code"] = code
    return jsonify(body), status


def body():
    return request.get_json(silent=True) or {}


def public_user(u):
    return {
        "id": u["id"],
        "name": u["name"],
        "phone": u["phone"],
        "email": u["email"],
        "role": u["role"],
        "status": u["status"],
        "memberSince": u["created_at"][:10],
    }


def public_account(a):
    return {
        "id": a["id"],
        "accountType": a["account_type"],
        "accountNumber": a["account_number"] if a["status"] == "approved" else None,
        "balance": a["balance_paisa"] / 100,
        "status": a["status"],
        "reason": a["reason"],
        "createdAt": a["created_at"],
    }


def mask(number):
    return f"**** **** **** {number[-4:]}" if number else None


def public_card(c):
    return {
        "id": c["id"],
        "network": c["network"],
        "cardType": c["card_type"],
        "numberMasked": mask(c["number"]) if c["status"] in ("approved", "blocked") else None,
        "expiry": c["expiry"] if c["status"] in ("approved", "blocked") else None,
        "holder": c["holder"],
        "creditLimit": c["credit_limit_paisa"] / 100,
        "status": c["status"],
        "reason": c["reason"],
        "createdAt": c["created_at"],
    }


def luhn_complete(prefix, length=16):
    digits = [int(d) for d in prefix] + [random.SystemRandom().randrange(10) for _ in range(length - len(prefix) - 1)]
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 0:  # position of the (future) check digit's neighbour
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return "".join(map(str, digits)) + str((10 - total % 10) % 10)


def new_card_number(network, db):
    prefix = "400000" if network == "visa" else "555555"
    while True:
        n = luhn_complete(prefix)
        if not db.execute("SELECT 1 FROM cards WHERE number=?", (n,)).fetchone():
            return n


def new_account_number(db):
    r = random.SystemRandom()
    while True:
        n = "NIR-{:04d}-{:04d}-{:04d}".format(r.randrange(10000), r.randrange(10000), r.randrange(10000))
        if not db.execute("SELECT 1 FROM accounts WHERE account_number=?", (n,)).fetchone():
            return n


# -------------------------------------------------------------- auth plumbing
FAILED = {}  # key -> (count, first_ts)
MAX_FAILS, LOCK_SECONDS = 5, 300


def locked(key):
    rec = FAILED.get(key)
    if not rec:
        return False
    count, ts = rec
    if time.time() - ts > LOCK_SECONDS:
        FAILED.pop(key, None)
        return False
    return count >= MAX_FAILS


def record_fail(key):
    count, ts = FAILED.get(key, (0, time.time()))
    FAILED[key] = (count + 1, ts)


def auth_required(roles=("customer", "admin")):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return err("Please log in", 401, "no_token")
            try:
                data = serializer.loads(header[7:], max_age=TOKEN_MAX_AGE)
            except SignatureExpired:
                return err("Session expired, please log in again", 401, "expired")
            except BadSignature:
                return err("Invalid session", 401, "bad_token")
            user = get_db().execute("SELECT * FROM users WHERE id=?", (data.get("uid"),)).fetchone()
            if not user or user["status"] != "approved":
                return err("Account is not active", 401, "inactive")
            if user["role"] not in roles:
                return err("Not allowed", 403, "forbidden")
            g.user = user
            return fn(*a, **kw)

        return wrapper

    return deco


# ---------------------------------------------------------------- auth routes
@app.post("/api/auth/register")
def register():
    d = body()
    name = (d.get("name") or "").strip()
    phone = normalize_phone(d.get("phone"))
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    if not 2 <= len(name) <= 60:
        return err("Enter your full name")
    if not phone:
        return err("Enter a valid Bangladeshi mobile number (01XXXXXXXXX)")
    if not EMAIL_RE.match(email) or len(email) > 120:
        return err("Enter a valid email address")
    if len(password) < 8 or len(password) > 128:
        return err("Password must be 8–128 characters")
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (name, phone, email, password_hash, created_at) VALUES (?,?,?,?,?)",
            (name, phone, email, generate_password_hash(password, method=HASH_METHOD), now()),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        if is_unique_violation(e):
            return err("This phone number or email is already registered", 409)
        raise
    return jsonify({"ok": True, "status": "pending",
                    "message": "Registration received. You can log in after an admin approves your account."}), 201


@app.post("/api/auth/login")
def login():
    d = body()
    ident = (d.get("identifier") or "").strip()
    password = d.get("password") or ""
    if not ident or not password:
        return err("Enter your phone/email and password")
    key = f"{ident.lower()}|{request.remote_addr}"
    if locked(key):
        return err("Too many failed attempts. Try again in a few minutes.", 429, "locked")
    phone = normalize_phone(ident)
    row = get_db().execute(
        "SELECT * FROM users WHERE email=? OR phone=?", (ident.lower(), phone or "-")
    ).fetchone()
    ok = check_password_hash(row["password_hash"] if row else DUMMY_HASH, password)
    if not row or not ok:
        record_fail(key)
        return err("Wrong phone/email or password", 401)
    FAILED.pop(key, None)
    # Status is revealed only after the password is proven correct.
    if row["status"] == "pending":
        return err("Your account is waiting for admin approval. Please try again later.", 403, "pending")
    if row["status"] == "rejected":
        return err("Your registration was not approved." + (f" Reason: {row['reason']}" if row["reason"] else ""), 403, "rejected")
    if row["status"] == "suspended":
        return err("Your account is suspended. Contact support.", 403, "suspended")
    token = serializer.dumps({"uid": row["id"]})
    return jsonify({"token": token, "user": public_user(row)})


@app.get("/api/me")
@auth_required()
def me():
    db = get_db()
    accounts = db.execute("SELECT * FROM accounts WHERE user_id=? ORDER BY id DESC", (g.user["id"],)).fetchall()
    cards = db.execute("SELECT * FROM cards WHERE user_id=? ORDER BY id DESC", (g.user["id"],)).fetchall()
    return jsonify({
        "user": public_user(g.user),
        "accounts": [public_account(a) for a in accounts],
        "cards": [public_card(c) for c in cards],
        "config": {"transferFee": taka(TRANSFER_FEE_PAISA), "maxTransfer": taka(MAX_TRANSFER_PAISA)},
    })


@app.post("/api/me/password")
@auth_required()
def change_password():
    d = body()
    if not check_password_hash(g.user["password_hash"], d.get("current") or ""):
        return err("Current password is wrong", 400)
    new = d.get("new") or ""
    if len(new) < 8 or len(new) > 128:
        return err("New password must be 8–128 characters")
    db = get_db()
    db.execute("UPDATE users SET password_hash=? WHERE id=?",
               (generate_password_hash(new, method=HASH_METHOD), g.user["id"]))
    db.commit()
    return jsonify({"ok": True})


# ------------------------------------------------------- customer: account/card
@app.post("/api/accounts/apply")
@auth_required(("customer",))
def apply_account():
    kind = (body().get("accountType") or "").lower()
    if kind not in ("savings", "current"):
        return err("Choose savings or current account")
    db = get_db()
    open_one = db.execute(
        "SELECT 1 FROM accounts WHERE user_id=? AND status IN ('pending','approved')", (g.user["id"],)
    ).fetchone()
    if open_one:
        return err("You already have an account or a pending application", 409)
    try:
        db.execute("INSERT INTO accounts (user_id, account_type, created_at) VALUES (?,?,?)",
                   (g.user["id"], kind, now()))
        db.commit()
    except Exception as e:
        db.rollback()
        if is_unique_violation(e):
            return err("You already have an account or a pending application", 409)
        raise
    return jsonify({"ok": True, "message": "Application submitted. An admin will review it."}), 201


@app.post("/api/cards/apply")
@auth_required(("customer",))
def apply_card():
    d = body()
    network = (d.get("network") or "").lower()
    ctype = (d.get("cardType") or "").lower()
    if network not in ("visa", "mastercard") or ctype not in ("debit", "credit"):
        return err("Choose Visa or Mastercard, and debit or credit")
    db = get_db()
    acc = db.execute("SELECT * FROM accounts WHERE user_id=? AND status='approved'", (g.user["id"],)).fetchone()
    if not acc:
        return err("You need an approved bank account before applying for a card", 409, "no_account")
    dup = db.execute(
        "SELECT 1 FROM cards WHERE user_id=? AND network=? AND card_type=? AND status IN ('pending','approved')",
        (g.user["id"], network, ctype),
    ).fetchone()
    if dup:
        return err("You already have this card or a pending application for it", 409)
    try:
        db.execute(
            "INSERT INTO cards (user_id, account_id, network, card_type, holder, created_at) VALUES (?,?,?,?,?,?)",
            (g.user["id"], acc["id"], network, ctype, g.user["name"].upper()[:26], now()),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        if is_unique_violation(e):
            return err("You already have this card or a pending application for it", 409)
        raise
    return jsonify({"ok": True, "message": "Card application submitted."}), 201


@app.get("/api/cards/<int:card_id>/reveal")
@auth_required(("customer",))
def reveal_card(card_id):
    c = get_db().execute(
        "SELECT * FROM cards WHERE id=? AND user_id=? AND status='approved'", (card_id, g.user["id"])
    ).fetchone()
    if not c:
        return err("Card not found", 404)
    return jsonify({"number": " ".join(c["number"][i:i + 4] for i in range(0, 16, 4))})


# ------------------------------------------------------------------- admin
def audit(action, target):
    get_db().execute("INSERT INTO audit (admin_id, action, target, at) VALUES (?,?,?,?)",
                     (g.user["id"], action, target, now()))


@app.get("/api/admin/users")
@auth_required(("admin",))
def admin_users():
    status = request.args.get("status")
    sql, args = "SELECT * FROM users WHERE role='customer'", []
    if status:
        sql += " AND status=?"
        args.append(status)
    rows = get_db().execute(sql + " ORDER BY id DESC", args).fetchall()
    return jsonify([{**public_user(u), "reason": u["reason"], "createdAt": u["created_at"]} for u in rows])


def decide(table, row_id, new_status, reason=None, extra=None, allowed_from=("pending",)):
    db = get_db()
    row = db.execute(f"SELECT * FROM {table} WHERE id=?", (row_id,)).fetchone()
    if not row:
        return None, err("Not found", 404)
    if row["status"] not in allowed_from:
        return None, err(f"Already {row['status']}", 409)
    sets, args = ["status=?", "reason=?", "decided_at=?"], [new_status, reason, now()]
    for k, v in (extra or {}).items():
        sets.append(f"{k}=?")
        args.append(v)
    db.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE id=?", (*args, row_id))
    return row, None


@app.post("/api/admin/users/<int:uid>/<action>")
@auth_required(("admin",))
def admin_user_action(uid, action):
    db = get_db()
    target = db.execute("SELECT role FROM users WHERE id=?", (uid,)).fetchone()
    if not target or target["role"] != "customer":
        return err("Not found", 404)
    reason = (body().get("reason") or "").strip()[:200] or None
    plan = {
        "approve": ("approved", ("pending", "rejected", "suspended")),
        "reject": ("rejected", ("pending",)),
        "suspend": ("suspended", ("approved",)),
    }.get(action)
    if not plan:
        return err("Unknown action", 404)
    _, e = decide("users", uid, plan[0], reason if action != "approve" else None, allowed_from=plan[1])
    if e:
        return e
    audit(f"user.{action}", f"user:{uid}")
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/accounts")
@auth_required(("admin",))
def admin_accounts():
    status = request.args.get("status")
    sql = ("SELECT a.*, u.name, u.phone FROM accounts a JOIN users u ON u.id=a.user_id"
           + (" WHERE a.status=?" if status else "") + " ORDER BY a.id DESC")
    rows = get_db().execute(sql, (status,) if status else ()).fetchall()
    return jsonify([{**public_account(a), "accountNumber": a["account_number"],
                     "customer": a["name"], "phone": a["phone"]} for a in rows])


@app.post("/api/admin/accounts/<int:aid>/<action>")
@auth_required(("admin",))
def admin_account_action(aid, action):
    db = get_db()
    if action == "approve":
        _, e = decide("accounts", aid, "approved", extra={"account_number": new_account_number(db)})
    elif action == "reject":
        _, e = decide("accounts", aid, "rejected", (body().get("reason") or "").strip()[:200] or None)
    else:
        return err("Unknown action", 404)
    if e:
        return e
    audit(f"account.{action}", f"account:{aid}")
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/cards")
@auth_required(("admin",))
def admin_cards():
    status = request.args.get("status")
    sql = ("SELECT c.*, u.name AS customer, u.phone FROM cards c JOIN users u ON u.id=c.user_id"
           + (" WHERE c.status=?" if status else "") + " ORDER BY c.id DESC")
    rows = get_db().execute(sql, (status,) if status else ()).fetchall()
    return jsonify([{**public_card(c), "customer": c["customer"], "phone": c["phone"]} for c in rows])


@app.post("/api/admin/cards/<int:cid>/<action>")
@auth_required(("admin",))
def admin_card_action(cid, action):
    db = get_db()
    d = body()
    card = db.execute("SELECT * FROM cards WHERE id=?", (cid,)).fetchone()
    if not card:
        return err("Not found", 404)
    if action == "approve":
        limit = 0
        if card["card_type"] == "credit":
            try:
                limit = int(round(float(d.get("creditLimit", 50000)) * 100))
            except (TypeError, ValueError):
                return err("Invalid credit limit")
            if not 0 < limit <= 10_000_000_00:
                return err("Credit limit must be between 1 and 10,000,000")
        expiry = datetime.now(timezone.utc)
        exp = f"{expiry.month:02d}/{(expiry.year + 4) % 100:02d}"
        _, e = decide("cards", cid, "approved",
                      extra={"number": new_card_number(card["network"], db), "expiry": exp, "credit_limit_paisa": limit})
    elif action == "reject":
        _, e = decide("cards", cid, "rejected", (d.get("reason") or "").strip()[:200] or None)
    elif action == "block":
        _, e = decide("cards", cid, "blocked", (d.get("reason") or "").strip()[:200] or None, allowed_from=("approved",))
    else:
        return err("Unknown action", 404)
    if e:
        return e
    audit(f"card.{action}", f"card:{cid}")
    db.commit()
    return jsonify({"ok": True})


# ======================================================= money: ledger core
TRANSFER_FEE_PAISA = int(float(os.environ.get("TRANSFER_FEE", "10")) * 100)  # flat fee per transfer (BDT)
MAX_TRANSFER_PAISA = int(float(os.environ.get("MAX_TRANSFER", "500000")) * 100)
MAX_CASH_PAISA = int(float(os.environ.get("MAX_CASH_OP", "10000000")) * 100)
MAX_RESERVE_OP_PAISA = 10**14  # BDT 1 trillion per reserve operation


class TxnError(Exception):
    def __init__(self, msg, status=400, code=None):
        super().__init__(msg)
        self.msg, self.status, self.code = msg, status, code


def to_paisa(value, cap):
    """Parse a BDT amount (max 2 decimals, > 0, <= cap) into integer paisa, or None."""
    try:
        d = Decimal(str(value).strip())
        if not d.is_finite() or d <= 0 or d != d.quantize(Decimal("0.01")):
            return None
        p = int(d * 100)
    except Exception:
        return None
    return p if 0 < p <= cap else None


def taka(paisa):
    return int(paisa or 0) / 100


def new_ref():
    return "NIR-TXN-" + datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + secrets.token_hex(4).upper()


def apply_money(db, deltas=(), reserve=0, fee=0):
    """Move money atomically (caller commits). deltas: [(account_id, +/-paisa)].
    Accounts are locked in id order (no deadlocks); debits and the reserve can never go negative."""
    for acc_id, delta in sorted(deltas):
        if delta < 0:
            c = db.execute(
                "UPDATE accounts SET balance_paisa=balance_paisa-? WHERE id=? AND status='approved' AND balance_paisa>=?",
                (-delta, acc_id, -delta))
            if c.rowcount != 1:
                raise TxnError("Insufficient balance", 409, "insufficient")
        elif delta > 0:
            c = db.execute("UPDATE accounts SET balance_paisa=balance_paisa+? WHERE id=? AND status='approved'",
                           (delta, acc_id))
            if c.rowcount != 1:
                raise TxnError("Account is not active", 409, "inactive")
    if reserve or fee:
        c = db.execute(
            "UPDATE reserve SET balance_paisa=balance_paisa+?, fees_paisa=fees_paisa+? WHERE id=1 AND balance_paisa+? >= 0",
            (reserve, fee, reserve))
        if c.rowcount != 1:
            raise TxnError("Reserve balance is not enough for this operation", 409, "reserve_low")


def log_txn(db, kind, amount, from_acc=None, to_acc=None, fee=0, note=None, admin_id=None, idem=None):
    ref = new_ref()
    db.execute(
        "INSERT INTO transactions (reference, kind, from_account_id, to_account_id, amount_paisa, fee_paisa,"
        " note, admin_id, idem_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (ref, kind, from_acc, to_acc, amount, fee, note, admin_id, idem, now()))
    return db.execute(TXN_SELECT + " WHERE t.reference=?", (ref,)).fetchone()


def notify(db, user_id, ntype, title, text):
    db.execute("INSERT INTO notifications (user_id, type, title, body, created_at) VALUES (?,?,?,?,?)",
               (user_id, ntype, title, text, now()))


def bdt(paisa):
    return f"৳{paisa / 100:,.2f}"


def guarded(fn):
    """Run a money operation: commit on success, roll back + clean error on TxnError."""
    @wraps(fn)
    def wrapper(*a, **kw):
        db = get_db()
        try:
            res = fn(*a, **kw)
            db.commit()
            return res
        except TxnError as e:
            db.rollback()
            return err(e.msg, e.status, e.code)
        except Exception:
            db.rollback()
            raise
    return wrapper


TXN_SELECT = """SELECT t.*,
  fa.user_id AS from_uid, fu.name AS from_name, fu.phone AS from_phone, fa.account_number AS from_acc_no,
  ta.user_id AS to_uid, tu.name AS to_name, tu.phone AS to_phone, ta.account_number AS to_acc_no,
  au.name AS admin_name
FROM transactions t
LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN users fu ON fu.id=fa.user_id
LEFT JOIN accounts ta ON ta.id=t.to_account_id LEFT JOIN users tu ON tu.id=ta.user_id
LEFT JOIN users au ON au.id=t.admin_id"""

KIND_TITLES = {
    "cash_in": "Cash Deposit", "cash_out": "Cash Withdrawal", "transfer": "Send Money",
    "savings_in": "Savings Contribution", "savings_out": "Savings Withdrawal",
    "reserve_add": "Reserve Added", "reserve_remove": "Reserve Removed",
}


def customer_txn(t, acc_id):
    out = t["from_account_id"] == acc_id
    kind = t["kind"]
    title, party, phone, category = KIND_TITLES.get(kind, kind), "Nirapod Bank", None, kind
    if kind in ("cash_in", "cash_out"):
        party, category = "Nirapod Bank · Cash counter", "deposit" if kind == "cash_in" else "withdrawal"
    elif kind == "transfer":
        category = "transfer"
        title, party, phone = ("Send Money", t["to_name"], t["to_phone"]) if out else ("Money Received", t["from_name"], t["from_phone"])
    elif kind in ("savings_in", "savings_out"):
        party, category = t["note"] or "Savings goal", "savings"
    return {
        "id": t["id"], "reference": t["reference"], "type": "sent" if out else "received",
        "kind": kind, "title": title, "counterparty": party, "counterpartyPhone": phone,
        "amount": taka(t["amount_paisa"]), "fee": taka(t["fee_paisa"]) if out else 0,
        "date": t["created_at"], "status": "completed", "category": category,
        "note": t["note"] if kind == "transfer" else "",
    }


def admin_txn(t):
    return {
        "id": t["id"], "reference": t["reference"], "kind": t["kind"], "title": KIND_TITLES.get(t["kind"], t["kind"]),
        "amount": taka(t["amount_paisa"]), "fee": taka(t["fee_paisa"]), "note": t["note"],
        "from": t["from_name"], "fromAccount": t["from_acc_no"], "to": t["to_name"], "toAccount": t["to_acc_no"],
        "admin": t["admin_name"], "date": t["created_at"],
    }


def my_account(db, user_id):
    return db.execute("SELECT * FROM accounts WHERE user_id=? AND status='approved'", (user_id,)).fetchone()


def mask_name(name):
    parts = name.split()
    return " ".join([parts[0]] + [p[0] + "***" for p in parts[1:]]) if parts else name


def find_active_account(db, q):
    """Find an approved account of an approved customer by phone, account number or email."""
    q = (q or "").strip()
    if not q:
        return None
    phone = normalize_phone(q)
    return db.execute(
        "SELECT a.*, u.name AS name, u.phone AS phone, u.email AS email FROM accounts a JOIN users u ON u.id=a.user_id"
        " WHERE a.status='approved' AND u.status='approved' AND u.role='customer'"
        " AND (a.account_number=? OR u.phone=? OR u.email=?)",
        (q.upper(), phone or "-", q.lower())).fetchone()


# ------------------------------------------------------- customer: money APIs
@app.get("/api/config")
def public_config():
    return jsonify({"transferFee": taka(TRANSFER_FEE_PAISA), "maxTransfer": taka(MAX_TRANSFER_PAISA)})


@app.get("/api/transactions")
@auth_required(("customer",))
def my_transactions():
    db = get_db()
    acc = my_account(db, g.user["id"])
    if not acc:
        return jsonify([])
    rows = db.execute(TXN_SELECT + " WHERE t.from_account_id=? OR t.to_account_id=? ORDER BY t.id DESC LIMIT 200",
                      (acc["id"], acc["id"])).fetchall()
    return jsonify([customer_txn(r, acc["id"]) for r in rows])


@app.get("/api/recipients/lookup")
@auth_required(("customer",))
def lookup_recipient():
    db = get_db()
    rec = find_active_account(db, request.args.get("q"))
    if not rec or rec["user_id"] == g.user["id"]:
        return err("No active account found for this phone / account number", 404)
    return jsonify({"name": mask_name(rec["name"]), "phone": rec["phone"], "accountNumber": rec["account_number"]})


@app.post("/api/transfer")
@auth_required(("customer",))
@guarded
def transfer():
    d = body()
    db = get_db()
    amount = to_paisa(d.get("amount"), MAX_TRANSFER_PAISA)
    if not amount:
        return err(f"Enter an amount between ৳1 and {bdt(MAX_TRANSFER_PAISA)} (max 2 decimals)")
    note = (d.get("note") or "").strip()[:80] or None
    idem = f"{g.user['id']}:{str(d.get('requestId') or '')[:64]}" if d.get("requestId") else None
    if idem:
        dup = db.execute(TXN_SELECT + " WHERE t.idem_key=?", (idem,)).fetchone()
        if dup:  # same request sent twice (double tap / retry): return the original, move nothing
            return jsonify({"ok": True, "transaction": customer_txn(dup, dup["from_account_id"])})
    sender = my_account(db, g.user["id"])
    if not sender:
        raise TxnError("You need an approved bank account first", 409, "no_account")
    rec = find_active_account(db, d.get("to"))
    if not rec:
        raise TxnError("Recipient not found or account not active", 404)
    if rec["id"] == sender["id"]:
        raise TxnError("You cannot send money to yourself")
    fee = TRANSFER_FEE_PAISA
    apply_money(db, [(sender["id"], -(amount + fee)), (rec["id"], amount)], fee=fee)
    t = log_txn(db, "transfer", amount, sender["id"], rec["id"], fee, note, idem=idem)
    notify(db, g.user["id"], "transaction", "Transfer Successful", f"{bdt(amount)} sent to {rec['name']}")
    notify(db, rec["user_id"], "transaction", "Money Received", f"You received {bdt(amount)} from {g.user['name']}")
    return jsonify({"ok": True, "transaction": customer_txn(t, sender["id"])}), 201


def goal_json(r):
    return {"id": r["id"], "name": r["name"], "target": taka(r["target_paisa"]), "saved": taka(r["saved_paisa"]),
            "deadline": r["deadline"]}


@app.get("/api/savings")
@auth_required(("customer",))
def list_goals():
    rows = get_db().execute("SELECT * FROM savings_goals WHERE user_id=? ORDER BY id DESC", (g.user["id"],)).fetchall()
    return jsonify([goal_json(r) for r in rows])


@app.post("/api/savings")
@auth_required(("customer",))
def create_goal():
    d = body()
    name = (d.get("name") or "").strip()[:40]
    target = to_paisa(d.get("target"), MAX_RESERVE_OP_PAISA)
    deadline = (d.get("deadline") or "").strip()[:10] or None
    if len(name) < 2 or not target:
        return err("Enter a goal name and a valid target amount")
    db = get_db()
    db.execute("INSERT INTO savings_goals (user_id, name, target_paisa, deadline, created_at) VALUES (?,?,?,?,?)",
               (g.user["id"], name, target, deadline, now()))
    db.commit()
    return jsonify({"ok": True}), 201


@app.post("/api/savings/<int:gid>/<action>")
@auth_required(("customer",))
@guarded
def goal_move(gid, action):
    if action not in ("contribute", "withdraw"):
        return err("Unknown action", 404)
    db = get_db()
    amount = to_paisa(body().get("amount"), MAX_TRANSFER_PAISA)
    if not amount:
        return err("Enter a valid amount")
    goal = db.execute("SELECT * FROM savings_goals WHERE id=? AND user_id=?", (gid, g.user["id"])).fetchone()
    acc = my_account(db, g.user["id"])
    if not goal or not acc:
        raise TxnError("Savings goal not found", 404)
    if action == "contribute":
        if goal["saved_paisa"] + amount > goal["target_paisa"]:
            raise TxnError(f"Only {bdt(goal['target_paisa'] - goal['saved_paisa'])} is needed to reach this goal")
        apply_money(db, [(acc["id"], -amount)])
        db.execute("UPDATE savings_goals SET saved_paisa=saved_paisa+? WHERE id=?", (amount, gid))
        log_txn(db, "savings_in", amount, from_acc=acc["id"], note=goal["name"])
    else:
        c = db.execute("UPDATE savings_goals SET saved_paisa=saved_paisa-? WHERE id=? AND saved_paisa>=?", (amount, gid, amount))
        if c.rowcount != 1:
            raise TxnError("You have not saved that much in this goal")
        apply_money(db, [(acc["id"], amount)])
        log_txn(db, "savings_out", amount, to_acc=acc["id"], note=goal["name"])
    return jsonify({"ok": True})


@app.get("/api/notifications")
@auth_required(("customer",))
def my_notifications():
    rows = get_db().execute("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50", (g.user["id"],)).fetchall()
    return jsonify([{"id": r["id"], "type": r["type"], "title": r["title"], "body": r["body"],
                     "time": r["created_at"], "read": bool(r["is_read"])} for r in rows])


@app.post("/api/notifications/read")
@auth_required(("customer",))
def read_notifications():
    nid = body().get("id")
    db = get_db()
    if nid:
        db.execute("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", (int(nid), g.user["id"]))
    else:
        db.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (g.user["id"],))
    db.commit()
    return jsonify({"ok": True})


# --------------------------------------------------------- admin: money + reserve
def reserve_summary(db):
    r = db.execute("SELECT * FROM reserve WHERE id=1").fetchone()
    q = lambda sql, a=(): int(db.execute(sql, a).fetchone()[0])
    wallets = q("SELECT COALESCE(SUM(balance_paisa),0) FROM accounts WHERE status='approved'")
    savings = q("SELECT COALESCE(SUM(saved_paisa),0) FROM savings_goals")
    added = q("SELECT COALESCE(SUM(amount_paisa),0) FROM transactions WHERE kind='reserve_add'")
    removed = q("SELECT COALESCE(SUM(amount_paisa),0) FROM transactions WHERE kind='reserve_remove'")
    cash_in = q("SELECT COALESCE(SUM(amount_paisa),0) FROM transactions WHERE kind='cash_in'")
    cash_out = q("SELECT COALESCE(SUM(amount_paisa),0) FROM transactions WHERE kind='cash_out'")
    net = added - removed
    total = r["balance_paisa"] + wallets + savings + r["fees_paisa"]
    return {
        "balance": taka(r["balance_paisa"]), "fees": taka(r["fees_paisa"]),
        "wallets": taka(wallets), "savings": taka(savings), "circulation": taka(wallets + savings),
        "totalGenerated": taka(net), "totalAdded": taka(added), "totalRemoved": taka(removed),
        "totalCashIn": taka(cash_in), "totalCashOut": taka(cash_out),
        "balanced": total == net,  # reserve + wallets + savings + fees must equal everything ever generated
    }


@app.get("/api/admin/stats")
@auth_required(("admin",))
def admin_stats():
    db = get_db()
    q = lambda sql, a=(): int(db.execute(sql, a).fetchone()[0])
    day_start = datetime.now(timezone(timedelta(hours=6))).replace(hour=0, minute=0, second=0, microsecond=0)
    since = day_start.astimezone(timezone.utc).isoformat(timespec="seconds")
    week = (day_start - timedelta(days=6)).astimezone(timezone.utc).isoformat(timespec="seconds")
    # last 7 days (Dhaka time) of cash-in / cash-out / transfers for the chart
    series = {}
    for i in range(7):
        d = (day_start - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        series[d] = {"date": d, "cashIn": 0, "cashOut": 0, "transfers": 0}
    for t in db.execute("SELECT kind, amount_paisa, created_at FROM transactions WHERE created_at>=? AND kind IN ('cash_in','cash_out','transfer')", (week,)).fetchall():
        day = datetime.fromisoformat(t["created_at"]).astimezone(timezone(timedelta(hours=6))).strftime("%Y-%m-%d")
        key = {"cash_in": "cashIn", "cash_out": "cashOut", "transfer": "transfers"}[t["kind"]]
        if day in series:
            series[day][key] += taka(t["amount_paisa"])
    recent = db.execute(TXN_SELECT + " ORDER BY t.id DESC LIMIT 8").fetchall()
    return jsonify({
        "pendingUsers": q("SELECT COUNT(*) FROM users WHERE role='customer' AND status='pending'"),
        "customers": q("SELECT COUNT(*) FROM users WHERE role='customer' AND status='approved'"),
        "pendingAccounts": q("SELECT COUNT(*) FROM accounts WHERE status='pending'"),
        "pendingCards": q("SELECT COUNT(*) FROM cards WHERE status='pending'"),
        "totalBalance": q("SELECT COALESCE(SUM(balance_paisa),0) FROM accounts WHERE status='approved'") / 100,
        "todayCashIn": taka(q("SELECT COALESCE(SUM(amount_paisa),0) FROM transactions WHERE kind='cash_in' AND created_at>=?", (since,))),
        "todayTxns": q("SELECT COUNT(*) FROM transactions WHERE kind IN ('cash_in','cash_out','transfer') AND created_at>=?", (since,)),
        "reserve": reserve_summary(db),
        "series": list(series.values()),
        "recent": [admin_txn(t) for t in recent],
    })


@app.get("/api/admin/reserve")
@auth_required(("admin",))
def admin_reserve():
    db = get_db()
    rows = db.execute(TXN_SELECT + " WHERE t.kind IN ('reserve_add','reserve_remove') ORDER BY t.id DESC LIMIT 30").fetchall()
    return jsonify({**reserve_summary(db), "history": [admin_txn(t) for t in rows]})


@app.post("/api/admin/reserve")
@auth_required(("admin",))
@guarded
def admin_reserve_change():
    d = body()
    action = d.get("action")
    if action not in ("add", "remove"):
        return err("Unknown action", 404)
    amount = to_paisa(d.get("amount"), MAX_RESERVE_OP_PAISA)
    if not amount:
        return err("Enter a valid amount (up to 2 decimals)")
    note = (d.get("note") or "").strip()[:120] or None
    db = get_db()
    apply_money(db, reserve=amount if action == "add" else -amount)
    t = log_txn(db, "reserve_add" if action == "add" else "reserve_remove", amount, note=note, admin_id=g.user["id"])
    audit(f"reserve.{action}", f"{bdt(amount)} ref:{t['reference']}")
    return jsonify({"ok": True, "reference": t["reference"]})


@app.get("/api/admin/lookup")
@auth_required(("admin",))
def admin_lookup():
    rec = find_active_account(get_db(), request.args.get("q"))
    if not rec:
        return err("No active account found (check phone / account number)", 404)
    return jsonify({"name": rec["name"], "phone": rec["phone"], "email": rec["email"],
                    "accountNumber": rec["account_number"], "accountType": rec["account_type"],
                    "balance": taka(rec["balance_paisa"])})


def _cash_op(kind):
    d = body()
    db = get_db()
    amount = to_paisa(d.get("amount"), MAX_CASH_PAISA)
    if not amount:
        return err(f"Enter an amount up to {bdt(MAX_CASH_PAISA)} (max 2 decimals)")
    rec = find_active_account(db, d.get("account"))
    if not rec:
        raise TxnError("No active account found", 404)
    note = (d.get("note") or "").strip()[:120] or None
    if kind == "cash_in":  # customer hands over cash -> reserve e-money goes to the customer's wallet
        apply_money(db, [(rec["id"], amount)], reserve=-amount)
        t = log_txn(db, "cash_in", amount, to_acc=rec["id"], note=note, admin_id=g.user["id"])
        notify(db, rec["user_id"], "transaction", "Cash Deposit Received", f"{bdt(amount)} has been added to your account.")
    else:  # customer takes cash -> wallet is debited and e-money returns to the reserve
        apply_money(db, [(rec["id"], -amount)], reserve=amount)
        t = log_txn(db, "cash_out", amount, from_acc=rec["id"], note=note, admin_id=g.user["id"])
        notify(db, rec["user_id"], "transaction", "Cash Withdrawal", f"{bdt(amount)} was withdrawn from your account.")
    audit(kind, f"{bdt(amount)} {rec['account_number']} ref:{t['reference']}")
    bal = db.execute("SELECT balance_paisa FROM accounts WHERE id=?", (rec["id"],)).fetchone()[0]
    return jsonify({"ok": True, "reference": t["reference"], "customer": rec["name"],
                    "accountNumber": rec["account_number"], "amount": taka(amount), "newBalance": taka(bal)}), 201


@app.post("/api/admin/cash-in")
@auth_required(("admin",))
@guarded
def admin_cash_in():
    return _cash_op("cash_in")


@app.post("/api/admin/cash-out")
@auth_required(("admin",))
@guarded
def admin_cash_out():
    return _cash_op("cash_out")


@app.get("/api/admin/transactions")
@auth_required(("admin",))
def admin_transactions():
    kind, q = request.args.get("kind"), (request.args.get("q") or "").strip().lower()
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        offset = 0
    where, args = [], []
    if kind == "reserve":
        where.append("t.kind IN ('reserve_add','reserve_remove')")
    elif kind in KIND_TITLES:
        where.append("t.kind=?")
        args.append(kind)
    if q:
        like = f"%{q}%"
        where.append("(LOWER(t.reference) LIKE ? OR LOWER(COALESCE(fu.name,'')) LIKE ? OR LOWER(COALESCE(tu.name,'')) LIKE ?"
                     " OR LOWER(COALESCE(fa.account_number,'')) LIKE ? OR LOWER(COALESCE(ta.account_number,'')) LIKE ?)")
        args += [like] * 5
    sql = TXN_SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY t.id DESC LIMIT 51 OFFSET ?"
    rows = get_db().execute(sql, (*args, offset)).fetchall()
    return jsonify({"items": [admin_txn(t) for t in rows[:50]], "hasMore": len(rows) > 50})


# --------------------------------------------------------- headers + frontend
@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return err("Not found", 404)
    if not os.path.isdir(DIST_DIR):
        return "API running. Build the frontend (npm run build) to serve it here.", 200
    full = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(full):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
