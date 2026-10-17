import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:slink/features/syllabus/syllabus_models.dart';
import 'package:slink/features/syllabus/syllabus_page.dart';
import 'package:slink/features/syllabus/syllabus_repository.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

Map<String, dynamic> _topic(String id, String title, {String? unit, String? done, bool overdue = false}) => {
      'id': id,
      'unit': unit,
      'title': title,
      'plannedBy': '2026-10-05',
      'completedOn': done,
      'completedBy': null,
      'overdue': overdue,
    };

Map<String, dynamic> _plan({bool firstDone = false}) => {
      'class': {'id': 'c1', 'name': 'Class 5 A'},
      'subject': {'id': 's1', 'name': 'Mathematics'},
      'teachers': [],
      'canEdit': false,
      'canMark': true,
      'total': 2,
      'covered': firstDone ? 1 : 0,
      'percent': firstDone ? 50 : 0,
      'expectedByToday': 2,
      'expectedPercent': 100,
      'overdue': firstDone ? 1 : 2,
      'status': 'late',
      'daysLate': 12,
      'nextIndex': firstDone ? 1 : 0,
      'topics': [
        _topic('t1', 'Adding unlike fractions', unit: 'Unit 3: Fractions', done: firstDone ? '2026-10-17' : null, overdue: !firstDone),
        _topic('t2', 'Subtracting fractions', unit: 'Unit 3: Fractions', overdue: true),
      ],
    };

final _child = {
  'student': {'id': 'st1', 'name': 'Aarav', 'className': 'Class 5 A'},
  'subjects': [
    {
      'subjectId': 's1',
      'subjectName': 'Science',
      'total': 2,
      'covered': 1,
      'percent': 50,
      'lastCoveredOn': '2026-10-03',
      'topics': [
        {'id': 't1', 'unit': 'Plants', 'title': 'Parts of a plant', 'completedOn': '2026-10-03'},
        {'id': 't2', 'unit': 'Plants', 'title': 'Photosynthesis', 'completedOn': null},
      ],
    },
  ],
};

class _FakeRepo extends SyllabusRepository {
  final List<String?> completedWith = [];
  _FakeRepo() : super(Dio());

  @override
  Future<SyllabusPlan> complete(String topicId, {String? date}) async {
    completedWith.add(date);
    return SyllabusPlan.fromJson(_plan(firstDone: true));
  }
}

Widget _app(Widget home, List<Override> overrides) => ProviderScope(
      overrides: [brandingProvider.overrideWith((ref) async => null), ...overrides],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void main() {
  setUpAll(() => initializeDateFormatting());

  test('groups topics into runs of the same unit, in order', () {
    final groups = groupByUnit(['a1', 'a2', 'b1', 'x', 'a3'], (String s) => s == 'x' ? null : s[0]);
    expect(groups.map((g) => g.$1).toList(), ['a', 'b', null, 'a']);
    expect(groups.first.$2, ['a1', 'a2']);
  });

  testWidgets('a teacher ticks a topic with the date it was taught', (tester) async {
    tester.view.physicalSize = const Size(360, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = _FakeRepo();
    await tester.pumpWidget(_app(const TeacherTopicsPage(classId: 'c1', subjectId: 's1'), [
      syllabusRepositoryProvider.overrideWithValue(repo),
      syllabusPlanProvider(('c1', 's1')).overrideWith((ref) async => SyllabusPlan.fromJson(_plan())),
    ]));
    await tester.pumpAndSettle();

    expect(find.text('Mathematics · Class 5 A'), findsOneWidget);
    expect(find.text('12 days late'), findsOneWidget);
    expect(find.text('UNIT 3: FRACTIONS'), findsOneWidget);
    expect(find.text('Late: due by 05/10/2026'), findsNWidgets(2));

    await tester.tap(find.text('Adding unlike fractions'));
    await tester.pumpAndSettle();
    expect(find.text('When was this topic taught?'), findsOneWidget);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    expect(repo.completedWith, [DateFormat('yyyy-MM-dd').format(DateTime.now())]);
    expect(find.text('Covered on 17/10/2026'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('parents see coverage and topics, never target dates or late status', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(const ChildSyllabusPage(studentId: 'st1'), [
      childSyllabusProvider('st1').overrideWith((ref) async => ChildSyllabus.fromJson(_child)),
    ]));
    await tester.pumpAndSettle();

    expect(find.text('Science'), findsOneWidget);
    expect(find.text('50%'), findsOneWidget);
    expect(find.textContaining('1 of 2 topics covered'), findsOneWidget);
    expect(find.textContaining('late', findRichText: true), findsNothing);

    await tester.tap(find.text('Science'));
    await tester.pumpAndSettle();
    expect(find.text('Parts of a plant'), findsOneWidget);
    expect(find.text('Covered on 03/10/2026'), findsOneWidget);
    expect(find.textContaining('Due by'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
