# School Connect — Monorepo

Multi-tenant school management app: parent fee payments, teacher progress reports, admin finance console.

## Repo layout

```
apps/api          NestJS REST API (Node 22, Prisma 5, PostgreSQL)
apps/web-admin    Next.js 16 admin console (Accounts/Admin staff)
apps/mobile       Flutter 3 mobile app (Parents + Teachers)
packages/types    Shared TypeScript types & DTOs
packages/config   Shared ESLint / Prettier / tsconfig base
infra/            docker-compose (local dev), Terraform (prod)
```

## Prerequisites

- Node 22, pnpm 9
- Docker (for local Postgres + Redis + LocalStack)
- Flutter 3.x (for mobile; not required for API/web work)

## Local dev setup

```bash
pnpm install
pnpm docker:up          # starts postgres:16, redis:7, localstack
cp .env.example apps/api/.env
pnpm db:generate        # runs prisma generate
pnpm db:migrate         # runs prisma migrate dev
pnpm dev                # starts all apps in parallel via Turborepo
```

API runs on http://localhost:3000/v1  
Admin runs on http://localhost:3001  
Health check: GET http://localhost:3000/v1/health

## Key architectural invariants

1. `tenant_id` is NEVER trusted from the request body. It is resolved by `TenantMiddleware` from the `X-Tenant-ID` header or subdomain only.
2. Parent role NEVER queries students directly — always via `student_parents` joined on `parent_id = req.user.id`.
3. Payment webhook handlers MUST verify the gateway HMAC signature before processing. Reject unverified requests with 401.
4. Refresh tokens are stored as bcrypt hashes. The raw token is returned to the client once only.
5. Payment gateway credentials per tenant live in `tenant_payment_gateways` (set from the platform console); the key secret and webhook secret are AES-256-GCM encrypted with the `PAYMENT_SECRETS_KEY` env var and are never returned by the API — never in the `tenants` table.
6. All money values: `Decimal` / `NUMERIC(12,2)` in DB; integer paise/pence arithmetic in application code.

## Package manager

pnpm only — never use npm or yarn in this repo.

## Demo school

`pnpm --filter api seed:demo` builds/resets the fictional "Green Valley Public School" (school code `gvps-demo`). It refuses to touch any school not flagged `features.isDemo`. Logins: `apps/api/prisma/DEMO_SEED.md`.

## Languages (English, Kannada, Hindi)

Spec: `docs/SPEC-languages.md`. English is the source of truth; any missing translation shows English.

- **Mobile:** `apps/mobile/lib/l10n/app_{en,kn,hi}.arb` (Flutter gen-l10n). Widgets use `context.l10n.key`; code without a context uses `currentL10n`. Run `flutter gen-l10n` after editing ARB files.
- **Console:** `apps/web-admin/messages/{en,kn,hi}.json` (next-intl, keys type-checked). Use `useTranslations('namespace')`. `pnpm --filter web-admin check:i18n` checks for hard-coded text and stray keys. The marketing site stays English (`lib/strings.ts`).
- **API:** `users.preferred_language`, `tenants.default_language`, `PATCH /users/me/language`; login and `/users/me` return `language`. Errors the apps translate carry `error.code` (throw `{ code, message }`).
- **Review spreadsheet:** `node tools/i18n/review-csv.mjs export|import`.
- No hard-coded user-facing text, no string concatenation for sentences, digits 0–9, ₹ Indian grouping, DD/MM/YYYY.

## Database

PostgreSQL 16. Schema managed by Prisma 5 (pinned — do not upgrade to v6+ until Node 22 compat is confirmed).

After editing `prisma/schema.prisma`:
```bash
pnpm db:migrate    # dev: creates migration + applies it
pnpm db:generate   # regenerates the Prisma client
```

## Feature modules (apps/api/src/modules/)

