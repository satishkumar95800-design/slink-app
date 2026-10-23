import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/school_bus/live_bus_page.dart';
import 'package:slink/features/school_bus/school_bus_models.dart';
import 'package:slink/features/school_bus/school_bus_repository.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

class _FakeRepo extends SchoolBusRepository {
  final ChildBusLive data;
  _FakeRepo(this.data) : super(Dio());

  @override
  Future<ChildBusLive> childLive(String studentId) async => data;
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets('says the bus is not on a trip, with the stop and a call button', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final live = ChildBusLive.fromJson({
      'bus': {
        'routeName': 'Route 1',
        'vehicleNumber': 'KA01AB1234',
        'stop': {'name': 'South End Circle', 'pickupTime': '07:20', 'dropTime': '15:45'},
        'driver': {'name': 'Ramesh', 'phone': '+919845012345'},
      },
      'trip': null,
    });
    await tester.pumpWidget(ProviderScope(
      overrides: [
        brandingProvider.overrideWith((ref) async => null),
        schoolBusRepositoryProvider.overrideWithValue(_FakeRepo(live)),
      ],
      child: const MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: LiveBusPage(studentId: 's1'),
      ),
    ));
    await tester.pump();
    await tester.pump();
    expect(find.text('Not on a trip'), findsOneWidget);
    expect(find.text('Stop: South End Circle · 07:20'), findsOneWidget);
    expect(find.text('Call Ramesh'), findsOneWidget);
    expect(tester.takeException(), isNull);
    // Stop the 10 s poll timer.
    await tester.pumpWidget(const SizedBox());
  });
}
