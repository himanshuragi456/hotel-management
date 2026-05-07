# Hotel & Restaurant Management SaaS — Master Plan

## Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS + shadcn/ui
- **Backend**: Laravel 11 (PHP 8.2) REST API
- **Database**: MySQL / MariaDB
- **Realtime**: Laravel Echo + Pusher (or Soketi self-hosted)
- **Auth**: JWT (tymon/jwt-auth) + RBAC
- **Queue**: Laravel Queues (database driver → Redis later)
- **PDF/Excel**: Laravel DomPDF + Maatwebsite Excel
- **Payments**: Stripe + Razorpay
- **Deployment**: Apache on existing cloud (103.191.209.34)

---

## Product Modules (sold separately or as combo)

| Module | Description |
|---|---|
| **Module 1** — Restaurant & Order Management | Tables, menu, orders, kitchen, billing, waiter/chef/counter roles |
| **Module 2** — Hotel & Room Management | Rooms, bookings, check-in/out, guest details, room service |
| **Module 3** — Feedback & Review System | QR-based feedback, Google review redirect, AI suggestions |

---

## Roles & Access

| Role | Scope |
|---|---|
| **Superadmin** | Full platform control, all restaurants, subscriptions, payments |
| **Owner** | Their restaurant only — analytics, staff, menu, rooms, reports |
| **Waiter** | Take orders by table/room number, view their active orders |
| **Chef** | Kitchen dashboard — live order feed, update order status |
| **Billing Counter** | Invoices, GST, discounts, split payments, checkout |
| **Customer** | QR menu, place orders, pay, feedback |

---

## Folder Structure

```
hotel-management/
├── backend/                  # Laravel 11 API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── Auth/
│   │   │   │   ├── Superadmin/
│   │   │   │   ├── Owner/
│   │   │   │   ├── Waiter/
│   │   │   │   ├── Chef/
│   │   │   │   ├── Billing/
│   │   │   │   └── Customer/
│   │   │   └── Middleware/
│   │   ├── Models/
│   │   ├── Events/           # WebSocket events
│   │   ├── Listeners/
│   │   ├── Jobs/
│   │   ├── Services/         # Business logic
│   │   │   ├── OrderService.php
│   │   │   ├── BillingService.php
│   │   │   ├── RoomService.php
│   │   │   ├── FeedbackService.php
│   │   │   └── SubscriptionService.php
│   │   └── Policies/         # RBAC policies
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/
│       ├── api.php
│       └── channels.php
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # shadcn components
│   │   │   ├── shared/       # reusable across roles
│   │   │   └── layouts/
│   │   ├── pages/
│   │   │   ├── superadmin/
│   │   │   ├── owner/
│   │   │   ├── waiter/
│   │   │   ├── chef/
│   │   │   ├── billing/
│   │   │   └── customer/     # public QR pages
│   │   ├── hooks/
│   │   ├── services/         # API call functions
│   │   ├── store/            # Zustand state
│   │   ├── utils/
│   │   └── router/           # React Router v6
│   └── public/
│
└── plan.md
```

---

## Database Schema Overview

### Core Tables
- `tenants` — each restaurant/hotel is a tenant
- `users` — all users with role + tenant_id
- `roles` — superadmin, owner, waiter, chef, billing, customer
- `tenant_modules` — which modules a tenant has enabled
- `subscriptions` — plan, status, billing cycle, payment gateway
- `subscription_plans` — plan tiers with module access flags

### Module 1 — Restaurant
- `restaurants` — tenant restaurant profile
- `tables` — table number, capacity, status (free/occupied), occupied_since
- `menu_categories` — category name, display order
- `menu_items` — name, price, category, image, available flag
- `orders` — table_id/room_id, waiter_id, status, total, timestamps
- `order_items` — order_id, item_id, qty, price, notes
- `invoices` — order_id, subtotal, GST, discount, total, payment_method
- `invoice_splits` — split payments per invoice
- `expenses` — category, amount, note, date

### Module 2 — Hotel
- `rooms` — number, type, price/night, status, floor
- `bookings` — guest_id, room_id, check_in, check_out, status, payment_status
- `guests` — name, phone, email, id_proof_type, id_proof_number, company
- `room_service_orders` — linked to orders table with room context

