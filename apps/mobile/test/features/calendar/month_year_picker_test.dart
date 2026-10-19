import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/calendar/widgets/month_year_picker.dart';
import 'package:slink/l10n/app_localizations.dart';

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets('jumps to a month in another year in two taps', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    DateTime? picked;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () async => picked = await showMonthYearPicker(
              context,
              current: DateTime(2026, 10),
              today: DateTime(2026, 10, 19),
            ),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Pick a month'), findsOneWidget);
    expect(find.text('2026'), findsOneWidget);
    expect(find.text('Oct'), findsOneWidget);

    await tester.tap(find.byTooltip('Next year'));
    await tester.pumpAndSettle();
    expect(find.text('2027'), findsOneWidget);
    await tester.tap(find.text('Mar'));
    await tester.pumpAndSettle();

    expect(picked, DateTime(2027, 3));
    expect(find.text('Pick a month'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('years stop five either side of today', (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: MonthYearPicker(current: DateTime(2031, 1), today: DateTime(2026, 10, 19))),
    ));
    final next = tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.chevron_right));
    expect(next.onPressed, isNull);
  });
}
