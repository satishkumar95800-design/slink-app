import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/attendance/attendance_models.dart';
import 'package:slink/features/attendance/attendance_outbox.dart';

void main() {
  test('parses a roster, keeping unmarked students as null', () {
    final roster = AttendanceRoster.fromJson({
      'class': {'id': 'c1', 'name': 'Class 5', 'section': 'A'},
      'date': '2026-10-08',
      'today': '2026-10-08',
      'holiday': null,
      'submitted': false,
      'canEdit': true,
      'students': [
        {'id': 's1', 'name': 'Ira', 'admissionNo': 'A1', 'rollNo': '2', 'status': 'absent'},
        {'id': 's2', 'name': 'Om', 'admissionNo': 'A2', 'rollNo': null, 'status': null},
      ],
    });

    expect(roster.classLabel, 'Class 5 A');
    expect(roster.students.first.status, AttendanceStatus.absent);
    expect(roster.students.last.status, isNull);
  });

  test('parses a student summary into a date -> status calendar', () {
    final summary = StudentAttendanceSummary.fromJson({
      'student': {'id': 's1', 'name': 'Avyaan Singha'},
      'month': '2026-10',
      'today': {'date': '2026-10-08', 'status': 'late'},
      'days': [
        {'date': '2026-10-01', 'status': 'present', 'note': null},
        {'date': '2026-10-05', 'status': 'absent', 'note': null},
      ],
      'holidays': [
        {'date': '2026-10-02', 'name': 'Gandhi Jayanti'},
      ],
      'monthSummary': {'daysMarked': 2, 'daysPresent': 1, 'percentage': 50},
      'academicYear': {'label': '2026-27', 'daysMarked': 100, 'daysPresent': 92, 'percentage': 92},
    });

    expect(summary.todayStatus, AttendanceStatus.late);
    expect(summary.days['2026-10-05'], AttendanceStatus.absent);
    expect(summary.holidays['2026-10-02'], 'Gandhi Jayanti');
    expect(summary.monthTotals.percentage, 50.0);
    expect(summary.yearTotals.daysPresent, 92);
  });

  test('a queued submission survives being saved and reloaded', () {
    final item = PendingAttendance(
      userId: 'u1',
      classId: 'c1',
      classLabel: 'Class 5 A',
      date: '2026-10-08',
      statuses: {'s1': AttendanceStatus.absent, 's2': AttendanceStatus.leave},
      queuedAt: DateTime.utc(2026, 10, 8, 4),
    );

    final restored = PendingAttendance.fromJson(item.toJson());

    expect(restored.key, 'c1|2026-10-08');
    expect(restored.statuses, item.statuses);
    expect(restored.rejectedReason, isNull);
  });

  test('only connection problems are queued for retry, not server refusals', () {
    final options = RequestOptions(path: '/attendance/class');
    expect(isConnectivityError(DioException(requestOptions: options, type: DioExceptionType.connectionError)), isTrue);
    expect(isConnectivityError(DioException(requestOptions: options, type: DioExceptionType.receiveTimeout)), isTrue);
    expect(
      isConnectivityError(DioException(
        requestOptions: options,
        type: DioExceptionType.badResponse,
        response: Response(requestOptions: options, statusCode: 403),
      )),
      isFalse,
    );
  });
}
