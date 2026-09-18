import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/teacher_class.dart';
import '../../shared/services/api_client.dart';

class ClassesRepository {
  final Dio _dio;

  ClassesRepository(this._dio);

  /// GET /classes — scoped server-side to the classes this teacher is linked to.
  Future<List<TeacherClass>> getMyClasses() async {
    final response = await _dio.get<List<dynamic>>('/classes');
    return response.data!.map((e) => TeacherClass.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final classesRepositoryProvider = Provider<ClassesRepository>((ref) {
  return ClassesRepository(ref.watch(apiClientProvider));
});

final myClassesProvider = FutureProvider<List<TeacherClass>>((ref) {
  return ref.watch(classesRepositoryProvider).getMyClasses();
});
