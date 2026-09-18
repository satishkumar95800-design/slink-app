import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

/// POST /notifications/broadcast targeted at a class's parents. Plain text
/// (no fileKey) requires the caller to be the class's designated class
/// teacher; a fileKey (e.g. a homework photo) is allowed for any teacher
/// linked to the class — see NotificationsService.assertTeacherCanBroadcast.
class BroadcastRepository {
  final Dio _dio;

  BroadcastRepository(this._dio);

  Future<void> sendToClass({
    required String classId,
    required String title,
    required String body,
    String? fileKey,
  }) async {
    await _dio.post('/notifications/broadcast', data: {
      'channel': 'fcm',
      'targetType': 'class',
      'targetId': classId,
      'title': title,
      'body': body,
      'data': {'type': fileKey != null ? 'homework' : 'notice'},
      if (fileKey != null) 'fileKey': fileKey,
    });
  }
}

final broadcastRepositoryProvider = Provider<BroadcastRepository>((ref) {
  return BroadcastRepository(ref.watch(apiClientProvider));
});
