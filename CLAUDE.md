# Hotel & Restaurant Management SaaS

## Project Summary
A multi-tenant SaaS with 3 separately sellable modules:
- **Module 1**: Restaurant & Order Management
- **Module 2**: Hotel & Room Management
- **Module 3**: Feedback & Review System (QR → Google review redirect + AI suggestions)

Full detailed plan is in `plan.md`. Read it before starting any phase.

## Tech Stack
- **Backend**: Laravel 11 (PHP 8.2) in `backend/`
- **Frontend**: React 18 + Vite + TailwindCSS + shadcn/ui in `frontend/`
- **Database**: MySQL / MariaDB
- **Realtime**: Laravel Echo + Pusher
- **Auth**: JWT (tymon/jwt-auth) + RBAC (spatie/laravel-permission)
- **Payments**: Stripe + Razorpay (per-tenant config)
- **Deployment**: Apache on 103.191.209.34 — no Docker, no root access

## Roles
Superadmin, Owner, Waiter, Chef, Billing Counter, Customer

## Key Decisions (don't re-discuss these)
- Tenant isolation via `tenant_id` global scope on all models
- Module gating: API routes + frontend nav both check `tenant_modules`
- QR codes generated server-side as PNG
- Feedback: rating > 3 → Google Reviews + AI suggestions; ≤ 3 → internal only
- Physical printed QR placed at hotel reception for feedback module
- No Node.js on server — React compiles to static files, served via Apache

## Resume Instructions
1. Scan the checklist below — find the first unchecked item, that's where to resume
2. After completing each item, mark it `[x]` and commit CLAUDE.md immediately
3. Never batch-update — update after each individual task so nothing is lost

---

## Progress Checklist

### Phase 1 — Foundation & Auth

#### 1.1 Backend Setup
- [x] Create Laravel 11 project in `backend/`
- [x] Install packages: jwt-auth, spatie/laravel-permission, pusher-php-server, dompdf, maatwebsite/excel, stripe-php, razorpay
- [x] Configure `.env` for DB, JWT, Pusher
- [x] Set up base API response trait (success/error format)

#### 1.2 Database Migrations
- [x] `tenants` table
- [x] `users` table (with tenant_id, role)
- [x] `roles` & `permissions` (spatie)
- [x] `tenant_modules` table
- [x] `subscription_plans` table
- [x] `subscriptions` table
- [x] `audit_logs` table
- [x] `notifications` table

#### 1.3 Auth System
- [x] JWT login / register / logout / refresh endpoints
- [x] Role middleware (CheckRole)
- [x] Tenant scoping middleware
- [x] Superadmin bypass middleware

#### 1.4 Seeders
- [x] Superadmin seeder
- [x] Default roles & permissions seeder
- [x] Demo tenant + owner seeder
- [x] Sample subscription plans seeder

#### 1.5 Frontend Setup
- [x] Create React + Vite project in `frontend/`
- [x] Install: TailwindCSS, shadcn/ui, React Router v6, Zustand, Axios, React Query, Pusher-js
- [x] Auth store (Zustand) — token, user, role
- [x] Axios instance with JWT interceptor + refresh logic
- [x] Role-based routing guard
- [x] Login page (works for all roles)
- [x] Role-based dashboard redirect after login

---

### Phase 2 — Superadmin Panel

#### 2.1 Restaurant / Tenant Management
- [ ] List all tenants (search, filter)
- [ ] Create / edit / suspend / delete tenant
- [ ] Assign modules to tenant (toggle Module 1/2/3)
- [ ] View tenant usage stats

#### 2.2 Subscription & Plans
- [ ] CRUD subscription plans
- [ ] Assign plan to tenant
- [ ] View all active subscriptions
- [ ] Manual plan override / extend

#### 2.3 Payment Gateways
- [ ] Stripe integration — customer, subscription, webhook
- [ ] Razorpay integration — subscription, webhook
- [ ] Per-tenant payment gateway config
- [ ] Monthly recurring billing logic

#### 2.4 Database Management UI
- [ ] View table stats per tenant
- [ ] Export tenant data
- [ ] Purge old audit logs

#### 2.5 Audit Logs
- [ ] Global audit log viewer
- [ ] Auto-log via Model Observer

#### 2.6 Superadmin Frontend
- [ ] Sidebar: Tenants, Plans, Subscriptions, Payments, Audit Logs
- [ ] Tenant detail page with module toggles
- [ ] Plan builder UI
- [ ] Subscription list with status badges

---

### Phase 3 — Module 1: Restaurant & Order Management

#### 3.1 Menu Management
- [ ] Menu categories CRUD
- [ ] Menu items CRUD (name, price, image, category, available toggle)
- [ ] Bulk enable/disable items
- [ ] Menu preview

#### 3.2 Table Management
- [ ] Tables CRUD (number, capacity, floor/section)
- [ ] Table status view (free/occupied + occupied since)
- [ ] QR code generation per table

#### 3.3 Waiter Dashboard
- [ ] View all tables with status
- [ ] Select table → open order form
- [ ] Browse menu by category, add items with qty + notes
- [ ] Submit order → triggers kitchen notification
- [ ] View active orders for their tables

