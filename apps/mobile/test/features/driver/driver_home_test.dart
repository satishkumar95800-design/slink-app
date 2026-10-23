import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/driver/driver_home_body.dart';
import 'package:slink/features/driver/driver_trip.dart';
import 'package:slink/features/school_bus/school_bus_models.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/models/active_user.dart';
import 'package:slink/shared/services/branding_repository.dart';

const _driver = ActiveUser(id: 'd1', name: 'Ramesh Gowda', role: UserRole.driver, tenantId: 't1');

Future<void> _pump(WidgetTester tester, Map<String, dynamic> json) async {
  tester.view.physicalSize = const Size(360, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      brandingProvider.overrideWith((ref) async => null),
      driverHomeProvider.overrideWith((ref) async => DriverHome.fromJson(json)),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: DriverHomeBody(user: _driver)),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets("lists the driver's routes with start buttons", (tester) async {
    await _pump(tester, {
      'routes': [
        {
          'id': 'r1',
          'name': 'Route 1 - Jayanagar',
          'vehicleNumber': 'KA01AB1234',
          'stops': [
            {'name': 'Jayanagar 4th Block', 'pickupTime': '07:40', 'dropTime': '15:20'},
          ],
          'studentCount': 42,
        },
      ],
      'trip': null,
    });
    expect(find.text('Route 1 - Jayanagar'), findsOneWidget);
    expect(find.text('KA01AB1234 · 1 stop · 42 children'), findsOneWidget);
    expect(find.text('Start morning pick-up'), findsOneWidget);
    expect(find.text('Start afternoon drop'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('says so when no route is assigned', (tester) async {
    await _pump(tester, {'routes': [], 'trip': null});
    expect(find.text('No bus route is assigned to you yet. Ask the school office.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
