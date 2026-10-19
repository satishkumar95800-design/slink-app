import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'syllabus_models.dart';
import 'syllabus_repository.dart';

final _date = DateFormat('dd/MM/yyyy', 'en');
String _ymd(DateTime d) => DateFormat('yyyy-MM-dd', 'en').format(d);

const _lateColor = Color(0xFFC62828);
const _doneColor = Color(0xFF2E9E6A);

/// On time / late / completed / not planned, for staff screens only.
Widget syllabusStatusPill(BuildContext context, SyllabusStatus status, int daysLate) {
  final l = context.l10n;
  return switch (status) {
    SyllabusStatus.late => StatusPill(label: l.syllabusStatusLate(daysLate), color: _lateColor, icon: Icons.schedule_rounded),
    SyllabusStatus.completed => StatusPill(label: l.syllabusStatusCompleted, color: _doneColor, icon: Icons.check_circle_rounded),
    SyllabusStatus.onTime => StatusPill(label: l.syllabusStatusOnTime, color: FeatureColors.calendar),
    SyllabusStatus.notPlanned => StatusPill(label: l.syllabusStatusNotPlanned, color: FeatureColors.sent),
  };
}

Color _barColor(SyllabusStatus s) => s == SyllabusStatus.late ? _lateColor : _doneColor;

Widget _unitHeader(BuildContext context, String unit) => Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 6),
      child: Text(
        unit.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.muted),
      ),
    );

// ── Teacher ──────────────────────────────────────────────────────────────────

