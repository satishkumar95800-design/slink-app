import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class NotificationsRepository {
  final Dio _dio;

  NotificationsRepository(this._dio);

  Future<void> registerFcmToken(String token) async {
    await _dio.post('/notifications/fcm-token', data: {'token': token});
  }

  Future<void> removeFcmToken(String token) async {
    await _dio.delete('/notifications/fcm-token', data: {'token': token});
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.watch(apiClientProvider));
});
