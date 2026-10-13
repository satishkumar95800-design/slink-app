import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/timetable_slot.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'timetable_repository.dart';

/// Weekday name (1 = Monday) in the UI language. 2024-01-01 was a Monday.
String _dayName(int day, String languageCode) =>
    DateFormat.EEEE(languageCode).format(DateTime(2024, 1, day));

class WeeklyRoutinePage extends ConsumerWidget {
  const WeeklyRoutinePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetableAsync = ref.watch(myTimetableProvider);
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.teacherWeeklyRoutine)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myTimetableProvider),
        child: timetableAsync.when(
          data: (slots) {
            if (slots.isEmpty) {
              return EmptyState(
                icon: Icons.calendar_view_week_rounded,
                color: FeatureColors.timetable,
                message: l.timetableEmpty,
              );
            }

            final byDay = <int, List<TimetableSlot>>{};
            for (final slot in slots) {
              byDay.putIfAbsent(slot.dayOfWeek, () => []).add(slot);
            }
            final sortedDays = byDay.keys.toList()..sort();
            for (final day in sortedDays) {
              byDay[day]!.sort((a, b) => a.periodNumber.compareTo(b.periodNumber));
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final day in sortedDays) _DaySection(day: day, slots: byDay[day]!),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('${l.timetableCouldNotLoad}\n$error',
                  textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}

class _DaySection extends StatelessWidget {
  final int day;
  final List<TimetableSlot> slots;

  const _DaySection({required this.day, required this.slots});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isToday = DateTime.now().weekday == day;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10, left: 4),
            child: Row(
              children: [
                Text(
                  _dayName(day, Localizations.localeOf(context).languageCode),
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (isToday) ...[
                  const SizedBox(width: 8),
                  StatusPill(label: context.l10n.homeTodayTitle, color: AppColors.coral),
                ],
              ],
            ),
          ),
          SoftCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              children: [
                for (var i = 0; i < slots.length; i++) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: isToday ? AppColors.coral : FeatureColors.timetable.withValues(alpha: 0.13),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${slots[i].periodNumber}',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              color: isToday ? Colors.white : FeatureColors.timetable,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            slots[i].subject.name,
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                        StatusPill(label: slots[i].studentClass.displayName, color: FeatureColors.classes),
                      ],
                    ),
                  ),
                  if (i != slots.length - 1) const Divider(height: 1, indent: 70),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
