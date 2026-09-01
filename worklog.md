# Internal Collection & Loan Management System - Worklog

## Project Overview
Internal web-based Collection & Loan Management System (SRS v1.0).
Employee-driven workflow: Customer Registration -> Account Creation -> Installment Setup -> Daily Collection -> Receipt -> Balance Update -> Notification -> Verification -> Reporting -> Audit. No customer login.

## Tech Stack
- Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (New York)
- Prisma ORM (SQLite) at `db/custom.db`
- Session-based auth (cookie `cls_session`), scrypt password hashing
- Recharts for dashboard charts, jsPDF-style export via client
- Single user route: `/` only (client-side view switching via Zustand)

## Task ID: 1 — Foundation (COMPLETED)
Agent: main
Work Log:
- Wrote `prisma/schema.prisma`: User, Session, Customer, Account, Installment, Collection, Receipt, Notification, AuditLog, SystemSetting. Decimal fields used without native type (SQLite compat).
- Ran `bun run db:push` -> schema in sync.
- `src/lib/auth.ts`: scrypt password hashing, session create/get/destroy, cookie helpers, role constants, permission helpers (canManageFinancialConfig, canReverseTransactions).
- `src/lib/money.ts`: integer-math money helpers (toMoney, addMoney, subMoney, mulMoney, cmpMoney, formatMoney/formatMoneyPlain) -> INR formatting.
- `src/lib/calc.ts`: calculation engine supporting FLAT (FLAT_PERIOD/MONTHLY/YEARLY) and REDUCING (amortized EMI) interest. Produces full installment schedule with due dates.
- `prisma/seed.ts` + ran it: 5 users (admin/manager/2 collectors/accountant), 9 system settings, 10 customers, 8 loans (mixed flat/reducing), generated installment schedules, simulated collection history with receipts + notifications + audit log entries.

## Login Credentials (demo)
- admin@cls.local / admin123 (ADMIN)
- manager@cls.local / manager123 (BRANCH_MANAGER)
- collector@cls.local / collector123 (COLLECTION_EMPLOYEE)
- accountant@cls.local / account123 (ACCOUNTANT)

## Suggested API Route Map (for Task 2)
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- GET/POST /api/customers, GET/PATCH /api/customers/[id], GET /api/customers/[id]/accounts, GET /api/customers/[id]/payments
- GET/POST /api/accounts, GET /api/accounts/[id], GET /api/accounts/[id]/schedule, POST /api/accounts/[id]/recalculate
- GET/POST /api/collections, GET /api/collections/[id], POST /api/collections/[id]/reverse, POST /api/collections/[id]/receipt (increment printCount)
- GET /api/reports?type=daily|weekly|monthly|sixmonthly|yearly|customer|employee|paymentmode|outstanding|overdue (with filters: from,to,customerId,accountId,employeeId,paymentMode,status,area)
- GET /api/dashboard
- GET/POST /api/employees, PATCH /api/employees/[id]
- GET /api/audit-logs (with filters)
- GET/POST /api/notifications
- GET/PUT /api/settings

## Next Steps
- Task 2: build all API routes (one full-stack-developer subagent, detailed contract above).
- Task 3: build the single-page frontend (one full-stack-developer subagent).
- Task 4: agent-browser verification + cron job.

---
Task ID: 2 — API Layer (COMPLETED)
Agent: main
Work Log:
- Created src/lib/api.ts (json/error helpers, withAuth wrapper, async parseBody, date helpers).
- Created src/lib/audit.ts (logAudit helper writing to AuditLog with old/new values).
- Auth: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me (cookie-based session).
- Customers: GET/POST /api/customers (search by name/mobile/customerId, filters status/area; enriched with totals). GET/PATCH /api/customers/[id]. GET /api/customers/[id]/accounts. GET /api/customers/[id]/payments (chronological running balance).
- Accounts: GET/POST /api/accounts (POST runs calculateLoan + creates installment schedule; validates active customer). GET/PATCH /api/accounts/[id]. GET /api/accounts/[id]/schedule.
- Collections: GET /api/collections (filters: from,to,customerId,accountId,employeeId,paymentMode,status). POST /api/collections (validates amount <= outstanding, prevents duplicates within 60s, generates receipt no, allocates to installments FIFO, creates receipt + notification, marks account COMPLETED). GET /api/collections/[id]. POST /api/collections/[id]/reverse (de-allocates installments, reopens account, audited). POST /api/collections/[id]/receipt (increments printCount).
- Reports: GET /api/reports?type=daily|weekly|monthly|sixmonthly|yearly|customer|employee|paymentmode|outstanding|overdue|accountstatus|reconciliation with filters from,to,customerId,accountId,employeeId,paymentMode,status,area.
- Dashboard: GET /api/dashboard (KPIs, byMode, byEmployee, overdueAccounts, todayCollections, 6-month trend, statusBreakdown).
- Employees: GET/POST /api/employees (admin/manager gate; enriched with collection stats). PATCH /api/employees/[id].
- Audit: GET /api/audit-logs (filters action,entity,userId,from,to).
- Notifications: GET/POST /api/notifications.
- Settings: GET/PUT /api/settings (admin/manager gate).
- Seed: POST /api/seed (admin gate, re-runs seed).
- Fixed parseBody to async req.json(). Lint passes. Smoke-tested login/dashboard/customers/accounts/reports — all working.

Stage Summary:
- All MVP API endpoints implemented and verified via curl.
- Session cookie auth works end-to-end.
- Calculation engine verified via seed data (mixed flat/reducing loans, correct balances).

