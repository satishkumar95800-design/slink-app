import 'parsing.dart';

class Receipt {
  final String id;
  final String receiptNumber;
  final double amount;
  final String method;
  final String? reference;
  final DateTime paidOn;
  final String? notes;
  final String studentName;
  final String feeStructureName;

  const Receipt({
    required this.id,
    required this.receiptNumber,
    required this.amount,
    required this.method,
    this.reference,
    required this.paidOn,
    this.notes,
    required this.studentName,
    required this.feeStructureName,
  });

  factory Receipt.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>;
    final studentFee = json['studentFee'] as Map<String, dynamic>;
    final feeStructure = studentFee['feeStructure'] as Map<String, dynamic>;
    return Receipt(
      id: json['id'] as String,
      receiptNumber: json['receiptNumber'] as String,
      amount: parseDecimal(json['amount']),
      method: json['method'] as String,
      reference: json['reference'] as String?,
      paidOn: DateTime.parse(json['paidOn'] as String),
      notes: json['notes'] as String?,
      studentName: student['name'] as String,
      feeStructureName: feeStructure['name'] as String,
    );
  }
}
