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
    expect(find.text('Payment proofs to check'), findsOneWidget);
    expect(find.text('Leave requests'), findsOneWidget);
    // Zero petty cash entries waiting: not listed.
    expect(find.text('Petty cash entries'), findsNothing);
    expect(find.text('2 of 4'), findsOneWidget);
    expect(find.text('Library books overdue'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a Basic school sees no module tiles; a holiday replaces attendance', (tester) async {
    await _pump(tester, _json(holiday: true, premiumMax: false));
    expect(find.text('Holiday today: Deepavali'), findsOneWidget);
    expect(find.text('Leave requests'), findsNothing);
    expect(find.text('Buses on a trip'), findsNothing);
    expect(find.text('Library books overdue'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
