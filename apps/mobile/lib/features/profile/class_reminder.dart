import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/services/api_client.dart';
import '../../shared/widgets/ui_kit.dart';

/// Lead times a teacher can pick for the "next class" push; null = off.
const classReminderChoices = <int?>[1, 2, 3, 4, 5, null];

/// The teacher's reminder lead time in minutes (null = off). The server sends
/// the push; the default is 5 minutes until the teacher changes it.
final classReminderProvider = FutureProvider.autoDispose<int?>((ref) async {
  final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/class-reminders/me');
  return (res.data?['minutesBefore'] as num?)?.toInt();
});

String classReminderLabel(AppLocalizations l, int? minutes) =>
    minutes == null ? l.classReminderOff : l.classReminderMinutes(minutes);

/// Profile row for teachers: shows the current lead time and opens the picker.
class ClassReminderTile extends ConsumerWidget {
  const ClassReminderTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final reminder = ref.watch(classReminderProvider);
    return ListCard(
      leading: const IconBadge(icon: Icons.alarm_rounded, color: FeatureColors.timetable),
      title: l.classReminderTitle,
      subtitle: reminder.maybeWhen(data: (m) => classReminderLabel(l, m), orElse: () => null),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: reminder.hasValue ? () => _pick(context, ref, reminder.value) : null,
    );
  }

  Future<void> _pick(BuildContext context, WidgetRef ref, int? current) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final picked = await showModalBottomSheet<({int? minutes})>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(sheetContext.l10n.classReminderChoose, style: Theme.of(sheetContext).textTheme.titleLarge),
              const SizedBox(height: 12),
              // 0 stands for "off" here, since a radio value of null means "nothing picked".
              RadioGroup<int>(
                groupValue: current ?? 0,
                onChanged: (v) => Navigator.of(sheetContext).pop((minutes: v == null || v == 0 ? null : v)),
                child: Column(
                  children: [
                    for (final minutes in classReminderChoices)
                      RadioListTile<int>(
                        value: minutes ?? 0,
                        title: Text(classReminderLabel(sheetContext.l10n, minutes)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || picked.minutes == current) return;
    try {
      await ref.read(apiClientProvider).put<void>('/class-reminders/me', data: {'minutesBefore': picked.minutes});
      ref.invalidate(classReminderProvider);
    } catch (_) {
      messenger?.showSnackBar(SnackBar(content: Text(currentL10n.classReminderSaveFailed)));
    }
  }
}
