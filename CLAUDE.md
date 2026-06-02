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
- [x] List all tenants (search, filter)
- [x] Create / edit / suspend / delete tenant
- [x] Assign modules to tenant (toggle Module 1/2/3)
- [x] View tenant usage stats

#### 2.2 Subscription & Plans
- [x] CRUD subscription plans
- [x] Assign plan to tenant
- [x] View all active subscriptions
- [x] Manual plan override / extend

#### 2.3 Payment Gateways
- [x] Stripe integration — customer, subscription, webhook
- [x] Razorpay integration — subscription, webhook
- [x] Per-tenant payment gateway config
- [x] Monthly recurring billing logic

#### 2.4 Database Management UI
- [x] View table stats per tenant
- [x] Export tenant data
- [x] Purge old audit logs

#### 2.5 Audit Logs
- [x] Global audit log viewer
- [x] Auto-log via Model Observer

#### 2.6 Superadmin Frontend
- [x] Sidebar: Tenants, Plans, Subscriptions, Payments, Audit Logs
- [x] Tenant detail page with module toggles
- [x] Plan builder UI
- [x] Subscription list with status badges

---

### Phase 3 — Module 1: Restaurant & Order Management

#### 3.1 Menu Management
- [x] Menu categories CRUD
- [x] Menu items CRUD (name, price, image, category, available toggle)
- [x] Bulk enable/disable items
- [x] Menu preview

#### 3.2 Table Management
- [x] Tables CRUD (number, capacity, floor/section)
- [x] Table status view (free/occupied + occupied since)
- [x] QR code generation per table

#### 3.3 Waiter Dashboard
- [x] View all tables with status
- [x] Select table → open order form
- [x] Browse menu by category, add items with qty + notes
- [x] Submit order → triggers kitchen notification
- [x] View active orders for their tables

#### 3.4 Kitchen Dashboard (Chef)
- [x] Realtime order feed via WebSocket
- [x] Sound notification on new order
- [x] Order cards: table, items, notes, time elapsed
- [x] Status update: Pending → Preparing → Ready
- [x] Color coded by status and urgency

#### 3.5 Customer QR Order Flow
- [x] Public route: `/menu/{tenant_slug}/{table_id}`
- [x] Responsive mobile menu (no login)
- [x] Add to cart, place order
- [x] Order confirmation page

#### 3.6 Billing Counter
- [x] View orders ready for billing
- [x] Generate invoice: subtotal, GST, discount, total
- [x] Payment methods: cash, card, UPI, split
- [x] UPI QR on printed bill
- [x] PDF invoice download
- [x] Split payment between room and direct
- [x] Customer record (name/phone optional)

#### 3.7 Owner — Orders & Revenue
- [x] Live order board
- [x] Today's revenue widget
- [x] Export orders PDF/Excel (date range)
- [x] Expense tracking
- [x] Expense report

---

### Phase 4 — Module 2: Hotel & Room Management

#### 4.1 Room Setup
- [x] Room CRUD (number, type, floor, price/night, amenities)
- [x] Room status board (available/occupied + since when)
- [x] Room type pricing

#### 4.2 Guest Management
- [x] Guest profile: name, phone, email, ID proof, company/sponsor
- [x] Guest history

#### 4.3 Booking Management
- [x] New booking form: guest, room, check-in, check-out, advance
- [x] Booking calendar view
- [x] Check-in flow
- [x] Check-out flow with consolidated bill
- [x] Booking status management

#### 4.4 Room Service Orders
- [x] Orders placed against room number
- [x] Charges accumulate on booking
- [x] Checkout shows total room + service charges

#### 4.5 Reports
- [x] Occupancy report
- [x] Revenue per room type
- [x] Guest list export
- [x] Outstanding payments report

---

### Phase 5 — Module 3: Feedback & Review System

#### 5.1 Feedback QR Setup
- [x] Generate unique QR per tenant
- [x] QR links to `/feedback/{qr_token}`
- [x] Label placement (reception, table, room)
- [x] Downloadable QR PNG for printing

#### 5.2 Feedback Submission Page
- [x] Mobile-optimized public page
- [x] Star rating (1–5)
- [x] Optional comment
- [x] Routing: >3 → Google Reviews + AI suggestions; ≤3 → internal apology

#### 5.3 AI Review Suggestions
- [x] Call OpenAI on rating > 3
- [x] Generate 3 compliment suggestions
- [x] "Copy & Open Google Review" button

#### 5.4 Google Review Config
- [x] Owner enters Google Place ID / review URL
- [x] Test link preview

#### 5.5 Feedback Dashboard
- [x] All feedback list (date, rating, comment)
- [x] Average rating widget
- [x] Rating breakdown chart
- [x] Filter by date / rating
- [x] Internal vs public split view

---

### Phase 6 — Analytics, Notifications & Polish

#### 6.1 Owner Analytics Dashboard
- [x] Revenue chart (daily/weekly/monthly)
- [x] Top selling menu items
- [x] Table turnover rate
- [x] Peak hours heatmap
- [x] Occupancy rate (if hotel module on)
- [x] Expense vs revenue comparison

