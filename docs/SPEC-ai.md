# AI features (premium) — plan

Premium schools only: the platform switches on the `aiInsights` optional module
per school (platform console → school → Optional modules), like the TC and
concession modules. Every AI feature checks it on the server.

Two kinds of feature:

- **Generative** (calls Claude): translation, drafting, reading images, summaries, questions in plain language.
- **Pattern warnings** (plain code over our own data, no model cost): computed nightly, stored as alerts, each with the reasons behind it.

## Rules for every feature

1. **Children's data (DPDP Act 2023).** Send the model the least it needs: no phone numbers, no caste, no gender; use first names or IDs where a name isn't needed. No data is used for training (Anthropic API default).
2. **Never use caste or gender** in any risk score or warning.
3. **People decide.** Warnings are suggestions for staff, always with their reasons ("attendance fell 23% in 4 weeks"). Nothing is shown to parents as a label on their child. Drafts (remarks, replies) are edited and approved by a person before anyone sees them.
4. **Fail open.** If the model is slow, down or over budget, the normal (non-AI) behaviour continues — e.g. a notice is sent untranslated.
5. **Cost control.** Every call is logged in `ai_usage` (school, feature, model, tokens). A monthly per-school token cap (`AI_MONTHLY_TOKEN_LIMIT`, default 2M) stops calls before they run.
6. **Providers and models.** Sarvam when `SARVAM_API_KEY` is set: notice translation uses its dedicated `sarvam-translate:v1` model (source language detected from the script; long text split into 2000-character pieces), drafting uses `sarvam-105b` chat. Reading payment-proof screenshots needs a vision model, so it uses Anthropic (`ANTHROPIC_API_KEY`) and is skipped without it. With only an Anthropic key, everything uses `claude-haiku-5-5` (volume) / `claude-sonnet-5-5` (drafting). Overrides: `AI_PROVIDER`, `SARVAM_MODEL`, `AI_MODEL_FAST`, `AI_MODEL_SMART`.

## Foundation (phase 0)

- `aiInsights` optional module (API flag, platform toggle, console `useTenantFeatures`).
- `AiService` (`apps/api/src/modules/ai`): one place that calls the Anthropic Messages API (`ANTHROPIC_API_KEY`), applies the flag and the cap, logs usage, times out after 30 s.
- `ai_usage` table.
- `insight_alerts` table + nightly in-process job (same pattern as class reminders) for the pattern warnings; dashboard "Insights" card and panel; teacher app list.

## Phase 1 — quick wins

| # | Feature | Where | Model |
|---|---|---|---|
| 1.1 | **Notice & homework translation**: each parent gets the notice in their own language (en/kn/hi). Original kept for the sender. | Console notify, teacher app notice/homework | fast |
| 1.2 | **Report-card remark drafts** from marks, attendance and notes, in the teacher's language; teacher edits before publishing. | Report upload (app + console) | smart |
| 1.3 | **Payment-proof reader**: read amount, date, UPI/UTR from the parent's screenshot; pre-fill the claim; flag mismatches and reused UTRs for the accountant. | Parent claim form, Payment Claims page | fast (vision) |
| 1.4 | **Weekly principal summary**: attendance, collections, risks, gaps (e.g. "7B not marked 3 days"), pushed Monday morning and shown on the dashboard. | Admin dashboard, push | fast |

## Phase 2 — warnings (rules first, learned models after a term of data)

| # | Warning | Signals |
|---|---|---|
| 2.1 | **Student at risk** | attendance trend, mark trend, unopened homework/notices, complaint notes |
| 2.2 | **Attendance patterns** | same-weekday absences, absent after holidays, siblings absent together, long absence streak, class-wide dip, class not marked |
| 2.3 | **Late-fee risk** per fee + **forecast** from due dates and each family's payment timing (replaces the 3-month average) | past delays, part-payments, rejected claims, app engagement |
| 2.4 | **Parent drifting away** | notice-opening rate falling |
| 2.5 | **Money anomalies** | duplicate UTR, claim ≠ screenshot, concessions concentrated on one staff member, receipts at odd hours, many removals by one person |
| 2.6 | **Teacher load & follow-through** | weekly periods, attendance marked late/missing, report cards not uploaded, unread rates |

Prerequisite for good mark trends: structured marks entry (subject, max, scored, exam) — today grades live inside each report's free-form `content`.

## Phase 3 — assistants

| # | Feature | Notes |
|---|---|---|
| 3.1 | **Admin questions in plain language** ("classes under 85% attendance this month?") | tool use over a fixed set of school-scoped read queries; never raw SQL |
| 3.2 | **Parent assistant** in the app ("was Diya present yesterday?", "what's due?") | only that parent's own children (invariant #2) |
| 3.3 | **Import clean-up**: map messy Excel columns, fix name casing, catch duplicate classes/students before saving | import validate step |

## Status

| Item | Status |
|---|---|
| Foundation: `aiInsights` flag, `AiService` (Messages API, cap, usage log), `ai_usage` / `insight_alerts` / `payment_claim_checks` tables | done |
| 1.1 Notice & homework translation (push text per parent language; homework list keeps the original) | done |
| 1.2 Report-card remark drafts (console upload + teacher app) | done |
| 1.3 Payment-proof reader (on claim submit + "Check with AI"; flags on Payment Claims; pre-fills approve amount) | done |
| 1.4 Weekly summary (Monday, admin, in the Insights panel; deterministic numbers, no model call) | done |
| 2.1 Student at risk, 2.2 attendance patterns, 2.3 late-fee risk + expected collections, 2.4 parent drifting, 2.5 money anomalies, 2.6 teacher overload | done (rules, nightly, `/alerts`); console banner + panel for all roles; teacher app list |
| 2.x mark-trend warnings | needs structured marks entry first |
| 2.3 learned (non-rule) fee model | after a term of payment history |
| 3.1 Admin/accounts questions in plain language (`POST /assistant/ask`; console header box + panel) | done — the model only picks one of 7 read-only queries and its arguments; answers are built from data and rendered in the user's language; no student data sent to the model |
| 3.2 Parent assistant (teacher-free; 4 queries over the parent's own children; app "Ask" tile) | done — asks "which child?" when it isn't clear |
| 3.3 Import clean-up (`POST /imports/fix`; "Fix with AI" on the import page) | done — tabs/columns renamed (exact/alias, AI for the rest from header names only), spaces trimmed, ALL-CAPS names fixed, class-name variants matched to existing classes |

Server settings: `SARVAM_API_KEY` and/or `ANTHROPIC_API_KEY` (generative features need at least one; screenshots need Anthropic), optional `AI_PROVIDER`, `SARVAM_MODEL`, `AI_MONTHLY_TOKEN_LIMIT`, `AI_MODEL_FAST`, `AI_MODEL_SMART`, `ALERTS_DISABLED`.
