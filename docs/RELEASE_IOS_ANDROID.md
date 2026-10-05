# Release guide — Schoolinkd (iOS + Android)

Hand this file to Claude Code on a new computer: *"Follow docs/RELEASE_IOS_ANDROID.md and get me to a signed iOS .ipa and Android .aab."*

## Identity (identical on both platforms)
| | Value |
|---|---|
| App name (home screen) | Schoolinkd |
| App Store Connect name | schoolinkd |
| Bundle / application ID | `com.slink.school` |
| Apple Team ID | `22FR3BJ52R` |
| Firebase project | `slink-57513` |
| Version | `pubspec.yaml` → `1.0.4+5` (bump the `+N` build number for every upload) |
| Production API | `https://api.schoolinkd.in/v1` |

## Prerequisites on the new machine
- macOS with Xcode (for iOS), Flutter 3.x stable, Node 22 + pnpm 9 (only if touching api/web), CocoaPods.
- Android: Android SDK incl. platform **android-36**, JDK 17.
- Apple Developer account signed in to Xcode (Settings → Accounts) with team `22FR3BJ52R`.

## Secret files — NOT in git, copy them over securely
| File | Destination | Used for |
|---|---|---|
| `GoogleService-Info.plist` (bundle `com.slink.school`) | `apps/mobile/ios/Runner/` | iOS Firebase. Download again from Firebase console → Project settings → iOS app. Already referenced in the Xcode project. |
| `google-services.json` | `apps/mobile/android/app/` | Android Firebase (same console). |
| `slink-release-upload.jks` | any path | Android upload key. |
| `key.properties` | `apps/mobile/android/key.properties` | `storeFile` must point at the .jks path on the new machine; also holds alias `slink-upload` + passwords. |

Never commit these. Losing the upload keystore means a Play Console key-reset request.

## Setup
```bash
git clone <repo> && cd slink/apps/mobile
flutter pub get
cd ios && pod install && cd ..     # if pods are out of date
flutter doctor                      # must be green for the target platform
```

## Build Android (Play Console)
```bash
flutter analyze
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.schoolinkd.in/v1
# -> build/app/outputs/bundle/release/app-release.aab
```
Upload in Play Console → Testing/Production → Create new release. Version code (`+N`) must be higher than any previous upload.
Gotcha: `android/build.gradle.kts` forces plugin `compileSdk = 36` (file_picker still targets 34) — keep it.

## Build iOS (App Store Connect / TestFlight)
One-time in Xcode: open `ios/Runner.xcworkspace` → Runner target → Signing & Capabilities → *Automatically manage signing*, Team `22FR3BJ52R`; add **Push Notifications** and **Background Modes → Remote notifications**.

```bash
flutter build ipa --release --dart-define=API_BASE_URL=https://api.schoolinkd.in/v1
# -> build/ios/ipa/*.ipa
```
Upload with the **Transporter** app (drag the .ipa), or `xcrun altool --upload-app -f build/ios/ipa/*.ipa -t ios --apiKey <KEY> --apiIssuer <ISSUER>`.
The build shows in App Store Connect → TestFlight after processing (~10 min). Then attach it to *iOS App Version 1.0* and Add for Review.

## One-time Apple / Firebase setup (already done for this app unless noted)
- App ID `com.slink.school` registered with Push Notifications ticked.
- App Store Connect app "schoolinkd" created (SKU `slink-ios-001`).
- **TODO:** APNs Auth Key (`.p8`, developer.apple.com → Keys) uploaded in Firebase → Project settings → Cloud Messaging → iOS app, otherwise iOS push won't deliver.
- **TODO:** Firebase Phone Auth on iOS needs the app's reversed client ID as a URL scheme if reCAPTCHA fallback is used — test OTP login on a real iPhone before submitting.

## App Store Connect listing checklist
- Screenshots: 6.5" (1242×2688 or 1284×2778) and 6.9" if prompted.
- Description, keywords, support URL, privacy policy URL (`/privacy-policy` on the web-admin site).
- App Privacy questionnaire (phone number, name, payment info, photos).
- Age rating; export compliance = no non-exempt encryption (HTTPS only).
- **Reviewer access:** login is phone OTP — provide a demo number with a fixed test OTP (Firebase console → Authentication → Phone → test numbers) in App Review notes.

## Verify before upload
- App launches on a real device with the release build and logs in.
- `flutter analyze` clean.
- iOS: no crash at startup (missing/mismatched `GoogleService-Info.plist` is the usual cause).
