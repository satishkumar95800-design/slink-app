import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

/// Premium AI features (docs/SPEC-ai.md). Every call is optional: screens show
/// AI buttons only when [aiAvailableProvider] is true.
class AiRepository {
  final Dio _dio;

  AiRepository(this._dio);

  Future<bool> isAvailable() async {
    final res = await _dio.get<Map<String, dynamic>>('/ai/status');
    return res.data?['available'] == true;
  }

  /// A report-card remark draft for this student, built on the teacher's [points].
  Future<String> draftRemark({required String studentId, String? points}) async {
    final res = await _dio.post<Map<String, dynamic>>('/ai/report-remark', data: {
      'studentId': studentId,
      if (points != null && points.trim().isNotEmpty) 'points': points.trim(),
    });
    return (res.data?['remark'] as String?) ?? '';
  }
}

final aiRepositoryProvider = Provider<AiRepository>((ref) => AiRepository(ref.watch(apiClientProvider)));

/// False on any error (older API, no premium module, offline).
final aiAvailableProvider = FutureProvider.autoDispose<bool>((ref) async {
  try {
    return await ref.read(aiRepositoryProvider).isAvailable();
  } catch (_) {
    return false;
  }
});
