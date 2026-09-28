import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/teacher_class_overview.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
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
      appBar: AppBar(title: const Text('About My Class(es)')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myClassOverviewsProvider),
        child: overviewsAsync.when(
          data: (overviews) {
            if (overviews.isEmpty) {
              return const Center(child: Text('You are not linked to any classes yet.'));
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
              child: Text('Could not load your classes. Pull down to retry.\n$error',
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

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(overview.studentClass.displayName, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Boys: ${strength.male} · Girls: ${strength.female} · Total: ${strength.total}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (overview.subjects.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final subject in overview.subjects) Chip(label: Text(subject.name)),
                ],
              ),
            ],
            if (overview.recentReports.isNotEmpty) ...[
              const Divider(height: 24),
              Text('Recent reports', style: Theme.of(context).textTheme.titleSmall),
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
            child: Text('${report.studentName} • ${report.type} • ${report.term}'),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: (report.readByAnyParent ? Colors.green : Colors.orange).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              report.readByAnyParent ? 'Read' : 'Unread',
              style: TextStyle(
                color: report.readByAnyParent ? Colors.green : Colors.orange,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
