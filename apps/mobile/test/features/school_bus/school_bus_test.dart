import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:slink/features/school_bus/school_bus_models.dart';
import 'package:slink/features/school_bus/school_bus_page.dart';
import 'package:slink/features/school_bus/school_bus_repository.dart';
import 'package:slink/l10n/app_localizations.dart';
import 'package:slink/shared/services/branding_repository.dart';

Widget _app(Widget home, List<Override> overrides) => ProviderScope(
      overrides: [brandingProvider.overrideWith((ref) async => null), ...overrides],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

Future<void> _pump(WidgetTester tester, Map<String, dynamic> json) async {
  tester.view.physicalSize = const Size(360, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_app(const ChildBusPage(studentId: 'st1'), [
    childBusProvider('st1').overrideWith((ref) async => ChildBusInfo.fromJson(json)),
  ]));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets("shows the child's route, stop times and a call button for the driver", (tester) async {
    await _pump(tester, {
      'student': {'id': 'st1', 'name': 'Asha'},
      'bus': {
        'routeName': 'Route 1 – Jayanagar',
        'vehicleNumber': 'KA01AB1234',
        'stop': {'name': 'South End Circle', 'pickupTime': '07:20', 'dropTime': '15:45'},
        'driver': {'name': 'Ramesh Gowda', 'phone': '+919845012345'},
        'attendant': {'name': 'Lakshmi B', 'phone': null},
      },
    });
    expect(find.text('Route 1 – Jayanagar'), findsOneWidget);
    expect(find.text('Vehicle KA01AB1234'), findsOneWidget);
    expect(find.text('South End Circle'), findsOneWidget);
    expect(find.text('Pick-up 07:20'), findsOneWidget);
    expect(find.text('Drop 15:45'), findsOneWidget);
    expect(find.text('Ramesh Gowda'), findsOneWidget);
    expect(find.text('+919845012345'), findsOneWidget);
    // Only the driver has a phone, so one call button.
    expect(find.text('Call'), findsOneWidget);
    expect(find.text('Lakshmi B'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('says so when the child is not on a bus', (tester) async {
    await _pump(tester, {
      'student': {'id': 'st1', 'name': 'Asha'},
      'bus': null,
    });
    expect(find.text("Asha isn't on a school bus route."), findsOneWidget);
  });

  testWidgets('a route without a stop or driver yet', (tester) async {
    await _pump(tester, {
      'student': {'id': 'st1', 'name': 'Asha'},
      'bus': {'routeName': 'Route 3', 'vehicleNumber': null, 'stop': null, 'driver': null, 'attendant': null},
    });
    expect(find.text('No stop set yet. Ask the school office.'), findsOneWidget);
    expect(find.text('No driver assigned yet.'), findsOneWidget);
    expect(find.text('Call'), findsNothing);
  });
}
