/// Class identity as seen from `GET /teacher-dashboard/my-classes`.
class TeacherClassOverviewClassInfo {
  final String id;
  final String name;
  final String? section;
  final String academicYear;

  const TeacherClassOverviewClassInfo({
    required this.id,
    required this.name,
    this.section,
    required this.academicYear,
  });

  factory TeacherClassOverviewClassInfo.fromJson(Map<String, dynamic> json) =>
      TeacherClassOverviewClassInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        section: json['section'] as String?,
        academicYear: json['academicYear'] as String,
      );

  String get displayName => section != null && section!.isNotEmpty ? '$name $section' : name;
}

class ClassStrength {
  final int male;
  final int female;
  final int other;
  final int unspecified;
  final int total;

  const ClassStrength({
    required this.male,
    required this.female,
    required this.other,
    required this.unspecified,
    required this.total,
  });

  factory ClassStrength.fromJson(Map<String, dynamic> json) => ClassStrength(
        male: json['male'] as int? ?? 0,
        female: json['female'] as int? ?? 0,
        other: json['other'] as int? ?? 0,
        unspecified: json['unspecified'] as int? ?? 0,
        total: json['total'] as int? ?? 0,
      );
}

class TeacherClassSubject {
  final String id;
  final String name;

  const TeacherClassSubject({required this.id, required this.name});

  factory TeacherClassSubject.fromJson(Map<String, dynamic> json) => TeacherClassSubject(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// A single recent report row surfaced on the "About My Class(es)" screen —
/// intentionally has no fee/money fields, the API response doesn't include any.
class TeacherClassRecentReport {
  final String id;
  final String type;
  final String term;
  final DateTime createdAt;
  final String studentName;
  final bool readByAnyParent;

  const TeacherClassRecentReport({
    required this.id,
    required this.type,
    required this.term,
    required this.createdAt,
    required this.studentName,
    required this.readByAnyParent,
  });

  factory TeacherClassRecentReport.fromJson(Map<String, dynamic> json) => TeacherClassRecentReport(
        id: json['id'] as String,
        type: json['type'] as String,
        term: json['term'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        studentName: json['studentName'] as String,
        readByAnyParent: json['readByAnyParent'] as bool? ?? false,
      );
}

class TeacherClassOverview {
  final TeacherClassOverviewClassInfo studentClass;
  final ClassStrength strength;
  final List<TeacherClassSubject> subjects;
  final List<TeacherClassRecentReport> recentReports;

  const TeacherClassOverview({
    required this.studentClass,
    required this.strength,
    required this.subjects,
    required this.recentReports,
  });

  factory TeacherClassOverview.fromJson(Map<String, dynamic> json) => TeacherClassOverview(
        studentClass:
            TeacherClassOverviewClassInfo.fromJson(json['class'] as Map<String, dynamic>),
        strength: ClassStrength.fromJson(json['strength'] as Map<String, dynamic>),
        subjects: (json['subjects'] as List<dynamic>? ?? [])
            .map((e) => TeacherClassSubject.fromJson(e as Map<String, dynamic>))
            .toList(),
        recentReports: (json['recentReports'] as List<dynamic>? ?? [])
            .map((e) => TeacherClassRecentReport.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
