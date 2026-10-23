import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/library/child_library_page.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

ChildLoan _loan(String title, String due, int late, {String? returned, num? fine}) => ChildLoan.fromJson({
      'id': title,
      'title': title,
      'author': 'R. K. Narayan',
      'issuedOn': '2026-10-01',
      'dueOn': due,
      'returnedOn': returned,
      'daysLate': late,
      'fineAmount': fine?.toStringAsFixed(2),
    });

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets("shows the child's books, overdue ones and fines", (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        brandingProvider.overrideWith((ref) async => null),
        childLibraryProvider('s1').overrideWith((ref) async => (
              open: [_loan('Malgudi Days', '2026-11-06', 0), _loan('Swami and Friends', '2026-10-15', 8)],
              recent: [_loan('The Guide', '2026-10-01', 3, returned: '2026-10-04', fine: 7.5)],
            )),
      ],
      child: const MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ChildLibraryPage(studentId: 's1'),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Return by 06/11/2026'), findsOneWidget);
    expect(find.text('8 days late'), findsOneWidget);
    expect(find.text('Fine ₹7.50'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
