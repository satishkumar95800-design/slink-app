import 'parsing.dart';

class ClassInfo {
  final String id;
  final String name;
  final String? academicYear;

  const ClassInfo({required this.id, required this.name, this.academicYear});

  factory ClassInfo.fromJson(Map<String, dynamic> json) => ClassInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        academicYear: json['academicYear'] as String?,
      );
}

class Student {
  final String id;
  final String name;
  final String admissionNo;
  final DateTime? dob;
  final ClassInfo? studentClass;

  const Student({
    required this.id,
    required this.name,
    required this.admissionNo,
    this.dob,
    this.studentClass,
  });

  factory Student.fromJson(Map<String, dynamic> json) => Student(
        id: json['id'] as String,
        name: json['name'] as String,
        admissionNo: json['admissionNo'] as String,
        dob: parseDateOrNull(json['dob']),
        studentClass: json['class'] == null
            ? null
            : ClassInfo.fromJson(json['class'] as Map<String, dynamic>),
      );
}
