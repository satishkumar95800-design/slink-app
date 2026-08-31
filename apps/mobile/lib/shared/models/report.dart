import 'parsing.dart';

enum ReportType { academic, attendance, behavior, homework }
enum ReportStatus { draft, published }

ReportType _parseReportType(String raw) => ReportType.values.firstWhere(
      (t) => t.name == raw,
      orElse: () => ReportType.academic,
    );

ReportStatus _parseReportStatus(String raw) => ReportStatus.values.firstWhere(
      (s) => s.name == raw,
      orElse: () => ReportStatus.draft,
    );

class ReportStudentInfo {
  final String id;
  final String name;
  final String admissionNo;

  const ReportStudentInfo({required this.id, required this.name, required this.admissionNo});

  factory ReportStudentInfo.fromJson(Map<String, dynamic> json) => ReportStudentInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        admissionNo: json['admissionNo'] as String,
      );
}

class ReportTeacherInfo {
  final String id;
  final String name;

  const ReportTeacherInfo({required this.id, required this.name});

  factory ReportTeacherInfo.fromJson(Map<String, dynamic> json) => ReportTeacherInfo(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class Report {
  final String id;
  final ReportType type;
  final String term;
  final String academicYear;
  final Map<String, dynamic> content;
  final String? pdfKey;
  final ReportStatus status;
  final DateTime? publishedAt;
  final ReportStudentInfo student;
  final ReportTeacherInfo teacher;
  final int readReceiptCount;

  const Report({
    required this.id,
    required this.type,
    required this.term,
    required this.academicYear,
    required this.content,
    this.pdfKey,
    required this.status,
    this.publishedAt,
    required this.student,
    required this.teacher,
    required this.readReceiptCount,
  });

  factory Report.fromJson(Map<String, dynamic> json) => Report(
        id: json['id'] as String,
        type: _parseReportType(json['type'] as String),
        term: json['term'] as String,
        academicYear: json['academicYear'] as String,
        content: (json['content'] as Map<String, dynamic>? ?? {}),
        pdfKey: json['pdfKey'] as String?,
        status: _parseReportStatus(json['status'] as String),
        publishedAt: parseDateOrNull(json['publishedAt']),
        student: ReportStudentInfo.fromJson(json['student'] as Map<String, dynamic>),
        teacher: ReportTeacherInfo.fromJson(json['teacher'] as Map<String, dynamic>),
        readReceiptCount: (json['_count'] as Map<String, dynamic>?)?['readReceipts'] as int? ?? 0,
      );
}
