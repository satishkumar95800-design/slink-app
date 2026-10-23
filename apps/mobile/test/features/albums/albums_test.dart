import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/albums/albums_models.dart';
import 'package:slink/features/albums/albums_repository.dart';
import 'package:slink/features/albums/child_albums_page.dart';
import 'package:slink/features/albums/staff_albums_page.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

class _FakeRepo extends AlbumsRepository {
  _FakeRepo() : super(Dio());

  @override
  Future<List<ChildAlbum>> forChild(String studentId) async => [
        ChildAlbum.fromJson({
          'id': 'a1',
          'title': 'Sports Day 2026',
          'expiresAt': '2026-11-23T06:00:00.000Z',
          'expired': false,
          'photoCount': 24,
          'saved': true,
          'coverUrl': null,
        }),
        ChildAlbum.fromJson({
          'id': 'a0',
          'title': 'Science fair',
          'expiresAt': '2026-09-01T06:00:00.000Z',
          'expired': true,
          'photoCount': 0,
          'saved': false,
          'coverUrl': null,
        }),
      ];

  @override
  Future<List<StaffAlbum>> mine() async => [
        StaffAlbum.fromJson({'id': 'a1', 'title': 'Sports Day 2026', 'status': 'draft', 'photoCount': 3, 'savedCount': 0}),
        StaffAlbum.fromJson({'id': 'a2', 'title': 'Annual day rehearsal with a long name', 'status': 'live', 'expiresAt': '2026-11-23T06:00:00.000Z', 'photoCount': 80, 'savedCount': 12}),
      ];
}

Future<void> _pump(WidgetTester tester, Widget home) async {
  tester.view.physicalSize = const Size(360, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      brandingProvider.overrideWith((ref) async => null),
      albumsRepositoryProvider.overrideWithValue(_FakeRepo()),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets("a parent sees the child's albums, when they leave, and removed ones", (tester) async {
    await _pump(tester, const ChildAlbumsPage(studentId: 's1'));
    expect(find.text('Sports Day 2026'), findsOneWidget);
    expect(find.text('24 photos'), findsOneWidget);
    expect(find.text('Until 23/11/2026'), findsOneWidget);
    expect(find.text('Saved'), findsOneWidget);
    expect(find.text('Science fair'), findsOneWidget);
    expect(find.text('Removed'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets("a teacher sees their albums with draft and shared status", (tester) async {
    await _pump(tester, const StaffAlbumsPage());
    expect(find.text('Sports Day 2026'), findsOneWidget);
    expect(find.text('Draft'), findsOneWidget);
    expect(find.text('Until 23/11/2026'), findsOneWidget);
    expect(find.text('80 photos'), findsOneWidget);
    expect(find.text('New album'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
