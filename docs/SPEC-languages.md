# Slink — Kannada & Hindi Language Support Spec (for Claude Code)

Oct 9, 2026 · @satish

Add Kannada and Hindi alongside English in the parent app, teacher app and admin web console, so each user can use Slink in the language they're most comfortable with.

## How to use with Claude Code

Save this spec as `docs/SPEC-languages.md` in your repo and run it one rollout stage at a time (see the last section). Switch Claude Code to plan mode (Shift+Tab) before pasting, so it proposes a plan before editing anything.

```
Read docs/SPEC-languages.md fully. We are implementing Stage <N> only.

Project layout: website in /web, admin console and API in /api,
mobile app in /mobile. Never run migrations or scripts against production.

Before writing any code:
1. Confirm the stack in each folder and whether any i18n library is already in use.
2. Recommend the i18n library for each codebase, following the spec, and explain why.
3. Count roughly how many hard-coded user-facing strings exist in the parts
   covered by this stage, and list the files.
4. List planned migrations, new endpoints, and files to change. Flag anything
   in the spec that conflicts with the current code and ask before deviating.

Then implement Stage <N>. Move every user-facing string into the translation
files; do not leave any hard-coded text. When done, give me: a summary of
changes, the list of new translation keys, and a manual test checklist.
```

Replace the folder paths with your real ones.

## Scope

Translate the app's own interface text into Kannada and Hindi; leave content that schools and teachers type exactly as they entered it.

**Languages and locale codes:**

| Language | Code | Shown in switcher as |
| --- | --- | --- |
| English (default) | `en` | English |
| Kannada | `kn` | ಕನ್ನಡ |
| Hindi | `hi` | हिन्दी |

Always show each language name in its own script in the switcher, so a parent who doesn't read English can still find their language. Design the setup so adding Tamil, Telugu or Marathi later means only adding a translation file.

**Surfaces in scope:** parent app, teacher app, admin web console (Admin, Accounts and Teacher roles), push notifications, and in-app emails or SMS templates if any exist. The marketing website is out of scope for now.

**Translate:**

- All interface text: buttons, menus, labels, headings, placeholders, empty states, confirmation dialogs, toasts, validation and error messages.
- System-generated messages: notification templates, fee reminders, absence alerts, claim approved or rejected messages.
- Status values shown to users: Paid, Pending, Overdue, Present, Absent, Under review, Approved, Rejected.
- Month and weekday names in date pickers and calendars.

**Do not translate:**

- Content typed by users: notice text, homework descriptions, student notes, report comments, fee structure names, class and subject names entered by the school. Show these exactly as entered (they may be in any language).
- People's names, school names, roll numbers, receipt numbers, amounts.
- Uploaded files such as report-card PDFs and homework photos.
- No automatic machine translation of user content in this release.

## Language selection

Each user picks their own language, it is saved to their account, and the change applies instantly without restarting or logging out.

**Which language a user sees, in order of priority:**

1. The language saved on the user's account.
2. On a device before login: the language picked on this device's first-launch screen.
3. The school's default language (set by the admin).
4. English.

**Mobile app:**

- First launch (before login): a simple full-screen picker with three large buttons: English, ಕನ್ನಡ, हिन्दी. This matters because many parents can't read an English login screen.
- Login screen: a small language button in the top corner (globe icon plus current language name).
- After login: Profile → Language. Changing it updates the UI immediately and saves to the server.
- Do not follow the phone's system language automatically; many Indian parents keep phones in English but prefer Kannada for reading. The first-launch picker can pre-select the system language if it is `kn` or `hi`.

**Admin web console:**

- Language dropdown in the top header (next to the user name) and in the user's profile/settings.
- Settings → School: "Default language for new parents and teachers" (English, Kannada or Hindi). Changing it doesn't override users who have already chosen.

**Backend:**

- Additive migration: `users.preferred_language` (nullable, one of `en`, `kn`, `hi`) and `schools.default_language` (default `en`).
- Endpoint to update the current user's language.
- Include the effective language in the login/profile response so apps load it at sign-in on a new device.

## Technical implementation

Use the standard, well-maintained i18n library for each stack, with English as the source of truth and automatic fallback to English for any missing translation.

**Library choice** (Claude Code confirms against the actual stack):

| Codebase | Recommended approach |
| --- | --- |
| Flutter app | `flutter_localizations` + `intl` with ARB files (`app_en.arb`, `app_kn.arb`, `app_hi.arb`) |
| React Native app | `i18next` + `react-i18next` with JSON files per language |
| Next.js / React web console | `next-intl` or `react-i18next` with JSON files per language |
| Other | The framework's standard i18n tool; ask before adding something unusual |

**Rules for strings:**

- Every user-facing string goes through the translation function. No hard-coded text in components. Add a lint rule or check that flags new hard-coded strings where the tooling supports it.
- Use meaningful, grouped keys, not English sentences as keys: `fees.payNow`, `attendance.markedAbsent`, `common.cancel`.
- Use placeholders, never string concatenation: `"{childName} was marked absent on {date}"`. Word order differs in Kannada and Hindi, so concatenating pieces will produce broken sentences.
- Use the library's plural support for counts ("1 student" vs "3 students").
- Missing key in `kn` or `hi` → show English, and log the missing key in development builds.
- Keep one shared key set for the parent and teacher apps where they are the same app; keep the web console's file separate.

**API errors:** the backend returns error codes (for example `CLAIM_ALREADY_APPROVED`) plus an English message. Apps show the translated message for known codes and fall back to the English text for unknown ones.

**Performance:** load only the active language's file; translation files must not noticeably increase app start time.

## Notifications, receipts and server-generated text

Anything the server writes for a user is rendered in that recipient's language, not the sender's.

