import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/teacher_class_overview.dart';
import '../../shared/services/api_client.dart';

class TeacherClassesRepository {
  final Dio _dio;

  TeacherClassesRepository(this._dio);

  /// GET /teacher-dashboard/my-classes — one entry per class this teacher is
  /// linked to, with strength/subjects/recent-reports. No fee data — the API
  /// response deliberately doesn't include any.
  Future<List<TeacherClassOverview>> getMyClassOverviews() async {
    final response = await _dio.get<List<dynamic>>('/teacher-dashboard/my-classes');
    return response.data!
        .map((e) => TeacherClassOverview.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final teacherClassesRepositoryProvider = Provider<TeacherClassesRepository>((ref) {
  return TeacherClassesRepository(ref.watch(apiClientProvider));
});

final myClassOverviewsProvider = FutureProvider.autoDispose<List<TeacherClassOverview>>((ref) {
  return ref.watch(teacherClassesRepositoryProvider).getMyClassOverviews();
});
