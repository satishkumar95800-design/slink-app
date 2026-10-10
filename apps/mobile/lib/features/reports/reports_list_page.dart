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

class ReportsListPage extends ConsumerWidget {
  const ReportsListPage({super.key});

  IconData _iconFor(ReportType type) {
    switch (type) {
      case ReportType.academic:
        return Icons.school;
      case ReportType.attendance:
        return Icons.event_available;
      case ReportType.behavior:
        return Icons.emoji_people;
      case ReportType.homework:
        return Icons.assignment;
      case ReportType.reportCard:
        return Icons.picture_as_pdf;
    }
  }

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
              icon: const Icon(Icons.upload_file),
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
              return Center(child: Text(isTeacher ? l.reportsEmptyTeacher : l.reportsEmptyParent));
            }
            return ListView.builder(
              itemCount: reports.length,
              itemBuilder: (context, index) {
                final report = reports[index];
                return ListTile(
                  leading: CircleAvatar(child: Icon(_iconFor(report.type))),
                  title: Text('${report.student.name} • ${report.term}'),
                  subtitle: Text(reportTypeLabel(l, report.type)),
                  trailing: report.publishedAt != null ? Text(displayDate(report.publishedAt!)) : null,
                  onTap: () => context.push('/reports/${report.id}'),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('${l.reportsCouldNotLoad}\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}