#### 3.4 Kitchen Dashboard (Chef)
- [ ] Realtime order feed via WebSocket
- [ ] Sound notification on new order
- [ ] Order cards: table, items, notes, time elapsed
- [ ] Status update: Pending → Preparing → Ready
- [ ] Color coded by status and urgency

#### 3.5 Customer QR Order Flow
- [ ] Public route: `/menu/{tenant_slug}/{table_id}`
- [ ] Responsive mobile menu (no login)
- [ ] Add to cart, place order
- [ ] Order confirmation page

#### 3.6 Billing Counter
- [ ] View orders ready for billing
- [ ] Generate invoice: subtotal, GST, discount, total
- [ ] Payment methods: cash, card, UPI, split
- [ ] UPI QR on printed bill
- [ ] PDF invoice download
- [ ] Split payment between room and direct
- [ ] Customer record (name/phone optional)

#### 3.7 Owner — Orders & Revenue
- [ ] Live order board
- [ ] Today's revenue widget
- [ ] Export orders PDF/Excel (date range)
- [ ] Expense tracking
- [ ] Expense report

---

### Phase 4 — Module 2: Hotel & Room Management

#### 4.1 Room Setup
- [ ] Room CRUD (number, type, floor, price/night, amenities)
- [ ] Room status board (available/occupied + since when)
- [ ] Room type pricing

#### 4.2 Guest Management
- [ ] Guest profile: name, phone, email, ID proof, company/sponsor
- [ ] Guest history

#### 4.3 Booking Management
- [ ] New booking form: guest, room, check-in, check-out, advance
- [ ] Booking calendar view
- [ ] Check-in flow
- [ ] Check-out flow with consolidated bill
- [ ] Booking status management

#### 4.4 Room Service Orders
- [ ] Orders placed against room number
- [ ] Charges accumulate on booking
- [ ] Checkout shows total room + service charges

#### 4.5 Reports
- [ ] Occupancy report
- [ ] Revenue per room type
- [ ] Guest list export
- [ ] Outstanding payments report

---

### Phase 5 — Module 3: Feedback & Review System

#### 5.1 Feedback QR Setup
- [ ] Generate unique QR per tenant
- [ ] QR links to `/feedback/{qr_token}`
- [ ] Label placement (reception, table, room)
- [ ] Downloadable QR PNG for printing

#### 5.2 Feedback Submission Page
- [ ] Mobile-optimized public page
- [ ] Star rating (1–5)
- [ ] Optional comment
- [ ] Routing: >3 → Google Reviews + AI suggestions; ≤3 → internal apology

#### 5.3 AI Review Suggestions
- [ ] Call OpenAI on rating > 3
- [ ] Generate 3 compliment suggestions
- [ ] "Copy & Open Google Review" button

#### 5.4 Google Review Config
- [ ] Owner enters Google Place ID / review URL
- [ ] Test link preview

#### 5.5 Feedback Dashboard
- [ ] All feedback list (date, rating, comment)
- [ ] Average rating widget
- [ ] Rating breakdown chart
- [ ] Filter by date / rating
- [ ] Internal vs public split view

---

### Phase 6 — Analytics, Notifications & Polish

#### 6.1 Owner Analytics Dashboard
- [ ] Revenue chart (daily/weekly/monthly)
- [ ] Top selling menu items
- [ ] Table turnover rate
- [ ] Peak hours heatmap
- [ ] Occupancy rate (if hotel module on)
- [ ] Expense vs revenue comparison

#### 6.2 Notification System
- [ ] In-app notifications (bell icon) all roles
- [ ] Chef: new order sound + badge
- [ ] Owner: low inventory, new booking, checkout due
- [ ] Billing: order ready for invoicing
- [ ] Mark read / clear all

#### 6.3 Inventory Management
- [ ] Stock tracking per ingredient/item
- [ ] Low stock threshold alerts
- [ ] Stock deduction on order (optional)
- [ ] Manual stock update

#### 6.4 Report Filters & Exports
- [ ] Date range, category, role filters on all reports
- [ ] PDF export (DomPDF)
- [ ] Excel export (Maatwebsite)

#### 6.5 Audit Log (Owner view)
- [ ] Tenant-scoped audit trail
- [ ] Filter by user, action, date

#### 6.6 UI Polish
- [ ] Loading skeletons
- [ ] Empty states with CTAs
- [ ] Mobile responsiveness audit
- [ ] Toast notifications
- [ ] Dark mode toggle

---

### Phase 7 — Deployment

- [ ] `composer install --no-dev` on server
- [ ] `.env.production` setup
- [ ] Apache virtual host config for API subdomain
- [ ] `php artisan migrate --force` on server
- [ ] Queue worker via cron
- [ ] Storage symlink + permissions
- [ ] `npm run build` → upload `dist/` to server
- [ ] Apache SPA catch-all config
- [ ] WebSocket setup (Pusher free tier or polling fallback)
- [ ] Rate limiting on auth endpoints
- [ ] CORS locked to production domain
- [ ] Final smoke test all roles
