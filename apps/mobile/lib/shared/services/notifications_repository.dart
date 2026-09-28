import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class NotificationHistoryItem {
  final String id;
  final String? title;
  final String body;
  final String? attachmentUrl;
  final DateTime createdAt;

  NotificationHistoryItem({
    required this.id,
    required this.title,
    required this.body,
    required this.attachmentUrl,
    required this.createdAt,
  });

  factory NotificationHistoryItem.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>?;
    return NotificationHistoryItem(
      id: json['id'] as String,
      title: json['title'] as String?,
      body: json['body'] as String,
      attachmentUrl: data?['attachmentUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class NotificationsRepository {
  final Dio _dio;

  NotificationsRepository(this._dio);

  Future<void> registerFcmToken(String token) async {
    await _dio.post('/notifications/fcm-token', data: {'token': token});
  }

  Future<void> removeFcmToken(String token) async {
    await _dio.delete('/notifications/fcm-token', data: {'token': token});
  }

  /// The caller's own notification/homework history — server always scopes
  /// this to the authenticated user, page/limit are the only inputs.
  Future<List<NotificationHistoryItem>> fetchMine({int page = 1, int limit = 20}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notifications/me',
      queryParameters: {'page': page, 'limit': limit},
    );
    final items = response.data!['data'] as List<dynamic>;
    return items.map((e) => NotificationHistoryItem.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.watch(apiClientProvider));
});
