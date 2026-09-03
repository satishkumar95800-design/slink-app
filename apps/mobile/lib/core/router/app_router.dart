import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/otp_verify_page.dart';
import '../../features/auth/phone_entry_page.dart';
import '../../features/auth/session_controller.dart';
import '../../features/auth/splash_page.dart';
import '../../features/auth/tenant_entry_page.dart';
import '../../features/dashboard/dashboard_page.dart';
import '../../features/fees/fees_list_page.dart';
import '../../features/payments/checkout_page.dart';
import '../../features/profile/profile_page.dart';
import '../../features/reports/report_detail_page.dart';
import '../../features/reports/reports_list_page.dart';
import '../../shared/services/secure_storage_service.dart';

const _authRoutes = ['/onboarding/tenant', '/login/phone', '/login/otp'];

/// Recreated whenever session status changes (login/logout/bootstrap resolves),
/// which intentionally resets the navigation stack at exactly those moments.
final appRouterProvider = Provider<GoRouter>((ref) {
  final sessionState = ref.watch(sessionControllerProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) async {
      final location = state.matchedLocation;

      if (sessionState.status == SessionStatus.unknown) {
        return location == '/splash' ? null : '/splash';
      }

      if (sessionState.status == SessionStatus.loggedOut) {
        final tenantId = await ref.read(secureStorageServiceProvider).readTenantId();
        if (tenantId == null) {
          return location == '/onboarding/tenant' ? null : '/onboarding/tenant';
        }
        return _authRoutes.contains(location) ? null : '/login/phone';
      }

      // loggedIn
      final onAuthOrSplash = location == '/splash' || _authRoutes.contains(location) || location == '/onboarding/tenant';
      return onAuthOrSplash ? '/dashboard' : null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/onboarding/tenant', builder: (_, __) => const TenantEntryPage()),
      GoRoute(path: '/login/phone', builder: (_, __) => const PhoneEntryPage()),
      GoRoute(path: '/login/otp', builder: (_, __) => const OtpVerifyPage()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardPage()),
      GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
      GoRoute(path: '/dashboard/fees', builder: (_, __) => const FeesListPage()),
      GoRoute(path: '/dashboard/reports', builder: (_, __) => const ReportsListPage()),
      GoRoute(
        path: '/fees/:feeId/pay',
        builder: (_, state) => CheckoutPage(feeId: state.pathParameters['feeId']!),
      ),
      GoRoute(
        path: '/reports/:id',
        builder: (_, state) => ReportDetailPage(reportId: state.pathParameters['id']!),
      ),
    ],
  );
});
