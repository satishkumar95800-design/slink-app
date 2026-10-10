import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/timetable_slot.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
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
              return Center(child: Text(l.timetableEmpty));
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
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_dayName(day, Localizations.localeOf(context).languageCode), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                for (var i = 0; i < slots.length; i++)
                  Column(
                    children: [
                      ListTile(
                        leading: CircleAvatar(child: Text('${slots[i].periodNumber}')),
                        title: Text(slots[i].subject.name),
                        subtitle: Text(slots[i].studentClass.displayName),
                      ),
                      if (i != slots.length - 1) const Divider(height: 1),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
