import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';

/// Internal staff notes about a student (Note, MOM, Complaint, Parent Discussion).
/// The API only lets teachers read/write notes for students in their own
/// classes, and never exposes them to parents.
class StudentNote {
  final String id;
  final String type;
  final String content;
  final String authorName;
  final DateTime createdAt;

  const StudentNote({
    required this.id,
    required this.type,
    required this.content,
    required this.authorName,
    required this.createdAt,
  });

  factory StudentNote.fromJson(Map<String, dynamic> json) => StudentNote(
        id: json['id'] as String,
        type: json['type'] as String,
        content: json['content'] as String,
        authorName: (json['author'] as Map<String, dynamic>?)?['name'] as String? ?? '',
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class StudentNotesRepository {
  final Dio _dio;

  StudentNotesRepository(this._dio);

  Future<List<StudentNote>> getForStudent(String studentId) async {
    final response = await _dio.get<List<dynamic>>('/student-notes', queryParameters: {'studentId': studentId});
    return (response.data ?? []).map((e) => StudentNote.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> create({required String studentId, required String type, required String content}) async {
    await _dio.post('/student-notes', data: {'studentId': studentId, 'type': type, 'content': content});
  }
}

final studentNotesRepositoryProvider = Provider<StudentNotesRepository>((ref) {
  return StudentNotesRepository(ref.watch(apiClientProvider));
});

final studentNotesProvider = FutureProvider.autoDispose.family<List<StudentNote>, String>((ref, studentId) {
  return ref.watch(studentNotesRepositoryProvider).getForStudent(studentId);
});
