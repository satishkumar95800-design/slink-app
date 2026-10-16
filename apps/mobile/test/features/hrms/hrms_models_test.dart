import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/hrms/hrms_models.dart';

void main() {
  setUpAll(() => initializeDateFormatting());

  test('payslip parses string money and paidAt', () {
    final p = Payslip.fromJson({
      'id': 'p1',
      'month': '2026-03',
      'gross': '125000.50',
      'deductions': '1800.00',
      'net': '123200.50',
      'paidAt': null,
    });
    expect(p.net, 123200.5);
    expect(p.paidAt, isNull);
    expect(monthLabel(p.month, 'en'), 'March 2026');
  });

  test('balance parses half days and formats them', () {
    final b = LeaveBalance.fromJson({
      'leaveTypeId': 't',
      'name': 'Casual Leave',
      'isPaid': true,
      'allowance': 12,
      'carriedIn': 0,
      'used': 2.5,
      'pending': 1,
      'available': 8.5,
    });
    expect(b.available, 8.5);
    expect(formatDays(b.available), '8.5');
    expect(formatDays(b.allowance), '12');
  });

  LeaveRequest req(String status, String from) => LeaveRequest.fromJson({
        'id': 'r',
        'leaveType': {'id': 't', 'name': 'Casual Leave', 'isPaid': true},
        'fromDate': from,
        'toDate': from,
        'halfDay': false,
        'days': 1,
        'reason': 'x',
        'status': status,
      });

  test('owner can cancel pending, or approved leave that has not started', () {
    final today = DateTime(2026, 10, 15);
    expect(req('PENDING', '2026-10-01').canCancel(today), isTrue);
    expect(req('APPROVED', '2026-10-16').canCancel(today), isTrue);
    expect(req('APPROVED', '2026-10-15').canCancel(today), isFalse);
    expect(req('REJECTED', '2026-10-20').canCancel(today), isFalse);
    expect(req('CANCELLED', '2026-10-20').canCancel(today), isFalse);
  });

  test('dates are shown DD/MM/YYYY', () {
    expect(displayYmd('2026-03-05'), '05/03/2026');
    expect(ymd(DateTime(2026, 3, 5)), '2026-03-05');
  });
}
