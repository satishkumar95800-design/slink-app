class TimetablePersonInfo {
  final String id;
  final String name;

  const TimetablePersonInfo({required this.id, required this.name});

  factory TimetablePersonInfo.fromJson(Map<String, dynamic> json) => TimetablePersonInfo(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class TimetableClassInfo {
  final String id;
  final String name;
  final String? section;
  final String academicYear;

  const TimetableClassInfo({
    required this.id,
    required this.name,
    this.section,
    required this.academicYear,
  });

  factory TimetableClassInfo.fromJson(Map<String, dynamic> json) => TimetableClassInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        section: json['section'] as String?,
        academicYear: json['academicYear'] as String,
      );

  String get displayName => section != null && section!.isNotEmpty ? '$name $section' : name;
}

/// A single scheduled period on a teacher's own weekly timetable.
class TimetableSlot {
  final String id;
  final int dayOfWeek; // 1=Mon .. 6=Sat
  final int periodNumber; // 1-12
  final TimetablePersonInfo teacher;
  final TimetablePersonInfo subject;
  final TimetableClassInfo studentClass;

  const TimetableSlot({
    required this.id,
    required this.dayOfWeek,
    required this.periodNumber,
    required this.teacher,
    required this.subject,
    required this.studentClass,
  });

  factory TimetableSlot.fromJson(Map<String, dynamic> json) => TimetableSlot(
        id: json['id'] as String,
        dayOfWeek: json['dayOfWeek'] as int,
        periodNumber: json['periodNumber'] as int,
        teacher: TimetablePersonInfo.fromJson(json['teacher'] as Map<String, dynamic>),
        subject: TimetablePersonInfo.fromJson(json['subject'] as Map<String, dynamic>),
        studentClass: TimetableClassInfo.fromJson(json['class'] as Map<String, dynamic>),
      );
}
