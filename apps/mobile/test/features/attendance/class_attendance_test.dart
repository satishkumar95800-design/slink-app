import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/attendance/attendance_models.dart';
import 'package:slink/features/attendance/attendance_repository.dart';
import 'package:slink/features/attendance/class_attendance_page.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

Map<String, dynamic> _s(String id, String name, String roll, int p, int l, int a, int lv) {
  final marked = p + l + a + lv;
  return {
    'studentId': id,
    'studentName': name,
    'rollNo': roll,
    'present': p,
    'late': l,
    'absent': a,
    'leave': lv,
    'daysMarked': marked,
    'percentage': marked == 0 ? null : ((p + l) * 1000 / marked).round() / 10,
  };
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets("shows every student's month with percentages and the class average", (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final json = {
      'class': {'id': 'c1', 'name': 'Class 8', 'section': 'A'},
      'month': '2026-10',
      'students': [_s('s1', 'Aarav', '1', 12, 1, 1, 0), _s('s2', 'Diya', '2', 8, 0, 5, 1)],
    };
    await tester.pumpWidget(ProviderScope(
      overrides: [
        brandingProvider.overrideWith((ref) async => null),
        classMonthProvider((classId: 'c1', month: null))
            .overrideWith((ref) async => ClassMonthAttendance.fromJson(json)),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ClassAttendancePage(classId: 'c1'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Class 8 A'), findsOneWidget);
    expect(find.text('October 2026'), findsOneWidget);
    expect(find.text('1. Aarav'), findsOneWidget);
    expect(find.text('93%'), findsOneWidget); // 13 of 14
    expect(find.text('57%'), findsOneWidget); // 8 of 14
    expect(find.text('12 present · 1 late · 1 absent · 0 leave'), findsOneWidget);
    expect(find.text('Class average: 75%'), findsOneWidget); // 21 of 28
    expect(tester.takeException(), isNull);
  });
}
