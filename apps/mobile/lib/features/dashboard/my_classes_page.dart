import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/teacher_class_overview.dart';
import '../reports/report_labels.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'teacher_classes_repository.dart';

/// "About My Class(es)" — deliberately has no fee/money widgets anywhere.
/// The `GET /teacher-dashboard/my-classes` response has no fee fields at all,
/// so there is nothing here to accidentally surface.
class MyClassesPage extends ConsumerWidget {
  const MyClassesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewsAsync = ref.watch(myClassOverviewsProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(context.l10n.teacherAboutMyClasses)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myClassOverviewsProvider),
        child: overviewsAsync.when(
          data: (overviews) {
            if (overviews.isEmpty) {
              return EmptyState(
                icon: Icons.groups_rounded,
                color: FeatureColors.classes,
                message: context.l10n.myClassesEmpty,
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: overviews.length,
              itemBuilder: (context, index) => _ClassOverviewCard(overview: overviews[index]),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('${context.l10n.myClassesCouldNotLoad}\n$error',
                  textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}

class _ClassOverviewCard extends StatelessWidget {
  final TeacherClassOverview overview;

  const _ClassOverviewCard({required this.overview});

  @override
  Widget build(BuildContext context) {
    final strength = overview.strength;

    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const IconBadge(icon: Icons.groups_rounded, color: FeatureColors.classes, size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(overview.studentClass.displayName,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      Text(
                        context.l10n.myClassesStrength(strength.male, strength.female, strength.total),
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (overview.subjects.isNotEmpty) ...[
              const SizedBox(height: 14),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final subject in overview.subjects)
                    StatusPill(label: subject.name, color: FeatureColors.timetable),
                ],
              ),
            ],
            if (overview.recentReports.isNotEmpty) ...[
              const Divider(height: 28),
              Text(context.l10n.myClassesRecentReports,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              for (final report in overview.recentReports) _RecentReportRow(report: report),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecentReportRow extends StatelessWidget {
  final TeacherClassRecentReport report;

  const _RecentReportRow({required this.report});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text('${report.studentName} • ${reportTypeLabelFromApi(context.l10n, report.type)} • ${report.term}'),
          ),
          StatusPill(
            label: report.readByAnyParent ? context.l10n.myClassesRead : context.l10n.myClassesUnread,
            color: report.readByAnyParent ? FeatureColors.attendance : FeatureColors.fees,
            icon: report.readByAnyParent ? Icons.done_all_rounded : Icons.schedule_rounded,
          ),
        ],
      ),
    );
  }
}
