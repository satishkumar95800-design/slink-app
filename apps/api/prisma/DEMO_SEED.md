# Demo school: Green Valley Public School

A fully fictional school for product videos and live demos (docs/SPEC-improvements.md, Phase 6).
Built by `prisma/seed-demo.ts`. Every name, phone number and payment in it is made up.

## Run it

```bash
cd apps/api
pnpm seed:demo            # uses DATABASE_URL and the S3_* / AWS_* settings from .env
```

- **Safe to re-run.** It deletes and rebuilds the demo school each time.
- **It can't touch a real school.** It only ever touches the school with code `gvps-demo`, and refuses to run if that school isn't marked as a demo (`features.isDemo = true`).
- **Placeholder files** (homework photos, a PDF circular, report cards, payment proofs) are uploaded to S3. If S3 isn't reachable, everything else is still created; set `DEMO_SEED_SKIP_FILES=true` to skip uploads on purpose.
- **Dates are relative to today.** Attendance covers the last 30 school days, homework the last two weeks. Re-run it before recording a demo.

## Logins

School code (mobile app and web console): **`gvps-demo`**

| Who | Where | Login | Password / OTP |
|---|---|---|---|
| Admin, Gayathri Rao | Web console | `admin@gvps-demo.in` | `GreenValley@2026` |
| Accountant, Manjunath Bhat | Web console | `accounts@gvps-demo.in` | `GreenValley@2026` |
| Teacher, Divya Rao (class teacher, Class 5 A) | Mobile app | `+91 99999 00002` | OTP `123456`* |
| Teacher, Divya Rao | Web console | `teacher@gvps-demo.in` | `GreenValley@2026` |
| Parent of two (Class 5 A + Class 2 A) | Mobile app | `+91 99999 00001` | OTP `123456`* |

\* **Mobile logins use phone OTP.** Add both numbers as test numbers with code `123456`: Firebase console → Authentication → Sign-in method → Phone → *Phone numbers for testing*. No SMS is sent for test numbers.

To use a different password, set `DEMO_SEED_PASSWORD` before running.

## What's in it

- **Classes and people:**
  - 10 classes (LKG to Class 8), about 300 students with roll numbers.
  - About 294 parents, including 6 sibling pairs with a 10% sibling discount.
  - 12 teachers, 1 accountant, 1 admin.
- **Timetable:** Mon–Sat, 7 periods, no teacher double-booked, plus period timings for the Now/Next strip.
- **Fees** for the current academic year:
  - Term 1 and Term 2 tuition, plus transport in three distance slabs.
  - About 80% of students paid in full, 15% partly, 5% overdue.
  - Cash, cheque, UPI/bank transfer and online payments.
  - Dashboard: about ₹19 lakh collected, about ₹3.2 lakh outstanding.
- **Payment claims:** 5 pending (with proof photos), 3 approved, 1 rejected with a reason.
- **Attendance:** the last 30 school days at about 92%. Today, UKG, Class 3 and Class 7 are left unmarked so the dashboard shows "not marked yet".
- **Messages:**
  - Homework with photos and subjects.
  - Class and school notices, one with a PDF circular.
  - Seen-by counts for both.
- **Reports and notes:** report-card PDFs (including the demo parent's children), progress reports with read receipts, and internal student notes.
- **Holidays:** Independence Day, Gandhi Jayanti, Kannada Rajyotsava, Christmas, Republic Day.

## Remove it

Platform console → Tenants → Green Valley Public School → deactivate, then permanently delete.
