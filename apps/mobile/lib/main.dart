import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_controller.dart';
import 'core/l10n/l10n.dart';
import 'core/l10n/language_controller.dart';
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
  final locale = await LanguageController.loadInitial();
  final themeMode = await ThemeModeController.loadInitial();
  runApp(ProviderScope(
    overrides: [
      initialLocaleProvider.overrideWithValue(locale),
      initialThemeModeProvider.overrideWithValue(themeMode),
    ],
    child: const SlinkApp(),
  ));
}

class SlinkApp extends ConsumerStatefulWidget {
  const SlinkApp({super.key});

  @override
  ConsumerState<SlinkApp> createState() => _SlinkAppState();
}

/// Plays the bus chime (MainActivity.kt / AppDelegate.swift).
const _sounds = MethodChannel('slink/sounds');

class _SlinkAppState extends ConsumerState<SlinkApp> {
  final _messenger = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    _configurePushNotifications();
  }

  Future<void> _configurePushNotifications() async {
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationRoute(message);
    });

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationRoute(initialMessage);
    }
  }

  /// The OS shows nothing for a push while the app is open: for the school
  /// bus, play the chime (bus arriving) and show it with a Track button.
  void _onForegroundMessage(RemoteMessage message) {
    final type = message.data['type'];
    if (type != 'bus_arriving' && type != 'bus_started') return;
    if (type == 'bus_arriving') _sounds.invokeMethod<void>('busChime').catchError((_) {});
    final n = message.notification;
    _messenger.currentState?.showSnackBar(SnackBar(
      duration: const Duration(seconds: 8),
      content: Text([n?.title, n?.body].whereType<String>().join('\n')),
      action: SnackBarAction(label: currentL10n.busPushTrack, onPressed: () => _handleNotificationRoute(message)),
    ));
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
            'title': message.notification?.title ??
                data['title'] ??
                (type == 'homework' ? currentL10n.homeworkKind : currentL10n.noticeKind),
            'body': message.notification?.body ?? data['body'] ?? '',
            'attachmentUrl': data['attachmentUrl'],
            'broadcastId': data['broadcastId'],
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
      case 'class_reminder':
        return (route: '/dashboard/routine', extra: null);
      case 'consent':
        return (route: '/consent', extra: null);
      // Morning holiday push; the calendar is optional, the history is not.
      case 'holiday':
        return (route: '/dashboard/notifications', extra: null);
      // A photo album shared (or about to be removed): open it for that child.
      case 'album':
        final studentId = data['studentId'];
        final albumId = data['albumId'];
        if (studentId != null && albumId != null) return (route: '/photos/child/$studentId/$albumId', extra: null);
        break;
      // School bus started / about 5 minutes away: the child's bus on the map.
      case 'bus_started':
      case 'bus_arriving':
        final studentId = data['studentId'];
        if (studentId != null) return (route: '/school-bus/live/$studentId', extra: null);
        break;
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
    final locale = ref.watch(languageControllerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => context.l10n.appName,
      theme: theme.lightTheme,
      darkTheme: theme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      scaffoldMessengerKey: _messenger,
      debugShowCheckedModeBanner: false,
      // Changing language rebuilds from here down — no restart or re-login.
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
