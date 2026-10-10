import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import '../../l10n/app_localizations.dart';

export '../../l10n/app_localizations.dart';

/// Interface text lives in lib/l10n/app_*.arb (docs/SPEC-languages.md). Widgets
/// use `context.l10n`; it rebuilds when the user switches language.
extension L10nContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

/// For code with no BuildContext (controllers, exceptions). Follows the app's
/// language because [LanguageController] keeps `Intl.defaultLocale` in step.
AppLocalizations get currentL10n {
  final code = Intl.defaultLocale?.split(RegExp('[-_]')).first ?? 'en';
  final supported = AppLocalizations.supportedLocales.any((l) => l.languageCode == code);
  return lookupAppLocalizations(Locale(supported ? code : 'en'));
}

/// Each language's own name in its own script ("ಕನ್ನಡ", "हिन्दी"), so a parent who
/// can't read English can still find theirs. Comes from that language's ARB file.
String languageNativeName(Locale locale) => lookupAppLocalizations(locale).languageNativeName;
