import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/student.dart';
import '../../shared/services/api_client.dart';

class StudentsRepository {
  final Dio _dio;

  StudentsRepository(this._dio);

  /// GET /students/me — the parent's linked children only (StudentsController:47-49).
  Future<List<Student>> getMyChildren() async {
    final response = await _dio.get<List<dynamic>>('/students/me');
    return response.data!.map((e) => Student.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final studentsRepositoryProvider = Provider<StudentsRepository>((ref) {
  return StudentsRepository(ref.watch(apiClientProvider));
});

final myChildrenProvider = FutureProvider<List<Student>>((ref) {
  return ref.watch(studentsRepositoryProvider).getMyChildren();
});

/// Currently selected child in the dashboard's child switcher. Null means "all
/// children" for screens that support an aggregate view (e.g. fees list).
final selectedChildIdProvider = StateProvider<String?>((ref) => null);