| Module | Status | Responsibility |
|---|---|---|
| health | done | GET /health |
| tenants | done | Tenant CRUD, branding, feature flags, super_admin + admin self-management |
| auth | done | Phone OTP via Firebase, JWT issue/refresh/revoke |
| users | done | User profiles |
| students | done | Student records, parent linkage |
| fees | done | Fee structures, student fee assignments, offline payments, adjustments |
| payments | done | Razorpay gateway, webhook handler, idempotency |
| reports | done | Teacher → student → parent progress reports, read receipts |
| notifications | done | FCM push (multicast), Twilio SMS, broadcast, audit log, FCM token management |
| files | done | S3 upload/download, presigned URLs, tenant-isolated key paths |
| calendar | done | School calendar: admin-managed events + PTMs (`school_events`), unified `GET /calendar?from=&to=` feed with holidays for parents and teachers (mobile month-grid calendar). Optional: `calendar` flag, off by default; every endpoint answers `FEATURE_DISABLED` without it and the mobile tiles hide (flag read from `GET /tenant` `features`) |
| consent-forms | done | Parent consent for an event (e.g. a school trip), part of the `calendar` flag: an admin sends one form per event to the parents of chosen classes (push in the parent's language) with the wording and a last day to sign; any linked parent signs for their child by typing their full name and ticking a confirmation, and can change the answer until the deadline (school-local). Console Settings → Events shows answers per student, reminds parents who haven't answered, and downloads CSV. A form, or an event, with answers can't be deleted; every create/sign/remind is audit-logged |
| syllabus | done | Premium (`syllabus` flag): per class-section and subject, an ordered topic list (optional unit) with a target date each, kept by the admin in the console (editor, copy to other sections, Excel import `/syllabus/import/template|validate|commit`). The subject teacher (`TeacherSubject`) or an admin marks topics covered (no future dates) from the mobile app or console. On time / late / days late are derived in `syllabus.math.ts`, never stored, and shown to staff only (console Syllabus page + dashboard roadmap); parents get `/syllabus/child/:studentId` (own child via student_parents) with % covered and topics, no target dates. Every plan save / copy / import / tick is audit-logged |
| subscriptions | done | Plan (`tenants.subscription_plan`: basic / premium / premium_max) and period (`subscription_starts_on/ends_on`, one year from creation by default) — docs/SPEC-subscriptions.md. Status is derived (`common/subscription.ts`): renewal due from 30 days before the end, 7 days' grace after it, then `TenantMiddleware` answers `403 SUBSCRIPTION_EXPIRED` for the school (a valid super_admin token still passes). Super admin: plan at creation, `PATCH /tenants/:id/subscription` (plan applies its module preset), `POST /tenants/:id/renew` (+ `subscription_renewals` history, audit-logged), `GET /platform/renewals`. Console grace banner for admin/accounts |
| platform-dashboard | done | `GET /platform/dashboard` (super_admin): schools by plan and status, revenue under contract and due for renewal, rule-based suggestions in `platform-insights.ts` (renew, switched off, extra students, upgrades, low parent app use, no attendance, not set up, leads) |
| head-office | done | Franchise view (Premium and Premium Max schools): `school_groups`, `tenants.group_id`, role `head_office` (email + password at the no-school-code login, `users.group_id`). `GET /head-office/overview` and `/head-office/branches/:id` are read-only and scoped to the user's own group; super admin manages groups and logins at `/platform/groups` |
| attendance | done | Daily class attendance (bulk upsert), absent/correction pushes, school holidays, summaries + CSV report |
| parent | done | Parent home summary (fees/today/attendance in one call), per-child notices |
| fee-reminders | done | Daily Bull job: fee-due pushes 3 days before and on the due date |
| broadcasts | done | Notice/homework sent items, per-parent "seen" tracking, unseen-parent lists |
| public-site | done | Marketing-site contact form (stored + SMTP email, optional plan interest), "Download the price list" form (`POST /public/pricing`: school name, email, phone → stored `pricing_requests` + SMTP email, returns `Schoolinkd_Plans_and_Pricing_2026-27.pdf`; plan prices live only in `pricing-plans.ts`), cookie-free daily event counts; Platform "Leads" views |
| class-reminders | done | Teacher "next class" push 1–5 min before each period (in-process, once per slot per day) |
| payment-gateway | done | Per-school Razorpay keys, encrypted (platform console) |
| ai | done | Premium (`aiInsights`): Claude client with per-school cap + usage log, notice translation, report remark drafts — docs/SPEC-ai.md |
| assistant | done | Premium plain-language questions: the model picks one fixed read-only query (staff: attendance, absentees, fees, collections, strength, workload; parents: own child's attendance, fees, homework, notices) — docs/SPEC-ai.md |
| petty-cash | done | Optional (`pettyCash` flag). Admin-console-only cash ledger for the accountant: float top-ups, advances to staff/registered payees, expenses, settlements/returns, admin approval above a threshold, categories/payees/settings, CSV export, optional notes-and-coins tracking (`trackDenominations` setting: each cash entry records the notes in/out, which must net to its float effect; notes in hand = latest physical cash count + approved entries after it), deterministic forecast + savings rules (needs >= 3 months of approved expenses; optional AI phrasing under `aiInsights`) |
| hrms | done | Optional (`hrms` flag, paid). HR & Payroll: employee directory (login staff + ground staff with no login; PAN/Aadhaar/UAN/ESI/bank AES-256-GCM encrypted, masked everywhere, audit-logged reveal; Excel/CSV import; HR documents), staff attendance (admin/accounts mark; school holidays + weekly offs), leave types/requests/derived balances (mobile apply/cancel, console approve with push), effective-dated salary structures, per-school PF/ESI/PT settings, pay runs (DRAFT→REVIEW→APPROVED→LOCKED, accountant prepares / admin approves + locks, mark-paid), payslip PDFs, bank-transfer + salary-register CSV. Mobile: own payslips + leave for staff with a linked employee |
| staff-documents | done | Shared staff folders and files (console "Shared Documents"): every teacher/admin/accounts user of the school sees and downloads all of them; anyone creates folders and uploads (20 MB, PDF/images/Office/text); rename/delete only by the creator or an admin, a folder only when empty. Keys `private/{tenant}/staff-docs/{folderId}/` are refused by the generic `/files` routes |
| alerts | done | Premium pattern warnings (attendance, risk, fees, money anomalies, workload) + Monday summary, nightly — docs/SPEC-ai.md |

## Optional per-school modules (feature flags)

`tenants.features` flags are off unless set; only the platform `super_admin` switches them (`PATCH /tenants/:id/features`, `UpdatePlatformFeaturesDto`, toggles in the platform console tenant page). Add one by extending `OptionalFeature` in `apps/api/src/common/tenant-features.ts`, the DTO, and `OPTIONAL_MODULES` in the platform tenant page; endpoints call `assertFeatureEnabled` or `@UseGuards(FeatureGuard('<flag>'))` (`common/guards/feature.guard.ts`; 403 `FEATURE_DISABLED`), the web-admin hides the nav item via `useTenantFeatures` and gates the page with `PlanGate` or its own empty state. Current flags: `transferCertificate`, `feeConcession`, `aiInsights`, `pettyCash`, `calendar`, `hrms`, and the plan flags `timetable` (timetable routes, today's periods, class reminders), `staffDocuments`, `advancedReports` (attendance report + `/insights` fee reports, not the dashboard totals/forecast), `customBranding` (a school changing its own logo, background or colours), `syllabus` (syllabus progress).

Plans (docs/SPEC-subscriptions.md) are stored on the school (`subscription_plan`) and are presets over these flags (`PLAN_PRESETS` in `common/subscription.ts`, mirrored in `app/platform/plans.ts`): Basic = none; Premium = timetable, staffDocuments, advancedReports, customBranding, calendar, feeConcession, transferCertificate, pettyCash, syllabus; Premium Max (formerly "Gold") = Premium + hrms + aiInsights. Picking a plan sets its flags at once; a flag on beyond the plan is an add-on. Prices live only in `pricing-plans.ts`. The four plan flags were always on before plans, so migration `20261022090000_plan_feature_flags` switched them on for every existing school; new schools start on Basic. Migration `20261026090000_syllabus` switched `syllabus` on for schools that already had every Premium module. There is no student-count limit in code.

## Subscription and head office invariants

- Subscription status is never stored: it is derived from `subscription_ends_on` in the school's timezone. Only the platform team (super_admin) changes plans, dates and renewals; every change is audit-logged and renewals are append-only history.
- An expired school (past the 7-day grace) is refused in `TenantMiddleware` for everyone except a request carrying a valid super_admin token. `is_active` stays a separate manual switch.
- `head_office` is read-only and cross-school: `RolesGuard` refuses it on every route that does not list `Role.head_office`, and the head office routes are GET only. Its group always comes from its own `users.group_id`, never from the request; a school outside the group answers 404, and only Premium / Premium Max schools that are not switched off show data.

## Petty cash invariants (apps/api/src/modules/petty-cash)

- Admin console only. Every route is `@Roles(admin, accounts, super_admin)` (super_admin follows the other finance controllers: admin-equivalent) behind `PettyCashFeatureGuard`; parents/teachers never reach it, and petty-cash receipt keys (`private/{tenant}/petty-cash/`) are refused by the generic `/files` upload, signed-url and delete endpoints.
- Ledger is append-only: no edit, no hard delete. Corrections are a void (with reason) plus a new entry. Float and open advances are derived from APPROVED rows only, never stored.
- Entries above `approvalThreshold` start PENDING and affect nothing until an admin approves. An admin entering one above the threshold self-approves (recorded in the audit log); an accountant never approves, and nobody approves their own pending entry. Approval and voiding re-check that the float stays >= 0 and no disbursement is over-settled.
- Recipients are exactly one of a staff user (teacher/admin/accounts of the same school) or a registered `PettyCashPayee`; no free-text names. Payees are deactivated, never deleted.
- Money: NUMERIC(12,2) in the DB, integer paise inside the service (`petty-cash.math.ts`), rupee strings at the API boundary. Float-changing writes take a per-school advisory lock. Every mutation writes an `AuditLog` row.
- Forecast and savings rules are deterministic code (`petty-cash.forecast.ts`); the model may only rephrase rule-computed findings, and the reply is discarded unless every number in it came from those findings.

## HR & payroll invariants (apps/api/src/modules/hrms)

- Flag `hrms` (platform-only, off by default). Console routes (`/hrms/...`) are `@Roles(admin, accounts, super_admin)` behind `HrmsFeatureGuard`; approving/locking a pay run and saving statutory settings are admin/super_admin only. Staff self-service (`/hrms/me/...`) is `@Roles(teacher, admin, accounts)`; parents and the developer role are refused everywhere.
- **Own-data-only:** the employee for `/hrms/me` is ALWAYS resolved from the authenticated user (`employees.user_id` within the tenant) and no self-service route or DTO accepts an employee id. A payslip of another employee, or of a run that is not LOCKED, answers 404. Never add an `employeeId` parameter to a `/hrms/me` route.
- **Sensitive-field encryption:** PAN, Aadhaar, UAN, ESI number and bank account/IFSC/holder are stored only as AES-256-GCM ciphertext (`common/secret-box.ts`, same scheme and `PAYMENT_SECRETS_KEY` as the payment-gateway secrets). List/detail responses and audit logs carry masks and field names only; full values leave the API only through `POST /hrms/employees/:id/reveal` (admin/accounts, audit-logged) and the bank-transfer CSV (locked run, audit-logged). Never log them or put them in a diff.
- **HR key path:** HR documents live under `private/{tenantId}/hr/{employeeId}/` and are served only by the hrms module; the generic `/files` upload, signed-url and delete routes refuse them (`isModuleOwnedKey`).
- Employees are never hard-deleted (exit/reactivate). Salary structures are immutable and effective-dated (a change is a new row; the one in force at month end is used).
- **Payroll:** money is NUMERIC(12,2) in the DB and integer paise in `payroll.math.ts`. Statutory PF/ESI/PT use per-school configurable rates, ceilings and slabs (Karnataka PT slabs seed as an editable default the school's accountant must verify); TDS is a manual deduction; there is no filing, Form 16 or challan. Pay run lines are snapshots (earnings, deductions, LOP, bank details), so later structure/employee edits never rewrite history; corrections go in the next run as adjustments. One non-cancelled run per school per month (advisory lock + partial unique index). A LOCKED run is immutable; only mark-paid (once, with a bank reference) is allowed afterwards. The accountant prepares, an admin approves; accounts can never approve, and an admin approving a run they prepared is recorded as `selfApproved` in the audit log. Every mutation and sensitive reveal writes an `AuditLog` row.
- Leave balances are derived (allowance + capped carry-in from the previous leave year - approved use; pending is held back), never stored. Approved leave writes `ON_LEAVE`/`HALF_DAY` rows into staff attendance (linked by `leave_request_id`); unpaid leave types and absences become loss-of-pay days in payroll.

## Imports

- Onboarding import (`/imports/template|validate|commit`, admin + super_admin): Classes/Users/Teachers/Students/Fee Structures only.
- Vendors & ground staff import is a SEPARATE template (`/imports/payees/template|validate|commit`; admin + accounts + super_admin). It writes `PettyCashPayee` rows (VENDOR / GROUND_STAFF), is gated by the `pettyCash` feature flag (403 FEATURE_DISABLED when off), and is shown in `ImportWorkflow` (tenant admin + platform tenant page) only when the flag is on. Never add these records to the onboarding template.

## Tech decisions (do not revisit without discussion)

- **Flutter** over React Native (native rendering, Flutter Flavors for tenant theming)
- **NestJS** over Django (TypeScript end-to-end, first-class Razorpay/Firebase Node SDKs)
- **Prisma 5** over TypeORM/Drizzle (schema-as-source-of-truth, typed client)
- **REST** over GraphQL (screen-driven data, simpler webhook/payment audit surface)
- **Shared tables + tenant_id** over schema-per-tenant (operational simplicity at startup scale)
- **Firebase Phone Auth** for OTP (carrier routing, rate limiting, Android SMS auto-read)
