class ClassTeacherLink {
  final String teacherId;
  final bool isClassTeacher;

  const ClassTeacherLink({required this.teacherId, required this.isClassTeacher});

  factory ClassTeacherLink.fromJson(Map<String, dynamic> json) => ClassTeacherLink(
        teacherId: (json['teacher'] as Map<String, dynamic>)['id'] as String,
        isClassTeacher: json['isClassTeacher'] as bool? ?? false,
      );
}

/// A class as seen by a logged-in teacher — GET /classes is already scoped
/// server-side to classes the teacher is linked to (ClassesController.findAll).
class TeacherClass {
  final String id;
  final String name;
  final String? section;
  final String academicYear;
  final List<ClassTeacherLink> teacherLinks;

  const TeacherClass({
    required this.id,
    required this.name,
    this.section,
    required this.academicYear,
    required this.teacherLinks,
  });

  factory TeacherClass.fromJson(Map<String, dynamic> json) => TeacherClass(
        id: json['id'] as String,
        name: json['name'] as String,
        section: json['section'] as String?,
        academicYear: json['academicYear'] as String,
        teacherLinks: (json['teachers'] as List<dynamic>)
            .map((e) => ClassTeacherLink.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  /// Whether [userId] is designated as this class's homeroom/in-charge teacher
  /// (as opposed to just having subject-teaching access to it).
  bool isClassTeacherFor(String userId) =>
      teacherLinks.any((t) => t.teacherId == userId && t.isClassTeacher);

  String get displayName => section != null && section!.isNotEmpty ? '$name $section' : name;
}
