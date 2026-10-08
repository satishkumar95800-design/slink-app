import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'attendance_models.dart';

class AttendanceRepository {
  final Dio _dio;

  AttendanceRepository(this._dio);

  Future<MyAttendanceClasses> getMyClasses() async {
    final response = await _dio.get<Map<String, dynamic>>('/attendance/my-classes');
    return MyAttendanceClasses.fromJson(response.data!);
  }

  Future<AttendanceRoster> getRoster(String classId, {String? date}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/attendance/roster',
      queryParameters: {'classId': classId, if (date != null) 'date': date},
    );
    return AttendanceRoster.fromJson(response.data!);
  }

  /// PUT /attendance/class — whole-class upsert for one date.
  Future<AttendanceRoster> submit({
    required String classId,
    required String date,
    required Map<String, AttendanceStatus> statuses,
  }) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/attendance/class',
      data: {
        'classId': classId,
        'date': date,
        'entries': [
          for (final e in statuses.entries) {'studentId': e.key, 'status': e.value.name},
        ],
      },
      // Weak connections: give the request longer than the client-wide 10s default.
      options: Options(sendTimeout: const Duration(seconds: 30), receiveTimeout: const Duration(seconds: 30)),
    );
    return AttendanceRoster.fromJson(response.data!);
  }

  Future<StudentAttendanceSummary> getStudentSummary(String studentId, {String? month}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/attendance/student/$studentId/summary',
      queryParameters: {if (month != null) 'month': month},
    );
    return StudentAttendanceSummary.fromJson(response.data!);
  }
}

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(ref.watch(apiClientProvider));
});

final myAttendanceClassesProvider = FutureProvider.autoDispose<MyAttendanceClasses>((ref) {
  return ref.watch(attendanceRepositoryProvider).getMyClasses();
});

final studentAttendanceProvider =
    FutureProvider.autoDispose.family<StudentAttendanceSummary, ({String studentId, String? month})>((ref, args) {
  return ref.watch(attendanceRepositoryProvider).getStudentSummary(args.studentId, month: args.month);
});
