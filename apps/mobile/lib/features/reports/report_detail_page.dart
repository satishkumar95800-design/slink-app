import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/report.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/ui_kit.dart';
import '../home/parent_home_models.dart';
import 'report_labels.dart';
import 'reports_repository.dart';

/// Content keys shown as the teacher's remark bubble rather than as a field.
const _remarkKeys = {'summary', 'remark', 'remarks', 'comment', 'comments', 'teacherRemark', 'note'};

class ReportDetailPage extends ConsumerStatefulWidget {
  final String reportId;

  const ReportDetailPage({super.key, required this.reportId});

  @override
  ConsumerState<ReportDetailPage> createState() => _ReportDetailPageState();
}

class _ReportDetailPageState extends ConsumerState<ReportDetailPage> {
  late final Future<Report> _reportFuture;
  bool _markedRead = false;
  bool _openingPdf = false;

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

  Future<void> _openPdf(String key) async {
    setState(() => _openingPdf = true);
    final messenger = ScaffoldMessenger.of(context);
    final failed = context.l10n.reportPdfFailed;
    try {
      final url = await ref.read(filesRepositoryProvider).signedUrl(key);
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened) messenger.showSnackBar(SnackBar(content: Text(failed)));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(failed)));
    } finally {
      if (mounted) setState(() => _openingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return FutureBuilder<Report>(
      future: _reportFuture,
      builder: (context, snapshot) {
        final report = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            toolbarHeight: report == null ? kToolbarHeight : 68,
            title: report == null
                ? Text(l.reportTitle)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(reportTypeLabel(l, report.type)),
                      Text(
                        '${report.student.name} · ${report.term}',
                        style: const TextStyle(fontSize: 13, color: Colors.white70, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
          ),
          body: () {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError || report == null) {
              return EmptyState(icon: Icons.cloud_off_rounded, message: l.reportCouldNotLoad, color: AppColors.coral);
            }
            WidgetsBinding.instance.addPostFrameCallback((_) => _markReadOnce());
            return _ReportBody(
              report: report,
              openingPdf: _openingPdf,
              onOpenPdf: report.pdfKey == null ? null : () => _openPdf(report.pdfKey!),
            );
          }(),
        );
      },
    );
  }
}

class _ReportBody extends StatelessWidget {
  final Report report;
  final bool openingPdf;
  final VoidCallback? onOpenPdf;

  const _ReportBody({required this.report, required this.openingPdf, this.onOpenPdf});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final content = report.content;
    final grades = content['grades'] is Map ? (content['grades'] as Map).cast<String, Object?>() : null;
    final remarks = [
      for (final e in content.entries)
        if (_remarkKeys.contains(e.key) && e.value is String && (e.value as String).trim().isNotEmpty) e.value as String,
    ];
    final others = [
      for (final e in content.entries)
        if (e.key != 'grades' && !_remarkKeys.contains(e.key) && e.value != null && '${e.value}'.isNotEmpty) e,
    ];

    return SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        children: [
          SoftCard(
            child: Row(
              children: [
                IconBadge(icon: reportTypeIcon(report.type), color: FeatureColors.reports, size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(report.student.name,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      Text('${report.term} · ${report.academicYear}', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusPill(label: l.reportBy(report.teacher.name), color: FeatureColors.classes, icon: Icons.person_rounded),
                          if (report.publishedAt != null)
                            StatusPill(
                              label: displayDate(report.publishedAt!),
                              color: FeatureColors.sent,
                              icon: Icons.event_rounded,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (onOpenPdf != null) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: openingPdf ? null : onOpenPdf,
              icon: openingPdf
                  ? const SizedBox(
                      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.picture_as_pdf_rounded),
              label: Text(l.reportOpenPdf),
            ),
          ],
          if (grades != null && grades.isNotEmpty) ...[
            const SizedBox(height: 24),
            SectionHeader(title: l.reportSubjects),
            SoftCard(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
              child: Column(
                children: [
                  for (final (i, entry) in grades.entries.indexed)
                    _GradeRow(subject: entry.key, grade: entry.value, alternate: i.isOdd),
                ],
              ),
            ),
          ],
          for (final remark in remarks) ...[
            const SizedBox(height: 20),
            _RemarkBubble(text: remark),
          ],
          if (others.isNotEmpty) ...[
            const SizedBox(height: 24),
            for (final e in others) _FieldCard(label: e.key, value: e.value),
          ],
        ],
      ),
    );
  }
}

/// "Maths ........ A+" over a thick bar, alternating teal and coral.
class _GradeRow extends StatelessWidget {
  final String subject;
  final Object? grade;
  final bool alternate;

  const _GradeRow({required this.subject, required this.grade, required this.alternate});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fraction = gradeFraction(grade);
    final color = alternate ? AppColors.coral : theme.colorScheme.secondary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(subject, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              ),
              Text(grade?.toString() ?? '', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            ],
          ),
          if (fraction != null) ...[
            const SizedBox(height: 8),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: fraction),
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOutCubic,
              builder: (_, v, __) => RoundedBar(value: v, color: color, height: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _RemarkBubble extends StatelessWidget {
  final String text;

  const _RemarkBubble({required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.coral.withValues(alpha: dark ? 0.16 : 0.08),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
          bottomRight: Radius.circular(20),
          bottomLeft: Radius.circular(6),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.format_quote_rounded, color: AppColors.coral, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.l10n.reportTeacherRemark,
                    style: theme.textTheme.labelMedium
                        ?.copyWith(color: AppColors.coral, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(text, style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Any other content field the teacher filled in, shown as label + value.
class _FieldCard extends StatelessWidget {
  final String label;
  final Object? value;

  const _FieldCard({required this.label, required this.value});

  String _format(Object? v) => switch (v) {
        Map m => m.entries.map((e) => '${e.key}: ${e.value}').join('\n'),
        List list => list.join('\n'),
        _ => '$v',
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: FeatureColors.reports)),
            const SizedBox(height: 4),
            Text(_format(value), style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
