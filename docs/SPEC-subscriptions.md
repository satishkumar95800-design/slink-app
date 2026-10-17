# Subscriptions, renewals, platform dashboard and head office

Status: built (2026-10-17). Owner: platform (super_admin) console + API.

## 1. Goals

1. The super admin sees every school with its subscription plan: **Basic**, **Premium** or **Premium Max** (Premium Max is the plan the price list used to call "Gold"; it is renamed everywhere).
2. The super admin picks the plan when creating a school.
3. A subscription runs for **one year from creation** by default.
4. A school whose subscription the super admin has not marked renewed is **switched off** after expiry (with a grace period).
5. A **Renewals** tab lists schools from **one month before expiry**.
6. A **platform dashboard** for the super admin with analytical suggestions.
7. **Head office (franchise)**: one login that sees, read-only, the data and performance of several schools (branches) of the same group. Included in Premium and Premium Max.
8. On the school page, modules are **grouped like the price list** and **picking a plan switches the modules at once**.

Out of scope: online payment of subscription fees, invoices and GST bills, automatic emails to schools about renewal (later), the head office changing anything.

## 2. Plans

| Plan | Price / year (before GST) | Students included | Extra student / year | Modules |
|---|---|---|---|---|
| Basic | ₹13,333 | 400 | ₹40 | core only (no optional modules) |
| Premium | ₹29,999 | 1,000 | ₹35 | timetable, staffDocuments, advancedReports, customBranding, calendar, feeConcession, transferCertificate, pettyCash, syllabus, head office |
| Premium Max | ₹60,000 | 2,000 | ₹30 | Premium + hrms + aiInsights |

Add-ons on Premium: HR & payroll ₹18,000, AI insights ₹15,000 (unchanged).

- The plan is now **stored** on the school (`tenants.subscription_plan`: `basic | premium | premium_max`), not only inferred from module flags. It is what the school pays for and what the dashboard and renewals use.
- Module flags stay the source of truth for what is switched on. Picking a plan sets the flags to the plan's preset. A school whose flags differ from its plan's preset (for example Premium + HR add-on) shows "Premium + add-ons".
- Prices live in one place in the API (`modules/public-site/pricing-plans.ts`), used by the price list PDF, the marketing site and the platform dashboard. The console's `PLANS` keeps only the module presets.
- Migration: existing schools get `subscription_plan` from their current flags (all Premium+HR+AI → premium_max, all Premium → premium, else basic).

## 3. Subscription period and expiry

Fields on `tenants`:

- `subscription_starts_on` (date), `subscription_ends_on` (date).
- New schools: starts today (school timezone), ends the same day next year minus one day (e.g. 17/10/2026 → 16/10/2027).
- Existing schools at migration: starts on their creation date, **ends one year from the migration date** (so nobody is cut off by surprise). The super admin can correct the date.

Status (derived, never stored), with `today` in the school's timezone:

| Status | Rule | Effect |
|---|---|---|
| `active` | today ≤ ends_on − 31 days | none |
| `renewal_due` | ends_on − 30 days ≤ today ≤ ends_on | listed in Renewals; amber badge in the platform console |
| `grace` | ends_on < today ≤ ends_on + 7 days | everything still works; the school's admin and accounts users see a red banner in the console: "Your subscription ended on DD/MM/YYYY. Renew within N days to avoid interruption." |
| `expired` | today > ends_on + 7 days | the school is **switched off**: every tenant-scoped API call answers `403 SUBSCRIPTION_EXPIRED` (staff console, mobile app, logins). Data is kept. |

- Enforcement is in `TenantMiddleware` (it already loads the tenant on every request): no nightly job, so marking renewed takes effect immediately.
- The super admin's platform routes are not tenant-scoped, so the super admin can still open, edit, import into and renew an expired school. Calls the super admin makes into an expired school with `X-Tenant-ID` (the import tab) are allowed when the bearer token is a valid super_admin token.
- `is_active` (the manual on/off switch on the Settings tab) is unchanged and separate: a manually deactivated school answers `SCHOOL_NOT_FOUND` as today.
- The console and the mobile app translate `SUBSCRIPTION_EXPIRED`: "This school's Schoolinkd subscription has ended. Please contact the school office." (en/kn/hi).

