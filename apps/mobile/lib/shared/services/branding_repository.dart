import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/session_controller.dart';
import '../models/tenant_branding.dart';
import 'api_client.dart';

class BrandingRepository {
  final Dio _dio;

  BrandingRepository(this._dio);

  Future<TenantBranding> getBranding() async {
    final response = await _dio.get('/tenant');
    return TenantBranding.fromJson(response.data as Map<String, dynamic>);
  }
}

final brandingRepositoryProvider = Provider<BrandingRepository>((ref) {
  return BrandingRepository(ref.watch(apiClientProvider));
});

/// Refetches whenever the session transitions to/from loggedIn; returns null
/// while logged out so screens can fall back to a plain background.
final brandingProvider = FutureProvider<TenantBranding?>((ref) async {
  final session = ref.watch(sessionControllerProvider);
  if (session.status != SessionStatus.loggedIn) return null;
  return ref.read(brandingRepositoryProvider).getBranding();
});

/// Whether the school has the calendar module on. False while branding loads
/// or fails, so the calendar tile never flashes for a school that doesn't have it.
final calendarEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.calendarEnabled ?? false;
});

/// Whether the school has the HR & payroll module on (staff payslips and leave).
/// False while branding loads or fails, so the tiles never flash for other schools.
final hrmsEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.hrmsEnabled ?? false;
});

/// Whether the school's plan includes the timetable (weekly routine, class
/// reminders). False while branding loads or fails, like the flags above.
final timetableEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.timetableEnabled ?? false;
});

/// Whether the school's plan includes shared staff documents.
final staffDocumentsEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.staffDocumentsEnabled ?? false;
});

/// Whether the school's plan includes syllabus progress.
final syllabusEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.syllabusEnabled ?? false;
});

/// Whether the school's plan includes school bus routes.
final schoolBusEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.transportEnabled ?? false;
});

/// Whether parents can follow the bus live and drivers share GPS (Premium Max).
final busTrackingEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.busTrackingEnabled ?? false;
});

/// Whether the school has the library (Premium Max).
final libraryEnabledProvider = Provider<bool>((ref) {
  return ref.watch(brandingProvider).valueOrNull?.libraryEnabled ?? false;
});
