import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'syllabus_models.dart';

/// Syllabus progress: the teacher's own subjects and ticks, and a parent's child's coverage.
class SyllabusRepository {
  final Dio _dio;

  SyllabusRepository(this._dio);

  Future<List<SyllabusSubject>> mine() async {
    final r = await _dio.get<List<dynamic>>('/syllabus/mine');
    return [for (final e in r.data ?? []) SyllabusSubject.fromJson(e as Map<String, dynamic>)];
  }

  Future<SyllabusPlan> plan(String classId, String subjectId) async {
    final r = await _dio.get<Map<String, dynamic>>('/syllabus/$classId/$subjectId');
    return SyllabusPlan.fromJson(r.data!);
  }

  /// [date] is YYYY-MM-DD; the API defaults to today.
  Future<SyllabusPlan> complete(String topicId, {String? date}) async {
    final r = await _dio.post<Map<String, dynamic>>('/syllabus/topics/$topicId/complete', data: {
      if (date != null) 'date': date,
    });
    return SyllabusPlan.fromJson(r.data!);
  }

  Future<SyllabusPlan> undo(String topicId) async {
    final r = await _dio.delete<Map<String, dynamic>>('/syllabus/topics/$topicId/complete');
    return SyllabusPlan.fromJson(r.data!);
  }

  Future<ChildSyllabus> child(String studentId) async {
    final r = await _dio.get<Map<String, dynamic>>('/syllabus/child/$studentId');
    return ChildSyllabus.fromJson(r.data!);
  }
}

final syllabusRepositoryProvider = Provider<SyllabusRepository>((ref) => SyllabusRepository(ref.watch(apiClientProvider)));

final mySyllabusProvider = FutureProvider.autoDispose<List<SyllabusSubject>>((ref) => ref.watch(syllabusRepositoryProvider).mine());

final syllabusPlanProvider = FutureProvider.autoDispose.family<SyllabusPlan, (String, String)>(
  (ref, key) => ref.watch(syllabusRepositoryProvider).plan(key.$1, key.$2),
);

final childSyllabusProvider = FutureProvider.autoDispose.family<ChildSyllabus, String>(
  (ref, studentId) => ref.watch(syllabusRepositoryProvider).child(studentId),
);
