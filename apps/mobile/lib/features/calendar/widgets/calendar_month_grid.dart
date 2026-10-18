import 'package:flutter/material.dart';
import '../calendar_models.dart';

/// Monday-first month grid. A holiday fills the day with the holiday colour;
/// events and PTMs show as markers beneath the number. Today has a ring and the
/// selected day a tint (on a holiday, a dark ring instead).
class CalendarMonthGrid extends StatelessWidget {
  final DateTime month; // first day of the month
  final CalendarMonth data;
  final DateTime selected;
  final DateTime today;
  final ValueChanged<DateTime> onSelect;

  const CalendarMonthGrid({
    super.key,
    required this.month,
    required this.data,
    required this.selected,
    required this.today,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingBlanks = month.weekday - 1;
    final cells = leadingBlanks + daysInMonth;
    // narrowWeekdays starts on Sunday; the grid starts on Monday.
    final narrow = MaterialLocalizations.of(context).narrowWeekdays;
    final weekdayInitials = [...narrow.skip(1), narrow.first];
    final selectedKey = dateKey(selected);
    final todayKey = dateKey(today);

    return Column(
      children: [
        Row(
          children: [
            for (final d in weekdayInitials)
              Expanded(child: Center(child: Text(d, style: theme.textTheme.labelMedium))),
          ],
        ),
        const SizedBox(height: 6),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
          ),
          itemCount: cells + (7 - cells % 7) % 7,
          itemBuilder: (context, i) {
            final dayNumber = i - leadingBlanks + 1;
            if (dayNumber < 1 || dayNumber > daysInMonth) return const SizedBox.shrink();
            final day = DateTime(month.year, month.month, dayNumber);
            final key = dateKey(day);
            final types = data.typesOn(day);
            final isSelected = key == selectedKey;
            final isToday = key == todayKey;
            return _DayCell(
              day: dayNumber,
              types: [
                for (final t in CalendarItemType.values)
                  if (types.contains(t)) t
              ],
              selected: isSelected,
              today: isToday,
              onTap: () => onSelect(day),
            );
          },
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  final int day;
  final List<CalendarItemType> types;
  final bool selected;
  final bool today;
  final VoidCallback onTap;

  const _DayCell(
      {required this.day, required this.types, required this.selected, required this.today, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final holiday = types.contains(CalendarItemType.holiday);
    final markers = [for (final t in types) if (t != CalendarItemType.holiday) t];
    final Border? border = today
        ? Border.all(color: primary, width: 2)
        : holiday && selected
            ? Border.all(color: Colors.black54, width: 2)
            : null;
    return Semantics(
      button: true,
      selected: selected,
      label: [
        '$day',
        for (final t in types) t.label(context),
      ].join(', '),
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Container(
            decoration: BoxDecoration(
              color: holiday
                  ? CalendarItemType.holiday.color
                  : selected
                      ? primary.withValues(alpha: 0.15)
                      : null,
              shape: BoxShape.circle,
              border: border,
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$day',
                  style: TextStyle(
                    fontWeight: today || selected || holiday ? FontWeight.bold : FontWeight.normal,
                    color: holiday ? Colors.white : null,
                  ),
                ),
                const SizedBox(height: 3),
                SizedBox(
                  height: 6,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final t in markers)
                        Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.symmetric(horizontal: 1),
                          decoration: BoxDecoration(
                            color: t.color,
                            shape: BoxShape.circle,
                            border: holiday ? Border.all(color: Colors.white, width: 1) : null,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
