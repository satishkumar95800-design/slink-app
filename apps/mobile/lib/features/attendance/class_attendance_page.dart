import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../calendar/widgets/month_year_picker.dart';
import 'attendance_models.dart';
import 'attendance_repository.dart';
import 'attendance_status_colors.dart';

/// A class teacher's month of the whole class: every student's days and
/// percentage; tap a student for their day-by-day calendar.
class ClassAttendancePage extends ConsumerStatefulWidget {
  final String classId;

  const ClassAttendancePage({super.key, required this.classId});

  @override
  ConsumerState<ClassAttendancePage> createState() => _ClassAttendancePageState();
}

class _ClassAttendancePageState extends ConsumerState<ClassAttendancePage> {
  /// "YYYY-MM"; null until the first load gives the school's current month.
  String? _month;

  DateTime _asDate(String month) => DateTime(int.parse(month.substring(0, 4)), int.parse(month.substring(5, 7)));

  // API month key: always Latin digits, whatever the UI language.
  void _show(DateTime month) => setState(() => _month = DateFormat('yyyy-MM', 'en').format(month));

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final language = Localizations.localeOf(context).languageCode;
    final key = (classId: widget.classId, month: _month);
    final async = ref.watch(classMonthProvider(key));
    final data = async.valueOrNull;
    final current = data != null ? _asDate(data.month) : null;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(data?.classLabel ?? l.attendanceClassTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(classMonthProvider(key)),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Row(
                children: [
                  IconButton(
                    tooltip: l.calendarPreviousMonth,
                    icon: const Icon(Icons.chevron_left),
                    onPressed: current == null ? null : () => _show(DateTime(current.year, current.month - 1)),
                  ),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: current == null
                          ? null
                          : () async {
                              final picked = await showMonthYearPicker(context, current: current, today: DateTime.now());
                              if (picked != null && mounted) _show(picked);
                            },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          current == null ? l.attendanceClassTitle : DateFormat.yMMMM(language).format(current),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: l.calendarNextMonth,
                    icon: const Icon(Icons.chevron_right),
                    onPressed: current == null ? null : () => _show(DateTime(current.year, current.month + 1)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            ...async.when(
              loading: () => const [LoadingBlock(height: 70), SizedBox(height: 10), LoadingBlock(height: 70)],
              error: (e, _) => [
                SoftCard(
                  child: Column(children: [
                    Text(describeError(e), textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    OutlinedButton(onPressed: () => ref.invalidate(classMonthProvider(key)), child: Text(l.commonRetry)),
                  ]),
                ),
              ],
              data: (d) => _rows(context, d),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _rows(BuildContext context, ClassMonthAttendance d) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final average = d.average;
    if (average == null) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Text(l.attendanceClassEmpty, textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
        ),
      ];
    }
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
        child: Text(l.attendanceClassAverage(average.round()), style: theme.textTheme.titleSmall),
      ),
      for (final s in d.students)
        Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            onTap: () => context.push('/attendance/student/${s.studentId}?month=${d.month}'),
            leading: SizedBox(
              width: 54,
              child: Text(
                s.percentage == null ? '—' : l.attendanceClassPercent(s.percentage!.round()),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: s.percentage == null
                      ? AppColors.muted
                      : s.percentage! < 75
                          ? AttendanceColors.absent
                          : AttendanceColors.present,
                ),
              ),
            ),
            title: Text(s.rollNo != null ? '${s.rollNo}. ${s.name}' : s.name),
            subtitle: Text(l.attendanceClassCounts(s.present, s.late, s.absent, s.leave)),
            trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
          ),
        ),
    ];
  }
}
