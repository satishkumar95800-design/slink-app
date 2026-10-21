import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_controller.dart';
import '../../shared/models/active_user.dart';
import '../../shared/services/secure_storage_service.dart';
import '../../shared/services/push_notification_service.dart';
import 'auth_repository.dart';

enum SessionStatus { unknown, loggedOut, loggedIn }

class SessionState {
  final SessionStatus status;

  /// The signed-in account (its real role).
  final ActiveUser? account;

  /// A staff member who is also a parent, using the app as a parent.
  final bool actingAsParent;

  const SessionState._(this.status, this.account, {this.actingAsParent = false});

  const SessionState.unknown() : this._(SessionStatus.unknown, null);
  const SessionState.loggedOut() : this._(SessionStatus.loggedOut, null);
  const SessionState.loggedIn(ActiveUser user, {bool actingAsParent = false})
      : this._(SessionStatus.loggedIn, user, actingAsParent: actingAsParent);

  /// Who the app is acting as: the account, with the parent role in parent mode.
  ActiveUser? get user => actingAsParent ? account?.copyWith(role: UserRole.parent) : account;

  /// Staff linked to children of the school get the Staff | Parent switch.
  bool get canSwitchToParent => account != null && account!.role != UserRole.parent && account!.hasChildren;
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
    final String? token;
    final String? userJson;
    try {
      token = await storage.readAccessToken();
      userJson = await storage.readUserJson();
    } catch (_) {
      // Unreadable storage must never leave the app on the splash spinner.
      try {
        await storage.clearAll();
      } catch (_) {}
      state = const SessionState.loggedOut();
      return;
    }

    if (token == null || userJson == null) {
      state = const SessionState.loggedOut();
      return;
    }

    final ActiveUser user;
    try {
      user = ActiveUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
    } catch (_) {
      await storage.clearAll();
      state = const SessionState.loggedOut();
      return;
    }
    final actAs = await storage.readActAs().catchError((_) => null);
    state = SessionState.loggedIn(user, actingAsParent: actAs == 'parent' && user.role != UserRole.parent);
    if (user.role != UserRole.parent) unawaited(refreshAccount());
  }

  /// Re-reads the account from /auth/me (staff: whether children are linked,
  /// which a sign-in from an older app version didn't store). Called outside
  /// parent mode only, since /auth/me answers with the role in use.
  Future<void> refreshAccount() async {
    final current = state;
    if (current.status != SessionStatus.loggedIn || current.actingAsParent) return;
    try {
      final me = await _ref.read(authRepositoryProvider).getMe();
      final account = state.account;
      if (account?.id != me.id || state.actingAsParent || account?.hasChildren == me.hasChildren) return;
      await _ref.read(secureStorageServiceProvider).writeUserJson(jsonEncode(me.toJson()));
      state = SessionState.loggedIn(me);
    } catch (_) {
      // Offline or signed out meanwhile: keep what we have.
    }
  }

  /// Staff | Parent switch. Requests then carry `X-Act-As: parent`.
  Future<void> setActingAsParent(bool asParent) async {
    final account = state.account;
    if (state.status != SessionStatus.loggedIn || account == null) return;
    if (asParent && !state.canSwitchToParent) return;
    await _ref.read(secureStorageServiceProvider).writeActAs(asParent ? 'parent' : null);
    state = SessionState.loggedIn(account, actingAsParent: asParent);
  }

  /// The server refused parent mode (children unlinked): back to staff.
  Future<void> parentModeRefused() async {
    final account = state.account;
    if (!state.actingAsParent || account == null) return;
    final staff = account.copyWith(hasChildren: false);
    final storage = _ref.read(secureStorageServiceProvider);
    await storage.writeActAs(null);
    await storage.writeUserJson(jsonEncode(staff.toJson()));
    state = SessionState.loggedIn(staff);
  }

  Future<void> completeLogin(AuthResult result) async {
    final storage = _ref.read(secureStorageServiceProvider);
    await storage.writeAccessToken(result.accessToken);
    await storage.writeRefreshToken(result.refreshToken);
    await storage.writeUserJson(jsonEncode(result.user.toJson()));
    await storage.writeActAs(null);

    // Best-effort — a failed FCM registration shouldn't block login. Read
    // before flipping session state: the router watches this state and
    // rebuilds as soon as it changes, so no further ref reads can safely
    // happen on this notifier's ref after that point.
    try {
      await _ref.read(pushNotificationServiceProvider).registerToken();
    } catch (_) {}

    // Open in the account's language, even on a brand-new phone.
    await _ref.read(languageControllerProvider.notifier).applyFromAccount(
          preferredLanguage: result.user.preferredLanguage,
          effectiveLanguage: result.user.language,
        );

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
