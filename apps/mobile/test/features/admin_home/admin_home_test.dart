import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/admin_home/admin_home_body.dart';
import 'package:slink/features/admin_home/admin_home_repository.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/models/active_user.dart';
import 'package:slink/shared/services/branding_repository.dart';

const _admin = ActiveUser(id: 'a1', name: 'Gayathri Rao', role: UserRole.admin, tenantId: 't1');

Map<String, dynamic> _json({bool holiday = false, bool premiumMax = true}) => {
      'date': '2026-10-23',
      'attendance': {
        'holiday': holiday ? 'Deepavali' : null,
        'totalStudents': 300,
        'present': 250,
        'absent': 12,
        'late': 3,
        'leave': 5,
        'classesNotMarked': ['Class 7 A', 'Class 8 A'],
      },
      'fees': {'collectedToday': '42500.00', 'receiptsToday': 9, 'collectedThisMonth': '1215000.00'},
      'approvals': {'paymentClaims': 2, 'leaveRequests': premiumMax ? 1 : null, 'pettyCash': premiumMax ? 0 : null},
      'staffOnLeaveToday': premiumMax ? 2 : null,
      'admissions': premiumMax ? {'newThisWeek': 6, 'followUpsDue': 3} : null,
      'alerts': premiumMax ? {'critical': 1, 'warning': 2} : null,
      'buses': premiumMax ? {'routes': 4, 'onTheMove': 2, 'live': []} : null,
      'libraryOverdue': premiumMax ? 5 : null,
      'teachers': premiumMax
          ? {
              'total': 12,
              'tracked': true,
              'present': 9,
              'halfDay': 0,
              'absent': 1,
              'onLeave': 1,
              'notMarked': 1,
              'away': [
                {'name': 'Ravi Kumar', 'status': 'ON_LEAVE'},
                {'name': 'Sunita Rao', 'status': 'ABSENT'},
              ],
            }
          : {'total': 12, 'tracked': false},
      'events': [
        {'title': 'Deepavali', 'kind': 'holiday', 'date': '2026-10-28', 'endDate': null, 'time': null},
        {'title': 'Term 1 PTM', 'kind': 'ptm', 'date': '2026-10-30', 'endDate': null, 'time': '10:00'},
      ],
      'appointments': premiumMax
          ? {
              'today': [
                {'time': '11:30', 'kind': 'interview', 'name': 'Anil Joshi', 'withWhom': 'Principal', 'status': 'scheduled'},
                {'time': '09:00', 'kind': 'parent_meeting', 'name': 'Mrs Rao', 'withWhom': null, 'status': 'arrived'},
              ],
              'tours': [
                {'childName': 'Aarav', 'parentName': 'Ritu', 'phone': '98'},
              ],
              'laterThisWeek': 3,
              'waiting': 0,
            }
          : null,
      'urgent': [
        {'kind': 'critical_alerts', 'count': 1},
        {'kind': 'classes_not_marked', 'count': 2},
        {'kind': 'payment_claims', 'count': 2},
        if (premiumMax) {'kind': 'leave_requests', 'count': 1},
      ],
    };

Future<void> _pump(WidgetTester tester, Map<String, dynamic> json) async {
  tester.view.physicalSize = const Size(360, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      brandingProvider.overrideWith((ref) async => null),
      adminHomeProvider.overrideWith((ref) async => AdminHome.fromJson(json)),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: AdminHomeBody(user: _admin)),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting());

  test('works out present share and what is waiting', () {
    final h = AdminHome.fromJson(_json());
    expect(h.marked, 270);
    expect(h.presentPercent, 94); // (250 + 3) / 270
    expect(h.waiting, 3);
  });

  testWidgets("shows today's attendance, fees, approvals and module numbers", (tester) async {
    await _pump(tester, _json());
    expect(find.text('94% present'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('2 classes not marked yet'), findsOneWidget);
    expect(find.text('Class 7 A'), findsOneWidget);
    expect(find.text('₹42,500'), findsOneWidget);
    expect(find.text('9 receipts · this month ₹12,15,000'), findsOneWidget);
    // Needs attention, most pressing first.
    expect(find.text('1 serious alert'), findsOneWidget);
    expect(find.text("2 classes haven't marked attendance"), findsOneWidget);
    expect(find.text('2 payment claims to check'), findsOneWidget);
    expect(find.text('1 leave request to approve'), findsOneWidget);
    // Teachers today.
    expect(find.text('9 of 12 present'), findsOneWidget);
    expect(find.text('Ravi Kumar, Sunita Rao'), findsOneWidget);
    // Today's appointments and the campus tour.
    expect(find.text('Anil Joshi'), findsOneWidget);
    expect(find.text('Interview · with Principal'), findsOneWidget);
    expect(find.text('Arrived'), findsOneWidget);
    expect(find.text('Campus tour · Ritu'), findsOneWidget);
    expect(find.text('3 more later this week'), findsOneWidget);
    // Coming up.
    expect(find.text('Term 1 PTM'), findsOneWidget);
    expect(find.text('PTM · Fri 30 Oct · 10:00'), findsOneWidget);
    expect(find.text('2 of 4'), findsOneWidget);
    expect(find.text('Library books overdue'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a Basic school sees no module tiles; a holiday replaces attendance', (tester) async {
    await _pump(tester, _json(holiday: true, premiumMax: false));
    expect(find.text('Holiday today: Deepavali'), findsOneWidget);
    expect(find.text('1 leave request to approve'), findsNothing);
    expect(find.text("Today's appointments"), findsNothing);
    expect(find.text('12 teachers. Daily staff attendance is part of HR & payroll.'), findsOneWidget);
    expect(find.text('Buses on a trip'), findsNothing);
    expect(find.text('Library books overdue'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