- **Push notifications:** keep notification templates on the server in all three languages. When a teacher sends homework or attendance is marked, each parent gets the notification in their own preferred language. Teacher-typed content inside a notification (such as the notice title) stays as typed.
- **Fee reminders, absence alerts, claim status messages:** same template approach, with placeholders for child name, amount and date.
- **SMS or WhatsApp templates** (if added later): note that WhatsApp Business templates must be approved separately for each language, so keep template keys aligned with the push templates.
- **Fee receipts (PDF):** keep receipts in English for now, since schools often need them for records and audits. Add an option later for a bilingual receipt (English plus the parent's language).
- **Excel/CSV exports from the admin console:** column headers stay in English so exports work with existing spreadsheets and accountants.
- **Emails** (password reset and similar): send in the user's preferred language, with English as fallback.

## Fonts, layout and formatting

Kannada and Hindi text is usually longer and taller than English, so layouts must wrap gracefully rather than cut text off.

**Fonts:**

- Web: add Noto Sans Kannada and Noto Sans Devanagari as fallbacks in the font stack, loaded only when the active language needs them.
- Mobile: check that the app's custom font (if any) falls back to a font that supports Kannada and Devanagari; on Flutter set `fontFamilyFallback`. Test on an older, low-cost Android phone.
- Slightly increase line height for Kannada and Hindi (around 1.5) so vowel signs above and below letters don't get clipped.

**Layout:**

- No fixed widths or heights on text containers, buttons or tabs. Allow text to wrap to two lines.
- Dashboard cards, bottom navigation labels and table headers must still look right with longer text. If a nav label doesn't fit, use a shorter translation, not truncation with "...".
- Test every screen at 360px width in all three languages.

**Numbers, currency and dates:**

- Always use standard digits 0–9 in all three languages (not Kannada or Devanagari numerals). This is what Indian users expect for money and dates.
- Currency stays in Indian grouping with the rupee symbol: ₹1,23,456.
- Dates stay DD/MM/YYYY in numeric form. Where a month or weekday name is shown (calendars, "15 Oct"), use the localised name.

**Input and search:** student and parent search must work with names typed in Kannada or Devanagari script as well as English (Unicode-safe, case-insensitive for English).

## Translation workflow and glossary

Claude Code can produce first-draft translations, but every string must be reviewed by a native Kannada and Hindi speaker before release.

1. Claude Code extracts all strings into the English file and writes draft `kn` and `hi` files using the glossary below for consistency.
2. Generate a review spreadsheet (CSV): key, English, Kannada, Hindi, screen where it appears, and a "Reviewed" column.
3. A native speaker reviews it. A teacher or office staff member at your client school is ideal, since they know how parents actually talk.
4. Import the corrected CSV back into the translation files with a small script.
5. Review on real screens, because wording that is correct in a spreadsheet may not fit on a button.

**Tone:** use simple, everyday words parents actually use, not formal or government-style vocabulary. Where an English word is commonly used in speech (fee, homework), it's fine to use it written in the local script.

**Starter glossary** (suggestions, to be confirmed by the native reviewer):

| English | Kannada | Hindi |
| --- | --- | --- |
| Fees | ಶುಲ್ಕ | फीस |
| Pay Now | ಈಗ ಪಾವತಿಸಿ | अभी भुगतान करें |
| Payment | ಪಾವತಿ | भुगतान |
| Due / Pending | ಬಾಕಿ | बकाया |
| Receipt | ರಸೀದಿ | रसीद |
| Homework | ಮನೆಗೆಲಸ | होमवर्क |
| Notice | ಸೂಚನೆ | सूचना |
| Attendance | ಹಾಜರಾತಿ | उपस्थिति |
| Present | ಹಾಜರು | उपस्थित |
| Absent | ಗೈರುಹಾಜರು | अनुपस्थित |
| Report card | ಪ್ರಗತಿ ಪತ್ರ | रिपोर्ट कार्ड |
| Class | ತರಗತಿ | कक्षा |
| Teacher | ಶಿಕ್ಷಕರು | शिक्षक |
| Parent | ಪೋಷಕರು | अभिभावक |
| Language | ಭಾಷೆ | भाषा |

Add new terms to this glossary as they come up, and keep translations consistent across the apps.

## Rollout order and definition of done

Ship the parent app first, because parents benefit most from their own language and it's the strongest selling point to schools.

1. **Stage 1, foundations:** backend fields and endpoint, i18n library set up in each codebase, language switcher, fonts, English strings extracted into files (no visible change for English users).
2. **Stage 2, parent app:** Kannada and Hindi translations for all parent screens, parent push notification templates, first-launch picker.
3. **Stage 3, teacher app:** translations for teacher screens and teacher notifications.
4. **Stage 4, admin console:** translations for admin and accounts screens, school default language setting.

Run the native-speaker review (previous section) at the end of Stages 2, 3 and 4 before releasing each.

**Definition of done for each stage:**

- [ ] No hard-coded user-facing English strings left in the screens covered by the stage.
- [ ] Switching language updates every visible screen immediately, without restarting the app or logging out.
- [ ] The chosen language is remembered after closing the app and when logging in on a new device.
- [ ] Each user receives notifications in their own language, even when the sender uses a different one.
- [ ] Teacher- and school-typed content (notices, homework, names) displays unchanged.
- [ ] All screens checked at 360px width in all three languages: no clipped text, overlapping buttons, or broken vowel signs.
- [ ] Kannada and Devanagari text renders correctly on a low-cost Android phone.
- [ ] Amounts show ₹1,23,456 and dates DD/MM/YYYY in all languages, using digits 0–9.
- [ ] Missing translations fall back to English, never to a raw key like `fees.payNow`.
- [ ] Native speaker has signed off on the review spreadsheet for this stage.
