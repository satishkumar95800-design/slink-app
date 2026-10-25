import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../../shared/services/secure_storage_service.dart';
import '../auth/session_controller.dart';

/// Biometric unlock of a session that phone OTP already created. The check
/// stays on the phone (fingerprint, face, or the device PIN as fallback); the
/// server never sees it and the tokens stay in secure storage, so pushes and
/// the driver's background location keep working while the screen is locked.
abstract class DeviceAuth {
  /// The phone can check the owner (biometrics enrolled, or a screen lock).
  Future<bool> available();

  /// Shows the system prompt; true when the owner was confirmed.
  Future<bool> confirm(String reason);
}

class LocalDeviceAuth implements DeviceAuth {
  final _auth = LocalAuthentication();

  @override
  Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported() && await _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> confirm(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, persistAcrossBackgrounding: true);
    } catch (_) {
      // Locked out after too many tries, no enrolment, cancelled: not confirmed.
      return false;
    }
  }
}

final deviceAuthProvider = Provider<DeviceAuth>((ref) => LocalDeviceAuth());

/// After this long in the background, the app asks again.
const appLockAfter = Duration(minutes: 5);

@immutable
class AppLockState {
  /// The phone supports it (decides whether the option is shown at all).
  final bool available;

  /// The user switched it on for this session.
  final bool enabled;

  /// The lock screen is showing.
  final bool locked;

  /// Show the one-time "use fingerprint next time?" offer after an OTP sign-in.
  final bool offer;

  /// Still reading the setting for a restored session: keep the app covered so
  /// nothing shows before the lock does.
  final bool checking;

  const AppLockState({
    this.available = false,
    this.enabled = false,
    this.locked = false,
    this.offer = false,
    this.checking = true,
  });

  /// The app's content must not be visible.
  bool get covers => locked || checking;

  AppLockState copyWith({bool? available, bool? enabled, bool? locked, bool? offer}) => AppLockState(
        available: available ?? this.available,
        enabled: enabled ?? this.enabled,
        locked: locked ?? this.locked,
        offer: offer ?? this.offer,
        checking: checking,
      );
}

class AppLockController extends StateNotifier<AppLockState> {
  AppLockController(this._auth, this._storage, {DateTime Function()? now})
      : _now = now ?? DateTime.now,
        super(const AppLockState());

  final DeviceAuth _auth;
  final SecureStorageService _storage;
  final DateTime Function() _now;
  DateTime? _backgroundSince;

  /// A session restored at app start: locked when the user turned unlock on.
  Future<void> sessionRestored() async {
    final available = await _auth.available();
    final enabled = available && await _storage.readAppLock();
    state = AppLockState(available: available, enabled: enabled, locked: enabled, checking: false);
  }

  /// A fresh OTP sign-in: never locked; offer biometric unlock once.
  Future<void> signedIn() async {
    final available = await _auth.available();
    final offered = await _storage.readAppLockOffered();
    state = AppLockState(available: available, offer: available && !offered, checking: false);
  }

  void signedOut() {
    _backgroundSince = null;
    state = AppLockState(available: state.available, checking: false);
  }

  void wentToBackground() => _backgroundSince ??= _now();

  void cameBack() {
    final since = _backgroundSince;
    _backgroundSince = null;
    if (state.enabled && since != null && _now().difference(since) >= appLockAfter) {
      state = state.copyWith(locked: true);
    }
  }

  Future<bool> unlock(String reason) async {
    final ok = await _auth.confirm(reason);
    if (ok) state = state.copyWith(locked: false);
    return ok;
  }

  /// Switching on needs the owner to confirm first, so nobody else can set it up.
  Future<bool> setEnabled(bool on, String reason) async {
    if (on && !await _auth.confirm(reason)) return false;
    await _storage.writeAppLock(on);
    await _storage.writeAppLockOffered();
    state = state.copyWith(enabled: on, offer: false, locked: false);
    return true;
  }

  Future<void> dismissOffer() async {
    await _storage.writeAppLockOffered();
    state = state.copyWith(offer: false);
  }
}

final appLockProvider = StateNotifierProvider<AppLockController, AppLockState>((ref) {
  final controller = AppLockController(ref.read(deviceAuthProvider), ref.read(secureStorageServiceProvider));
  // Follow the session: restored at start (may lock), fresh sign-in (offer), signed out (reset).
  ref.listen<SessionState>(sessionControllerProvider, (prev, next) {
    final was = prev?.status;
    if (next.status == SessionStatus.loggedIn && (was == null || was == SessionStatus.unknown)) {
      controller.sessionRestored();
    } else if (next.status == SessionStatus.loggedIn && was == SessionStatus.loggedOut) {
      controller.signedIn();
    } else if (next.status == SessionStatus.loggedOut) {
      controller.signedOut();
    }
  }, fireImmediately: true);
  return controller;
});
