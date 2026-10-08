import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  /// GET /students?classId= — already scoped server-side to a teacher's own
  /// classes; used to populate the student picker for report-card upload.
  Future<List<Student>> getStudentsForClass(String classId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/students',
      queryParameters: {'classId': classId, 'limit': 100},
    );
    final data = response.data!['data'] as List<dynamic>;
    return data.map((e) => Student.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final studentsRepositoryProvider = Provider<StudentsRepository>((ref) {
  return StudentsRepository(ref.watch(apiClientProvider));
});

final myChildrenProvider = FutureProvider<List<Student>>((ref) {
  return ref.watch(studentsRepositoryProvider).getMyChildren();
});

/// Child picked in the home screen's switcher. Every parent screen follows it.
/// Null only until the children list first loads (see [resolveSelectedChild]).
final selectedChildIdProvider = StateProvider<String?>((ref) => null);

const _lastChildKey = 'parent_last_selected_child';

/// Makes sure a valid child is selected: keeps the current one if still linked,
/// else the one remembered from last time, else the first child.
Future<void> resolveSelectedChild(WidgetRef ref, List<Student> children) async {
  if (children.isEmpty) return;
  final current = ref.read(selectedChildIdProvider);
  if (current != null && children.any((c) => c.id == current)) return;
  final prefs = await SharedPreferences.getInstance();
  final remembered = prefs.getString(_lastChildKey);
  ref.read(selectedChildIdProvider.notifier).state =
      children.any((c) => c.id == remembered) ? remembered : children.first.id;
}

/// Selects [studentId] and remembers it for the next app launch.
Future<void> selectChild(WidgetRef ref, String studentId) async {
  ref.read(selectedChildIdProvider.notifier).state = studentId;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_lastChildKey, studentId);
}
