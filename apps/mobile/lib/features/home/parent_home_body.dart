import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format/money.dart';
import '../../core/strings.dart';
import '../../shared/models/student.dart';
import '../attendance/attendance_models.dart';
import '../attendance/attendance_status_colors.dart';
import '../dashboard/students_repository.dart';
import 'parent_home_models.dart';
import 'parent_home_repository.dart';

/// Parent home (docs/SPEC-improvements.md §3.1–3.3): child switcher, then the
/// Fee, Today and Attendance cards for the selected child, then the menu.
class ParentHomeBody extends ConsumerStatefulWidget {
  final List<Student> children;

  const ParentHomeBody({super.key, required this.children});

  @override
  ConsumerState<ParentHomeBody> createState() => _ParentHomeBodyState();
}

class _ParentHomeBodyState extends ConsumerState<ParentHomeBody> {
  @override
  void initState() {
    super.initState();
    resolveSelectedChild(ref, widget.children);
  }

  @override
  void didUpdateWidget(covariant ParentHomeBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    resolveSelectedChild(ref, widget.children);
  }

  @override
  Widget build(BuildContext context) {
    final selectedId = ref.watch(selectedChildIdProvider);
    final child = widget.children.where((c) => c.id == selectedId).firstOrNull;
    if (child == null) return const Center(child: CircularProgressIndicator());

    final homeAsync = ref.watch(parentHomeProvider(child.id));

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(parentHomeProvider(child.id)),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ChildSwitcher(children: widget.children, selected: child),
          const SizedBox(height: 16),
          homeAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => Card(
              child: ListTile(
                title: const Text(AppStrings.couldNotLoadHome),
                trailing: TextButton(
                  onPressed: () => ref.invalidate(parentHomeProvider(child.id)),
                  child: const Text(AppStrings.retryNow),
                ),
              ),
            ),
            data: (home) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _FeeCard(fees: home.fees),
                const SizedBox(height: 12),
                _TodayCard(home: home),
                const SizedBox(height: 12),
                _AttendanceCard(home: home),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const _MenuCard(icon: Icons.receipt_long, title: AppStrings.menuFees, subtitle: AppStrings.menuFeesSubtitle, route: '/dashboard/fees'),
          const _MenuCard(icon: Icons.menu_book_outlined, title: AppStrings.menuHomework, subtitle: AppStrings.menuHomeworkSubtitle, route: '/homework'),
          const _MenuCard(icon: Icons.campaign_outlined, title: AppStrings.menuNotices, subtitle: AppStrings.menuNoticesSubtitle, route: '/notices'),
          const _MenuCard(icon: Icons.assignment_outlined, title: AppStrings.menuReports, subtitle: AppStrings.menuReportsSubtitle, route: '/dashboard/reports'),
          _MenuCard(
            icon: Icons.event_available_outlined,
            title: AppStrings.menuAttendance,
            subtitle: AppStrings.menuAttendanceSubtitle,
            route: '/attendance/student/${child.id}',
          ),
        ],
      ),
    );
  }
}

class _ChildSwitcher extends ConsumerWidget {
  final List<Student> children;
  final Student selected;

