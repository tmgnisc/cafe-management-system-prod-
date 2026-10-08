# ☕ Isha's Cozy Cafe — POS, Table Ordering, Billing & Inventory

A complete point-of-sale system for a café: visual table floor, fast touch-friendly ordering,
server-authoritative billing with discounts / service charge / VAT, payments, thermal receipts,
recipe-based automatic stock deduction, reports, audit logs and role-based access.

```
┌──────────────────────┐   REST / JSON + session cookie   ┌──────────────────────┐   PDO   ┌──────────┐
│  Next.js 16 frontend │ ───────────────────────────────▶ │   PHP 8 REST API     │ ──────▶ │  MySQL   │
│  React · TypeScript  │   (CORS allow-list, CSRF header)  │  auth · roles · BL   │         │  `cafe`  │
│  Tailwind · shadcn   │                                   │  billing · inventory │         │          │
└──────────────────────┘                                   └──────────────────────┘         └──────────┘
```

| Layer    | Tech |
|----------|------|
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Lucide · TanStack Query · React Hook Form · Zod · Recharts |
| Backend  | Plain PHP 8 (no framework) · PDO prepared statements · PHP sessions |
| Database | MySQL / MariaDB, database **`cafe`** |

---

## 1. Project structure

```
/
├── backend/
│   ├── bootstrap.php          # autoloader, config, timezone
│   ├── config/                # config.php (.env loader), database.php (PDO + transactions), cors.php
│   ├── controllers/           # thin HTTP controllers (validate → service → JSON)
│   ├── services/              # business logic: Order, Billing, Payment, Inventory, Report
│   ├── models/                # data access (one class per table)
│   ├── middleware/            # AuthMiddleware (session + CSRF), RoleMiddleware
│   ├── routes/                # Router.php + api.php (all endpoints & their guards)
│   ├── helpers/               # response.php, validation.php, auth.php, Request.php
│   ├── database/              # schema.sql, seed_base.sql, seed_demo.sql, install.php, history_seeder.php
│   ├── public/                # index.php front controller, .htaccess, uploads/
│   ├── storage/               # sessions/, logs/
│   └── tests/                 # run.sh + api_test.php (146 end-to-end assertions)
│
├── frontend/
│   ├── app/
│   │   ├── login/             # sign-in
│   │   ├── (app)/             # authenticated shell (sidebar)
│   │   │   ├── pos/           # table floor  ·  pos/table/[id] = order screen
│   │   │   ├── orders/        # order list   ·  orders/[id] = detail
│   │   │   ├── profile/
│   │   │   └── admin/         # SUPERADMIN only: dashboard, staff, tables, menu, inventory,
│   │   │                      #   orders, reports, settings, audit-logs
│   │   └── receipt/[id]/      # print-friendly 80 mm thermal receipt
│   ├── components/            # ui/ (shadcn), layout/, shared/, pos/, billing/, orders/, dashboard/,
│   │                          #   reports/, menu/, inventory/, staff/, tables/, settings/, audit/, profile/
│   ├── lib/                   # api.ts (central API client), auth.tsx, currency.ts, utils.ts, query-keys.ts
│   ├── hooks/                 # use-debounce, use-settings
│   └── types/                 # shared API types
└── README.md
```

---

## 2. Requirements

* PHP **8.0+** with `pdo_mysql`, `json`, `mbstring`, `fileinfo` (and `curl` for the test-suite)
* MySQL 5.7+ / MariaDB 10.3+
* Node.js 20+ and npm

> XAMPP works out of the box: PHP is `/opt/lampp/bin/php` (Linux) or `C:\xampp\php\php.exe` (Windows),
> MySQL is `/opt/lampp/bin/mysql`. Start Apache/MySQL from the XAMPP control panel.

---

## 3. Backend setup (PHP API)

```bash
cd backend
cp .env.example .env          # then edit DB_PASSWORD etc.
```

### Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | `production` disables debug output and enables secure cookies by default |
| `APP_DEBUG` | `true` | include exception text in 500 responses (never in production) |
| `APP_URL` | `http://localhost:8000` | public base URL of the API (used for uploaded image URLs) |
| `APP_TIMEZONE` | `Asia/Kathmandu` | PHP **and** MySQL session timezone |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL server |
| `DB_DATABASE` | `cafe` | database name |
| `DB_USERNAME` / `DB_PASSWORD` | `root` / *(empty)* | credentials — **never hard-coded** (Railway's `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` are used when `DB_*` are absent) |
| `DB_SOCKET` | *(empty)* | optional unix socket instead of TCP |
| `FRONTEND_URL` | `http://localhost:3000` | comma-separated CORS allow-list (exact origins) |
| `SESSION_NAME` | `ISHACAFE_SESSION` | session cookie name |
| `SESSION_LIFETIME` | `720` | idle timeout (minutes) |
| `SESSION_SECURE_COOKIE` | `false` | **set `true` in production (HTTPS)** |
| `SESSION_SAMESITE` | `Lax` | `Lax` when frontend & API share a site; `None` (+Secure) if cross-site |
| `SESSION_DOMAIN` | *(empty)* | cookie domain |
| `SESSION_DRIVER` | `database` | `database` (sessions table — survives redeploys) or `files` |
| `TRUST_PROXY` | `false` | `true` behind Railway/Vercel/nginx so login throttling & audit logs see the real client IP |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | first superadmin (see §5) |
| `AUTH_MAX_LOGIN_ATTEMPTS` / `AUTH_LOCKOUT_MINUTES` | `5` / `15` | brute-force protection |

Real environment variables override `.env` values.

### Create & seed the database

```bash
# SAFE / idempotent: creates missing tables, default settings and — if there are
# no users yet — the single SUPERADMIN (from ADMIN_EMAIL / ADMIN_PASSWORD)
php backend/database/install.php

# Wipe everything and start clean (superadmin only — no tables, menu or orders)
php backend/database/install.php --fresh

# Development playground: demo tables/menu/inventory/recipes + a demo staff user
php backend/database/install.php --fresh --demo
#   … plus ~3 weeks of realistic order history (drives the real services)
php backend/database/install.php --fresh --demo --with-history
```

`--fresh` drops every table in `DB_DATABASE` and refuses to run when `APP_ENV=production` unless `--force` is added.

Prefer importing manually (phpMyAdmin / mysql CLI)? Import `schema.sql`, then `seed_base.sql`
(and optionally `seed_demo.sql`), then run `php backend/database/install.php` once to create the superadmin.

### Run the API

```bash
# development (PHP built-in server)
php -S localhost:8000 -t backend/public backend/public/index.php
# → http://localhost:8000/api/health
```

With Apache, point a virtual host's `DocumentRoot` at `backend/public` (`.htaccess` routes everything to `index.php`; `mod_rewrite` required). Sub-directory deployments also work — the router strips the script directory.

---

## 4. Frontend setup (Next.js)

```bash
cd frontend
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                    # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Local dev: base URL of the PHP API, called directly (CORS). Public — no secrets. |
| `BACKEND_URL` | Production: the API URL that Next.js **proxies** `/api/*` and `/uploads/*` to. When set, the browser only talks to the frontend domain. |

Production build: `npm run build && npm start`.

---

## 5. Default accounts

A clean install contains **exactly one user — the SUPERADMIN** — created from these variables:

| Variable | Development default | Production |
|---|---|---|
| `ADMIN_EMAIL` | `admin@ishascozycafe.com` | **required** |
| `ADMIN_PASSWORD` | `IshaAdmin@2026` | **required** (≥ 8 chars, letters + numbers) |
| `ADMIN_NAME` | `Isha Sharma` | optional |

It is only created when the `users` table is empty, so redeploys never reset it. Create staff
accounts from **Staff** in the admin panel. The demo seed (`--demo`) additionally adds
`staff@ishascozycafe.com` / `IshaStaff@2026` — development only.

---

## 6. Authentication & security

* **Login** – `POST /api/auth/login` verifies with `password_verify()`; passwords are stored with `password_hash()` (bcrypt) and transparently re-hashed when the algorithm changes.
* **Session** – PHP session id in an **HttpOnly** cookie (`Secure` in production, `SameSite` configurable), strict mode, id regenerated on login, idle timeout, stored in `backend/storage/sessions`.
* **CSRF** – each session gets a random token, returned by `/auth/login` and `/auth/me` and kept in memory by the SPA; every POST/PUT/PATCH/DELETE must echo it in `X-CSRF-Token` (`419` otherwise). Combined with JSON bodies and the CORS allow-list this blocks cross-site request forgery.
* **CORS** – only origins listed in `FRONTEND_URL` receive `Access-Control-Allow-Origin` (echoed exactly, never `*`) with `Allow-Credentials: true`.
* **Authorization is enforced by the API.** Every protected route runs `AuthMiddleware` (session → user re-loaded from DB → must be `ACTIVE`) and admin routes additionally run `RoleMiddleware('SUPERADMIN')`. Deactivating a user or changing their role takes effect on their very next request. Next.js route guards are UX only.
* **Brute-force protection** – 5 failed logins per email per 15 min (and a looser per-IP limit) → `429`.
* **SQL injection** – PDO prepared statements everywhere, `ATTR_EMULATE_PREPARES=false`; only integer-cast values are interpolated (LIMIT/OFFSET).
* **Validation** – every request body is validated server-side (`Validator`), errors returned as `422` with per-field messages.
* **Uploads** – images only (MIME sniffed with `finfo` + `getimagesize`), ≤2 MB, random file names, PHP execution disabled in `uploads/`.
* **Audit logs never contain passwords** (password-like keys are stripped recursively).

### Roles

| Capability | STAFF | SUPERADMIN |
|---|:-:|:-:|
| View tables, take orders, add/remove items, notes, send to kitchen | ✅ | ✅ |
| Kitchen status, cancel open orders | ✅ | ✅ |
| Bill, discount (if enabled, up to the configured max %), payment, receipts | ✅ | ✅ (no limit) |
| Mark tables reserved / cleaning / available | ✅ | ✅ |
| Dashboard, reports, staff, tables CRUD, menu, recipes, inventory, settings, audit logs | ❌ (`403`) | ✅ |

---

## 7. API

All responses use one envelope:

```json
{ "success": true,  "message": "Order created and sent to the kitchen", "data": { } }
{ "success": false, "message": "The given data was invalid", "errors": { "items.0.quantity": ["The quantity must be at least 1."] } }
```

Status codes: `200` OK · `201` created · `400` malformed · `401` not logged in · `403` forbidden ·
`404` not found · `409` conflict (already paid, table busy, completed order…) · `419` CSRF · `422` validation · `429` throttled · `500`.

List endpoints are server-side paginated (`?page=&per_page=`) and return `{ items, pagination: { page, per_page, total, total_pages } }`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `PUT /api/auth/profile` · `PUT /api/auth/password` |
| Staff 🔒 | `GET/POST /api/staff` · `GET/PUT/DELETE /api/staff/{id}` · `POST /api/staff/{id}/reset-password` |
| Tables | `GET /api/tables` · `GET /api/tables/{id}` · `POST /api/tables/{id}/status` · 🔒 `POST /api/tables` · `PUT/DELETE /api/tables/{id}` |
| Categories | `GET /api/categories` · 🔒 `GET/POST/PUT/DELETE /api/categories[/{id}]` |
| Menu | `GET /api/menu` · `GET /api/menu/{id}` · 🔒 `POST /api/menu` · `PUT/DELETE /api/menu/{id}` |
| Recipes 🔒 | `GET/PUT /api/menu/{id}/recipe` · `GET /api/recipes` |
| Orders | `GET/POST /api/orders` · `GET/PUT /api/orders/{id}` · `POST /api/orders/{id}/send` · `POST /api/orders/{id}/status` · `POST /api/orders/{id}/discount` · `POST /api/orders/{id}/cancel` · `GET /api/orders/{id}/receipt` |
| Payments | `POST /api/orders/{id}/payment` (alias `POST /api/orders/{id}/complete`) · `GET /api/orders/{id}/payment` |
| Inventory 🔒 | `GET/POST /api/inventory` · `GET /api/inventory/options` · `GET /api/inventory/movements` · `GET/PUT/DELETE /api/inventory/{id}` · `POST /api/inventory/{id}/adjust` · `GET /api/inventory/{id}/movements` |
| Reports 🔒 | `GET /api/reports/dashboard` · `GET /api/reports/sales?preset=today\|yesterday\|week\|month\|custom&from=&to=` · `GET /api/reports/top-items` |
| Settings | `GET /api/settings` · 🔒 `PUT /api/settings` |
| Other 🔒 | `GET /api/audit-logs` · `POST /api/uploads` (multipart `file`) · `GET /api/health` (public) |

🔒 = SUPERADMIN only.

---

## 8. Orders, billing & payment

**Order flow:** select table → add items (quantity, notes) → **Save** (`DRAFT`) or **Send** (`PENDING`, lines stamped `sent_at`) →
add more items any time (new lines show as *new* until sent) → kitchen statuses (`PREPARING → READY → SERVED`) →
**View bill** → discount → **payment** → `COMPLETED`, table released, receipt.

* A table can hold only **one open order**; creating an order locks the table row (`SELECT … FOR UPDATE`) and marks it `OCCUPIED`.
* **Historical prices:** `order_items` stores `item_name_snapshot`, `category_snapshot`, `unit_price` and `cost_price_snapshot` when a line is added. Changing a menu price never alters existing lines or past orders.
* **Completed orders are immutable** – edit, discount, cancel or pay again → `409`.

**BillingService** (the only place totals are computed; the frontend preview is display-only):

```
subtotal          = Σ unit_price × quantity
discount          = PERCENTAGE: subtotal × value%   |  FIXED: value      (≤ subtotal)
service charge    = (subtotal − discount) × service_charge_rate%
tax (VAT)         = (subtotal − discount [+ service charge]) × tax_rate%
grand total       = subtotal − discount + service charge + tax
```

Arithmetic is done in integer paisa. Discount rules: percentage ≤ 100, amount ≤ subtotal, staff limited to
`max_staff_discount_percent` (and only if `staff_discount_enabled`); `discount_type`, `discount_value`,
`discount_amount` and `discount_applied_by` are stored on the order.

**Payment** (`PaymentService::settle`) runs in **one transaction**:

1. `SELECT … FOR UPDATE` the order · 2. reject if completed / paid / cancelled · 3. recalculate the total ·
4. validate amount (cash ≥ total → change; other methods = total; optional `expected_total` guards against a stale bill) ·
5. insert payment (`UNIQUE(order_id)` is a second duplicate guard) · 6. deduct inventory · 7. mark `COMPLETED/PAID` ·
8. release table (`AVAILABLE` or `CLEANING`, configurable) · 9. stock movements · 10. audit log → `COMMIT` (any failure → `ROLLBACK`).

Methods: `CASH`, `CARD`, `ESEWA`, `KHALTI`, `BANK_TRANSFER`, `OTHER`.

**Receipts:** `/receipt/{id}` renders an 80 mm thermal layout (`@page { size: 80mm auto }`) and auto-prints with `?print=1`. Unpaid orders print as *PRE-BILL*.

---

## 9. Inventory & recipes

* `inventory_items` hold `current_quantity` in their own unit (`kg, g, liter, ml, pcs, packet, bottle, box`). Status is **computed**: `OUT_OF_STOCK` (≤0), `LOW_STOCK` (≤ minimum), `IN_STOCK`.
* A **recipe** lists ingredients per **one** serving: e.g. Cappuccino = 18 g Coffee Beans + 150 ml Milk + 5 g Sugar. Recipe units may differ from the stock unit when convertible (g↔kg, ml↔liter).
* When an order is paid, `InventoryService::deductForOrder()` aggregates *recipe qty × sold qty* per ingredient (for menu items with `track_inventory`), converts units, locks the rows in id order and writes one `SALE` movement each — inside the payment transaction.
  *Cappuccino × 3 → beans −54 g, milk −450 ml, sugar −15 g.*
* **Never twice:** deduction is skipped if the order already has `SALE` movements or `inventory_deducted_at` is set; the order row is locked first.
* **Every** quantity change writes a `stock_movements` row (`INITIAL_STOCK, PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN`) with signed quantity, previous/new quantity, reference, reason and user. The inventory `PUT` endpoint refuses `current_quantity`; changes go through `POST /adjust` (manual adjustments cannot go below zero; sales may, if `allow_negative_stock` is on, so service is never blocked by a miscount).

---

## 10. Testing

```bash
./backend/tests/run.sh
```

Creates a throw-away **`cafe_test`** database, starts a PHP server on `:8001` and runs 146 real-HTTP assertions:
authentication, CSRF, CORS, staff vs admin authorization, table/menu/inventory/recipe creation, order creation with
multiple items, quantity changes, price snapshots, discount validation & staff limits, tax/service charge, payment,
duplicate payment prevention, inventory deduction & idempotency, table occupancy/release, completed-order protection,
soft deletion, audit logging and login throttling — including the full **§51 acceptance scenario**
(Cappuccino × 2 → subtotal 360 → 10% → 324 → cash → beans −36 g, milk −300 ml, edit/pay-again rejected).

Frontend checks: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`.

---

## 11. Production deployment — Vercel (frontend) + Railway (API + MySQL)

```
browser ──▶ https://your-app.vercel.app ──(/api/*, /uploads/* rewrites)──▶ https://your-api.up.railway.app ──▶ Railway MySQL
```

The frontend **proxies** API calls instead of calling Railway from the browser. `vercel.app` and
`railway.app` are different sites, so a cookie set by Railway would be a *third-party* cookie that
Safari and Chrome block — login would silently fail. Through the proxy, the session cookie is
first-party on your Vercel domain (`HttpOnly`, `Secure`, `SameSite=Lax`).

### Railway (backend)

1. **New project → Add MySQL** (Railway database service).
2. **Add service → GitHub repo**, set **Root Directory = `backend`**. `backend/railway.json` +
   `backend/Dockerfile` build a PHP 8.2 + Apache image; health check is `/api/health`.
3. **Variables** on the API service:
   ```
   MYSQLHOST=${{MySQL.MYSQLHOST}}          # or use Railway's "reference variables" UI
   MYSQLPORT=${{MySQL.MYSQLPORT}}
   MYSQLUSER=${{MySQL.MYSQLUSER}}
   MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
   MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
   APP_URL=https://your-api.up.railway.app
   FRONTEND_URL=https://your-app.vercel.app
   ADMIN_EMAIL=you@yourcafe.com
   ADMIN_PASSWORD=<a strong password>
   ```
   (`APP_ENV=production`, `SESSION_SECURE_COOKIE=true`, `TRUST_PROXY=true` are baked into the image.)
4. **Add a Volume** to the API service mounted at **`/var/www/html/public/uploads`** — otherwise
   uploaded menu images / logo are lost on every redeploy (container disks are ephemeral).
5. **Networking → Generate domain.** On every boot the container runs `php database/install.php`
   (idempotent): it creates tables, default settings and your superadmin the first time, and never
   wipes data.

### Vercel (frontend)

1. **Import the repo**, set **Root Directory = `frontend`** (framework auto-detected: Next.js).
2. **Environment variable:** `BACKEND_URL=https://your-api.up.railway.app` (no trailing slash).
3. Deploy, open the Vercel URL, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then add tables,
   menu, inventory and staff from the admin panel.

### Notes

* Custom domains (e.g. `pos.yourcafe.com` → Vercel) work the same; update `FRONTEND_URL`.
* Railway's MySQL database is called `railway` by default — that's fine, the app uses whatever `MYSQLDATABASE` says.
* Take regular backups of the Railway MySQL service.
* Other hosts: any Docker host works with `backend/Dockerfile`; classic Apache hosting works with
  document root `backend/public` (`AllowOverride All` + `mod_rewrite`); never expose `.env`, `storage/` or `database/`.
