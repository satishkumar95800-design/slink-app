import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guard for docs/SPEC-languages.md: interface text must come from lib/l10n/*.arb.
/// Flags string literals containing a word passed straight to common text
/// widgets/props. Literals that only join data ('${a} · ${b}') are fine.
void main() {
  test('no hard-coded user-facing strings in lib/', () {
    final pattern = RegExp(
      r'''(Text\(|labelText:|hintText:|helperText:|tooltip:|title:|label:|message:|errorMessage:|content: Text\()\s*(const\s+)?['"]([^'"]*)['"]''',
    );
    final offenders = <String>[];
    for (final file in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!file.path.endsWith('.dart') || file.path.contains('/l10n/app_localizations')) continue;
      final lines = file.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        for (final m in pattern.allMatches(lines[i])) {
          final literal = m.group(3)!.replaceAll(RegExp(r'\$\{[^}]*\}|\$\w+'), '');
          if (RegExp(r'[A-Za-z]{2,}').hasMatch(literal)) offenders.add('${file.path}:${i + 1}: ${lines[i].trim()}');
        }
      }
    }
    expect(offenders, isEmpty, reason: 'Move these into lib/l10n/app_en.arb:\n${offenders.join('\n')}');
  });
}