#### 6.2 Notification System
- [x] In-app notifications (bell icon) all roles
- [x] Chef: new order sound + badge
- [x] Owner: low inventory, new booking, checkout due
- [x] Billing: order ready for invoicing
- [x] Mark read / clear all

#### 6.3 Inventory Management
- [ ] Stock tracking per ingredient/item
- [ ] Low stock threshold alerts
- [ ] Stock deduction on order (optional)
- [ ] Manual stock update

#### 6.4 Report Filters & Exports
- [x] Date range, category, role filters on all reports
- [x] PDF export (DomPDF)
- [ ] Excel export (Maatwebsite)

#### 6.5 Audit Log (Owner view)
- [x] Tenant-scoped audit trail
- [x] Filter by user, action, date

#### 6.6 UI Polish
- [x] Loading skeletons
- [x] Empty states with CTAs
- [x] Mobile responsiveness audit
- [x] Toast notifications
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

---

### Phase 8 — Zomato/Swiggy POS Integration

Strategy: 30 restaurants go live WITHOUT the official Zomato API. Biller does manual
entry for Zomato/Swiggy orders. The POS owns all menu/order/outlet data natively so the
eventual Zomato API is just a sync adapter on top — no rework. Adapter ships behind a
per-tenant feature flag, activated only after Zomato approves us.

#### 8.A Menu data model (full Zomato parity)
- [x] Migrations: order_items variant/addon/GST cols; menu_categories parent_id + is_oos + tag;
      menu_items GST slab/cgst_sgst/packaging/beverage/meat/nutrition/serving; menu_item_variants;
      addon_groups + addons; category_schedules (all additive, verified on MySQL + rollback)
- [x] Models: MenuItemVariant, AddonGroup, Addon, CategorySchedule + relations on MenuItem/MenuCategory/Order/OrderItem
- [x] OrderService — single source of truth for order creation (variant price, addon snapshot, per-line GST 5(9) bifurcation). Verified against real data.
- [x] Order::recalculate() aggregates per-line GST (falls back to tenant rate for legacy lines)
- [x] Owner MenuController API: variants CRUD, addon-groups/addons CRUD, category schedules, category OOS/parent, new item fields. Routes registered.
- [x] Frontend owner menu UI: variants, add-on groups (min/max), dietary/beverage/meat tags, GST slab + CGST/SGST,
      packaging charge, nutrition, serving info, sub-categories, category OOS toggle, day/time schedule editor.
      Files: MenuManager.jsx (CategoryPanel+ItemForm extended) + new VariantsAddonsManager.jsx. Builds clean.
- [x] Wired POS order paths (waiter, customer QR, billing newOrder/takeaway/addItems) through OrderService.
      Magic Tables x2 (Razorpay/UPI payment paths) deliberately left as-is — payment-critical, separate consumer app, no variant/addon need yet.
- [x] Customer/Waiter/Billing menu APIs expose variants + add-ons via MenuCategory::orderableMenu(); respect category isAvailableNow() (OOS + parent OOS + day/time schedule). Verified end-to-end.

#### 8.B Manual aggregator orders (the go-live feature)
- [x] orders.source += 'aggregator'; platform/external_order_id/aggregator_status/no_cutlery cols
- [x] Billing screen: channel buttons Takeaway / Zomato / Swiggy (brand-colored), platform-aware order panel
      (external order id field, optional customer name), order entry via OrderService → storeAggregator. Builds clean.
- [x] Per-channel reporting: todayRevenue returns `channels[]` (count + total per channel, aggregator split by platform)

#### 8.C Order ops parity (Zomato order-management list)
- [x] Order rejection with reason codes — order_rejection_reasons table + seeder (9 Zomato-aligned reasons,
      zomato_message_id column reserved for post-approval mapping), IOOS captures rejected_item_ids.
      OrderActionController (reject/cancel/markOos) + routes for chef/billing/owner. Chef dashboard reject modal.
- [x] Mark item/variant/category OOS — backend endpoint + service ready; owners toggle via menu manager;
      kitchen IOOS handled via reject flow. (Minor follow-up: standalone OOS button on kitchen card.)
- [x] Merchant-agreed cancellation / order-return loop with audit closure (OrderActionController::cancel)
- [x] Aggregator platform badges (Zomato/Swiggy) + no_cutlery indicator on kitchen cards. Builds clean.

#### 8.D Outlet management
- [x] outlet_hours table (per-channel operational hours) + tenant zomato_online/swiggy_online/offline_reason/offline_until.
      OutletController (show/toggleChannel/setHours) with 7-reason offline glossary. Routes registered.
- [x] Per-channel outlet on/off toggle + hours editor in owner Settings (OutletCard). Offline-reason prompt on turn-off.
- [x] Zomato Help Centre link in Settings. Builds clean.

#### 8.E Zomato API adapter (post-approval, behind feature flag)
- [ ] ZomatoSyncService: map POS models → menu-push / order-push / status APIs
- [ ] Webhook controller for live order flow (order push, KPT, accept/reject, fetch status)
- [ ] Per-tenant feature flag to activate; manual restaurants unaffected until flipped
