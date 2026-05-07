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

## Current Progress
| Phase | Status |
|---|---|
| Phase 1 — Foundation & Auth | 🔲 Not Started |
| Phase 2 — Superadmin Panel | 🔲 Not Started |
| Phase 3 — Module 1: Restaurant | 🔲 Not Started |
| Phase 4 — Module 2: Hotel | 🔲 Not Started |
| Phase 5 — Module 3: Feedback | 🔲 Not Started |
| Phase 6 — Analytics & Polish | 🔲 Not Started |
| Phase 7 — Deployment | 🔲 Not Started |

## Resume Instructions
1. Read `plan.md` for full task checklist
2. Check the progress table above to find current phase
3. Update this file's progress table after each phase completes
4. Keep `plan.md` checkboxes updated as individual tasks complete

## Key Decisions (don't re-discuss these)
- Tenant isolation via `tenant_id` global scope on all models
- Module gating: API routes + frontend nav both check `tenant_modules`
- QR codes generated server-side as PNG
- Feedback: rating > 3 → Google Reviews + AI suggestions; ≤ 3 → internal only
- Physical printed QR placed at hotel reception for feedback module
- No Node.js on server — React compiles to static files, served via Apache
