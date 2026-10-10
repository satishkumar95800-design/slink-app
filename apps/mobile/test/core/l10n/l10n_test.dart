import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:slink/core/l10n/l10n.dart';
import 'package:slink/core/l10n/language_controller.dart';
import 'package:slink/shared/models/api_exception.dart';
import 'package:slink/shared/services/api_client.dart';

/// Records requests instead of sending them.
class _RecordingAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode({}), 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  tearDown(() => Intl.defaultLocale = 'en');

  group('translation files', () {
    test('English, Kannada and Hindi are supported, each named in its own script', () {
      expect(AppLocalizations.supportedLocales.map((l) => l.languageCode), containsAll(['en', 'kn', 'hi']));
      expect(languageNativeName(const Locale('en')), 'English');
      expect(languageNativeName(const Locale('kn')), 'ಕನ್ನಡ');
      expect(languageNativeName(const Locale('hi')), 'हिन्दी');
    });

    test('a key missing from kn/hi shows the English text, never the raw key', () {
      final kn = lookupAppLocalizations(const Locale('kn'));
      expect(kn.commonCancel, 'Cancel');
      expect(kn.feesPaidInFull, isNot('feesPaidInFull'));
      expect(kn.languageTitle, 'ಭಾಷೆ');
    });

    test('plurals and placeholders', () {
      final en = lookupAppLocalizations(const Locale('en'));
      expect(en.attendanceStudentCount(1), '1 student');
      expect(en.attendanceStudentCount(32), '32 students');
      expect(en.homeMoreDues(1), '+ 1 more fee pending');
      expect(en.homeMoreDues(2), '+ 2 more fees pending');
      expect(en.sentSeenBy(3, 1), 'Seen by 3/1 parent');
      expect(en.sentSeenBy(18, 32), 'Seen by 18/32 parents');
      expect(en.homeDueBy('₹1,23,456', '15/10/2026'), '₹1,23,456 due by 15/10/2026');
    });

    test('currentL10n follows the app language', () {
      Intl.defaultLocale = 'kn';
      expect(currentL10n.languageNativeName, 'ಕನ್ನಡ');
      Intl.defaultLocale = 'ta'; // not shipped yet → English
      expect(currentL10n.languageNativeName, 'English');
    });
  });

  group('API errors', () {
    test('known codes are translated, unknown codes keep the server message', () {
      expect(const ApiException(403, 'server text', code: 'PHONE_NOT_REGISTERED').message,
          lookupAppLocalizations(const Locale('en')).errorPhoneNotRegistered);
      expect(const ApiException(409, 'Claim already approved', code: 'SOMETHING_NEW').message, 'Claim already approved');
      expect(const ApiException(null, null, code: 'NO_INTERNET').message, 'No internet connection.');
    });
  });

  group('LanguageController', () {
    late _RecordingAdapter adapter;
    late ProviderContainer container;

    ProviderContainer make({Locale initial = const Locale('en')}) {
      adapter = _RecordingAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://api.test/v1'))..httpClientAdapter = adapter;
      return ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(dio),
        initialLocaleProvider.overrideWithValue(initial),
      ]);
    }

    tearDown(() => container.dispose());

    test('opens in the language saved on this phone', () async {
      SharedPreferences.setMockInitialValues({'app_language': 'hi'});
      expect(await LanguageController.loadInitial(), const Locale('hi'));
      SharedPreferences.setMockInitialValues({'app_language': 'xx'});
      expect(await LanguageController.loadInitial(), const Locale('en'));
      container = make();
    });

    test("the account's own language wins at sign-in", () async {
      SharedPreferences.setMockInitialValues({'device_language': 'hi'});
      container = make();
      await container
          .read(languageControllerProvider.notifier)
          .applyFromAccount(preferredLanguage: 'kn', effectiveLanguage: 'kn');
      expect(container.read(languageControllerProvider), const Locale('kn'));
      expect(adapter.requests, isEmpty);
    });

    test('a pick made before login is kept and saved to an account that has none', () async {
      SharedPreferences.setMockInitialValues({'device_language': 'hi'});
      container = make();
      await container
          .read(languageControllerProvider.notifier)
          .applyFromAccount(preferredLanguage: null, effectiveLanguage: 'kn');
      expect(container.read(languageControllerProvider), const Locale('hi'));
      expect(adapter.requests.single.path, '/users/me/language');
      expect(adapter.requests.single.data, {'language': 'hi'});
      expect((await SharedPreferences.getInstance()).getString('device_language'), isNull);
    });

    test("otherwise the school's default applies", () async {
      SharedPreferences.setMockInitialValues({});
      container = make();
      await container
          .read(languageControllerProvider.notifier)
          .applyFromAccount(preferredLanguage: null, effectiveLanguage: 'kn');
      expect(container.read(languageControllerProvider), const Locale('kn'));
      expect(adapter.requests, isEmpty);
    });

    test('choosing while signed in applies at once and saves to the account', () async {
      SharedPreferences.setMockInitialValues({});
      container = make();
      final saved = await container.read(languageControllerProvider.notifier).choose('kn', signedIn: true);
      expect(saved, isTrue);
      expect(container.read(languageControllerProvider), const Locale('kn'));
      expect(Intl.defaultLocale, 'kn');
      expect(adapter.requests.single.method, 'PATCH');
    });

    test('choosing before login only remembers it on this phone', () async {
      SharedPreferences.setMockInitialValues({});
      container = make();
      await container.read(languageControllerProvider.notifier).choose('hi', signedIn: false);
      expect(adapter.requests, isEmpty);
      expect((await SharedPreferences.getInstance()).getString('device_language'), 'hi');
    });
  });
}
