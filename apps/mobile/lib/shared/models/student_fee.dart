import 'parsing.dart';

enum FeeStatus { pending, partial, paid, overdue, waived }

FeeStatus _parseFeeStatus(String raw) => FeeStatus.values.firstWhere(
      (s) => s.name == raw,
      orElse: () => FeeStatus.pending,
    );

class FeeItem {
  final String id;
  final String label;
  final double amount;

  const FeeItem({required this.id, required this.label, required this.amount});

  factory FeeItem.fromJson(Map<String, dynamic> json) => FeeItem(
        id: json['id'] as String,
        label: json['label'] as String,
        amount: parseDecimal(json['amount']),
      );
}

class FeeStructureSummary {
  final String id;
  final String name;
  final String academicYear;
  final List<FeeItem> items;

  const FeeStructureSummary({
    required this.id,
    required this.name,
    required this.academicYear,
    required this.items,
  });

  factory FeeStructureSummary.fromJson(Map<String, dynamic> json) => FeeStructureSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        academicYear: json['academicYear'] as String,
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => FeeItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class StudentFeeStudentInfo {
  final String id;
  final String name;
  final String admissionNo;
  final String? className;

  const StudentFeeStudentInfo({
    required this.id,
    required this.name,
    required this.admissionNo,
    this.className,
  });

  factory StudentFeeStudentInfo.fromJson(Map<String, dynamic> json) {
    final cls = json['class'] as Map<String, dynamic>?;
    return StudentFeeStudentInfo(
      id: json['id'] as String,
      name: json['name'] as String,
      admissionNo: json['admissionNo'] as String,
      className: cls?['name'] as String?,
    );
  }
}

class StudentFee {
  final String id;
  final double amountDue;
  final double amountPaid;
  final FeeStatus status;
  final DateTime dueDate;
  final StudentFeeStudentInfo student;
  final FeeStructureSummary feeStructure;

  const StudentFee({
    required this.id,
    required this.amountDue,
    required this.amountPaid,
    required this.status,
    required this.dueDate,
    required this.student,
    required this.feeStructure,
  });

  double get outstanding => (amountDue - amountPaid).clamp(0, double.infinity);

  factory StudentFee.fromJson(Map<String, dynamic> json) => StudentFee(
        id: json['id'] as String,
        amountDue: parseDecimal(json['amountDue']),
        amountPaid: parseDecimal(json['amountPaid']),
        status: _parseFeeStatus(json['status'] as String),
        dueDate: DateTime.parse(json['dueDate'] as String),
        student: StudentFeeStudentInfo.fromJson(json['student'] as Map<String, dynamic>),
        feeStructure: FeeStructureSummary.fromJson(json['feeStructure'] as Map<String, dynamic>),
      );
}
