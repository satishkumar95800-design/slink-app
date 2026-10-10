import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/services/api_client.dart';

/// The language this phone shows right now — survives logout and app restarts.
const _appLanguageKey = 'app_language';

/// A language picked on this phone before signing in (login-screen switcher).
/// Used at sign-in only when the account has no language of its own yet.
const _deviceLanguageKey = 'device_language';

bool isSupportedLanguage(String? code) =>
    code != null && AppLocalizations.supportedLocales.any((l) => l.languageCode == code);

/// Interface language, in the spec's order of priority: the account's saved
/// language, then a language picked on this phone before login, then the
/// school's default (which the API already folds into `language`), then English.
/// The phone's system language is deliberately not followed.
class LanguageController extends StateNotifier<Locale> {
  final Ref _ref;

  LanguageController(this._ref, Locale initial) : super(initial) {
    Intl.defaultLocale = initial.languageCode;
  }

  /// Read once in main() before the first frame, so the app never flashes English.
  static Future<Locale> loadInitial() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final code = prefs.getString(_appLanguageKey);
      if (isSupportedLanguage(code)) return Locale(code!);
    } catch (_) {}
    return const Locale('en');
  }

  /// User picked a language. Applies instantly; saved to the account when signed
  /// in. Returns false only when the account save failed (the phone keeps it).
  Future<bool> choose(String code, {required bool signedIn}) async {
    if (!isSupportedLanguage(code)) return true;
    _apply(code);
    final prefs = await SharedPreferences.getInstance();
    if (!signedIn) {
      await prefs.setString(_deviceLanguageKey, code);
      return true;
    }
    try {
      await _ref.read(apiClientProvider).patch<void>('/users/me/language', data: {'language': code});
      return true;
    } on DioException {
      return false;
    }
  }

  /// Called once sign-in succeeds, with the language fields from the auth response.
  Future<void> applyFromAccount({required String? preferredLanguage, required String? effectiveLanguage}) async {
    final prefs = await SharedPreferences.getInstance();
    if (isSupportedLanguage(preferredLanguage)) {
      _apply(preferredLanguage!);
      return;
    }
    final picked = prefs.getString(_deviceLanguageKey);
    if (isSupportedLanguage(picked)) {
      // The account has no language yet: keep what they chose on the login screen
      // and save it, so their other devices open in it too. Best-effort.
      _apply(picked!);
      await prefs.remove(_deviceLanguageKey); // a later sign-in on this phone starts fresh
      try {
        await _ref.read(apiClientProvider).patch<void>('/users/me/language', data: {'language': picked});
      } on DioException catch (_) {}
      return;
    }
    _apply(isSupportedLanguage(effectiveLanguage) ? effectiveLanguage! : 'en');
  }

  void _apply(String code) {
    Intl.defaultLocale = code;
    state = Locale(code);
    SharedPreferences.getInstance().then((p) => p.setString(_appLanguageKey, code)).ignore();
  }
}

/// Overridden in main() with the language saved on this phone.
final initialLocaleProvider = Provider<Locale>((_) => const Locale('en'));

final languageControllerProvider = StateNotifierProvider<LanguageController, Locale>((ref) {
  return LanguageController(ref, ref.read(initialLocaleProvider));
});
