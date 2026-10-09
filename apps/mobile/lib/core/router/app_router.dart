import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/otp_verify_page.dart';
import '../../features/auth/phone_entry_page.dart';
import '../../features/auth/session_controller.dart';
import '../../features/auth/splash_page.dart';
import '../../features/auth/tenant_entry_page.dart';
import '../../features/dashboard/dashboard_page.dart';
import '../../features/dashboard/my_classes_page.dart';
import '../../features/fees/fees_list_page.dart';
import '../../features/homework/send_homework_page.dart';
import '../../features/notices/notice_detail_page.dart';
import '../../features/notices/send_notice_page.dart';
import '../../features/notifications/notification_history_page.dart';
import '../../features/payment_claims/my_payment_claims_page.dart';
import '../../features/payment_claims/submit_payment_claim_page.dart';
import '../../features/payments/checkout_page.dart';
import '../../features/profile/profile_page.dart';
import '../../features/receipts/fee_receipts_page.dart';
import '../../features/receipts/receipt_detail_page.dart';
import '../../features/reports/report_detail_page.dart';
import '../../features/reports/reports_list_page.dart';
import '../../features/reports/upload_report_card_page.dart';
import '../../features/timetable/weekly_routine_page.dart';
import '../../shared/services/secure_storage_service.dart';
import '../../features/attendance/attendance_calendar_page.dart';
import '../../features/attendance/mark_attendance_page.dart';
import '../../features/homework/homework_list_page.dart';
import '../../features/notices/notices_list_page.dart';
import '../../features/broadcasts/sent_items_page.dart';
import '../../features/student_notes/add_student_note_page.dart';

const _authRoutes = ['/onboarding/tenant', '/login/phone', '/login/otp'];

/// Recreated whenever session status changes (login/logout/bootstrap resolves),
/// which intentionally resets the navigation stack at exactly those moments.
final appRouterProvider = Provider<GoRouter>((ref) {
  final sessionState = ref.watch(sessionControllerProvider);
  // Captured synchronously, before any `await` — the redirect callback below
  // is async, and if session status changes while it's mid-flight, this whole
  // provider rebuilds and disposes `ref`. Calling `ref.read(...)` again after
  // the `await` would then throw ("Cannot use ref functions after the
  // dependency of a provider changed but before the provider rebuilt"). The
  // plain repository instance itself stays valid to use, so we hold onto it
  // instead of touching `ref` again post-await.
  final secureStorage = ref.read(secureStorageServiceProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) async {
      final location = state.matchedLocation;

      if (sessionState.status == SessionStatus.unknown) {
        return location == '/splash' ? null : '/splash';
      }

      if (sessionState.status == SessionStatus.loggedOut) {
        final tenantId = await secureStorage.readTenantId();
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
      GoRoute(path: '/dashboard/notifications', builder: (_, __) => const NotificationHistoryPage()),
      GoRoute(path: '/dashboard/routine', builder: (_, __) => const WeeklyRoutinePage()),
      GoRoute(path: '/dashboard/my-classes', builder: (_, __) => const MyClassesPage()),
      GoRoute(
        path: '/fees/:feeId/pay',
        builder: (_, state) => CheckoutPage(feeId: state.pathParameters['feeId']!),
      ),
      GoRoute(
        path: '/fees/:feeId/claim',
        builder: (_, state) => SubmitPaymentClaimPage(
          feeId: state.pathParameters['feeId']!,
          outstandingAmount: state.extra as double?,
        ),
      ),
      GoRoute(
        path: '/fees/:feeId/receipts',
        builder: (_, state) => FeeReceiptsPage(feeId: state.pathParameters['feeId']!),
      ),
      GoRoute(path: '/payment-claims/mine', builder: (_, __) => const MyPaymentClaimsPage()),
      GoRoute(
        path: '/receipts/:id',
        builder: (_, state) => ReceiptDetailPage(receiptId: state.pathParameters['id']!),
      ),
      // Must stay above '/reports/:id', otherwise "upload" is matched as a report id.
      GoRoute(path: '/reports/upload', builder: (_, __) => const UploadReportCardPage()),
      GoRoute(
        path: '/reports/:id',
        builder: (_, state) => ReportDetailPage(reportId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/homework', builder: (_, __) => const HomeworkListPage()),
      GoRoute(path: '/broadcasts/sent', builder: (_, __) => const SentItemsPage()),
      GoRoute(path: '/student-notes/add', builder: (_, __) => const AddStudentNotePage()),
      GoRoute(path: '/notices', builder: (_, __) => const NoticesListPage()),
      GoRoute(path: '/attendance/mark', builder: (_, __) => const MarkAttendanceEntryPage()),
      GoRoute(
        path: '/attendance/mark/:classId',
        builder: (_, state) => MarkAttendancePage(classId: state.pathParameters['classId']!),
      ),
      GoRoute(
        path: '/attendance/student/:studentId',
        builder: (_, state) => AttendanceCalendarPage(
          studentId: state.pathParameters['studentId']!,
          initialMonth: state.uri.queryParameters['month'],
        ),
      ),
      GoRoute(path: '/notices/send', builder: (_, __) => const SendNoticePage()),
      GoRoute(path: '/homework/send', builder: (_, __) => const SendHomeworkPage()),
      GoRoute(
        path: '/notices/detail',
        builder: (_, state) {
          final data = (state.extra as Map<String, dynamic>?) ?? const {};
          // Lists pass `attachments` ([{url, contentType}] or URLs); push taps only have `attachmentUrl`.
          final raw = data['attachments'] as List<dynamic>? ??
              [if (data['attachmentUrl'] != null && data['attachmentUrl'].toString().isNotEmpty) data['attachmentUrl']];
          return NoticeDetailPage(
            title: data['title']?.toString() ?? 'Notice',
            body: data['body']?.toString() ?? '',
            attachments: [for (final a in raw) NoticeAttachment.fromAny(a as Object)],
            broadcastId: data['broadcastId']?.toString(),
          );
        },
      ),
    ],
  );
});
