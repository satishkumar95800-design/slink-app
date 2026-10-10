import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/report.dart';
import 'report_labels.dart';
import 'reports_repository.dart';

class ReportDetailPage extends ConsumerStatefulWidget {
  final String reportId;

  const ReportDetailPage({super.key, required this.reportId});

  @override
  ConsumerState<ReportDetailPage> createState() => _ReportDetailPageState();
}

class _ReportDetailPageState extends ConsumerState<ReportDetailPage> {
  late final Future<Report> _reportFuture;
  bool _markedRead = false;

  @override
  void initState() {
    super.initState();
    _reportFuture = ref.read(reportsRepositoryProvider).getReport(widget.reportId);
  }

  void _markReadOnce() {
    if (_markedRead) return;
    _markedRead = true;
    // Fire-and-forget — read receipts aren't user-facing, no need to block the UI on this.
    ref.read(reportsRepositoryProvider).markRead(widget.reportId).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.reportTitle)),
      body: FutureBuilder<Report>(
        future: _reportFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(child: Text(l.reportCouldNotLoad));
          }

          final report = snapshot.data!;
          WidgetsBinding.instance.addPostFrameCallback((_) => _markReadOnce());

          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(report.term, style: Theme.of(context).textTheme.headlineSmall),
                Text('${report.academicYear} • ${reportTypeLabel(l, report.type)}'),
                const SizedBox(height: 8),
                Text(l.reportBy(report.teacher.name), style: Theme.of(context).textTheme.bodySmall),
                const Divider(height: 32),
                ...report.content.entries.map(
                  (entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.key,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text('${entry.value}'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
