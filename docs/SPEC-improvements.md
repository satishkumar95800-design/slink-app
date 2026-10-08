# Slink — Website & Mobile App Improvements Spec (for Claude Code)
_Oct 8, 2026 · @satish_

## How to use this with Claude Code

Save this spec in your repo as docs/SPEC-improvements.md, then run Claude Code one phase at a time. Review and test each phase before starting the next, so mistakes don't pile up.

- Export this doc as Markdown and save it at the repo root under docs/.
- Open Claude Code in the repo (or the parent folder if the website, admin console, backend and mobile app are separate repos).
- Paste the master prompt below, replacing <N> with the phase number.
- Review the plan it proposes before letting it write code.
- Test on a staging environment and a real Android phone, commit, then move to the next phase.

Master prompt to paste:

```
Read docs/SPEC-improvements.md fully. We are implementing Phase <N> only.

Before writing any code:
1. Explore the codebase and tell me the stack you find (website, admin console,
   backend/API, database, mobile app framework, push notification setup).
2. List every file you plan to create or change for this phase, any database
   migrations, and any new API endpoints.
3. Flag anything in the spec that conflicts with how the code currently works,
   and ask me before deviating from the spec.

Then implement Phase <N>, following the ground rules in the spec. Keep changes
minimal and consistent with the existing code style. Write or update tests
where the project has tests. When done, give me a short summary of what changed,
how to run migrations, and a manual test checklist for this phase.
```

## Context and ground rules

Slink is a school management system for Indian private schools: a marketing website (schoolinkd.in), an admin web console with Admin, Accounts and Teacher roles, and one mobile app with Parent and Teacher logins. The goal of these changes is to make the product easier to sell to school owners (fee recovery, attendance, control) and to get a clean demo ready for a product video.

Ground rules for the agent:

- Do not break existing data or flows. One school is live and paying. All schema changes must be additive migrations with safe defaults; no destructive changes to existing tables.
- Multi-tenant safety. Every new table and query must be scoped by school ID. A user must never see another school's data.
- Role scoping. Respect existing roles: parents see only their own children, teachers only their assigned classes, accounts only fee data, admins everything in their school.
- Internal stays internal. Student notes (MOM, complaints, parent discussions) must never be exposed to the parent role.
- Currency and dates. Show rupees in Indian grouping (₹1,23,456) everywhere. Use DD/MM/YYYY in the UI and the school's timezone (default Asia/Kolkata).
- Reuse existing components and match current styling (dark green header, cream background, rounded white cards).
- Strings in one place. Put all new user-facing text in a strings or localisation file, so Kannada and Hindi can be added later without code changes.
- No new paid services without asking first (for example SMS or WhatsApp providers).
- Ask before guessing. If the existing code does something differently from what this spec assumes, stop and ask.

## Phase 1: Bug fixes and polish (do first, before recording the demo)

These are small but visible problems that would hurt the demo video and first impressions.

**1.1 Admin dashboard fee totals are blank.** The "Fees Collected" and "Outstanding Fees" cards show "—" even when Recent Payments lists cash payments.

- Fees Collected = sum of all verified payments (online, cash, cheque, and approved payment claims) for the current academic year.
- Outstanding Fees = total fees due to date for all students (after discounts) minus Fees Collected.
- Show ₹0 rather than "—" when there is genuinely no data; show a loading state while fetching.
- Add a small subtitle under each, such as "This academic year".
- Make sure the totals match the Fee Reports and Student Fees screens exactly.

**1.2 Indian currency formatting.** Create one shared formatting helper per codebase (web and mobile) and use it everywhere amounts appear: dashboards, Recent Payments, receipts, fee screens, reports. Example: ₹21,400 and ₹1,25,000.

**1.3 Recent Payments shows payment method correctly.** Badges should distinguish Cash, Cheque, Online/UPI and Claim (approved). Use different badge colours.

**1.4 Name capitalisation.** On display, do not alter stored names, but add validation on create and import that trims spaces and warns if a name is all lowercase. Fix the demo data separately (Phase 6).

**1.5 Branding consistency.** Use "Slink" as the product name everywhere in the website, console, app titles and emails. The domain can stay schoolinkd.in.

## Phase 2: Daily attendance

Attendance is the biggest missing feature. Teachers mark it once a day per class, parents get alerted when their child is absent, and admins see school-wide numbers.

2.1 Data model (additive migration):

- attendance_records: id, school_id, class_id, student_id, date, status (present / absent / late / leave), marked_by (teacher user id), marked_at, updated_at, note (optional).
- Unique constraint on (school_id, student_id, date).
- Index on (school_id, class_id, date).
- Optional school_holidays table (school_id, date, name) so holidays are excluded from attendance percentages. Admins manage it from Settings.

2.2 API:

- Get the roster for a class and date with any existing statuses.
- Submit or update attendance for a class and date in one request (bulk upsert).
- Get a student's attendance summary for a month and for the academic year (days present, days marked, percentage).
- Get a school summary for a date (present, absent, not yet marked, per class).
- Only the class teacher (or admin) can mark a class. Teachers can edit the same day's attendance until midnight; after that only admins can edit. Log every edit.