### Module 3 — Feedback
- `feedback_qr_codes` — tenant_id, qr_token, placement_location
- `feedback_submissions` — qr_token, rating, comment, is_internal, timestamp
- `google_review_configs` — tenant google place_id, review URL

### SaaS / Platform
- `audit_logs` — user_id, action, model, model_id, old_val, new_val, ip
- `notifications` — user_id, type, data, read_at

---

## Phases

---

### PHASE 1 — Foundation & Auth
**Goal**: Project scaffold, database, JWT auth, RBAC, tenant system

#### 1.1 Backend Setup
- [ ] Create Laravel 11 project in `backend/`
- [ ] Install packages: jwt-auth, spatie/laravel-permission, pusher-php-server, dompdf, maatwebsite/excel, stripe-php, razorpay
- [ ] Configure `.env` for DB, JWT, Pusher
- [ ] Set up base API response trait (success/error format)

#### 1.2 Database Migrations
- [ ] `tenants` table
- [ ] `users` table (with tenant_id, role)
- [ ] `roles` & `permissions` (spatie)
- [ ] `tenant_modules` table
- [ ] `subscription_plans` table
- [ ] `subscriptions` table
- [ ] `audit_logs` table
- [ ] `notifications` table

#### 1.3 Auth System
- [ ] JWT login / register / logout / refresh endpoints
- [ ] Role middleware (CheckRole)
- [ ] Tenant scoping middleware (all queries scoped to tenant)
- [ ] Superadmin bypass middleware

#### 1.4 Seeders
- [ ] Superadmin seeder
- [ ] Default roles & permissions seeder
- [ ] Demo tenant + owner seeder
- [ ] Sample subscription plans seeder

#### 1.5 Frontend Setup
- [ ] Create React + Vite project in `frontend/`
- [ ] Install: TailwindCSS, shadcn/ui, React Router v6, Zustand, Axios, React Query, Pusher-js
- [ ] Auth store (Zustand) — token, user, role
- [ ] Axios instance with JWT interceptor + refresh logic
- [ ] Role-based routing guard
- [ ] Login page (works for all roles)
- [ ] Role-based dashboard redirect after login

**Phase 1 Done When**: Any role can log in, gets redirected to their dashboard shell, tenant is resolved, JWT refresh works.

---

### PHASE 2 — Superadmin Panel
**Goal**: Full platform control from superadmin dashboard

#### 2.1 Restaurant / Tenant Management
- [ ] List all tenants (search, filter by plan/status)
- [ ] Create / edit / suspend / delete tenant
- [ ] Assign modules to tenant (toggle Module 1/2/3)
- [ ] View tenant's usage stats

#### 2.2 Subscription & Plans
- [ ] CRUD subscription plans (name, price, modules included, billing cycle)
- [ ] Assign plan to tenant
- [ ] View all active subscriptions
- [ ] Manual plan override / extend

#### 2.3 Payment Gateways
- [ ] Stripe integration — create customer, subscription, webhook handler
- [ ] Razorpay integration — create subscription, webhook handler
- [ ] Per-tenant payment gateway config (owner picks Stripe or Razorpay)
- [ ] Monthly recurring billing logic

#### 2.4 Database Management UI
- [ ] View table stats per tenant
- [ ] Export tenant data as SQL/CSV
- [ ] Purge old audit logs

#### 2.5 Audit Logs
- [ ] Global audit log viewer (filter by tenant, user, action, date)
- [ ] Auto-log all create/update/delete via Model Observer

#### 2.6 Superadmin Frontend
- [ ] Sidebar with: Tenants, Plans, Subscriptions, Payments, Audit Logs, Settings
- [ ] Tenant detail page with module toggles
- [ ] Plan builder UI
- [ ] Subscription list with status badges

**Phase 2 Done When**: Superadmin can create a tenant, assign a plan with modules, and billing is tracked.

---

### PHASE 3 — Module 1: Restaurant & Order Management
**Goal**: Full restaurant operations — menu, tables, orders, kitchen, billing

#### 3.1 Menu Management (Owner)
- [ ] Menu categories CRUD
- [ ] Menu items CRUD (name, price, image upload, category, available toggle)
- [ ] Bulk enable/disable items
- [ ] Menu preview

#### 3.2 Table Management (Owner)
- [ ] Tables CRUD (number, capacity, floor/section)
- [ ] Table status view (free / occupied + occupied since time)
- [ ] QR code generation per table (links to customer order page)