---
Task ID: 3 — Frontend (COMPLETED)
Agent: main
Work Log:
- Updated src/app/globals.css with emerald/teal primary palette (light + dark), custom scrollbar, print styles for receipts.
- src/lib/store.ts: Zustand store (user, booted, view, selected ids, collectionPrefill, searchQuery, role permission helpers).
- src/lib/format.ts: formatMoney/formatDate/formatDateTime helpers, apiFetch wrapper (credentials + JSON), downloadCSV, STATUS_COLORS, ROLE_COLORS/LABELS.
- src/components/theme-provider.tsx: next-themes provider.
- src/app/layout.tsx: ThemeProvider + Sonner toaster + metadata.
- src/app/page.tsx: root client component - boots auth, renders Login or AppShell.
- src/components/login.tsx: split-screen login with brand panel + demo credential quick-fill buttons.
- src/components/ui-bits.tsx: StatCard, SectionCard, EmptyState, LoadingRows helpers.
- src/components/receipt-print.tsx: print-ready receipt component (forwardRef, @media print isolation).
- src/components/app-shell.tsx: sidebar nav (10 modules with role-restricted visibility), header (search + theme toggle + user menu + re-seed), view router, sticky footer.
- Views (src/components/views/):
  - dashboard.tsx: 8 KPI cards, 6-mo trend AreaChart, payment-mode Donut, employee BarChart, status Pie, today's collections table, overdue accounts table with collect shortcuts.
  - customers.tsx: list + search + status/area filters, new customer dialog, detail Drawer with Overview/Accounts/Payment History tabs.
  - accounts.tsx: list + search + status filter, new account dialog with LIVE calculateLoan preview (total interest, payable, installment, schedule), detail Drawer with installment schedule table.
  - collections.tsx: list + filters (date/employee/mode/status) + totals footer, New Collection dialog (4-step: search customer -> select account -> summary card -> enter amount), receipt dialog with Print, reverse dialog (role-gated).
  - receipts.tsx: searchable receipt list, print-ready receipt viewer.
  - reports.tsx: 12 report types (daily/weekly/monthly/sixmonthly/yearly/customer/employee/paymentmode/outstanding/overdue/accountstatus/reconciliation), dynamic filters, summary KPIs, CSV export + print.
  - employees.tsx: list with collection stats, add/edit dialogs, role badges.
  - audit-logs.tsx: filterable list with expandable old/new JSON details.
  - notifications.tsx: list + send notification dialog.
  - settings.tsx: grouped settings form (Branch/Codes/Notifications/Security) with switches.
- Fixed lint error: extracted SidebarContent to top-level renderSidebar function.
- Fixed runtime error: Radix Select doesn't allow empty string value="" in SelectItem — changed employee filter to use 'ALL' sentinel in collections.tsx and reports.tsx.
- Verified via agent-browser: login -> dashboard (charts+data) -> collections (list+filters) -> new collection workflow (search -> select -> record -> receipt RCP-00020 generated) -> all 8 views render without errors -> reports show data -> customers list (11 customers).

Stage Summary:
- Full single-page frontend complete and browser-verified. Lint clean. No runtime errors.
- Key workflow (Customer -> Account -> Collection -> Receipt) works end-to-end.
- Sticky footer, responsive sidebar (Sheet on mobile), dark mode toggle, print-ready receipts all functional.

---
Task ID: 4 — Verification & Cron (COMPLETED)
Agent: main
Work Log:
- Ran `bun run lint` — clean (0 errors) after fixing SidebarContent extraction + Radix empty-value SelectItem.
- agent-browser end-to-end verification:
  - Login screen renders, filled admin credentials, signed in successfully.
  - Dashboard: 8 KPI cards, 4 charts (trend/pie/bar/status), today's collections table, overdue accounts table — all populated with seed data.
  - Collections view: list with filters, totals footer, View/Print/Reverse actions.
  - New Collection workflow tested end-to-end: searched "lakshmi" -> selected CUST-0001 -> selected LN-0001 (Outstanding ₹44,500) -> entered ₹5,500 -> Record Collection -> toast "Collection recorded: RCP-00020" -> receipt dialog opened with Print button.
  - All 8 views clicked through (Customers, Accounts, Collections, Receipts, Reports, Employees, Audit Logs, Notifications, Settings) — zero runtime errors.
  - Reports daily view shows the newly created RCP-00020 collection.
  - Customers list shows 11 customers with outstanding balances.
- Created scheduled cron job (ID 350457, fixed_rate 900s / 15min, webDevReview) for autonomous continuation.
- Final API smoke test: login 200, dashboard 200, all endpoints clean.

Stage Summary:
- Project COMPLETE and browser-verified.
- No lint errors, no runtime errors, all 8 modules functional.
- Cron job scheduled for ongoing development every 15 minutes.

## Current Project Status
FULLY OPERATIONAL. Internal Collection & Loan Management System v1.0 (MVP Phase 1) complete:
- Auth (4 roles), Dashboard, Customers, Accounts/Loans (with calc engine), Collections (with receipts), Reports (12 types + CSV/print export), Employees, Audit Logs, Notifications, Settings.
- Sticky footer, responsive sidebar, dark mode, print-ready receipts.
- Decimal-safe money handling, FIFO installment allocation, duplicate-prevention, reversal workflow with audit trail.

## Unresolved / Future (Phase 2)
- Multi-branch support (schema has no branch entity yet)
- Real SMS gateway integration (currently simulated as 'SENT')
- Manager approval workflow for reversals (setting exists, not enforced)
- PWA / mobile collector interface
- GPS location capture for field collections
- Customer allocation by route/area
- Advanced analytics / predictive overdue