## 4. Renewal

- `POST /tenants/:id/renew` (super_admin) with `{ plan?, endsOn?, amount?, reference?, note? }`.
  - New period: starts the day after the current `ends_on` (or today, if the school has been expired for longer than the grace period), ends one year later minus a day, unless `endsOn` is given.
  - `plan` (optional) changes the plan and applies its module preset.
  - Writes a `subscription_renewals` row (tenant, plan, previous ends_on, new starts_on/ends_on, amount in rupees NUMERIC(12,2), reference, note, renewed_by, created_at) and an audit log row.
- `PATCH /tenants/:id/subscription` (super_admin) `{ plan?, startsOn?, endsOn? }` corrects dates or changes the plan without recording a renewal (audit-logged).
- Renewal history is shown on the school page.

## 5. Platform console changes

### 5.1 Tenants list
Columns: School, Plan (badge; "+ add-ons" when flags differ), Students (with "over limit" when above the plan's included count), Subscription ends (date + status badge: Active / Renewal due / Grace / Expired), Status (manual Active/Inactive). Filters: plan, subscription status.

### 5.2 New school
The "New tenant" form adds **Plan** (Basic / Premium / Premium Max, default Basic) and **Subscription starts** (default today; ends a year later, shown). Creating the school stores the plan and switches on its modules.

### 5.3 Renewals tab (`/platform/renewals`)
Schools with status `renewal_due`, `grace` or `expired`, soonest first: school, plan, students, ends on, days left / days over, yearly amount due (plan price + extra students), and **Mark renewed** (modal: plan, new end date prefilled, amount received prefilled with the amount due, payment reference, note). A count badge on the tab in the platform nav.

### 5.4 School page: plan and modules grouped like the price list
- A **Subscription** card: plan, period, status, amount due at renewal, Mark renewed, Edit dates, renewal history.
- **Plan** picker: Basic / Premium / Premium Max with price and student allowance. Clicking a plan **applies it immediately** (stores the plan and sets the module flags to the preset); a toast says what was switched on or off, with **Undo** for 10 seconds.
- **Modules grouped as in the price list**:
  - *Included in every plan* (read-only list: mobile app, attendance, notices and homework, fees and online payment, reminders, progress reports, three languages, Excel import).
  - *Premium*: Timetable, Calendar & PTMs (incl. consent forms), Shared documents, Attendance & fee reports, Fee concessions, Transfer certificates, Petty cash, Custom branding, Syllabus progress, Head office access.
  - *Premium Max*: HR & payroll, AI features.
  Each module keeps its own on/off switch (for add-ons), shown inside its group; a module switched on outside the school's plan is marked "Add-on".

### 5.5 Platform dashboard (`/platform`, the new landing page)
Numbers: schools by plan, active / renewal due / grace / expired, total students and staff, yearly revenue under contract (sum of plan prices + add-ons + extra-student charges), revenue due for renewal in the next 30 / 90 days, new leads in the last 30 days.

Suggestions (rule-based, each with the schools it applies to and a link to act):

| Suggestion | Rule |
|---|---|
| Renew soon | status `renewal_due` or `grace` |
| Switched off | status `expired` |
| Charge extra students | students > plan allowance → amount = extra × rate |
| Upgrade to Premium | Basic with > 400 students, or Basic with ≥ 2 Premium modules switched on as add-ons |
| Upgrade to Premium Max | Premium with both HR and AI add-ons (₹33,000 of add-ons vs ₹30,001 more for Premium Max), or Premium with > 1,000 students |
| Low parent app use | < 40% of students have a parent who signed in to the app |
| Not using attendance | no attendance marked in the last 7 days (school days) |
| Not set up | created more than 14 days ago with no students |
| Follow up leads | contact/price-list requests in the last 7 days |

Suggestions are computed in code (no AI), cheapest to check first, and shown highest-money first.

## 6. Head office (franchise)

### 6.1 Model
- `school_groups` (id, name, created_at). `tenants.group_id` (nullable) puts a school in a group; a school is in at most one group.
- Role `head_office` (new `Role` value). A head office user is a `users` row with `role = head_office`, an email and password, `group_id` set, and `tenant_id` = one school of the group (users need a tenant; it is never used for scoping).
- The super admin manages groups on a **Groups** tab: create a group, add/remove schools, create/disable head office logins (name, email, password).

### 6.2 Access rules (the security invariant)
- The head office is **read-only**: there is no write route for `head_office`.
- Its scope is **always** resolved from the signed-in user: `user.groupId` → schools with `group_id = groupId`. No route accepts a group id from the request; a branch id in a URL is accepted only if that branch is in the user's group (else 404).
- Only branches on **Premium or Premium Max** show data; a Basic branch is listed as "Not included in Basic".
- `RolesGuard`: a `head_office` user is refused (403) on every route that does not explicitly list `Role.head_office`, so the generic tenant routes of its home school are closed to it.
- Head office routes (`/head-office/*`) are excluded from `TenantMiddleware`; a branch switched off (`expired` or inactive) shows its status and last known numbers are not fetched.
- Login: `POST /auth/head-office/login` (email + password, no tenant), like the super admin login.

### 6.3 What the head office sees (console, `/head-office`)
- **Group overview**: per branch, side by side — students, staff, attendance today and last 30 days, fees collected this academic year vs due (collection %), outstanding and overdue, notices sent in 30 days, parent app use, syllabus on time (if the branch has it), subscription status. Group totals on top; best and weakest branch per measure highlighted; ranking table sortable by any column.
- **Branch page** (drill-down): the same measures by class (attendance %, collection %, outstanding), monthly fee collection for the last 6 months, attendance trend for the last 30 days.
- Nothing to set: no forms, no settings, no exports in v1.

## 7. API summary

| Route | Role | Notes |
|---|---|---|
| `POST /tenants` | super_admin | + `plan`, `startsOn` |
| `GET /tenants` | super_admin | + plan, subscription, status, students; filters `plan`, `subscription` |
| `PATCH /tenants/:id/subscription` | super_admin | correct plan/dates |
| `POST /tenants/:id/renew` | super_admin | renewal + history row |
| `GET /tenants/:id/renewals` | super_admin | history |
| `GET /platform/renewals` | super_admin | due / grace / expired |
| `GET /platform/dashboard` | super_admin | numbers + suggestions |
| `GET/POST/PATCH /platform/groups…` | super_admin | groups, members, head office logins |
| `POST /auth/head-office/login` | public | email + password |
| `GET /head-office/overview` | head_office | branches of own group |
| `GET /head-office/branches/:tenantId` | head_office | own group only |
| `GET /tenant` | any school user | + `subscription: { plan, endsOn, status, graceDaysLeft }` for the banner |

Errors: `SUBSCRIPTION_EXPIRED` (403), `PLAN_INVALID`, `GROUP_NOT_FOUND`, `BRANCH_NOT_IN_GROUP` (404), `TENANT_IN_OTHER_GROUP` (409).

## 8. Build order

1. Plans: rename Gold → Premium Max (API price list, PDF, marketing site, console), store `subscription_plan`, plan at creation, grouped modules, instant plan switch with undo.
2. Subscription period, status, expiry enforcement, grace banner, `SUBSCRIPTION_EXPIRED` in the console and the app; renewals tab and renew/edit APIs; renewal history.
3. Platform dashboard with suggestions.
4. Head office: groups, role and login, guard rule, overview and branch pages.

## 9. Tests

- Status boundaries (31/30 days before, end day, grace day 7 and 8), new-school dates (incl. 29 Feb), migration rule for existing schools.
- Middleware: expired school answers `SUBSCRIPTION_EXPIRED`; grace still works; renewal lifts it at once; super_admin token passes.
- Renew: period chaining (on time vs long expired), plan change applies preset, history + audit row.
- Suggestions: each rule fires on a minimal fixture and not on its near miss.
- Head office: cannot see a school outside its group (404), cannot call any tenant route (403), Basic branch shows no data, no write route exists.