#### 3.3 Waiter Dashboard
- [ ] View all tables with status
- [ ] Select table → open order form
- [ ] Browse menu by category, add items with qty + notes
- [ ] Submit order → triggers kitchen notification
- [ ] View active orders for their tables

#### 3.4 Kitchen Dashboard (Chef)
- [ ] Realtime order feed via WebSocket (Pusher/Soketi)
- [ ] Sound notification on new order
- [ ] Order cards: table number, items, notes, time elapsed
- [ ] Status update buttons: Pending → Preparing → Ready
- [ ] Color coded by status and urgency (time-based)

#### 3.5 Customer QR Order Flow
- [ ] Public route: `/menu/{tenant_slug}/{table_id}`
- [ ] Responsive mobile menu (no login required)
- [ ] Add to cart, view cart, place order
- [ ] Order confirmation page with estimated time

#### 3.6 Billing Counter
- [ ] View all active orders ready for billing
- [ ] Generate invoice: subtotal, GST %, discount (flat/%), total
- [ ] Payment methods: cash, card, UPI, split
- [ ] UPI QR generation on printed bill
- [ ] Print-ready invoice layout (PDF download)
- [ ] Split payment between room charges and direct pay
- [ ] Customer record (name/phone optional)

#### 3.7 Owner — Orders & Revenue
- [ ] Live order board (all tables)
- [ ] Today's revenue widget
- [ ] Export orders as PDF/Excel (date range filter)
- [ ] Expense tracking (add expense category + amount)
- [ ] Expense report

**Phase 3 Done When**: Full order lifecycle works — waiter takes order → chef sees it live → chef marks ready → billing generates invoice → PDF downloaded.

---

### PHASE 4 — Module 2: Hotel & Room Management
**Goal**: Room bookings, guest management, check-in/out, room service

#### 4.1 Room Setup (Owner)
- [ ] Room CRUD (number, type: single/double/suite, floor, price/night, amenities)
- [ ] Room status board (available / occupied + occupied since)
- [ ] Room type pricing management

#### 4.2 Guest Management
- [ ] Guest profile: name, phone, email, ID proof type + number, company/sponsor
- [ ] Guest history (past bookings)

#### 4.3 Booking Management (Billing Counter / Owner)
- [ ] New booking form: guest, room, check-in, check-out, advance payment
- [ ] Booking calendar view
- [ ] Check-in flow: confirm guest details, mark room occupied
- [ ] Check-out flow: show room service charges, outstanding balance, final bill
- [ ] Booking status: upcoming / checked-in / checked-out / cancelled

#### 4.4 Room Service Orders
- [ ] Waiter can place order against a room number (same order system)
- [ ] Room service charges accumulate on booking
- [ ] At checkout, billing sees total room charges + service charges

#### 4.5 Reports (Owner)
- [ ] Occupancy report (date range)
- [ ] Revenue per room type
- [ ] Guest list export
- [ ] Outstanding payments report

**Phase 4 Done When**: Full booking lifecycle — room created → guest checked in → room service added to tab → checkout with consolidated bill.

---

### PHASE 5 — Module 3: Feedback & Review System
**Goal**: QR-based feedback, smart Google review redirect, AI suggestions

#### 5.1 Feedback QR Setup (Owner)
- [ ] Generate unique feedback QR code per tenant
- [ ] QR links to: `/feedback/{qr_token}`
- [ ] Owner can label placement (reception, table, room)
- [ ] Downloadable QR PNG for printing

#### 5.2 Feedback Submission Page (Customer — public)
- [ ] Mobile-optimized page (no login)
- [ ] Star rating (1–5)
- [ ] Optional comment box
- [ ] Submit → routing logic:
  - Rating > 3 → redirect to Google Review page + show AI-generated compliment suggestions
  - Rating ≤ 3 → show internal thank-you + apology, save internally only

#### 5.3 AI Review Suggestions
- [ ] On rating > 3, call OpenAI API with restaurant name + rating
- [ ] Generate 3 short compliment suggestions customer can tap to copy
- [ ] "Copy & Open Google Review" button

#### 5.4 Google Review Config (Owner)
- [ ] Owner enters Google Place ID or review URL
- [ ] Test link preview

