/// Calling codes offered at sign-in. India first; then where Indian school
/// families most often live or work. Names are shown as-is (proper nouns) and
/// are searchable together with the code.
class CountryCode {
  final String iso;
  final String name;
  final String dial;

  /// Allowed length of the local number (digits after the code).
  final int minDigits;
  final int maxDigits;

  const CountryCode(this.iso, this.name, this.dial, this.minDigits, [int? maxDigits])
      : maxDigits = maxDigits ?? minDigits;

  /// The flag emoji from the two-letter ISO code.
  String get flag => String.fromCharCodes(iso.codeUnits.map((c) => 0x1F1A5 + c));

  bool isValidLocal(String digits) =>
      RegExp(r'^\d+$').hasMatch(digits) && digits.length >= minDigits && digits.length <= maxDigits;

  bool matches(String query) {
    final q = query.trim().toLowerCase().replaceFirst('+', '');
    return q.isEmpty || name.toLowerCase().contains(q) || dial.contains(q) || iso.toLowerCase() == q;
  }
}

const india = CountryCode('IN', 'India', '91', 10);

const countryCodes = <CountryCode>[
  india,
  CountryCode('AE', 'United Arab Emirates', '971', 9),
  CountryCode('SA', 'Saudi Arabia', '966', 9),
  CountryCode('QA', 'Qatar', '974', 8),
  CountryCode('OM', 'Oman', '968', 8),
  CountryCode('KW', 'Kuwait', '965', 8),
  CountryCode('BH', 'Bahrain', '973', 8),
  CountryCode('US', 'United States', '1', 10),
  CountryCode('CA', 'Canada', '1', 10),
  CountryCode('GB', 'United Kingdom', '44', 10),
  CountryCode('AU', 'Australia', '61', 9),
  CountryCode('NZ', 'New Zealand', '64', 8, 10),
  CountryCode('SG', 'Singapore', '65', 8),
  CountryCode('MY', 'Malaysia', '60', 9, 10),
  CountryCode('NP', 'Nepal', '977', 10),
  CountryCode('LK', 'Sri Lanka', '94', 9),
  CountryCode('BD', 'Bangladesh', '880', 10),
  CountryCode('BT', 'Bhutan', '975', 8),
  CountryCode('MV', 'Maldives', '960', 7),
  CountryCode('DE', 'Germany', '49', 10, 11),
  CountryCode('IE', 'Ireland', '353', 9),
  CountryCode('KE', 'Kenya', '254', 9),
  CountryCode('ZA', 'South Africa', '27', 9),
];

/// The country for a saved ISO code, else India.
CountryCode countryByIso(String? iso) =>
    countryCodes.firstWhere((c) => c.iso == iso, orElse: () => india);
