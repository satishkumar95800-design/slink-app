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
