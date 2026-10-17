import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/consent/consent_models.dart';
import 'package:slink/features/consent/consent_page.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

Map<String, dynamic> _json({Map<String, dynamic>? response, bool open = true}) => {
      'formId': 'f1',
      'studentId': 's1',
      'studentName': 'Asha',
      'className': 'Class 5 A',
      'event': {
        'id': 'e1',
        'title': 'Trip to Mysuru Zoo',
        'description': 'Bus leaves at 7 am',
        'startDate': '2026-11-05',
        'endDate': '2026-11-05',
        'startTime': '07:00',
        'endTime': null,
        'venue': 'Mysuru Zoo',
      },
      'body': 'I allow my child to go on the trip.',
      'deadline': '2026-10-30',
      'open': open,
      'status': response == null ? 'PENDING' : response['decision'],
      'response': response,
    };

void main() {
  setUpAll(() => initializeDateFormatting());

  test('parses an unanswered form', () {
    final item = ConsentItem.fromJson(_json());
    expect(item.status, ConsentStatus.pending);
    expect(item.needsAnswer, isTrue);
    expect(item.event.venue, 'Mysuru Zoo');
    expect(item.deadline, DateTime(2026, 10, 30));
  });

  test('parses a signed answer', () {
    final item = ConsentItem.fromJson(_json(response: {
      'decision': 'DECLINED',
      'signedName': 'Meena Rao',
      'signedAt': '2026-10-16T10:00:00.000Z',
      'note': null,
      'signedByMe': true,
      'signedBy': 'Meena',
    }));
    expect(item.status, ConsentStatus.declined);
    expect(item.needsAnswer, isFalse);
    expect(item.response!.signedName, 'Meena Rao');
  });

  testWidgets('sign button needs an answer, a name and the confirmation', (tester) async {
    // A tall phone, so the whole form is built at once.
    tester.view.physicalSize = const Size(400, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [brandingProvider.overrideWith((ref) async => null)],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ConsentSignPage(item: ConsentItem.fromJson(_json())),
      ),
    ));
    await tester.pumpAndSettle();

    FilledButton button() => tester.widget<FilledButton>(find.byWidgetPredicate((w) => w is FilledButton));
    expect(find.text('Trip to Mysuru Zoo'), findsOneWidget);
    expect(button().onPressed, isNull);

    await tester.tap(find.text('I agree'));
    await tester.enterText(find.byType(TextField).first, 'Meena Rao');
    await tester.pump();
    expect(button().onPressed, isNull);

    await tester.ensureVisible(find.byType(CheckboxListTile));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    expect(button().onPressed, isNotNull);
  });
}
