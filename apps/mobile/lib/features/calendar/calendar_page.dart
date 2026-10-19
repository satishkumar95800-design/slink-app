import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'calendar_repository.dart';
import 'widgets/calendar_item_tile.dart';
import 'widgets/calendar_legend.dart';
import 'widgets/calendar_month_grid.dart';
import 'widgets/month_year_picker.dart';

/// School calendar for parents and teachers: holidays, events and PTMs the admin
/// set up, as a month grid with the tapped day's items listed below.
class CalendarPage extends ConsumerStatefulWidget {
  const CalendarPage({super.key});

  @override
  ConsumerState<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends ConsumerState<CalendarPage> {
  late DateTime _month;
  late DateTime _selected;

  static DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  void initState() {
    super.initState();
    _goToToday();
  }

  void _goToToday() {
    final today = _dateOnly(DateTime.now());
    _selected = today;
    _month = DateTime(today.year, today.month);
  }

  void _shiftMonth(int delta) => _showMonth(DateTime(_month.year, _month.month + delta));

  void _showMonth(DateTime month) {
    setState(() {
      _month = DateTime(month.year, month.month);
      final today = _dateOnly(DateTime.now());
      final inThisMonth = today.year == _month.year && today.month == _month.month;
      _selected = inThisMonth ? today : _month;
    });
  }

  Future<void> _pickMonth() async {
    final picked = await showMonthYearPicker(context, current: _month, today: _dateOnly(DateTime.now()));
    if (picked != null && mounted) _showMonth(picked);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final monthAsync = ref.watch(calendarMonthProvider(_month));
    final today = _dateOnly(DateTime.now());
    final language = Localizations.localeOf(context).languageCode;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.calendarTitle)),
      body: monthAsync.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: const [LoadingBlock(height: 360)],
        ),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l.calendarCouldNotLoad, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(calendarMonthProvider(_month)),
                  child: Text(l.commonRetry),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          final dayItems = data.forDay(_selected);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(calendarMonthProvider(_month)),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            IconButton(
                              tooltip: l.calendarPreviousMonth,
                              icon: const Icon(Icons.chevron_left),
                              onPressed: () => _shiftMonth(-1),
                            ),
                            Expanded(
                              // Tap the month to jump to any month and year.
                              child: Tooltip(
                                message: l.calendarPickMonth,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(12),
                                  onTap: _pickMonth,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Flexible(
                                          child: Text(
                                            // Month name in the UI language, digits stay 0–9.
                                            DateFormat.yMMMM(language).format(_month),
                                            textAlign: TextAlign.center,
                                            style: Theme.of(context).textTheme.titleMedium,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Icon(Icons.arrow_drop_down_rounded),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: l.calendarNextMonth,
                              icon: const Icon(Icons.chevron_right),
                              onPressed: () => _shiftMonth(1),
                            ),
                          ],
                        ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            icon: const Icon(Icons.today_rounded, size: 18),
                            label: Text(l.calendarToday),
                            onPressed: () => setState(_goToToday),
                          ),
                        ),
                        const SizedBox(height: 4),
                        CalendarMonthGrid(
                          month: _month,
                          data: data,
                          selected: _selected,
                          today: today,
                          onSelect: (d) => setState(() => _selected = d),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const CalendarLegend(),
                const SizedBox(height: 20),
                SectionHeader(
                  title: l.calendarDayHeading(
                    DateFormat.EEEE(language).format(_selected),
                    DateFormat('dd/MM/yyyy', 'en').format(_selected),
                  ),
                ),
                if (dayItems.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      children: [
                        const IconBadge(icon: Icons.event_busy_rounded, color: FeatureColors.calendar),
                        const SizedBox(width: 14),
                        Expanded(child: Text(l.calendarNothingOnDay)),
                      ],
                    ),
                  )
                else
                  for (final item in dayItems) CalendarItemTile(item: item),
              ],
            ),
          );
        },
      ),
    );
  }
}
