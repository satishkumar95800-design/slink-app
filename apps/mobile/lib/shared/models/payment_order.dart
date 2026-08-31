import 'parsing.dart';

enum PaymentOrderStatus { created, attempted, paid, failed, refunded }

PaymentOrderStatus _parseOrderStatus(String raw) => PaymentOrderStatus.values.firstWhere(
      (s) => s.name == raw,
      orElse: () => PaymentOrderStatus.created,
    );

class PaymentOrderStudentFeeInfo {
  final String id;
  final double amountDue;
  final double amountPaid;
  final String status;
  final String studentName;
  final String admissionNo;

  const PaymentOrderStudentFeeInfo({
    required this.id,
    required this.amountDue,
    required this.amountPaid,
    required this.status,
    required this.studentName,
    required this.admissionNo,
  });

  factory PaymentOrderStudentFeeInfo.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>;
    return PaymentOrderStudentFeeInfo(
      id: json['id'] as String,
      amountDue: parseDecimal(json['amountDue']),
      amountPaid: parseDecimal(json['amountPaid']),
      status: json['status'] as String,
      studentName: student['name'] as String,
      admissionNo: student['admissionNo'] as String,
    );
  }
}

class PaymentTransactionInfo {
  final String id;
  final String gatewayPaymentId;
  final double amount;
  final DateTime paidAt;
  final String? receiptUrl;

  const PaymentTransactionInfo({
    required this.id,
    required this.gatewayPaymentId,
    required this.amount,
    required this.paidAt,
    this.receiptUrl,
  });

  factory PaymentTransactionInfo.fromJson(Map<String, dynamic> json) => PaymentTransactionInfo(
        id: json['id'] as String,
        gatewayPaymentId: json['gatewayPaymentId'] as String,
        amount: parseDecimal(json['amount']),
        paidAt: DateTime.parse(json['paidAt'] as String),
        receiptUrl: json['receiptUrl'] as String?,
      );
}

class PaymentOrder {
  final String id;
  final String studentFeeId;
  final String gatewayOrderId;
  final double amount;
  final String currency;
  final PaymentOrderStatus status;
  final PaymentOrderStudentFeeInfo studentFee;
  final PaymentTransactionInfo? transaction;
  /// Razorpay publishable key — required to open Checkout for created/attempted orders.
  final String? keyId;

  const PaymentOrder({
    required this.id,
    required this.studentFeeId,
    required this.gatewayOrderId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.studentFee,
    this.transaction,
    this.keyId,
  });

  int get amountInPaise => (amount * 100).round();

  factory PaymentOrder.fromJson(Map<String, dynamic> json) => PaymentOrder(
        id: json['id'] as String,
        studentFeeId: json['studentFeeId'] as String,
        gatewayOrderId: json['gatewayOrderId'] as String,
        amount: parseDecimal(json['amount']),
        currency: json['currency'] as String,
        status: _parseOrderStatus(json['status'] as String),
        studentFee: PaymentOrderStudentFeeInfo.fromJson(json['studentFee'] as Map<String, dynamic>),
        transaction: json['transaction'] == null
            ? null
            : PaymentTransactionInfo.fromJson(json['transaction'] as Map<String, dynamic>),
        keyId: json['keyId'] as String?,
      );
}
