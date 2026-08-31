import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/report.dart';
import 'reports_providers.dart';

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
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(reportsProvider),
        child: reportsAsync.when(
          data: (reports) {
            if (reports.isEmpty) {
              return const Center(child: Text('No reports yet.'));
            }
            return ListView.builder(
              itemCount: reports.length,
              itemBuilder: (context, index) {
                final report = reports[index];
                return ListTile(
                  leading: CircleAvatar(child: Icon(_iconFor(report.type))),
                  title: Text('${report.student.name} • ${report.term}'),
                  subtitle: Text(report.type.name),
                  trailing: report.publishedAt != null
                      ? Text(report.publishedAt!.toLocal().toString().split(' ').first)
                      : null,
                  onTap: () => context.push('/reports/${report.id}'),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load reports. Pull down to retry.\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}
