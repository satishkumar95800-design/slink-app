import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/strings.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/error_banner.dart';
import 'attendance_models.dart';
import 'attendance_outbox.dart';
import 'attendance_repository.dart';
import 'attendance_status_colors.dart';

/// Entry point from the dashboard card: picks the class first when the teacher has more than one.
class MarkAttendanceEntryPage extends ConsumerWidget {
  const MarkAttendanceEntryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(myAttendanceClassesProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text(AppStrings.markAttendance)),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Message(AppStrings.couldNotLoad, onRetry: () => ref.invalidate(myAttendanceClassesProvider)),
        data: (data) {
          if (data.holidayName != null) return _Message(AppStrings.holidayToday(data.holidayName!));
          if (data.classes.isEmpty) return const _Message(AppStrings.noClassesToMark);
          if (data.classes.length == 1) {
            // Only one class: skip the picker.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) context.pushReplacement('/attendance/mark/${data.classes.first.id}');
            });
            return const Center(child: CircularProgressIndicator());
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(AppStrings.pickClass, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              for (final c in data.classes)
                Card(
                  child: ListTile(
                    minVerticalPadding: 16,
                    title: Text(c.label, style: Theme.of(context).textTheme.titleMedium),
                    subtitle: Text(c.submitted ? AppStrings.doneForToday : '${c.studentCount} students'),
                    trailing: c.submitted
                        ? const Icon(Icons.check_circle, color: AttendanceColors.present)
                        : const Icon(Icons.chevron_right),
                    onTap: () => context.push('/attendance/mark/${c.id}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

final _rosterProvider = FutureProvider.autoDispose.family<AttendanceRoster, String>((ref, classId) {
  return ref.watch(attendanceRepositoryProvider).getRoster(classId);
});

class MarkAttendancePage extends ConsumerWidget {
  final String classId;

  const MarkAttendancePage({super.key, required this.classId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(_rosterProvider(classId));
    return rosterAsync.when(
      loading: () => AuthenticatedScaffold(
        appBar: AppBar(title: const Text(AppStrings.markAttendance)),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => AuthenticatedScaffold(
        appBar: AppBar(title: const Text(AppStrings.markAttendance)),
        body: _Message(
          e is DioException ? ApiException.fromDioError(e).message : AppStrings.couldNotLoad,
          onRetry: () => ref.invalidate(_rosterProvider(classId)),
        ),
      ),
      data: (roster) => _MarkAttendanceView(roster: roster),
    );
  }
}

class _MarkAttendanceView extends ConsumerStatefulWidget {
  final AttendanceRoster roster;

  const _MarkAttendanceView({required this.roster});

  @override
  ConsumerState<_MarkAttendanceView> createState() => _MarkAttendanceViewState();
}

class _MarkAttendanceViewState extends ConsumerState<_MarkAttendanceView> {
  late Map<String, AttendanceStatus> _statuses;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final roster = widget.roster;
    // An unsent submission on this phone wins over what the server has; otherwise everyone starts Present.
    final pending = ref.read(attendanceOutboxProvider.notifier).pendingFor(roster.classId, roster.date);
    _statuses = {
      for (final s in roster.students) s.id: pending?.statuses[s.id] ?? s.status ?? AttendanceStatus.present,
    };
  }

  int _count(AttendanceStatus status) => _statuses.values.where((s) => s == status).length;

  void _toggle(String studentId) {
    HapticFeedback.selectionClick();
    setState(() {
      _statuses[studentId] =
          _statuses[studentId] == AttendanceStatus.absent ? AttendanceStatus.present : AttendanceStatus.absent;
    });
  }

  Future<void> _chooseStatus(RosterStudent student) async {
    HapticFeedback.mediumImpact();
    final chosen = await showModalBottomSheet<AttendanceStatus>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(title: Text(student.name, style: Theme.of(context).textTheme.titleMedium), subtitle: const Text(AppStrings.chooseStatus)),
            for (final status in AttendanceStatus.values)
              ListTile(
                minVerticalPadding: 14,
                leading: CircleAvatar(radius: 10, backgroundColor: AttendanceColors.of(status)),
                title: Text(status.label),
                trailing: _statuses[student.id] == status ? const Icon(Icons.check) : null,
                onTap: () => Navigator.of(context).pop(status),
              ),
          ],
        ),
      ),
    );
    if (chosen != null) setState(() => _statuses[student.id] = chosen);
  }

  Future<void> _submit() async {
    final present = _count(AttendanceStatus.present) + _count(AttendanceStatus.late);
    final absent = _count(AttendanceStatus.absent);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(AppStrings.confirmSubmit(present, absent)),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text(AppStrings.cancel)),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text(AppStrings.confirm)),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final roster = widget.roster;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(attendanceRepositoryProvider).submit(classId: roster.classId, date: roster.date, statuses: _statuses);
      final outbox = ref.read(attendanceOutboxProvider.notifier);
      final stale = outbox.pendingFor(roster.classId, roster.date);
      if (stale != null) await outbox.discard(stale);
      ref.invalidate(myAttendanceClassesProvider);
      messenger.showSnackBar(const SnackBar(content: Text(AppStrings.submitted)));
      if (mounted) context.pop();
    } on DioException catch (e) {
      if (isConnectivityError(e)) {
        await ref.read(attendanceOutboxProvider.notifier).enqueue(
              classId: roster.classId,
              classLabel: roster.classLabel,
              date: roster.date,
              statuses: _statuses,
            );
        messenger.showSnackBar(const SnackBar(content: Text(AppStrings.queuedOffline), duration: Duration(seconds: 6)));
        if (mounted) context.pop();
      } else {
        setState(() => _error = ApiException.fromDioError(e).message);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roster = widget.roster;
    final editable = roster.canEdit;
    final pending = ref.watch(attendanceOutboxProvider).where((p) => p.classId == roster.classId && p.date == roster.date).firstOrNull;
    final present = _count(AttendanceStatus.present);
    final absent = _count(AttendanceStatus.absent);
    final other = _count(AttendanceStatus.late) + _count(AttendanceStatus.leave);

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(roster.classLabel)),
      body: Column(
        children: [
          if (roster.holidayName != null)
            _Banner(text: AppStrings.holidayToday(roster.holidayName!))
          else if (pending != null)
            _PendingBanner(item: pending)
          else if (!editable)
            const _Banner(text: AppStrings.readOnlyDay)
          else if (roster.submitted)
            const _Banner(text: AppStrings.alreadySubmittedEditable),
          if (_error != null) Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: ErrorBanner(message: _error!)),
          if (editable && roster.students.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(AppStrings.tapHint, style: Theme.of(context).textTheme.bodySmall),
            ),
          Expanded(
            child: roster.students.isEmpty
                ? const _Message(AppStrings.noStudents)
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
                    itemCount: roster.students.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final s = roster.students[i];
                      final status = _statuses[s.id]!;
                      return _StudentRow(
                        student: s,
                        status: status,
                        onTap: editable ? () => _toggle(s.id) : null,
                        onLongPress: editable ? () => _chooseStatus(s) : null,
                      );
                    },
                  ),
          ),
        ],
      ),
      bottomNavigationBar: roster.students.isEmpty || roster.holidayName != null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x22000000), offset: Offset(0, -2))],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppStrings.countsLine(present, absent, other),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    if (editable)
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        style: FilledButton.styleFrom(minimumSize: const Size(120, 52)),
                        child: _submitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Text(roster.submitted ? AppStrings.update : AppStrings.submit),
                      ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _StudentRow extends StatelessWidget {
  final RosterStudent student;
  final AttendanceStatus status;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const _StudentRow({required this.student, required this.status, this.onTap, this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final color = AttendanceColors.of(status);
    final isPresent = status == AttendanceStatus.present;
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        constraints: const BoxConstraints(minHeight: 64),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        color: isPresent ? null : color.withValues(alpha: 0.08),
        child: Row(
          children: [
            SizedBox(
              width: 44,
              child: Text(
                student.rollNo ?? '—',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.black54),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(student.name, style: Theme.of(context).textTheme.titleMedium),
                  Text(student.admissionNo, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            Container(
              width: 92,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: isPresent ? Colors.transparent : color,
                border: Border.all(color: color, width: 2),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                status.label,
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.bold, color: isPresent ? color : Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingBanner extends ConsumerWidget {
  final PendingAttendance item;

  const _PendingBanner({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rejected = item.rejectedReason != null;
    return _Banner(
      text: rejected ? item.rejectedReason! : (item.sending ? AppStrings.sendingNow : AppStrings.pendingSend),
      color: rejected ? Colors.red.shade50 : Colors.amber.shade50,
      action: rejected
          ? null
          : TextButton(onPressed: () => ref.read(attendanceOutboxProvider.notifier).flush(), child: const Text(AppStrings.retryNow)),
    );
  }
}

class _Banner extends StatelessWidget {
  final String text;
  final Color? color;
  final Widget? action;

  const _Banner({required this.text, this.color, this.action});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: color ?? Theme.of(context).colorScheme.secondaryContainer,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(child: Text(text)),
          if (action != null) action!,
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  final VoidCallback? onRetry;

  const _Message(this.text, {this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(text, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text(AppStrings.retryNow)),
            ],
          ],
        ),
      ),
    );
  }
}
