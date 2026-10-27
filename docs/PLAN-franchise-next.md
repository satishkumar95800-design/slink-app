# Plan: next franchise features (on hold until after school pitches)

Status: **planned, not built** (written 2026-10-27). Build only after pitching these to franchise / multi-branch school owners and hearing which they will pay for. Decide the order from that feedback; the order below is the current guess at value to a franchisor.

Already built for groups (docs/SPEC-franchise.md): overview and branch compare, attendance compliance, circulars, admissions funnel, group pricing, insights with the weekly AI brief (§8), royalties (§7), CSV export.

## What to ask in the pitch

For each item: would you use it, how often, who in your office would, and would it change which plan you buy? Also ask how they collect royalty today (bank transfer? cheque? invoice?), whether branches share one fee structure and calendar, and whether they have area or regional managers.

## 1. Group templates

Push one fee structure, holiday calendar or syllabus plan from the head office to all or chosen branches.

- **Decision needed first:** today the head office never writes school data (CLAUDE.md invariant). Options: (a) the head office sends a template and each branch admin accepts it (recommended: the branch keeps control, nothing changes silently); (b) the head office writes directly, audit-logged.
- Scope: `group_templates` (type, payload, version); "send to branches" creates a pending offer per branch; branch admin sees "From head office: Fee structure 2027-28 — Review / Apply"; applying reuses the existing fee structure / holiday / syllabus import code paths.
- Edge cases: branch already has a structure for that year; classes named differently per branch (map by class name, show unmatched).
- Effort: about 1.5–2 weeks (API, console both sides, tests).

## 2. Royalty invoices

A monthly royalty invoice PDF per branch from the royalty statement (§7).

- Scope: invoice numbering per group (advisory lock), group legal name, GSTIN and address on `school_groups`, GST on royalty (18%, configurable), PDF like the price list (pdfkit), "Email to branch admin" and download; invoice marked paid from the royalty payments.
- Decision: is the invoice a tax invoice (GST registered franchisor) or a simple statement?
- Effort: about 1 week.

## 3. Brand audit checklists

Area managers or the owner inspect a branch against the brand standard.

- Scope: checklist templates (sections, items, weight, photo required); an audit visit per branch (date, inspector, item scores, notes, photos — JPEG/PNG through the existing moderation check); score trend per branch on Insights; findings rule "audit score dropped".
- Mobile-friendly console page (inspectors use a phone at the branch).
- Effort: about 2 weeks.

## 4. Area manager logins

Head office logins limited to some branches (a region).

- Scope: `head_office_branches` (user → branches); when present, every head office query is limited to those branches (overview, insights, royalties, circulars); owner login still sees all. Super admin (or the owner) assigns.
- Security: same rules as today — group from the user's own row, branch list from the server; add e2e cases.
- Effort: about 1 week.

## 5. Central lead routing

One enquiry form for the whole group that hands each lead to the right branch.

- Scope: a public group enquiry page (`/g/{group}`), branch chosen by the parent or by pincode/area list per branch; the lead lands in that branch's admissions pipeline; the head office sees response time per branch (first follow-up) on Insights.
- Spam: same honeypot + rate limits as the website forms.
- Effort: about 1–1.5 weeks.

## 6. Collection targets

A monthly fee-collection target per branch.

- Scope: target per branch per month (head office sets); progress on overview and Insights; nudge to the branch admin's console and phone at mid-month if behind; finding "behind target".
- Effort: about 4–5 days.

## 7. Group payroll view

Staff headcount and salary cost per branch (from HR & Payroll, `hrms` branches only).

- Scope: per branch: employees, gross and net pay of the last locked pay run, staff cost as % of fees collected; no individual salaries or PAN/bank details ever leave the branch (totals only).
- Effort: about 4–5 days.

## Before building any of these

- Re-read docs/SPEC-franchise.md and the head office invariant in CLAUDE.md.
- Each feature: rules in a pure file with unit tests, access rules in `security.e2e-spec.ts`, en/kn/hi text, audit log for every write, CLAUDE.md row update.
