import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/strings.dart';
import 'features/dashboard/students_repository.dart';

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
  runApp(const ProviderScope(child: SlinkApp()));
}

class SlinkApp extends ConsumerStatefulWidget {
  const SlinkApp({super.key});

  @override
  ConsumerState<SlinkApp> createState() => _SlinkAppState();
}

class _SlinkAppState extends ConsumerState<SlinkApp> {
  @override
  void initState() {
    super.initState();
    _configurePushNotifications();
  }

  Future<void> _configurePushNotifications() async {
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationRoute(message);
    });

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationRoute(initialMessage);
    }
  }

  void _handleNotificationRoute(RemoteMessage message) {
    final target = _resolveNotificationRoute(message);
    if (target == null) return;

    // Pushes about one child (attendance, fees, claims, reports) switch the
    // parent's selected child first, so the screen opens for the right child.
    final studentId = message.data['studentId']?.toString();
    if (studentId != null && studentId.isNotEmpty) selectChild(ref, studentId);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(appRouterProvider).go(target.route, extra: target.extra);
    });
  }

  ({String route, Object? extra})? _resolveNotificationRoute(RemoteMessage message) {
    final data = message.data;
    final type = data['type']?.toString();
    final feeId = data['feeId'] ?? data['studentFeeId'];
    final reportId = data['reportId'];
    final receiptId = data['receiptId'];

    switch (type) {
      case 'fee_due':
      case 'fee_payment':
      case 'payment':
        if (feeId != null) return (route: '/fees/$feeId/pay', extra: null);
        break;
      case 'receipt':
        if (receiptId != null) return (route: '/receipts/$receiptId', extra: null);
        break;
      case 'report':
      case 'report_published':
        if (reportId != null) return (route: '/reports/$reportId', extra: null);
        break;
      case 'notice':
      case 'homework':
        return (
          route: '/notices/detail',
          extra: {
            'title': message.notification?.title ?? data['title'] ?? (type == 'homework' ? 'Homework' : 'Notice'),
            'body': message.notification?.body ?? data['body'] ?? '',
            'attachmentUrl': data['attachmentUrl'],
          },
        );
      case 'attendance':
        final studentId = data['studentId'];
        final date = data['date']?.toString();
        if (studentId != null) {
          final month = date != null && date.length >= 7 ? '?month=${date.substring(0, 7)}' : '';
          return (route: '/attendance/student/$studentId$month', extra: null);
        }
        break;
      case 'payment_claim':
        return (route: '/dashboard/fees', extra: null);
      case 'dashboard':
        return (route: '/dashboard', extra: null);
    }

    if (feeId != null && feeId is String && feeId.isNotEmpty) {
      return (route: '/fees/$feeId/pay', extra: null);
    }

    if (reportId != null && reportId is String && reportId.isNotEmpty) {
      return (route: '/reports/$reportId', extra: null);
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final theme = ref.watch(appThemeProvider);

    return MaterialApp.router(
      title: AppStrings.appName,
      theme: theme.lightTheme,
      darkTheme: theme.darkTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
