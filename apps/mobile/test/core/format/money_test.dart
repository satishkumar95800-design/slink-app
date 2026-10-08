import 'package:flutter_test/flutter_test.dart';
import 'package:slink/core/format/money.dart';

void main() {
  test('formatRupees uses Indian grouping and shows paise only when non-zero', () {
    expect(formatRupees(21400), '₹21,400');
    expect(formatRupees(125000), '₹1,25,000');
    expect(formatRupees(12345678), '₹1,23,45,678');
    expect(formatRupees(1234.5), '₹1,234.50');
    expect(formatRupees(0), '₹0');
    expect(formatRupees(null), '₹0');
  });
}
