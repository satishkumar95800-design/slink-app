import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/l10n.dart';

/// Opens a sheet to jump straight to any month: year arrows and a 12-month grid.
/// Returns the first day of the picked month, or null if dismissed.
Future<DateTime?> showMonthYearPicker(BuildContext context, {required DateTime current, required DateTime today}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    showDragHandle: true,
    builder: (_) => MonthYearPicker(current: current, today: today),
  );
}

class MonthYearPicker extends StatefulWidget {
  final DateTime current;
  final DateTime today;

  /// Years offered either side of [today].
  static const yearSpan = 5;

  const MonthYearPicker({super.key, required this.current, required this.today});

  @override
  State<MonthYearPicker> createState() => _MonthYearPickerState();
}

class _MonthYearPickerState extends State<MonthYearPicker> {
  late int _year = widget.current.year;

  int get _minYear => widget.today.year - MonthYearPicker.yearSpan;
  int get _maxYear => widget.today.year + MonthYearPicker.yearSpan;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    final language = Localizations.localeOf(context).languageCode;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.calendarPickMonth, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  tooltip: l.calendarPrevYear,
                  icon: const Icon(Icons.chevron_left),
                  onPressed: _year > _minYear ? () => setState(() => _year--) : null,
                ),
                Expanded(
                  child: Text('$_year', textAlign: TextAlign.center, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  tooltip: l.calendarNextYear,
                  icon: const Icon(Icons.chevron_right),
                  onPressed: _year < _maxYear ? () => setState(() => _year++) : null,
                ),
              ],
            ),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 2.4,
              children: [
                for (var m = 1; m <= 12; m++) _monthCell(m, language, primary, theme),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _monthCell(int month, String language, Color primary, ThemeData theme) {
    final selected = _year == widget.current.year && month == widget.current.month;
    final isThisMonth = _year == widget.today.year && month == widget.today.month;
    final label = DateFormat.MMM(language).format(DateTime(_year, month));
    return Semantics(
      button: true,
      selected: selected,
      label: DateFormat.yMMMM(language).format(DateTime(_year, month)),
      child: ExcludeSemantics(
        child: Material(
          color: selected ? primary : primary.withValues(alpha: 0.06),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: isThisMonth && !selected ? BorderSide(color: primary, width: 2) : BorderSide.none,
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => Navigator.of(context).pop(DateTime(_year, month)),
            child: Center(
              child: Text(
                label,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: selected ? theme.colorScheme.onPrimary : null,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
