# Franchises: competitor analysis, head office additions, admissions and group pricing

Status: built (2026-10-17). Extends docs/SPEC-subscriptions.md §6 (head office).

## 1. Competitor feature review

Source: a franchise-focused preschool product's feature list (6 modules). ✓ = Schoolinkd already has it.

| Competitor feature | Schoolinkd today | Decision |
|---|---|---|
| **1. Head office dashboard** | | |
| Multi-branch summary (schools, students, staff, fees, dues, notices) | ✓ head office overview | — |
| Side-by-side comparison with best/weakest highlights | ✓ | — |
| Plan-based access (Basic branches restricted) | ✓ | — |
| Attendance compliance alerts by a morning cutoff | ✗ | **Build now** (§2) |
| Head office circulars to all or chosen branches | ✗ | **Build now** (§3) — the one thing a head office can create |
| **2. Daily childcare & engagement** | | |
| Meal / nap / nappy / mood log | ✗ | Roadmap (preschool-only, large) |
| Notice board and circulars | ✓ notices, homework, consent forms | Birthday cards: roadmap |
| Photo and video gallery | ✗ (flag only) | Roadmap |
| Two-way teacher–parent messaging | ✗ (flag only) | Roadmap |
| **3. Attendance & check-in** | | |
| QR / parent self check-in | ✗ | Roadmap |
| Multiple sessions (daycare, drop-in) | ✗ | Roadmap |
| Authorised pickup pass | ✗ | Roadmap |
| **4. Admissions & CRM** | | |
| Lead funnel Enquiry → Tour → Follow-up → Registration → Enrolled | ✗ | **Build now** (§4), with funnel on the head office view |
| Online enrolment form and document upload | ✗ | Roadmap |
| **5. Billing** | ✓ fee structures, transport slabs, late fee, reminders, online payment, receipts | — |
| **6. Live bus tracking** | ✗ | Roadmap |

"Absolutely necessary for the franchise model" = what a head office needs to run branches: see compliance, reach every branch at once, and track admissions growth. Billing and notices already exist.

## 2. Attendance compliance alerts (head office)

- `school_groups.attendance_cutoff` (HH:MM, default 10:00), set by the super admin on the Groups page (the head office still sets nothing).
- For each branch with data, in the branch's timezone, today:
  - `holiday` — Sunday or a school holiday;
  - `done` — every class with students has attendance;
  - `pending` — before the cutoff and not done;
  - `late` — past the cutoff and at least one class not marked (count shown).
- Shown at the top of the head office overview ("3 schools haven't marked attendance by 10:00") and on the branch page.

## 3. Head office circulars

- Head office writes a circular: title (≤100), body (≤1,000), audience **staff** or **staff and parents**, branches = all or chosen (only branches with data: Premium / Premium Max and not switched off).
- Delivery per branch, in the background:
  - staff (teacher, admin, accounts): push + notification history (`NotificationsService.send`, data `{type: 'circular'}`);
  - parents (if chosen): a whole-school notice through the existing notice flow (push in the parent's language where AI translation is on; appears in the app's Notices with "seen by").
- Stored: `group_circulars` + `group_circular_branches` (per-branch staff and parent counts). Audit-logged.
- School console: a "From head office" card on the dashboard for admin, accounts and teachers.
- The head office lists what it sent with reach per branch. No edit or delete (it has been delivered).
- Rule change to the head office invariant: `POST /head-office/circulars` is the only write route for `head_office`.

## 4. Admissions pipeline

- Optional module flag `admissions` (Premium and Premium Max; switched on for those schools by migration).
- `admission_enquiries`: child name, date of birth, class sought, parent name, phone, email, source (walk-in, phone, website, referral, social media, other), stage (`enquiry`, `campus_tour`, `follow_up`, `registration`, `enrolled`, `lost`), tour date, next follow-up date, lost reason, notes, assigned to (staff), created by.
- `admission_activities`: append-only timeline (created, stage change with from/to, note).
- Console `/admin/admissions` (admin, accounts): stage counts and conversion, follow-ups due today/overdue, list with stage filter and search, add enquiry, detail drawer (edit, move stage, add note, timeline). Lost needs a reason.
- Head office: per branch, enquiries this academic year (from 1 June), tours, registrations, enrolled, lost, conversion % (enrolled / enquiries); also on the branch page.

## 5. Group (franchise) pricing

Per branch, by size, with Premium features; Premium Max adds per branch:

| Branch size (students) | Price / branch / year |
|---|---|
| up to 150 | ₹12,000 |
| 151 – 500 | ₹20,000 |
| 501 – 1,000 | ₹29,999 |
| over 1,000 | ₹29,999 + ₹30 per student over 1,000 |
| Premium Max (HR + AI) | + ₹12,000 per branch |

- Volume discount on branch fees by number of branches in the group: 3–9 → 10%, 10–24 → 15%, 25+ → 20%.
- Head office fee ₹15,000 / year (dashboard, compliance, circulars, admissions funnel, logins) for groups of 2–9 branches; free from 10 branches.
- Groups of 1–2 branches pay the normal single-school prices (no group pricing or discount).
- Prices before 18% GST. Example: 12 preschools of 100 children → 12 × ₹12,000 − 15% = ₹1,22,400 / year (≈ ₹100 per child), head office included.
- Code: `FRANCHISE_PRICING` in `pricing-plans.ts` (single source); `groupQuote()` in `common/subscription.ts`. Used by: renewal amount of a grouped school (its branch share), the platform dashboard revenue (+ head office fees), the Groups page quote and calculator, the price list PDF (new page) and the marketing site.

## 6. Out of scope now

Everything marked Roadmap in §1; online admission forms; invoices for groups.
