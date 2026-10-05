# School Connect / Schoolinkd — project handoff for Claude Code

Give this file to Claude Code on a new machine: *"Read CLAUDE.md and docs/PROJECT_HANDOFF.md first; they hold everything known about this project."*
It complements `CLAUDE.md` (architecture invariants, tech decisions — do not contradict those) and `docs/RELEASE_IOS_ANDROID.md` (store release runbook).
No secrets are in this file. Credentials, keystores and Firebase files are listed in §9 and must be copied separately.

## 1. What this is
Multi-tenant school management product, branded **Schoolinkd** (store name `schoolinkd`, internal name "School Connect" / "slink"):
parents pay fees and read reports, teachers write reports, admin/accounts staff run a web console.

| App | Path | Stack | Users |
|---|---|---|---|
| API | `apps/api` | NestJS, Prisma 5 (pinned — don't upgrade to v6), PostgreSQL 16, Node 22 | all |
| Web console | `apps/web-admin` | Next.js 16 (webpack build), Tailwind 4, react-hook-form + zod | admin, accounts, teacher, super_admin |
| Mobile | `apps/mobile` | Flutter 3.44, Riverpod, go_router, Firebase (auth, messaging), Razorpay | parents, teachers |
| Shared | `packages/types`, `packages/config` | TS | — |

Repo: `github.com/satishkumar95800-design/slink-app`, branch `main`. pnpm only (never npm/yarn) for local work.

## 2. Hard rules (from CLAUDE.md — summary)
1. `tenant_id` never from request body; resolved by `TenantMiddleware` from `X-Tenant-ID` header/subdomain.
2. Parents reach students only via `student_parents` (`parent_id = req.user.id`).
3. Payment webhooks must verify HMAC signature, else 401.
4. Refresh tokens stored as bcrypt hashes; raw token returned once.
5. Per-tenant gateway credentials live in AWS Secrets Manager, not the DB.
6. Money: `NUMERIC(12,2)` in DB, integer paise in app code.
Tech decisions (Flutter, NestJS, Prisma 5, REST, shared tables + tenant_id, Firebase phone OTP) are settled — don't revisit without asking.

## 3. Working conventions the owner expects
- **Stage explicit paths, never `git add -A` / `.`.** The tree always has noise that must not be committed: `.claude/`, `apps/mobile/**/xcshareddata/swiftpm/`, and a deleted `infra/mock-data/school-connect-mock-import.xlsx` (leave it alone). Run `git status --short` before each commit.
- **Commit/push only when asked**, one logical change per commit. Commit messages: conventional style (`feat(web-admin): …`, `fix(api): …`).
- **A push to `main` auto-deploys production on Hostinger.** Say so before pushing.
- Other Claude sessions may edit the repo concurrently ("changed on disk" notices) — check before redoing work.
- Prefer root-cause fixes; for prod issues ask for Hostinger **Runtime logs** first (`AllExceptionsFilter` logs full stack traces).

## 4. Local development
Prereqs: Node 22, pnpm 9, Docker, Flutter 3.x, Android SDK (platform android-36) + JDK 17, Xcode for iOS.
```bash
pnpm install
pnpm docker:up                 # postgres:16, redis:7, localstack (S3 on :4566)
cp .env.example apps/api/.env  # then fill values
pnpm db:generate && pnpm db:migrate
pnpm --filter api start:dev    # API  http://localhost:3000/v1   (health: /v1/health)
cd apps/web-admin && PORT=3001 npx next dev -p 3001   # NOT `pnpm --filter web-admin dev` (collides with API port 3000)
```
- Super admin: log in with the tenant slug field **blank**. The seed script (`apps/api/prisma/seed.ts`) defines the default email/password, overridable via `SEED_SUPER_ADMIN_*` env vars — ask the owner which was used, and check the DB before reseeding.
- Phone testing (Android, USB or wireless adb): `adb` lives at `~/Library/Android/sdk/platform-tools`. For every device, every reconnect:
  `adb -s <id> reverse tcp:3000 tcp:3000` and `adb -s <id> reverse tcp:4566 tcp:4566` (LAN IPs are unreliable on VPN; 4566 is for presigned S3 URLs).
  Run: `flutter run -d <id> --dart-define=API_BASE_URL=http://localhost:3000/v1`.
  **One `flutter run` at a time** (concurrent Gradle builds corrupt the Kotlin cache — fix: kill gradle/kotlin daemons, uninstall app, delete `apps/mobile/build`; don't `flutter clean`). `-d a -d b` in one command only runs one device.
- Mobile release builds **require** `--dart-define=API_BASE_URL=https://api.schoolinkd.in/v1` (the app throws without it).

## 5. Production deployment (Hostinger)
Two Hostinger sites: `schoolinkd.in` (web-admin) and `api.schoolinkd.in` (api). Each has its own env-var page.
- `NEXT_PUBLIC_API_URL` → web-admin site; inlined at **build time** (needs a rebuild, not a restart).
- `ADMIN_BASE_URL` (CORS allowlist), `DATABASE_URL` → api site; runtime (restart is enough).
- Never put literal quote characters in env values (a `PORT` of `""` caused a restart loop).
- Prisma `42P05` prepared-statement error → append `?pgbouncer=true` to `DATABASE_URL`.
- Hostinger runs the compiled entry directly (`node dist/src/main.js`) — **npm scripts like `start:prod` never run in prod**. Boot-time work (migrations) lives in `apps/api/src/main.ts::bootstrap()`.
- Hostinger only promotes `dist/`; `apps/api/scripts/copy-node-modules.js` copies `node_modules` and `prisma/` into `dist/` at build end — extend that script rather than adding a parallel mechanism.
- Migration runner in `main.ts` is non-fatal and has `timeout: 8000` (an unbounded `execFileSync` once froze the event loop and tripped Hostinger's 3-second listen() watchdog).
- Build constraints: plain **npm** at build time (not pnpm), Next standalone output, **webpack not Turbopack**, no `__dirname` in `next.config.ts`, musl SWC binary as optional dep. Don't revert these.
- Prod DB is Supabase. The owner has several Supabase projects — verify table names (`students`, `tenants`, `fees`…) before trusting any query result. Past incident: prod was 3 migrations behind; backfilled by running SQL manually and inserting rows into `_prisma_migrations`.

## 6. Feature status
All API modules in CLAUDE.md are done. Addendum 4 (A8–A14: discount labels, receipt SMS/push, teacher dashboard, collection forecast, parent payment claims, accountant documents, teacher workload) is **shipped**. Also shipped: student notes, teacher report-card PDF upload (web + mobile), timetable with teacher/subject mismatch warning, bulk Excel import, tenant branding (logo/background).
**Deferred, not built:** "pending report-cycle reminders" on the teacher class-overview card (no report-cycle concept exists; see FOLLOW-UP comment in `apps/api/src/modules/teacher-dashboard/teacher-dashboard.service.ts::getMyClasses`).
**Gotcha:** `infra/mock-data/school-connect-mock-import.xlsx` is a hand-maintained fixture that drifts from `apps/api/src/modules/imports/tab-schema.ts` (`REQUIRED_TABS`/`TAB_HEADERS`). Diff headers before trusting it. (It is currently deleted in the working tree.)

## 7. Web-admin specifics
- Admin pages at `/admin/**`, platform (super_admin) at `/platform/**`, marketing landing at `/` (route group `(marketing)`), public receipts at `/receipts/**`, dev log viewer at `/dev/logs` (intentionally dark).
- Auth in localStorage (`slink_user`, tokens); `proxy.ts` (Next 16 rename of middleware) checks the `slink_authed` cookie. Never recreate `middleware.ts`.
- zod + react-hook-form: use `z.number()` with `register(..., { valueAsNumber: true })`, not `z.coerce.number()`.
- Route groups can't share a URL with a non-group page.
- **Design system (matches the landing page):** cream `#fbf3ea`, coral `#e8623d` (dark `#c94f2e`), deep teal `#123e3b` (light `#1b4b4a`) — tokens `bg-cream`, `bg-coral`, `text-teal` etc. in `app/globals.css`. Pill buttons, rounded-2xl cards, `font-extrabold` headings.
- Shared UI in `components/ui/*`. `Input`/`Select` accept `required` → red asterisk + `aria-required` only (does **not** set native `required`; validation stays in zod). Mark a field required only if the zod schema/handler enforces it.
- Responsive: sidebar is a drawer below `lg`; modals are bottom sheets on phones; form grids use `grid-cols-1 sm:grid-cols-2`; tables sit in `overflow-x-auto`.
- Lint has 32 pre-existing errors (mostly `react-hooks/set-state-in-effect`); don't treat as regressions — compare counts before/after.

## 8. Mobile specifics
- Theme in `lib/core/theme/app_theme.dart` (`AppColors`, light + dark `ThemeData` with component themes). No hard-coded brand colors in screens; only status colors (orange/green/grey) on fees/claims/reports.
- Tenant background image via `AuthenticatedScaffold`. Layout rule learned: card rows with several actions must use `Wrap` (the Fees card overflowed on phones with a `Row`).
- Android: `applicationId`/namespace `com.slink.school`; `android/build.gradle.kts` forces plugin `compileSdk = 36` (file_picker 8.x targets 34) — keep it. Release signing reads `android/key.properties`; without it the build silently falls back to debug signing — **verify with `jarsigner -verify -verbose:summary -certs build/app/outputs/bundle/release/app-release.aab`** (expect `CN=School Connect, O=Slink`).
- iOS: bundle ID `com.slink.school` (same as Android), team `22FR3BJ52R`, `GoogleService-Info.plist` is registered in the Runner target (file itself is gitignored). `Firebase.initializeApp()` runs at startup, so a missing/mismatched plist crashes iOS at launch.
- Display name "Schoolinkd" (Info.plist `CFBundleDisplayName`, manifest `android:label`).
- Current version `1.0.4+5` (`pubspec.yaml`); the `+N` build number must increase on every store upload. `1.0.3+4` was previously built.
- Store status: Android `.aab` builds and is signed. App Store Connect record "schoolinkd" exists (SKU `slink-ios-001`, v1.0 "Prepare for Submission"); listing metadata, screenshots, APNs key and first `.ipa` upload are still open — see `docs/RELEASE_IOS_ANDROID.md`.

## 9. Things NOT in git — copy or recreate on the new machine
| Item | Where it goes | Source |
|---|---|---|
| `apps/api/.env` | `apps/api/.env` | copy from `.env.example`; real values from owner / Hostinger / Supabase |
| `apps/web-admin/.env.local` | same path | owner |
| `google-services.json` | `apps/mobile/android/app/` | Firebase console (project `slink-57513`) |
| `GoogleService-Info.plist` | `apps/mobile/ios/Runner/` | Firebase console, iOS app `com.slink.school` |
| Android upload keystore `slink-release-upload.jks` + `android/key.properties` (alias `slink-upload`; `storeFile` path must be edited for the new machine) | `~/keystores/` and `apps/mobile/android/` | owner's backup — **if lost, Play needs an upload-key reset** |
| Apple Developer sign-in | Xcode → Settings → Accounts | owner's Apple ID, team `22FR3BJ52R` |
| Claude project skills | `.claude/skills/run-slink-stack` (untracked) | contents summarized in §4; copy the folder if wanted |

Do not paste any of these into chat or commit them.

## 10. Claude memory notes (carried over)
The owner's Claude memory on the original laptop lives in `~/.claude/projects/<project-path>/memory/`. It is not synced; this document is the portable copy. A new Claude session can re-create memory from §3 (conventions) and §5 (Hostinger) if desired.

## 11. First steps on the new machine
1. Clone, `pnpm install`, copy the secret files from §9.
2. `flutter doctor`; for iOS open `ios/Runner.xcworkspace` once and confirm signing shows no errors.
3. Run the local stack (§4) and confirm `curl localhost:3000/v1/health` returns ok.
4. Ask the owner what to work on; follow §3 for git hygiene.