  const _ChildSwitcher({required this.children, required this.selected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final label = AppStrings.childWithClass(selected.name, selected.studentClass?.name);
    final style = Theme.of(context).textTheme.titleLarge;
    if (children.length < 2) return Text(label, style: style);

    return PopupMenuButton<String>(
      tooltip: AppStrings.switchChild,
      onSelected: (id) => selectChild(ref, id),
      itemBuilder: (_) => [
        for (final c in children)
          CheckedPopupMenuItem(
            value: c.id,
            checked: c.id == selected.id,
            child: Text(AppStrings.childWithClass(c.name, c.studentClass?.name)),
          ),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Flexible(child: Text(label, style: style, overflow: TextOverflow.ellipsis)),
            const Icon(Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}

class _FeeCard extends StatelessWidget {
  final FeeSummary fees;

  const _FeeCard({required this.fees});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final next = fees.next;

    final Widget headline;
    if (fees.claimsUnderReview > 0) {
      headline = Row(children: [
        const Icon(Icons.hourglass_top, color: Colors.orange),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            AppStrings.claimUnderReview(fees.claimAmount == null ? null : formatRupees(fees.claimAmount)),
            style: theme.textTheme.titleMedium,
          ),
        ),
      ]);
    } else if (fees.allPaid || next == null) {
      headline = Row(children: [
        const Icon(Icons.check_circle, color: AttendanceColors.present),
        const SizedBox(width: 8),
        Text(AppStrings.allFeesPaid, style: theme.textTheme.titleMedium),
      ]);
    } else {
      headline = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (next.overdue)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(999)),
              child: Text(AppStrings.overdue, style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.bold)),
            ),
          Text(
            AppStrings.dueBy(formatRupees(next.outstanding), displayYmd(next.dueDate)),
            style: theme.textTheme.titleLarge?.copyWith(color: next.overdue ? Colors.red.shade700 : null),
          ),
          Text(next.name, style: theme.textTheme.bodySmall),
          if (fees.openCount > 1) Text(AppStrings.moreDues(fees.openCount - 1), style: theme.textTheme.bodySmall),
        ],
      );
    }

    final showPay = fees.claimsUnderReview == 0 && next != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            headline,
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => context.push('/dashboard/fees'), child: const Text(AppStrings.viewFees)),
                if (showPay) ...[
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () => context.push('/fees/${next.studentFeeId}/pay'),
                    child: const Text(AppStrings.payNow),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  final ParentHome home;

  const _TodayCard({required this.home});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notice = home.latestNotice;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text(AppStrings.todayCardTitle, style: theme.textTheme.titleMedium),
            ),
            if (home.homework.isEmpty)
              const ListTile(leading: Icon(Icons.menu_book_outlined), title: Text(AppStrings.noHomeworkToday))
            else
              for (final hw in home.homework)
                ListTile(
                  leading: _Thumbnail(url: hw.photoUrl),
                  title: Text(hw.caption.isEmpty ? AppStrings.menuHomework : hw.caption, maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text(AppStrings.homeworkBy(hw.teacherName, hw.subject)),
                  onTap: () => context.push('/notices/detail', extra: {
                    'title': AppStrings.menuHomework,
                    'body': hw.caption,
                    'attachments': hw.photoUrls.isNotEmpty ? hw.photoUrls : [if (hw.photoUrl != null) hw.photoUrl],
                    'broadcastId': hw.broadcastId,
                  }),
                ),
            const Divider(height: 1),
            if (notice == null)
              const ListTile(leading: Icon(Icons.campaign_outlined), title: Text(AppStrings.noNotices))
            else
              ListTile(
                leading: const Icon(Icons.campaign_outlined),
                title: Text(notice.title ?? AppStrings.latestNotice, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text('${displayDate(notice.createdAt)} · ${notice.body}', maxLines: 2, overflow: TextOverflow.ellipsis),
                onTap: () => context.push('/notices/detail', extra: {
                  'title': notice.title ?? AppStrings.latestNotice,
                  'body': notice.body,
                  'attachments': notice.attachments,
                  'broadcastId': notice.broadcastId,
                }),
              ),
          ],
        ),
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  final String? url;

  const _Thumbnail({this.url});

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    final placeholder = Container(
      width: size,
      height: size,
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: const Icon(Icons.menu_book_outlined),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: url == null
          ? placeholder
          : CachedNetworkImage(
              imageUrl: url!,
              width: size,
              height: size,
              fit: BoxFit.cover,
              // Signed URLs change on every load; cache by path so the thumbnail isn't refetched each time.
              cacheKey: Uri.tryParse(url!)?.path,
              placeholder: (_, __) => placeholder,
              errorWidget: (_, __, ___) => placeholder,
            ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  final ParentHome home;

  const _AttendanceCard({required this.home});

  @override
  Widget build(BuildContext context) {
    final today = home.attendanceToday;
    return Card(
      child: ListTile(
        minVerticalPadding: 16,
        leading: CircleAvatar(
          radius: 14,
          backgroundColor: today == null ? AttendanceColors.holiday : AttendanceColors.of(today),
          child: const Icon(Icons.event_available, size: 16, color: Colors.white),
        ),
        title: Text(AppStrings.thisMonth(home.attendanceDaysPresent, home.attendanceDaysMarked)),
        subtitle: Text(AppStrings.todayStatus(today?.label ?? AppStrings.notMarkedYet)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/attendance/student/${home.studentId}'),
      ),
    );
  }
}

class _MenuCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String route;

  const _MenuCard({required this.icon, required this.title, required this.subtitle, required this.route});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, size: 32),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push(route),
      ),
    );
  }
}
