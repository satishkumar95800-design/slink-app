import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:slink/core/l10n/l10n.dart';
import 'package:slink/core/l10n/language_controller.dart';
import 'package:slink/shared/widgets/language_picker.dart';

/// Mirrors SlinkApp's MaterialApp wiring: the locale comes from LanguageController.
class _App extends ConsumerWidget {
  const _App();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      locale: ref.watch(languageControllerProvider),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Builder(
        builder: (context) => Scaffold(
          appBar: AppBar(actions: const [LanguageButton()]),
          body: Column(children: [
            Text(context.l10n.languageTitle, key: const Key('title')),
            Text(context.l10n.commonCancel, key: const Key('cancel')),
            Text(MaterialLocalizations.of(context).okButtonLabel, key: const Key('material')),
          ]),
        ),
      ),
    );
  }
}

void main() {
  testWidgets('picking ಕನ್ನಡ on the sign-in screen switches the UI at once, falling back to English', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ProviderScope(child: _App()));
    await tester.pumpAndSettle();

    expect(find.text('Language'), findsOneWidget);
    expect(find.text('English'), findsOneWidget); // current language on the button

    await tester.tap(find.byType(LanguageButton));
    await tester.pumpAndSettle();
    // Every language is offered in its own script.
    expect(find.text('ಕನ್ನಡ'), findsOneWidget);
    expect(find.text('हिन्दी'), findsOneWidget);

    await tester.tap(find.text('ಕನ್ನಡ'));
    await tester.pumpAndSettle();

    expect(tester.widget<Text>(find.byKey(const Key('title'))).data, 'ಭಾಷೆ');
    expect(tester.widget<Text>(find.byKey(const Key('cancel'))).data, 'Cancel'); // not translated yet → English
    expect(tester.widget<Text>(find.byKey(const Key('material'))).data, isNot('OK')); // Flutter's own widgets switch too
    expect((await SharedPreferences.getInstance()).getString('device_language'), 'kn');
  });
}