2.3 Teacher app: Mark Attendance screen:

- New first card on the teacher dashboard: "Mark Attendance". Show "Done for today" with a tick when already submitted.
- If the teacher has more than one class, pick the class first.
- All students default to Present. One tap toggles Absent; long-press gives Late or Leave.
- Sticky bar at the bottom showing "32 present · 3 absent" and a Submit button, with a confirmation.
- Must be usable in under 30 seconds for a class of 40. Large tap targets, roll number plus name.
- Should work on a weak connection: queue the submission and retry if it fails, and show clear status.

2.4 Parent app:

- Push notification when the child is marked Absent: "Avyaan was marked absent today (08/10/2026)." Send once per day per child, and send a correction if the teacher changes it back.
- Attendance card on the parent home screen (see Phase 3) and an Attendance screen with a monthly calendar view, colour-coded by status.

2.5 Admin console:

- Dashboard card: "Today's attendance: 412 / 450 present (91.5%)" with a list of classes not yet marked.
- Attendance page: filter by class and date range, view per-student percentage, export to Excel/CSV.
- Feed attendance percentage into the existing attendance reports where relevant.

## Phase 3: Parent app

Turn the parent home screen from a menu into a summary of what needs attention today, with fees at the top.

**3.1 Sibling switcher.** If a parent account is linked to more than one student, show the child's name with a dropdown ("Avyaan · Class 1 ▾") at the top of the home screen. Switching reloads all cards for that child. Remember the last selected child. Hide the dropdown when there is only one child.

3.2 Home screen summary cards (in this order, above the menu):

- Fee card. "₹6,000 due by 15/10/2026" with a primary Pay Now button. Show "Overdue" in red when past the due date and "All fees paid" with a tick when nothing is pending. If a payment claim is under review, show "₹6,000 claim under review" instead.
- Today card. Today's homework (teacher name, subject, thumbnail of the photo) and the most recent notice, each tappable. Show "No homework today" when empty.
- Attendance card. "This month: 21/22 days" and today's status (Present / Absent / Not marked yet). Tapping opens the calendar from Phase 2.

Pull data for all three in one API call if practical, to keep the home screen fast.

**3.3 Clearer menu.** Replace the current four items with:

- Fees: view dues, pay online, upload proof of cash or cheque payment, past receipts.
- Homework: all homework sent to this child's class, newest first.
- Notices: all class and school notices, newest first.
- Report Cards & Reports: published report-card PDFs and teacher progress reports.
- Attendance: calendar view (Phase 2).

Remove the overlap where homework appeared under both Reports and Notifications. Consider a bottom navigation bar (Home, Fees, Homework, Notices, More) if it fits the existing navigation; otherwise keep cards.

**3.4 Payment claims move inside Fees.** On the Fees screen show two actions per due item: "Pay Online" and "I paid by cash/cheque – upload proof". Show the list of the parent's claims and their status (Under review / Approved / Rejected with reason) on the same screen. Remove "My Payment Claims" from the home menu.

**3.5 Downloadable receipts.** Each payment in Fees history has a "Download receipt" button producing a PDF with school name, student, amount, method, discount line if any, date and receipt number.

**3.6 Logout moves to Profile.** Remove the logout icon from the header; keep the profile icon. Put Logout at the bottom of the Profile screen with a confirmation dialog.

**3.7 Notifications.** Push notifications for: new homework, new notice, absent alert, fee due reminder (3 days before due date and on the due date), claim approved or rejected, report card published. Tapping a notification opens the relevant screen for the right child.

## Phase 4: Teacher app

Put the daily actions at the top and make the home screen useful every hour, not just when sending something.

**4.1 "Today" strip at the top of the teacher dashboard, using the existing timetable: "Now: Class 3B · Maths (10:30–11:15)" and "Next: Class 5A · Science (11:15)".** Show "No more periods today" after the last period. Hide on holidays and Sundays.

4.2 Reorder dashboard cards by daily use:

- Mark Attendance (new, Phase 2)
- Send Homework
- Send Notice
- Reports
- Add Student Note (new, 4.4)
- Weekly Routine
- About My Class(es)

Remove the Profile card (the header icon already opens Profile). Move logout into Profile, same as the parent app.

4.3 Better notices and homework:

- Allow attaching up to 3 photos or 1 PDF to a notice (homework already supports a photo; allow multiple photos too).
- Track when each parent opens a notice or homework item. Show "Seen by 28/35 parents" on each sent item, and a list of parents who haven't seen it.
- Feed the seen counts into the admin console's Teacher Workload table (Reports Sent, Unread columns).

**4.4 Student notes on mobile.** The web console already has a notes log (Note, MOM, Complaint, Parent Discussion). Add an "Add Student Note" action in the teacher app: pick class, pick student, pick type, type text, save. Teachers see and add notes only for their own classes. These notes are never visible to parents; add a test that checks the parent API never returns them.

## Phase 5: Marketing website (schoolinkd.in)

Reposition the site around fee recovery for school owners and make it easy to book a demo on WhatsApp.

