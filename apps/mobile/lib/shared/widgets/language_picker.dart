import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../core/l10n/language_controller.dart';

/// Large, one-tap language buttons, each labelled in its own script.
Future<void> showLanguagePicker(BuildContext context, WidgetRef ref, {required bool signedIn}) {
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(sheetContext.l10n.languageChoose, style: Theme.of(sheetContext).textTheme.titleLarge),
            const SizedBox(height: 16),
            for (final locale in AppLocalizations.supportedLocales)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _LanguageOption(
                  locale: locale,
                  selected: ref.read(languageControllerProvider).languageCode == locale.languageCode,
                  onTap: () async {
                    Navigator.of(sheetContext).pop();
                    final messenger = ScaffoldMessenger.maybeOf(context);
                    final saved = await ref
                        .read(languageControllerProvider.notifier)
                        .choose(locale.languageCode, signedIn: signedIn);
                    if (!saved) messenger?.showSnackBar(SnackBar(content: Text(currentL10n.languageSaveFailed)));
                  },
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _LanguageOption extends StatelessWidget {
  final Locale locale;
  final bool selected;
  final VoidCallback onTap;

  const _LanguageOption({required this.locale, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        backgroundColor: selected ? scheme.primary.withValues(alpha: 0.08) : null,
        side: BorderSide(color: selected ? scheme.primary : scheme.outline, width: selected ? 2 : 1),
      ),
      child: Row(
        children: [
          Expanded(child: Text(languageNativeName(locale), style: const TextStyle(fontSize: 18))),
          if (selected) Icon(Icons.check_circle, color: scheme.primary),
        ],
      ),
    );
  }
}

/// Globe + current language, for the top corner of the sign-in screens.
class LanguageButton extends ConsumerWidget {
  final Color? color;

  const LanguageButton({super.key, this.color});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(languageControllerProvider);
    return TextButton.icon(
      style: TextButton.styleFrom(foregroundColor: color),
      onPressed: () => showLanguagePicker(context, ref, signedIn: false),
      icon: const Icon(Icons.language),
      label: Text(languageNativeName(locale)),
    );
  }
}
