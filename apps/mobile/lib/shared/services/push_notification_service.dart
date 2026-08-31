import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'notifications_repository.dart';

/// Owns the FCM token lifecycle: request permission, register with the backend
/// on login, keep it fresh on rotation, and remove it on logout.
///
/// Deliberately scoped for MVP: background/terminated-state notifications are
/// displayed by the OS automatically (no app code needed for that). Tapping one
/// currently just brings the app to the foreground rather than deep-linking to
/// the specific fee/report — the backend doesn't yet send structured routing
/// hints in the FCM data payload, so there's nothing to route on. Revisit once
/// notification `data` payloads carry e.g. `{ type: 'fee_due', studentFeeId }`.
class PushNotificationService {
  final Ref _ref;

  PushNotificationService(this._ref);

  Future<void> registerToken() async {
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    final token = await messaging.getToken();
    if (token != null) {
      await _ref.read(notificationsRepositoryProvider).registerFcmToken(token);
    }

    messaging.onTokenRefresh.listen((newToken) {
      _ref.read(notificationsRepositoryProvider).registerFcmToken(newToken);
    });
  }

  Future<void> unregisterToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _ref.read(notificationsRepositoryProvider).removeFcmToken(token);
    }
  }
}

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService(ref);
});
