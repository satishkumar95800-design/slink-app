import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/auth/country_codes.dart';

void main() {
  test('India is the default and needs exactly 10 digits', () {
    expect(countryByIso(null), india);
    expect(countryByIso('XX'), india);
    expect(india.isValidLocal('9876543210'), isTrue);
    expect(india.isValidLocal('987654321'), isFalse);
    expect(india.isValidLocal('98765 43210'), isFalse);
  });

  test('other countries use their own number length', () {
    final uae = countryByIso('AE');
    expect(uae.dial, '971');
    expect(uae.isValidLocal('501234567'), isTrue);
    expect(uae.isValidLocal('9876543210'), isFalse);
    final nz = countryByIso('NZ');
    expect(nz.isValidLocal('21234567'), isTrue);
    expect(nz.isValidLocal('2123456789'), isTrue);
  });

  test('flag and search', () {
    expect(india.flag, '🇮🇳');
    expect(countryByIso('AE').matches('+971'), isTrue);
    expect(countryByIso('AE').matches('emirates'), isTrue);
    expect(india.matches('qatar'), isFalse);
  });

  test('every code is valid E.164 (code + number at most 15 digits)', () {
    for (final c in countryCodes) {
      expect(c.dial.length + c.maxDigits, lessThanOrEqualTo(15), reason: c.name);
      expect(c.minDigits, lessThanOrEqualTo(c.maxDigits), reason: c.name);
    }
  });
}
