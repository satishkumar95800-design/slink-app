import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/active_user.dart';
import '../../shared/services/api_client.dart';

class AuthRepository {
  final Dio _dio;

  AuthRepository(this._dio);

  Future<AuthResult> verifyPhoneOtp({required String firebaseIdToken}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/phone/verify',
      data: {'firebaseIdToken': firebaseIdToken},
    );
    return AuthResult.fromJson(response.data!);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post('/auth/logout', data: {'refreshToken': refreshToken});
  }

  /// GET /auth/me wraps its payload as { success: true, data: user } — unlike
  /// every other endpoint in this API, which return the resource directly.
  Future<ActiveUser> getMe() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    return ActiveUser.fromJson(response.data!['data'] as Map<String, dynamic>);
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});