/// The teacher's own classes and subjects with how far each has got.
class TeacherSyllabusPage extends ConsumerWidget {
  const TeacherSyllabusPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(mySyllabusProvider);
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.syllabusTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(mySyllabusProvider.future),
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [LoadingBlock(height: 110), SizedBox(height: 10), LoadingBlock(height: 110)],
          ),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(mySyllabusProvider),
          ),
          data: (subjects) {
            if (subjects.isEmpty) {
              return EmptyState(icon: Icons.checklist_rounded, message: l.syllabusMineEmpty, color: FeatureColors.syllabus);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final s in subjects)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SoftCard(
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => TeacherTopicsPage(classId: s.classId, subjectId: s.subjectId),
                      )),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  l.syllabusSubjectInClass(s.subjectName, s.className),
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                                ),
                              ),
                              const SizedBox(width: 8),
                              syllabusStatusPill(context, s.status, s.daysLate),
                            ],
                          ),
                          const SizedBox(height: 12),
                          RoundedBar(value: s.total == 0 ? 0 : s.covered / s.total, color: _barColor(s.status), height: 8),
                          const SizedBox(height: 6),
                          Text(
                            s.total == 0 ? l.syllabusNoTopics : l.syllabusCoveredOf(s.covered, s.total, s.percent),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted),
                          ),
                          if (s.nextTopic != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              l.syllabusNextTopic(s.nextTopic!, _date.format(s.nextTopicDue!)),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
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

/// One class's subject: tick topics as they are taught.
class TeacherTopicsPage extends ConsumerStatefulWidget {
  final String classId;
  final String subjectId;

  const TeacherTopicsPage({super.key, required this.classId, required this.subjectId});

  @override
  ConsumerState<TeacherTopicsPage> createState() => _TeacherTopicsPageState();
}

class _TeacherTopicsPageState extends ConsumerState<TeacherTopicsPage> {
  /// The latest plan after a tick; null until the first change.
  SyllabusPlan? _plan;
  String? _busy;

  (String, String) get _key => (widget.classId, widget.subjectId);

  Future<void> _toggle(SyllabusTopic topic) async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final repo = ref.read(syllabusRepositoryProvider);
    String? date;
    if (topic.covered) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l.syllabusUndoTitle),
          content: Text(l.syllabusUndoBody(topic.title)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.syllabusUndoConfirm)),
          ],
        ),
      );
      if (ok != true) return;
    } else {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final picked = await showDatePicker(
        context: context,
        initialDate: today,
        firstDate: today.subtract(const Duration(days: 366)),
        lastDate: today,
        helpText: l.syllabusPickDateHelp,
      );
      if (picked == null) return;
      date = _ymd(picked);
    }
    setState(() => _busy = topic.id);
    try {
      final plan = topic.covered ? await repo.undo(topic.id) : await repo.complete(topic.id, date: date);
      ref.invalidate(mySyllabusProvider);
      if (!mounted) return;
      setState(() => _plan = plan);
      messenger.showSnackBar(SnackBar(content: Text(topic.covered ? l.syllabusUnmarked : l.syllabusMarked)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(describeError(e))));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final async = ref.watch(syllabusPlanProvider(_key));
    final plan = _plan ?? async.valueOrNull;
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(plan == null ? l.syllabusTitle : l.syllabusSubjectInClass(plan.subjectName, plan.className))),
      body: RefreshIndicator(
        onRefresh: () {
          setState(() => _plan = null);
          return ref.refresh(syllabusPlanProvider(_key).future);
        },
        child: plan == null
            ? async.hasError
                ? EmptyState(
                    icon: Icons.cloud_off_rounded,
                    message: describeError(async.error!),
                    color: FeatureColors.sent,
                    actionLabel: l.commonRetry,
                    onAction: () => ref.invalidate(syllabusPlanProvider(_key)),
                  )
                : ListView(padding: const EdgeInsets.all(16), children: const [LoadingBlock(height: 100), SizedBox(height: 10), LoadingBlock(height: 300)])
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                plan.total == 0 ? l.syllabusNoTopics : l.syllabusCoveredOf(plan.covered, plan.total, plan.percent),
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            syllabusStatusPill(context, plan.status, plan.daysLate),
                          ],
                        ),
                        const SizedBox(height: 10),
                        RoundedBar(value: plan.total == 0 ? 0 : plan.covered / plan.total, color: _barColor(plan.status), height: 8),
                        const SizedBox(height: 8),
                        Text(l.syllabusTickHelp, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                      ],
                    ),
                  ),
                  if (plan.topics.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: EmptyState(icon: Icons.checklist_rounded, message: l.syllabusNoTopicsTeacher, color: FeatureColors.syllabus),
                    ),
                  for (final (unit, topics) in groupByUnit(plan.topics, (SyllabusTopic t) => t.unit)) ...[
                    if (unit != null) _unitHeader(context, unit) else const SizedBox(height: 12),
                    Card(
                      margin: EdgeInsets.zero,
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: [
                          for (final (i, topic) in topics.indexed) ...[
                            if (i > 0) const Divider(height: 1),
                            _TeacherTopicTile(
                              topic: topic,
                              busy: _busy == topic.id,
                              enabled: plan.canMark && _busy == null,
                              onTap: () => _toggle(topic),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _TeacherTopicTile extends StatelessWidget {
  final SyllabusTopic topic;
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  const _TeacherTopicTile({required this.topic, required this.busy, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final late = topic.overdue && !topic.covered;
    return ListTile(
      onTap: enabled ? onTap : null,
      leading: busy
          ? const SizedBox(width: 24, height: 24, child: Padding(padding: EdgeInsets.all(2), child: CircularProgressIndicator(strokeWidth: 2.5)))
          : Icon(
              topic.covered ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
              color: topic.covered ? _doneColor : (late ? _lateColor : AppColors.muted),
              semanticLabel: topic.covered ? l.syllabusCoveredLabel : l.syllabusNotCoveredLabel,
            ),
      title: Text(topic.title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
        topic.covered
            ? l.syllabusCoveredOn(_date.format(topic.completedOn!))
            : late
                ? l.syllabusLateDue(_date.format(topic.plannedBy))
                : l.syllabusDueBy(_date.format(topic.plannedBy)),
        style: TextStyle(color: late ? _lateColor : null, fontWeight: late ? FontWeight.w700 : null),
      ),
    );
  }
}

// ── Parent ───────────────────────────────────────────────────────────────────

/// How much of each subject has been taught in the child's class.
class ChildSyllabusPage extends ConsumerWidget {
  final String studentId;

  const ChildSyllabusPage({super.key, required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(childSyllabusProvider(studentId));
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.syllabusTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(childSyllabusProvider(studentId).future),
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [LoadingBlock(height: 90), SizedBox(height: 10), LoadingBlock(height: 90)],
          ),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(childSyllabusProvider(studentId)),
          ),
          data: (data) {
            if (data.subjects.isEmpty) {
              return EmptyState(icon: Icons.checklist_rounded, message: l.syllabusChildEmpty(data.studentName), color: FeatureColors.syllabus);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                  child: Text(
                    l.syllabusChildIntro(data.studentName, data.className),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted),
                  ),
                ),
                for (final s in data.subjects)
                  ListCard(
                    leading: RingStat(
                      value: s.total == 0 ? 0 : s.covered / s.total,
                      color: FeatureColors.syllabus,
                      centerText: l.syllabusPercent(s.percent),
                      size: 52,
                    ),
                    title: s.subjectName,
                    subtitle: [
                      l.syllabusTopicsCovered(s.covered, s.total),
                      if (s.lastCoveredOn != null) l.syllabusLastCovered(_date.format(s.lastCoveredOn!)),
                    ].join('\n'),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => ChildSubjectPage(subject: s),
                    )),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The topics of one subject, ticked when taught.
class ChildSubjectPage extends StatelessWidget {
  final ChildSubject subject;

  const ChildSubjectPage({super.key, required this.subject});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(subject.subjectName)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          SoftCard(
            child: Row(
              children: [
                RingStat(
                  value: subject.total == 0 ? 0 : subject.covered / subject.total,
                  color: FeatureColors.syllabus,
                  centerText: l.syllabusPercent(subject.percent),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    l.syllabusTopicsCovered(subject.covered, subject.total),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
          for (final (unit, topics) in groupByUnit(subject.topics, (ChildTopic t) => t.unit)) ...[
            if (unit != null) _unitHeader(context, unit) else const SizedBox(height: 12),
            Card(
              margin: EdgeInsets.zero,
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (final (i, topic) in topics.indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      leading: Icon(
                        topic.completedOn != null ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                        color: topic.completedOn != null ? _doneColor : AppColors.muted,
                        semanticLabel: topic.completedOn != null ? l.syllabusCoveredLabel : l.syllabusNotCoveredLabel,
                      ),
                      title: Text(topic.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: topic.completedOn != null ? Text(l.syllabusCoveredOn(_date.format(topic.completedOn!))) : null,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
