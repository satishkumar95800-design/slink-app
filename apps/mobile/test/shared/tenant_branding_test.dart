import 'package:flutter_test/flutter_test.dart';
import 'package:slink/shared/models/tenant_branding.dart';

void main() {
  Map<String, dynamic> json(Object? features) => {
        'id': 't1',
        'name': 'School',
        if (features != null) 'features': features,
      };

  test('calendar is off when the features key is missing or false', () {
    expect(TenantBranding.fromJson(json(null)).calendarEnabled, isFalse);
    expect(TenantBranding.fromJson(json(<String, dynamic>{})).calendarEnabled, isFalse);
    expect(TenantBranding.fromJson(json({'calendar': false})).calendarEnabled, isFalse);
  });

  test('calendar is on only for an explicit true', () {
    expect(TenantBranding.fromJson(json({'calendar': true})).calendarEnabled, isTrue);
    expect(TenantBranding.fromJson(json({'calendar': 'true'})).calendarEnabled, isFalse);
  });

  test('ignores a malformed features value', () {
    expect(TenantBranding.fromJson(json('nope')).features, isEmpty);
  });
}