**5.1 New hero message.** Lead with the owner's outcome rather than features. Suggested headline: "Know exactly how much fee your school collected, and who still owes, every single day." Subline: cash, cheque and online payments in one dashboard, plus a parent and teacher app. Primary button: Book a free demo on WhatsApp; secondary: School Login.

**5.2 WhatsApp demo button.** A floating WhatsApp button on every page and the primary CTA in hero, mid-page and footer. Link format https://wa.me/<number>?text=<prefilled message> with a message like "Hi, I'd like a demo of Slink for my school." Put the number in one config value. Do not put any personal data in the URL beyond this fixed message.

**5.3 Demo video section.** Below the hero, an embedded video player (YouTube embed, lazy-loaded) with a placeholder thumbnail until the video exists. Title: "See Slink in 90 seconds".

**5.4 "Why schools switch" section.** Three short benefit blocks: fewer fee defaults (cash and online in one place), live in a day (one Excel import, we do it for you), parents stay informed (homework, notices, attendance, report cards on their phone).

**5.5 Testimonial section.** A component for a quote, name, role, school name and optional photo or short video. Ship it with placeholder content and hide it behind a config flag until real testimonials are added.

**5.6 Pricing section.** "Starting from ₹<X> per student per year", a short list of what's included, and "Talk to us for multi-branch pricing". Keep the price in one config value; hide the number behind a flag if not decided yet.

**5.7 Download the app.** Google Play and App Store badges linking to the store listings (URLs in config; hide a badge if its link is empty).

**5.8 Update features list.** Add attendance and absence alerts once Phase 2 ships. Keep existing feature descriptions accurate.

**5.9 Contact page.** Fields: name, school name, city, number of students, phone, preferred time. Plus the WhatsApp button. Validate phone as an Indian mobile number. Send submissions to the admin email and store them.

5.10 Basics:

- Proper title, meta description and Open Graph image for sharing on WhatsApp and LinkedIn.
- Mobile-first: most owners will open the site from a WhatsApp link on their phone. Check at 360px width.
- Page speed: compress images, lazy-load the video.
- Add basic analytics (privacy-friendly) and track clicks on the WhatsApp and demo buttons.

## Phase 6: Demo school seed script

Create a repeatable script that builds a realistic, fully fictional demo school for recording videos and giving live demos. It must never touch the live client's school.

- Script creates (or wipes and recreates) a school called "Green Valley Public School", identified by a fixed demo flag, and refuses to run against any school without that flag.
- About 10 classes (LKG to Class 8), 12 teachers, 1 accountant, 1 admin, around 300 students with properly capitalised Indian names, and parents linked to them. Include at least 5 sibling pairs with a sibling discount.
- Fee structures with tuition by term, transport slabs and one or two discount types.
- Payment history for the current academic year: a realistic mix of online/UPI, cash and cheque; about 80% fully paid, 15% partial, 5% overdue. Dashboard totals should land around ₹18–20 lakh collected and ₹3–4 lakh outstanding.
- 4–6 pending payment claims with photo proofs (use placeholder receipt images), plus a few approved and one rejected with a reason.
- Attendance for the last 30 school days at around 92% average, with a few classes not yet marked today.
- Homework posts with photos, class notices, a few report-card PDFs (generated placeholders), progress reports, and some student notes.
- Teacher workload numbers that look active (weekly periods, reports sent, seen counts).
- Demo login credentials for one parent with two children, one teacher, one accountant and one admin, written to the project's example config or seed README, not printed in logs.

## Out of scope for now (later backlog)

Do not build these in this round. They are listed so the agent designs current changes in a way that won't block them.

- WhatsApp notifications via the WhatsApp Business API (fee reminders, absence alerts, receipts) as a fallback to push.
- Kannada and Hindi translations of the parent and teacher apps.
- Marks entry by teachers and auto-generated report cards.
- Owner daily summary (push or WhatsApp): today's collection, overdue total, attendance.
- School calendar with holidays, exams and PTMs in the parent app.
- Parent absence notes and leave requests.
- Exports for government portals (SATS, UDISE+, APAAR).
- Transport tracking.

## Definition of done and testing checklist

A phase is done when every item below passes on staging and on a real low-to-mid-range Android phone.

- [ ] Migrations run cleanly on a copy of production data, and the live client's existing data and screens still work.
- [ ] Logged in as a parent, I see only my own children; as a teacher, only my classes; as accounts, only fee data.
- [ ] Parent API never returns student notes (automated test).
- [ ] Data from one school never appears in another school (automated test with two schools).
- [ ] Dashboard Fees Collected and Outstanding match Fee Reports and the sum of Student Fees exactly.
- [ ] All amounts show Indian grouping (₹1,23,456) on web and mobile.
- [ ] Attendance for a class of 40 can be marked and submitted in under 30 seconds.
- [ ] Absence push notification arrives within a minute and opens the right child's attendance.
- [ ] Parent with two children can switch between them and every card updates.
- [ ] App works on a slow 3G connection with clear loading and retry states.
- [ ] Website looks right at 360px width, and the WhatsApp button opens WhatsApp with the prefilled message.
- [ ] All new text lives in the strings file, ready for translation.
- [ ] Demo seed script refuses to run on a non-demo school.
