import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';

/// "12345.67" (the API sends money as strings) or a number -> double.
double parseMoney(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

DateTime parseYmd(String ymd) {
  final p = ymd.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// DD/MM/YYYY from an API "yyyy-MM-dd" date.
String displayYmd(String value) => DateFormat('dd/MM/yyyy', 'en').format(parseYmd(value));

/// "March 2026" in the UI language from a "yyyy-MM" month.
String monthLabel(String month, String languageCode) {
  final p = month.split('-').map(int.parse).toList();
  return DateFormat('MMMM yyyy', languageCode).format(DateTime(p[0], p[1]));
}

/// One finalised payslip from GET /hrms/me/payslips.
class Payslip {
  final String id;
  final String month;
  final double gross;
  final double deductions;
  final double net;
  final DateTime? paidAt;

  const Payslip({
    required this.id,
    required this.month,
    required this.gross,
    required this.deductions,
    required this.net,
    this.paidAt,
  });

  factory Payslip.fromJson(Map<String, dynamic> j) => Payslip(
        id: j['id'] as String,
        month: j['month'] as String,
        gross: parseMoney(j['gross']),
        deductions: parseMoney(j['deductions']),
        net: parseMoney(j['net']),
        paidAt: j['paidAt'] is String ? DateTime.parse(j['paidAt'] as String).toLocal() : null,
      );
}

class LeaveType {
  final String id;
  final String name;
  final bool isPaid;

  const LeaveType({required this.id, required this.name, required this.isPaid});

  factory LeaveType.fromJson(Map<String, dynamic> j) =>
      LeaveType(id: j['id'] as String, name: j['name'] as String, isPaid: j['isPaid'] as bool? ?? true);
}

/// Per leave type, from GET /hrms/me/leave/balances. Days can be halves.
class LeaveBalance {
  final String leaveTypeId;
  final String name;
  final bool isPaid;
  final double allowance;
  final double carriedIn;
  final double used;
  final double pending;
  final double available;

  const LeaveBalance({
    required this.leaveTypeId,
    required this.name,
    required this.isPaid,
    required this.allowance,
    required this.carriedIn,
    required this.used,
    required this.pending,
    required this.available,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> j) => LeaveBalance(
        leaveTypeId: j['leaveTypeId'] as String,
        name: j['name'] as String,
        isPaid: j['isPaid'] as bool? ?? true,
        allowance: parseMoney(j['allowance']),
        carriedIn: parseMoney(j['carriedIn']),
        used: parseMoney(j['used']),
        pending: parseMoney(j['pending']),
        available: parseMoney(j['available']),
      );
}

/// 1 -> "1", 2.5 -> "2.5".
String formatDays(double d) => d == d.truncateToDouble() ? d.toInt().toString() : d.toStringAsFixed(1);

enum LeaveStatus {
  pending('PENDING'),
  approved('APPROVED'),
  rejected('REJECTED'),
  cancelled('CANCELLED');

  final String wire;
  const LeaveStatus(this.wire);

  static LeaveStatus parse(String? v) =>
      LeaveStatus.values.firstWhere((s) => s.wire == v, orElse: () => LeaveStatus.pending);

  Color get color => switch (this) {
        LeaveStatus.pending => FeatureColors.fees,
        LeaveStatus.approved => FeatureColors.attendance,
        LeaveStatus.rejected => AppColors.coral,
        LeaveStatus.cancelled => FeatureColors.sent,
      };

  String label(BuildContext context) => switch (this) {
        LeaveStatus.pending => context.l10n.hrmsStatusPending,
        LeaveStatus.approved => context.l10n.hrmsStatusApproved,
        LeaveStatus.rejected => context.l10n.hrmsStatusRejected,
        LeaveStatus.cancelled => context.l10n.hrmsStatusCancelled,
      };
}

class LeaveRequest {
  final String id;
  final String typeName;
  final String fromDate;
  final String toDate;
  final bool halfDay;
  final double days;
  final String reason;
  final LeaveStatus status;
  final String? decisionNote;

  const LeaveRequest({
    required this.id,
    required this.typeName,
    required this.fromDate,
    required this.toDate,
    required this.halfDay,
    required this.days,
    required this.reason,
    required this.status,
    this.decisionNote,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> j) => LeaveRequest(
        id: j['id'] as String,
        typeName: (j['leaveType'] as Map<String, dynamic>)['name'] as String,
        fromDate: j['fromDate'] as String,
        toDate: j['toDate'] as String,
        halfDay: j['halfDay'] as bool? ?? false,
        days: parseMoney(j['days']),
        reason: j['reason'] as String? ?? '',
        status: LeaveStatus.parse(j['status'] as String?),
        decisionNote: j['decisionNote'] as String?,
      );

  /// Pending requests, and approved ones that have not started, can be cancelled by the owner.
  bool canCancel(DateTime today) =>
      status == LeaveStatus.pending ||
      (status == LeaveStatus.approved && parseYmd(fromDate).isAfter(DateTime(today.year, today.month, today.day)));
}
