import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/reports/report_labels.dart';

void main() {
  test('letter grades, case and spacing ignored', () {
    expect(gradeFraction('A+'), 0.97);
    expect(gradeFraction(' b+ '), 0.8);
    expect(gradeFraction('A1'), 0.97);
  });

  test('percentages and marks', () {
    expect(gradeFraction('85'), 0.85);
    expect(gradeFraction('85%'), 0.85);
    expect(gradeFraction('42/50'), 0.84);
    expect(gradeFraction('42 / 50'), 0.84);
    expect(gradeFraction(72), 0.72);
    expect(gradeFraction(0.5), 0.5);
    expect(gradeFraction('120'), 1.0);
  });

  test('anything else has no bar', () {
    expect(gradeFraction('Good'), isNull);
    expect(gradeFraction('5/0'), isNull);
    expect(gradeFraction(null), isNull);
    expect(gradeFraction(const {'a': 1}), isNull);
  });
}
