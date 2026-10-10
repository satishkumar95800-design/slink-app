import '../../core/l10n/l10n.dart';

enum AttendanceStatus { present, absent, late, leave }

AttendanceStatus? parseAttendanceStatus(Object? raw) => switch (raw) {
      'present' => AttendanceStatus.present,
      'absent' => AttendanceStatus.absent,
      'late' => AttendanceStatus.late,
      'leave' => AttendanceStatus.leave,
      _ => null,
    };

extension AttendanceStatusLabel on AttendanceStatus {
  String label(AppLocalizations l) => switch (this) {
        AttendanceStatus.present => l.attendancePresent,
        AttendanceStatus.absent => l.attendanceAbsent,
        AttendanceStatus.late => l.attendanceLate,
        AttendanceStatus.leave => l.attendanceLeave,
      };
}

/// GET /attendance/my-classes — classes this teacher can mark, and whether today is done.
class MyAttendanceClasses {
  final String date;
  final String? holidayName;
  final List<AttendanceClass> classes;

  const MyAttendanceClasses({required this.date, this.holidayName, required this.classes});

  bool get allDone => classes.isNotEmpty && classes.every((c) => c.submitted);
  int get doneCount => classes.where((c) => c.submitted).length;

  factory MyAttendanceClasses.fromJson(Map<String, dynamic> json) => MyAttendanceClasses(
        date: json['date'] as String,
        holidayName: (json['holiday'] as Map<String, dynamic>?)?['name'] as String?,
        classes: (json['classes'] as List<dynamic>)
            .map((e) => AttendanceClass.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class AttendanceClass {
  final String id;
  final String name;
  final String? section;
  final int studentCount;
  final bool submitted;

  const AttendanceClass({
    required this.id,
    required this.name,
    this.section,
    required this.studentCount,
    required this.submitted,
  });

  String get label => [name, if (section != null && section!.isNotEmpty) section].join(' ');

  factory AttendanceClass.fromJson(Map<String, dynamic> json) => AttendanceClass(
        id: json['id'] as String,
        name: json['name'] as String,
        section: json['section'] as String?,
        studentCount: json['studentCount'] as int,
        submitted: json['submitted'] as bool,
      );
}

/// GET /attendance/roster
class AttendanceRoster {
  final String classId;
  final String classLabel;
  final String date;
  final String today;
  final String? holidayName;
  final bool submitted;
  final bool canEdit;
  final List<RosterStudent> students;

  const AttendanceRoster({
    required this.classId,
    required this.classLabel,
    required this.date,
    required this.today,
    this.holidayName,
    required this.submitted,
    required this.canEdit,
    required this.students,
  });

  factory AttendanceRoster.fromJson(Map<String, dynamic> json) {
    final cls = json['class'] as Map<String, dynamic>;
    final section = cls['section'] as String?;
    return AttendanceRoster(
      classId: cls['id'] as String,
      classLabel: [cls['name'] as String, if (section != null && section.isNotEmpty) section].join(' '),
      date: json['date'] as String,
      today: json['today'] as String,
      holidayName: (json['holiday'] as Map<String, dynamic>?)?['name'] as String?,
      submitted: json['submitted'] as bool,
      canEdit: json['canEdit'] as bool,
      students: (json['students'] as List<dynamic>)
          .map((e) => RosterStudent.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class RosterStudent {
  final String id;
  final String name;
  final String admissionNo;
  final String? rollNo;
  final AttendanceStatus? status;

  const RosterStudent({
    required this.id,
    required this.name,
    required this.admissionNo,
    this.rollNo,
    this.status,
  });

  factory RosterStudent.fromJson(Map<String, dynamic> json) => RosterStudent(
        id: json['id'] as String,
        name: json['name'] as String,
        admissionNo: json['admissionNo'] as String,
        rollNo: json['rollNo'] as String?,
        status: parseAttendanceStatus(json['status']),
      );
}

class AttendanceTotals {
  final int daysMarked;
  final int daysPresent;
  final double? percentage;

  const AttendanceTotals({required this.daysMarked, required this.daysPresent, this.percentage});

  factory AttendanceTotals.fromJson(Map<String, dynamic> json) => AttendanceTotals(
        daysMarked: json['daysMarked'] as int,
        daysPresent: json['daysPresent'] as int,
        percentage: (json['percentage'] as num?)?.toDouble(),
      );
}

/// GET /attendance/student/:id/summary — parent calendar + summary card.
class StudentAttendanceSummary {
  final String studentName;
  final String month;
  final String today;
  final AttendanceStatus? todayStatus;
  final Map<String, AttendanceStatus> days;
  final Map<String, String> holidays;
  final AttendanceTotals monthTotals;
  final String academicYearLabel;
  final AttendanceTotals yearTotals;

  const StudentAttendanceSummary({
    required this.studentName,
    required this.month,
    required this.today,
    this.todayStatus,
    required this.days,
    required this.holidays,
    required this.monthTotals,
    required this.academicYearLabel,
    required this.yearTotals,
  });

  factory StudentAttendanceSummary.fromJson(Map<String, dynamic> json) {
    final today = json['today'] as Map<String, dynamic>;
    final year = json['academicYear'] as Map<String, dynamic>;
    return StudentAttendanceSummary(
      studentName: (json['student'] as Map<String, dynamic>)['name'] as String,
      month: json['month'] as String,
      today: today['date'] as String,
      todayStatus: parseAttendanceStatus(today['status']),
      days: {
        for (final d in json['days'] as List<dynamic>)
          (d as Map<String, dynamic>)['date'] as String: parseAttendanceStatus(d['status'])!,
      },
      holidays: {
        for (final h in json['holidays'] as List<dynamic>)
          (h as Map<String, dynamic>)['date'] as String: h['name'] as String,
      },
      monthTotals: AttendanceTotals.fromJson(json['monthSummary'] as Map<String, dynamic>),
      academicYearLabel: year['label'] as String,
      yearTotals: AttendanceTotals.fromJson(year),
    );
  }
}
