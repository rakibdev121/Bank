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
import time
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, g, jsonify, request, send_from_directory
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "nirapod.db"))
DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "dist"))
TOKEN_MAX_AGE = 60 * 60 * 12  # 12 hours
HASH_METHOD = "pbkdf2:sha256:600000"


def _load_secret():
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    path = os.path.join(os.path.dirname(DB_PATH), ".secret_key")
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
  balance_paisa INTEGER NOT NULL DEFAULT 0,
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
  credit_limit_paisa INTEGER NOT NULL DEFAULT 0,
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
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
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
    except sqlite3.IntegrityError:
        return err("This phone number or email is already registered", 409)
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
    db.execute("INSERT INTO accounts (user_id, account_type, created_at) VALUES (?,?,?)",
               (g.user["id"], kind, now()))
    db.commit()
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
    db.execute(
        "INSERT INTO cards (user_id, account_id, network, card_type, holder, created_at) VALUES (?,?,?,?,?,?)",
        (g.user["id"], acc["id"], network, ctype, g.user["name"].upper()[:26], now()),
    )
    db.commit()
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


@app.get("/api/admin/stats")
@auth_required(("admin",))
def admin_stats():
    db = get_db()
    q = lambda sql: db.execute(sql).fetchone()[0]
    return jsonify({
        "pendingUsers": q("SELECT COUNT(*) FROM users WHERE role='customer' AND status='pending'"),
        "customers": q("SELECT COUNT(*) FROM users WHERE role='customer' AND status='approved'"),
        "pendingAccounts": q("SELECT COUNT(*) FROM accounts WHERE status='pending'"),
        "pendingCards": q("SELECT COUNT(*) FROM cards WHERE status='pending'"),
        "totalBalance": q("SELECT COALESCE(SUM(balance_paisa),0) FROM accounts WHERE status='approved'") / 100,
    })


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
