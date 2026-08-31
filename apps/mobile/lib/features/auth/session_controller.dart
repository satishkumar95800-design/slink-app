import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/active_user.dart';
import '../../shared/services/secure_storage_service.dart';
import '../../shared/services/push_notification_service.dart';
import 'auth_repository.dart';

enum SessionStatus { unknown, loggedOut, loggedIn }

class SessionState {
  final SessionStatus status;
  final ActiveUser? user;

  const SessionState._(this.status, this.user);

  const SessionState.unknown() : this._(SessionStatus.unknown, null);
  const SessionState.loggedOut() : this._(SessionStatus.loggedOut, null);
  const SessionState.loggedIn(ActiveUser user) : this._(SessionStatus.loggedIn, user);
}

/// Single source of truth for auth state. The router watches this to decide
/// whether to redirect to /onboarding/tenant, /login, or the authenticated app.
class SessionController extends StateNotifier<SessionState> {
  final Ref _ref;

  SessionController(this._ref) : super(const SessionState.unknown()) {
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final storage = _ref.read(secureStorageServiceProvider);
    final token = await storage.readAccessToken();
    final userJson = await storage.readUserJson();

    if (token == null || userJson == null) {
      state = const SessionState.loggedOut();
      return;
    }

    try {
      final user = ActiveUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      state = SessionState.loggedIn(user);
    } catch (_) {
      await storage.clearAll();
      state = const SessionState.loggedOut();
    }
  }

  Future<void> completeLogin(AuthResult result) async {
    final storage = _ref.read(secureStorageServiceProvider);
    await storage.writeAccessToken(result.accessToken);
    await storage.writeRefreshToken(result.refreshToken);
    await storage.writeUserJson(jsonEncode(result.user.toJson()));

    // Best-effort — a failed FCM registration shouldn't block login. Read
    // before flipping session state: the router watches this state and
    // rebuilds as soon as it changes, so no further ref reads can safely
    // happen on this notifier's ref after that point.
    try {
      await _ref.read(pushNotificationServiceProvider).registerToken();
    } catch (_) {}

    state = SessionState.loggedIn(result.user);
  }

  Future<void> logout() async {
    final storage = _ref.read(secureStorageServiceProvider);

    try {
      await _ref.read(pushNotificationServiceProvider).unregisterToken();
      final refreshToken = await storage.readRefreshToken();
      if (refreshToken != null) {
        await _ref.read(authRepositoryProvider).logout(refreshToken);
      }
    } catch (_) {
      // Best-effort server-side revoke — local session clears regardless.
    }

    await storage.clearAll();
    state = const SessionState.loggedOut();
  }
}

final sessionControllerProvider = StateNotifierProvider<SessionController, SessionState>((ref) {
  return SessionController(ref);
});