#### 5.5 Feedback Dashboard (Owner)
- [ ] All feedback list (date, rating, comment)
- [ ] Average rating widget
- [ ] Rating breakdown chart (1–5 stars)
- [ ] Filter by date range / rating
- [ ] Internal (≤3) vs public (>3) split view

**Phase 5 Done When**: Customer scans QR → rates → high rating goes to Google with AI suggestions → low rating stays internal → owner sees all feedback in dashboard.

---

### PHASE 6 — Analytics, Notifications & Polish
**Goal**: Owner analytics dashboard, notification system, audit trail, inventory basics

#### 6.1 Owner Analytics Dashboard
- [ ] Revenue chart (daily/weekly/monthly toggle)
- [ ] Top selling menu items
- [ ] Table turnover rate
- [ ] Peak hours heatmap
- [ ] Occupancy rate (if hotel module on)
- [ ] Expense vs revenue comparison

#### 6.2 Notification System
- [ ] In-app notifications (bell icon) for all roles
- [ ] Chef: new order sound + badge
- [ ] Owner: low inventory alert, new booking, checkout due
- [ ] Billing: order ready for invoicing
- [ ] Mark as read, clear all

#### 6.3 Inventory Management (Basic)
- [ ] Ingredient/item stock tracking
- [ ] Low stock threshold alerts
- [ ] Stock deduction on order (optional per item)
- [ ] Manual stock update

#### 6.4 Report Filters & Exports
- [ ] All reports: date range, category, role filter
- [ ] PDF export (DomPDF)
- [ ] Excel export (Maatwebsite)

#### 6.5 Audit Log (Owner view)
- [ ] Owner sees their tenant's audit trail
- [ ] Filter by user, action, date

#### 6.6 UI Polish
- [ ] Loading skeletons everywhere
- [ ] Empty states with helpful CTAs
- [ ] Mobile responsiveness audit (waiter + customer pages critical)
- [ ] Toast notifications for all actions
- [ ] Dark mode toggle

**Phase 6 Done When**: Owner has a full analytics view, exports work, notifications fire correctly.

---

### PHASE 7 — Deployment & Production Setup
**Goal**: Deploy to existing cloud server

#### 7.1 Backend Deployment
- [ ] `composer install --no-dev`
- [ ] `.env.production` setup
- [ ] Apache virtual host config for API subdomain
- [ ] `php artisan migrate --force`
- [ ] `php artisan queue:work` via supervisor or cron
- [ ] Storage symlink + permissions

#### 7.2 Frontend Deployment
- [ ] `npm run build` → `dist/`
- [ ] Upload to `public_html` or subdomain folder
- [ ] Apache config for React SPA (catch-all to index.html)

#### 7.3 WebSocket Setup
- [ ] Option A: Use Pusher free tier (sandbox — 100 connections)
- [ ] Option B: Self-host Soketi on same server (no sudo = needs PHP fallback via polling)

#### 7.4 Security Hardening
- [ ] Rate limiting on auth endpoints
- [ ] CORS locked to production domain
- [ ] JWT secret rotation process
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention audit

---

## Progress Tracker

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Foundation & Auth | 🔲 Not Started | |
| Phase 2 — Superadmin Panel | 🔲 Not Started | |
| Phase 3 — Module 1: Restaurant | 🔲 Not Started | |
| Phase 4 — Module 2: Hotel | 🔲 Not Started | |
| Phase 5 — Module 3: Feedback | 🔲 Not Started | |
| Phase 6 — Analytics & Polish | 🔲 Not Started | |
| Phase 7 — Deployment | 🔲 Not Started | |

---

## Key Decisions & Notes

- **Tenant isolation**: All queries scoped via `tenant_id` on every model using a global scope
- **Module gating**: Every API route checks `tenant_modules` before responding; frontend hides nav items accordingly
- **WebSocket fallback**: If Soketi can't run on shared host, use Laravel Echo with Pusher free tier or polling fallback
- **QR codes**: Generated server-side using `simple-qrcode` Laravel package, stored as PNG
- **Payments**: Stripe for international, Razorpay for India — per-tenant config, not global
- **GST**: Configurable per tenant (rate %, GSTIN number for invoice)
- **PDF bills**: UPI QR embedded in PDF using `chillerlan/php-qrcode`
