// Smoke test: the app boots without throwing, and lands on the splash
// screen while SessionController's bootstrap resolves.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:school_connect/main.dart';

void main() {
  testWidgets('app boots to the splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: SchoolConnectApp()));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
