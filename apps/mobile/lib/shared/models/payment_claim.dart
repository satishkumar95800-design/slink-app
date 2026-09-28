import 'parsing.dart';

enum PaymentClaimStatus { pending, approved, rejected }

PaymentClaimStatus _parseStatus(String raw) => PaymentClaimStatus.values.firstWhere(
      (s) => s.name == raw,
      orElse: () => PaymentClaimStatus.pending,
    );

class PaymentClaimStudentInfo {
  final String id;
  final String name;
  final String admissionNo;

  const PaymentClaimStudentInfo({
    required this.id,
    required this.name,
    required this.admissionNo,
  });

  factory PaymentClaimStudentInfo.fromJson(Map<String, dynamic> json) => PaymentClaimStudentInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        admissionNo: json['admissionNo'] as String,
      );
}

class PaymentClaimStudentFeeInfo {
  final String id;
  final double amountDue;
  final double amountPaid;
  final String status;

  const PaymentClaimStudentFeeInfo({
    required this.id,
    required this.amountDue,
    required this.amountPaid,
    required this.status,
  });

  factory PaymentClaimStudentFeeInfo.fromJson(Map<String, dynamic> json) => PaymentClaimStudentFeeInfo(
        id: json['id'] as String,
        amountDue: parseDecimal(json['amountDue']),
        amountPaid: parseDecimal(json['amountPaid']),
        status: json['status'] as String,
      );
}

class PaymentClaim {
  final String id;
  final String fileKey;
  final double? claimedAmount;
  final DateTime? claimedDate;
  final String? claimedMode;
  final String? note;
  final PaymentClaimStatus status;
  final String? reviewNote;
  final DateTime createdAt;
  final PaymentClaimStudentInfo student;
  final PaymentClaimStudentFeeInfo studentFee;

  const PaymentClaim({
    required this.id,
    required this.fileKey,
    this.claimedAmount,
    this.claimedDate,
    this.claimedMode,
    this.note,
    required this.status,
    this.reviewNote,
    required this.createdAt,
    required this.student,
    required this.studentFee,
  });

  factory PaymentClaim.fromJson(Map<String, dynamic> json) => PaymentClaim(
        id: json['id'] as String,
        fileKey: json['fileKey'] as String,
        claimedAmount: parseDecimalOrNull(json['claimedAmount']),
        claimedDate: parseDateOrNull(json['claimedDate']),
        claimedMode: json['claimedMode'] as String?,
        note: json['note'] as String?,
        status: _parseStatus(json['status'] as String),
        reviewNote: json['reviewNote'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        student: PaymentClaimStudentInfo.fromJson(json['student'] as Map<String, dynamic>),
        studentFee: PaymentClaimStudentFeeInfo.fromJson(json['studentFee'] as Map<String, dynamic>),
      );
}
