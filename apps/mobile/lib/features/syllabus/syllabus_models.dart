// Syllabus progress (/syllabus). Dates arrive as YYYY-MM-DD.

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String);

enum SyllabusStatus { notPlanned, onTime, late, completed }

SyllabusStatus _status(Object? v) => switch (v) {
      'on_time' => SyllabusStatus.onTime,
      'late' => SyllabusStatus.late,
      'completed' => SyllabusStatus.completed,
      _ => SyllabusStatus.notPlanned,
    };

/// One of the teacher's own class and subject pairs (GET /syllabus/mine).
class SyllabusSubject {
  final String classId;
  final String className;
  final String subjectId;
  final String subjectName;
  final int total;
  final int covered;
  final int percent;
  final SyllabusStatus status;
  final int daysLate;
  final String? nextTopic;
  final DateTime? nextTopicDue;

  const SyllabusSubject({
    required this.classId,
    required this.className,
    required this.subjectId,
    required this.subjectName,
    required this.total,
    required this.covered,
    required this.percent,
    required this.status,
    required this.daysLate,
    this.nextTopic,
    this.nextTopicDue,
  });

  factory SyllabusSubject.fromJson(Map<String, dynamic> json) {
    final next = json['nextTopic'] as Map<String, dynamic>?;
    return SyllabusSubject(
      classId: json['classId'] as String,
      className: json['className'] as String,
      subjectId: json['subjectId'] as String,
      subjectName: json['subjectName'] as String,
      total: json['total'] as int,
      covered: json['covered'] as int,
      percent: json['percent'] as int,
      status: _status(json['status']),
      daysLate: json['daysLate'] as int? ?? 0,
      nextTopic: next?['title'] as String?,
      nextTopicDue: _date(next?['plannedBy']),
    );
  }
}

/// A topic in the teacher's plan view.
class SyllabusTopic {
  final String id;
  final String? unit;
  final String title;
  final DateTime plannedBy;
  final DateTime? completedOn;
  final bool overdue;

  const SyllabusTopic({
    required this.id,
    this.unit,
    required this.title,
    required this.plannedBy,
    this.completedOn,
    required this.overdue,
  });

  bool get covered => completedOn != null;

  factory SyllabusTopic.fromJson(Map<String, dynamic> json) => SyllabusTopic(
        id: json['id'] as String,
        unit: json['unit'] as String?,
        title: json['title'] as String,
        plannedBy: _date(json['plannedBy'])!,
        completedOn: _date(json['completedOn']),
        overdue: json['overdue'] as bool? ?? false,
      );
}

/// GET /syllabus/:classId/:subjectId (teacher).
class SyllabusPlan {
  final String className;
  final String subjectName;
  final bool canMark;
  final int total;
  final int covered;
  final int percent;
  final SyllabusStatus status;
  final int daysLate;
  final List<SyllabusTopic> topics;

  const SyllabusPlan({
    required this.className,
    required this.subjectName,
    required this.canMark,
    required this.total,
    required this.covered,
    required this.percent,
    required this.status,
    required this.daysLate,
    required this.topics,
  });

  factory SyllabusPlan.fromJson(Map<String, dynamic> json) => SyllabusPlan(
        className: (json['class'] as Map<String, dynamic>)['name'] as String,
        subjectName: (json['subject'] as Map<String, dynamic>)['name'] as String,
        canMark: json['canMark'] as bool? ?? false,
        total: json['total'] as int,
        covered: json['covered'] as int,
        percent: json['percent'] as int,
        status: _status(json['status']),
        daysLate: json['daysLate'] as int? ?? 0,
        topics: [for (final t in json['topics'] as List<dynamic>) SyllabusTopic.fromJson(t as Map<String, dynamic>)],
      );
}

/// A topic as parents see it: no target dates.
class ChildTopic {
  final String id;
  final String? unit;
  final String title;
  final DateTime? completedOn;

  const ChildTopic({required this.id, this.unit, required this.title, this.completedOn});

  factory ChildTopic.fromJson(Map<String, dynamic> json) => ChildTopic(
        id: json['id'] as String,
        unit: json['unit'] as String?,
        title: json['title'] as String,
        completedOn: _date(json['completedOn']),
      );
}

class ChildSubject {
  final String subjectId;
  final String subjectName;
  final int total;
  final int covered;
  final int percent;
  final DateTime? lastCoveredOn;
  final List<ChildTopic> topics;

  const ChildSubject({
    required this.subjectId,
    required this.subjectName,
    required this.total,
    required this.covered,
    required this.percent,
    this.lastCoveredOn,
    required this.topics,
  });

  factory ChildSubject.fromJson(Map<String, dynamic> json) => ChildSubject(
        subjectId: json['subjectId'] as String,
        subjectName: json['subjectName'] as String,
        total: json['total'] as int,
        covered: json['covered'] as int,
        percent: json['percent'] as int,
        lastCoveredOn: _date(json['lastCoveredOn']),
        topics: [for (final t in json['topics'] as List<dynamic>) ChildTopic.fromJson(t as Map<String, dynamic>)],
      );
}

/// GET /syllabus/child/:studentId (parent).
class ChildSyllabus {
  final String studentName;
  final String className;
  final List<ChildSubject> subjects;

  const ChildSyllabus({required this.studentName, required this.className, required this.subjects});

  factory ChildSyllabus.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>;
    return ChildSyllabus(
      studentName: student['name'] as String,
      className: student['className'] as String,
      subjects: [for (final s in json['subjects'] as List<dynamic>) ChildSubject.fromJson(s as Map<String, dynamic>)],
    );
  }
}

/// Topics in teaching order, split into runs of the same unit (null unit = no heading).
List<(String?, List<T>)> groupByUnit<T>(List<T> topics, String? Function(T) unitOf) {
  final groups = <(String?, List<T>)>[];
  for (final t in topics) {
    final unit = unitOf(t);
    if (groups.isNotEmpty && groups.last.$1 == unit) {
      groups.last.$2.add(t);
    } else {
      groups.add((unit, [t]));
    }
  }
  return groups;
}
