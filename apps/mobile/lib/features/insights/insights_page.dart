import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/services/api_client.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';

/// One pattern warning (docs/SPEC-ai.md phase 2). The server sends reasons as
/// keys + params; the app turns them into text in the teacher's language.
class InsightAlert {
  final String id;
  final String kind;
  final String severity;
  final String? subjectName;
  final List<({String key, Map<String, dynamic> params})> reasons;

  InsightAlert({required this.id, required this.kind, required this.severity, this.subjectName, required this.reasons});

  factory InsightAlert.fromJson(Map<String, dynamic> json) => InsightAlert(
        id: json['id'] as String,
        kind: json['kind'] as String,
        severity: json['severity'] as String,
        subjectName: json['subjectName'] as String?,
        reasons: [
          for (final r in (json['reasons'] as List? ?? const []))
            if (r is Map<String, dynamic>)
              (key: r['key'] as String? ?? '', params: (r['params'] as Map<String, dynamic>?) ?? const {}),
        ],
      );
}

/// The teacher's own open alerts (their class-teacher students).
final insightsProvider = FutureProvider.autoDispose<List<InsightAlert>>((ref) async {
  final res = await ref.read(apiClientProvider).get<List<dynamic>>('/alerts');
  return [for (final a in res.data ?? const []) InsightAlert.fromJson(a as Map<String, dynamic>)];
});

String? _kindLabel(AppLocalizations l, String kind) => switch (kind) {
      'absence_streak' => l.insightKindAbsenceStreak,
      'weekday_absence' => l.insightKindWeekdayAbsence,
      'attendance_drop' => l.insightKindAttendanceDrop,
      'parent_disengaged' => l.insightKindParentDisengaged,
      'student_at_risk' => l.insightKindStudentAtRisk,
      _ => null,
    };

int _int(Map<String, dynamic> p, String k) => (p[k] as num?)?.toInt() ?? 0;

String? _reasonText(AppLocalizations l, String locale, ({String key, Map<String, dynamic> params}) r) {
  final p = r.params;
  return switch (r.key) {
    'absent_days_in_a_row' => l.insightReasonAbsentInARow(_int(p, 'days')),
    'absent_on_weekday' => l.insightReasonSameWeekday(
        _int(p, 'count'),
        _int(p, 'total'),
        // 2024-01-01 was a Monday.
        DateFormat.EEEE(locale).format(DateTime(2024, 1, _int(p, 'weekday').clamp(1, 7))),
      ),
    'attendance_fell' => l.insightReasonAttendanceFell(_int(p, 'before'), _int(p, 'now')),
    'parent_stopped_reading' => l.insightReasonParentNotReading(_int(p, 'unread')),
    'low_attendance' => l.insightReasonLowAttendance(_int(p, 'pct')),
    'complaints' => l.insightReasonComplaints(_int(p, 'count'), _int(p, 'days')),
    _ => null,
  };
}

class InsightsPage extends ConsumerWidget {
  const InsightsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(insightsProvider);
    final locale = Localizations.localeOf(context).languageCode;

    Future<void> dismiss(InsightAlert a) async {
      try {
        await ref.read(apiClientProvider).post<void>('/alerts/${a.id}/dismiss');
      } finally {
        ref.invalidate(insightsProvider);
      }
    }

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.insightsTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(insightsProvider),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => EmptyState(icon: Icons.cloud_off_rounded, message: l.insightsCouldNotLoad, color: AppColors.coral),
          data: (alerts) {
            if (alerts.isEmpty) {
              return EmptyState(icon: Icons.verified_rounded, message: l.insightsEmpty, color: FeatureColors.attendance);
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                Text(l.insightsExplainer, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 12),
                for (final a in alerts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SoftCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          IconBadge(
                            icon: a.severity == 'info' ? Icons.info_rounded : Icons.warning_amber_rounded,
                            color: switch (a.severity) {
                              'critical' => const Color(0xFFDC2626),
                              'warning' => FeatureColors.fees,
                              _ => FeatureColors.timetable,
                            },
                            size: 40,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  [_kindLabel(l, a.kind) ?? l.insightsTitle, if (a.subjectName != null) a.subjectName!]
                                      .join(' · '),
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 4),
                                for (final r in a.reasons)
                                  if (_reasonText(l, locale, r) case final text?)
                                    Text(text, style: Theme.of(context).textTheme.bodySmall),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: l.insightsDismiss,
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () => dismiss(a),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
