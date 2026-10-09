import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

enum BroadcastKind { notice, homework }

/// POST /notifications/broadcast targeted at a class's parents. A notice
/// requires the caller to be the class's designated class teacher; homework
/// is allowed for any teacher linked to the class — see
/// NotificationsService.assertTeacherCanBroadcast.
class BroadcastRepository {
  final Dio _dio;

  BroadcastRepository(this._dio);

  Future<void> sendToClass({
    required String classId,
    required BroadcastKind kind,
    required String title,
    required String body,
    List<String> fileKeys = const [],
    String? subjectId,
  }) async {
    await _dio.post('/notifications/broadcast', data: {
      'channel': 'fcm',
      'targetType': 'class',
      'targetId': classId,
      'kind': kind.name,
      'title': title,
      'body': body,
      if (fileKeys.isNotEmpty) 'fileKeys': fileKeys,
      if (subjectId != null) 'subjectId': subjectId,
    });
  }

  Future<List<SentItem>> getSent() async {
    final response = await _dio.get<List<dynamic>>('/broadcasts/sent');
    return (response.data ?? []).map((e) => SentItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<UnseenParent>> getUnseen(String broadcastId) async {
    final response = await _dio.get<List<dynamic>>('/broadcasts/$broadcastId/unseen');
    return (response.data ?? []).map((e) => UnseenParent.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Parent opened a notice/homework item. Fire-and-forget; failures don't matter to the parent.
  Future<void> markSeen(String broadcastId) async {
    await _dio.post('/broadcasts/$broadcastId/seen');
  }
}

class SentItem {
  final String id;
  final BroadcastKind kind;
  final String? title;
  final String body;
  final DateTime createdAt;
  final String? classLabel;
  final String? subject;
  final int attachmentCount;
  final int recipients;
  final int seen;

  const SentItem({
    required this.id,
    required this.kind,
    this.title,
    required this.body,
    required this.createdAt,
    this.classLabel,
    this.subject,
    required this.attachmentCount,
    required this.recipients,
    required this.seen,
  });

  factory SentItem.fromJson(Map<String, dynamic> json) {
    final cls = json['class'] as Map<String, dynamic>?;
    final section = cls?['section'] as String?;
    return SentItem(
      id: json['id'] as String,
      kind: json['kind'] == 'homework' ? BroadcastKind.homework : BroadcastKind.notice,
      title: json['title'] as String?,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      classLabel: cls == null ? null : [cls['name'] as String, if (section != null && section.isNotEmpty) section].join(' '),
      subject: json['subject'] as String?,
      attachmentCount: json['attachmentCount'] as int? ?? 0,
      recipients: json['recipients'] as int? ?? 0,
      seen: json['seen'] as int? ?? 0,
    );
  }
}

class UnseenParent {
  final String parentId;
  final String name;
  final String? phone;
  final List<String> children;

  const UnseenParent({required this.parentId, required this.name, this.phone, required this.children});

  factory UnseenParent.fromJson(Map<String, dynamic> json) => UnseenParent(
        parentId: json['parentId'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        children: (json['children'] as List<dynamic>? ?? []).cast<String>(),
      );
}

final broadcastRepositoryProvider = Provider<BroadcastRepository>((ref) {
  return BroadcastRepository(ref.watch(apiClientProvider));
});

final sentItemsProvider = FutureProvider.autoDispose<List<SentItem>>((ref) {
  return ref.watch(broadcastRepositoryProvider).getSent();
});
