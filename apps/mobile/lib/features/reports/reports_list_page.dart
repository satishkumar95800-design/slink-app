import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/active_user.dart';
import '../../shared/models/report.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../auth/session_controller.dart';
import 'reports_providers.dart';
import '../../core/l10n/l10n.dart';
import '../home/parent_home_models.dart';
import 'report_labels.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/ui_kit.dart';

class ReportsListPage extends ConsumerWidget {
  const ReportsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsProvider);
    final isTeacher = ref.watch(sessionControllerProvider).user?.role == UserRole.teacher;
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(isTeacher ? l.teacherReports : l.menuReports),
        actions: [
          if (isTeacher)
            IconButton(
              icon: const Icon(Icons.upload_file_rounded),
              tooltip: l.reportsUploadTooltip,
              onPressed: () => context.push('/reports/upload'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(reportsProvider),
        child: reportsAsync.when(
          data: (all) {
            // Parents see homework on its own Homework screen, so it isn't repeated here.
            final reports = isTeacher ? all : all.where((r) => r.type != ReportType.homework).toList();
            if (reports.isEmpty) {
              return EmptyState(
                icon: Icons.insights_rounded,
                color: FeatureColors.reports,
                message: isTeacher ? l.reportsEmptyTeacher : l.reportsEmptyParent,
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: reports.length,
              itemBuilder: (context, index) {
                final report = reports[index];
                final read = report.readReceiptCount > 0;
                return ListCard(
                  leading: IconBadge(icon: reportTypeIcon(report.type), color: FeatureColors.reports, size: 48),
                  title: '${report.student.name} • ${report.term}',
                  subtitle: [
                    reportTypeLabel(l, report.type),
                    if (report.publishedAt != null) displayDate(report.publishedAt!),
                  ].join(' · '),
                  // Teachers see whether a parent has opened it.
                  trailing: isTeacher && report.status == ReportStatus.published
                      ? StatusPill(
                          label: read ? l.myClassesRead : l.myClassesUnread,
                          color: read ? FeatureColors.attendance : FeatureColors.fees,
                        )
                      : const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push('/reports/${report.id}'),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            color: AppColors.coral,
            message: l.reportsCouldNotLoad,
          ),
        ),
      ),
    );
  }
}
