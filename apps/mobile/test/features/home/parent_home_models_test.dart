import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/attendance/attendance_models.dart';
import 'package:slink/features/home/parent_home_models.dart';

void main() {
  test('parses the /parent/home payload for the three cards', () {
    final home = ParentHome.fromJson({
      'student': {'id': 's1', 'name': 'Avyaan Singha', 'class': {'id': 'c1', 'name': 'Class 1', 'section': 'A'}},
      'today': '2026-10-08',
      'fees': {
        'totalOutstanding': 12000,
        'openCount': 2,
        'overdue': true,
        'next': {'studentFeeId': 'f1', 'name': 'Term 1', 'outstanding': 6000, 'dueDate': '2026-10-05', 'overdue': true},
        'claimUnderReview': null,
      },
      'homework': [
        {'id': 'h1', 'caption': 'Maths p.12', 'teacherName': 'Neha', 'subject': null, 'photoUrl': 'https://x/y.jpg', 'publishedAt': '2026-10-08T03:30:00.000Z'},
      ],
      'latestNotice': {'id': 'n1', 'title': 'PTM', 'body': 'Sat 10am', 'createdAt': '2026-10-07T05:00:00.000Z'},
      'attendance': {
        'month': {'daysPresent': 21, 'daysMarked': 22, 'percentage': 95.5},
        'todayStatus': 'absent',
      },
    });

    expect(home.fees.next!.studentFeeId, 'f1');
    expect(home.fees.overdue, isTrue);
    expect(home.fees.allPaid, isFalse);
    expect(home.fees.claimsUnderReview, 0);
    expect(home.homework.single.teacherName, 'Neha');
    expect(home.latestNotice!.title, 'PTM');
    expect(home.attendanceDaysPresent, 21);
    expect(home.attendanceToday, AttendanceStatus.absent);
  });

  test('reads a claim under review and a fully paid state', () {
    final fees = FeeSummary.fromJson({
      'totalOutstanding': 0,
      'openCount': 0,
      'overdue': false,
      'next': null,
      'claimUnderReview': {'count': 1, 'amount': 6000},
    });
    expect(fees.allPaid, isTrue);
    expect(fees.claimsUnderReview, 1);
    expect(fees.claimAmount, 6000.0);
  });

  test('dates show as DD/MM/YYYY', () {
    expect(displayYmd('2026-10-15'), '15/10/2026');
  });
}
