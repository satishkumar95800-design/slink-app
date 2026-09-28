import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/timetable_slot.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'timetable_repository.dart';

const _dayNames = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

class WeeklyRoutinePage extends ConsumerWidget {
  const WeeklyRoutinePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timetableAsync = ref.watch(myTimetableProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text('Weekly Routine')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myTimetableProvider),
        child: timetableAsync.when(
          data: (slots) {
            if (slots.isEmpty) {
              return const Center(child: Text('No timetable has been set up for you yet.'));
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
              child: Text('Could not load your routine. Pull down to retry.\n$error',
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
          Text(_dayNames[day] ?? 'Day $day', style: Theme.of(context).textTheme.titleMedium),
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
