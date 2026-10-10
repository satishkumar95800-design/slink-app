import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'attendance_models.dart';
import 'attendance_repository.dart';
import 'attendance_status_colors.dart';

/// Parent view: one child's month, colour-coded by status, with month/year totals.
class AttendanceCalendarPage extends ConsumerStatefulWidget {
  final String studentId;
  final String? initialMonth;

  const AttendanceCalendarPage({super.key, required this.studentId, this.initialMonth});

  @override
  ConsumerState<AttendanceCalendarPage> createState() => _AttendanceCalendarPageState();
}

class _AttendanceCalendarPageState extends ConsumerState<AttendanceCalendarPage> {
  /// "YYYY-MM"; null until the first load tells us the school's current month.
  String? _month;

  @override
  void initState() {
    super.initState();
    _month = widget.initialMonth;
  }

  void _shiftMonth(String current, int delta) {
    final parts = current.split('-').map(int.parse).toList();
    final shifted = DateTime(parts[0], parts[1] + delta);
    // API month key — always Latin digits, whatever the UI language.
    setState(() => _month = DateFormat('yyyy-MM', 'en').format(shifted));
  }

  @override
  Widget build(BuildContext context) {
    final summaryAsync = ref.watch(studentAttendanceProvider((studentId: widget.studentId, month: _month)));

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(summaryAsync.valueOrNull?.studentName ?? context.l10n.attendanceTitle)),
      body: summaryAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(context.l10n.attendanceCouldNotLoad),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.invalidate(studentAttendanceProvider((studentId: widget.studentId, month: _month))),
                child: Text(context.l10n.commonRetry),
              ),
            ],
          ),
        ),
        data: (summary) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(studentAttendanceProvider((studentId: widget.studentId, month: _month))),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SummaryCard(summary: summary),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.chevron_left),
                            onPressed: () => _shiftMonth(summary.month, -1),
                          ),
                          Expanded(
                            child: Text(
                              // Month name in the UI language ("ಅಕ್ಟೋಬರ್ 2026"), digits stay 0–9.
                              DateFormat.yMMMM(Localizations.localeOf(context).languageCode)
                                  .format(DateTime.parse('${summary.month}-01')),
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.chevron_right),
                            // No future months — nothing can be marked there yet.
                            onPressed: summary.month.compareTo(summary.today.substring(0, 7)) >= 0
                                ? null
                                : () => _shiftMonth(summary.month, 1),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _MonthGrid(summary: summary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const _Legend(),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final StudentAttendanceSummary summary;

  const _SummaryCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final today = summary.todayStatus;
    final l = context.l10n;
    final pct = summary.yearTotals.percentage;
    final pctLabel = pct == null ? '—' : '${pct.toStringAsFixed(pct.truncateToDouble() == pct ? 0 : 1)}%';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.attendanceThisMonth(summary.monthTotals.daysPresent, summary.monthTotals.daysMarked),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(l.attendanceYearPercentage(summary.academicYearLabel, pctLabel)),
            const SizedBox(height: 8),
            Row(
              children: [
                CircleAvatar(
                  radius: 6,
                  backgroundColor: today == null ? AttendanceColors.holiday : AttendanceColors.of(today),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(l.attendanceToday(today?.label(l) ?? l.attendanceNotMarkedYet))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  final StudentAttendanceSummary summary;

  const _MonthGrid({required this.summary});

  @override
  Widget build(BuildContext context) {
    final first = DateTime.parse('${summary.month}-01');
    final daysInMonth = DateTime(first.year, first.month + 1, 0).day;
    final leadingBlanks = first.weekday - 1; // Monday-first weeks
    final cells = leadingBlanks + daysInMonth;
    final fmt = DateFormat('yyyy-MM-dd', 'en');
    final l = context.l10n;
    // narrowWeekdays starts on Sunday; the grid starts on Monday.
    final narrow = MaterialLocalizations.of(context).narrowWeekdays;
    final weekdayInitials = [...narrow.skip(1), narrow.first];

    return Column(
      children: [
        Row(
          children: [
            for (final d in weekdayInitials)
              Expanded(child: Center(child: Text(d, style: Theme.of(context).textTheme.labelMedium))),
          ],
        ),
        const SizedBox(height: 6),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, mainAxisSpacing: 4, crossAxisSpacing: 4),
          itemCount: cells + (7 - cells % 7) % 7,
          itemBuilder: (context, i) {
            final day = i - leadingBlanks + 1;
            if (day < 1 || day > daysInMonth) return const SizedBox.shrink();
            final ymd = fmt.format(DateTime(first.year, first.month, day));
            final status = summary.days[ymd];
            final holiday = summary.holidays[ymd];
            final isToday = ymd == summary.today;
            final Color? fill = status != null
                ? AttendanceColors.of(status)
                : holiday != null
                    ? AttendanceColors.holiday.withValues(alpha: 0.35)
                    : null;

            return Tooltip(
              message: holiday ?? status?.label(l) ?? '',
              child: Container(
                decoration: BoxDecoration(
                  color: fill,
                  shape: BoxShape.circle,
                  border: isToday ? Border.all(color: Theme.of(context).colorScheme.primary, width: 2) : null,
                ),
                alignment: Alignment.center,
                child: Text(
                  '$day',
                  style: TextStyle(
                    color: status != null ? Colors.white : null,
                    fontWeight: isToday || status != null ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final items = [
      for (final s in AttendanceStatus.values) (AttendanceColors.of(s), s.label(l)),
      (AttendanceColors.holiday.withValues(alpha: 0.35), l.attendanceHoliday),
    ];
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        for (final (color, label) in items)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(radius: 7, backgroundColor: color),
              const SizedBox(width: 6),
              Text(label),
            ],
          ),
      ],
    );
  }
}
