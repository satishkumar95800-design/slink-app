import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/app_lock/app_lock_controller.dart';
import 'package:slink/features/app_lock/app_lock_gate.dart';
import 'package:slink/features/auth/session_controller.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/models/active_user.dart';
import 'package:slink/shared/services/secure_storage_service.dart';

/// The phone's fingerprint check: answers what the test says.
class _FakeAuth implements DeviceAuth {
  _FakeAuth({this.supported = true});
  final bool supported;
  bool next = true;
  int prompts = 0;

  @override
  Future<bool> available() async => supported;

  @override
  Future<bool> confirm(String reason) async {
    prompts++;
    return next;
  }
}

class _FakeStorage extends SecureStorageService {
  bool lock = false;
  bool offered = false;

  @override
  Future<bool> readAppLock() async => lock;
  @override
  Future<void> writeAppLock(bool on) async => lock = on;
  @override
  Future<bool> readAppLockOffered() async => offered;
  @override
  Future<void> writeAppLockOffered() async => offered = true;
}

/// A session the test drives; logout is what "Sign in with OTP instead" calls.
class _FakeSession extends StateNotifier<SessionState> implements SessionController {
  _FakeSession(super.state);
  bool loggedOut = false;

  void set(SessionState s) => state = s;

  @override
  Future<void> logout() async {
    loggedOut = true;
    state = const SessionState.loggedOut();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _parent = ActiveUser(id: 'p1', name: 'Asha', role: UserRole.parent, tenantId: 't1');

void main() {
  group('AppLockController', () {
    late _FakeAuth auth;
    late _FakeStorage storage;
    late DateTime now;
    AppLockController make() => AppLockController(auth, storage, now: () => now);

    setUp(() {
      auth = _FakeAuth();
      storage = _FakeStorage();
      now = DateTime(2026, 10, 25, 9);
    });

    test('keeps the app covered until the setting is read', () {
      expect(make().state.covers, isTrue);
    });

    test('a restored session with unlock on starts locked, and opens on a confirmed check', () async {
      storage.lock = true;
      final c = make();
      await c.sessionRestored();
      expect(c.state.locked, isTrue);

      auth.next = false;
      expect(await c.unlock('r'), isFalse);
      expect(c.state.locked, isTrue);

      auth.next = true;
      expect(await c.unlock('r'), isTrue);
      expect(c.state.covers, isFalse);
    });

    test('a restored session with unlock off is not locked', () async {
      final c = make();
      await c.sessionRestored();
      expect(c.state.covers, isFalse);
    });

    test('a phone without biometrics never locks, even if the setting says on', () async {
      auth = _FakeAuth(supported: false);
      storage.lock = true;
      final c = make();
      await c.sessionRestored();
      expect(c.state.covers, isFalse);
      expect(c.state.available, isFalse);
    });

    test('a fresh OTP sign-in is never locked and offers unlock once', () async {
      storage.lock = true;
      final c = make();
      await c.signedIn();
      expect(c.state.covers, isFalse);
      expect(c.state.offer, isTrue);
      await c.dismissOffer();
      await c.signedIn();
      expect(c.state.offer, isFalse);
    });

    test('switching on needs a confirmed check first', () async {
      final c = make();
      await c.signedIn();
      auth.next = false;
      expect(await c.setEnabled(true, 'r'), isFalse);
      expect(storage.lock, isFalse);
      auth.next = true;
      expect(await c.setEnabled(true, 'r'), isTrue);
      expect(storage.lock, isTrue);
      expect(c.state.offer, isFalse);
    });

    test('locks again only after 5 minutes in the background', () async {
      storage.lock = true;
      final c = make();
      await c.sessionRestored();
      await c.unlock('r');

      c.wentToBackground();
      now = now.add(const Duration(minutes: 4, seconds: 59));
      c.cameBack();
      expect(c.state.locked, isFalse);

      c.wentToBackground();
      now = now.add(appLockAfter);
      c.cameBack();
      expect(c.state.locked, isTrue);
    });

    test('signing out clears the lock', () async {
      storage.lock = true;
      final c = make();
      await c.sessionRestored();
      c.signedOut();
      expect(c.state.covers, isFalse);
      expect(c.state.enabled, isFalse);
    });
  });

  group('AppLockGate', () {
    late _FakeAuth auth;
    late _FakeStorage storage;
    late _FakeSession session;

    Future<void> pump(WidgetTester tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          deviceAuthProvider.overrideWithValue(auth),
          secureStorageServiceProvider.overrideWithValue(storage),
          sessionControllerProvider.overrideWith((ref) => session),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => AppLockGate(child: child!),
          home: const Scaffold(body: Text('Fees due: ₹4,500')),
        ),
      ));
      await tester.pumpAndSettle();
    }

    setUp(() {
      auth = _FakeAuth();
      storage = _FakeStorage();
      session = _FakeSession(const SessionState.unknown());
    });

    testWidgets('a locked session hides the app and asks at once; a confirmed check opens it', (tester) async {
      storage.lock = true;
      auth.next = false;
      await pump(tester);
      session.set(const SessionState.loggedIn(_parent));
      await tester.pumpAndSettle();

      expect(auth.prompts, 1);
      expect(find.text('Unlock'), findsOneWidget);
      expect(find.text('Not recognised. Try again, or sign in with OTP.'), findsOneWidget);
      expect(find.text('Fees due: ₹4,500').hitTestable(), findsNothing);
      expect(tester.takeException(), isNull);

      auth.next = true;
      await tester.tap(find.text('Unlock'));
      await tester.pumpAndSettle();
      expect(find.text('Unlock'), findsNothing);
      expect(find.text('Fees due: ₹4,500').hitTestable(), findsOneWidget);
    });

    testWidgets('"Sign in with OTP instead" signs out', (tester) async {
      storage.lock = true;
      auth.next = false;
      await pump(tester);
      session.set(const SessionState.loggedIn(_parent));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Sign in with OTP instead'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in with OTP instead'));
      await tester.pumpAndSettle();
      expect(session.loggedOut, isTrue);
      expect(find.text('Unlock'), findsNothing);
    });

    testWidgets('after an OTP sign-in, offers unlock once; "Turn on" asks for the fingerprint', (tester) async {
      session = _FakeSession(const SessionState.loggedOut());
      await pump(tester);
      session.set(const SessionState.loggedIn(_parent));
      await tester.pumpAndSettle();

      expect(find.text('Open the app with your fingerprint?'), findsOneWidget);
      expect(find.text('Fees due: ₹4,500').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Turn on'));
      await tester.pumpAndSettle();
      expect(auth.prompts, 1);
      expect(storage.lock, isTrue);
      expect(find.text('Open the app with your fingerprint?'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
