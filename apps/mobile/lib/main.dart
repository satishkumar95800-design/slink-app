import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

/// Must be a top-level function — the OS invokes this in a separate isolate
/// when a push notification arrives while the app is backgrounded/terminated.
/// No-op beyond the OS's own display of the notification (see
/// push_notification_service.dart for why deep-link routing is deferred).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(const ProviderScope(child: SchoolConnectApp()));
}

class SchoolConnectApp extends ConsumerStatefulWidget {
  const SchoolConnectApp({super.key});

  @override
  ConsumerState<SchoolConnectApp> createState() => _SchoolConnectAppState();
}

class _SchoolConnectAppState extends ConsumerState<SchoolConnectApp> {
  @override
  void initState() {
    super.initState();
    _configurePushNotifications();
  }

  Future<void> _configurePushNotifications() async {
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationRoute(message.data);
    });

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationRoute(initialMessage.data);
    }
  }

  void _handleNotificationRoute(Map<String, dynamic> data) {
    final targetRoute = _resolveNotificationRoute(data);
    if (targetRoute == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(appRouterProvider).go(targetRoute);
    });
  }

  String? _resolveNotificationRoute(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    final feeId = data['feeId'] ?? data['studentFeeId'];
    final reportId = data['reportId'];

    switch (type) {
      case 'fee_due':
      case 'fee_payment':
      case 'payment':
        if (feeId != null) return '/fees/$feeId/pay';
        break;
      case 'report':
      case 'report_published':
        if (reportId != null) return '/reports/$reportId';
        break;
      case 'dashboard':
        return '/dashboard';
    }

    if (feeId != null && feeId is String && feeId.isNotEmpty) {
      return '/fees/$feeId/pay';
    }

    if (reportId != null && reportId is String && reportId.isNotEmpty) {
      return '/reports/$reportId';
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final theme = ref.watch(appThemeProvider);

    return MaterialApp.router(
      title: 'School Connect',
      theme: theme.lightTheme,
      darkTheme: theme.darkTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
