import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/student.dart';
import '../../shared/widgets/ui_kit.dart';
import '../attendance/attendance_models.dart';
import '../attendance/attendance_status_colors.dart';
import '../dashboard/home_header.dart';
import '../dashboard/students_repository.dart';
import 'parent_home_models.dart';
import 'parent_home_repository.dart';
import '../consent/consent_repository.dart';
import '../../shared/services/ai_repository.dart';
import '../../shared/services/branding_repository.dart';

const _overlap = 36.0;

/// Parent home (docs/SPEC-improvements.md §3.1–3.3): teal header with the child
/// switcher, the fee card overlapping it, a grid of every feature, then this
/// month's attendance and today's homework and notice.
class ParentHomeBody extends ConsumerStatefulWidget {
  final List<Student> children;
  final String userName;

  const ParentHomeBody({super.key, required this.children, required this.userName});

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
    final home = homeAsync.valueOrNull;
    final l = context.l10n;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(consentItemsProvider);
        ref.invalidate(parentHomeProvider(child.id));
      },
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeroHeader(
            overlap: _overlap,
            child: HomeHeader(
              name: widget.userName,
              bottom: _ChildSwitcher(children: widget.children, selected: child),
            ),
          ),
          OverlapUp(
            by: _overlap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  homeAsync.when(
                    loading: () => const LoadingBlock(height: 150),
                    error: (_, __) => SoftCard(
                      child: Row(
                        children: [
                          const IconBadge(icon: Icons.cloud_off_rounded, color: AppColors.coral),
                          const SizedBox(width: 12),
                          Expanded(child: Text(l.homeCouldNotLoad)),
                          TextButton(
                            onPressed: () => ref.invalidate(parentHomeProvider(child.id)),
                            child: Text(l.commonRetry),
                          ),
                        ],
                      ),
                    ),
                    data: (home) => _FeeCard(fees: home.fees),
                  ),
                  const SizedBox(height: 24),
                  SectionHeader(title: l.homeQuickAccess),
                  FeatureGrid(tiles: [
                    // Premium: ask in plain language (docs/SPEC-ai.md 3.2).
                    if (ref.watch(aiAvailableProvider).valueOrNull ?? false)
                      FeatureTile(
                        icon: Icons.auto_awesome_rounded,
                        label: l.askTile,
                        color: FeatureColors.reports,
                        onTap: () => context.push('/ask'),
                      ),
                    FeatureTile(
                      icon: Icons.account_balance_wallet_rounded,
                      label: l.menuFees,
                      color: FeatureColors.fees,
                      caption: home == null || home.fees.allPaid ? null : formatRupees(home.fees.totalOutstanding),
                      alert: home?.fees.overdue ?? false,
                      onTap: () => context.push('/dashboard/fees'),
                    ),
                    FeatureTile(
                      icon: Icons.event_available_rounded,
                      label: l.attendanceTitle,
                      color: FeatureColors.attendance,
                      caption: home == null || home.attendanceDaysMarked == 0
                          ? null
                          : '${home.attendanceDaysPresent}/${home.attendanceDaysMarked}',
                      onTap: () => context.push('/attendance/student/${child.id}'),
                    ),
                    FeatureTile(
                      icon: Icons.menu_book_rounded,
                      label: l.menuHomework,
                      color: FeatureColors.homework,
                      badge: home?.homework.length,
                      onTap: () => context.push('/homework'),
                    ),
                    FeatureTile(
                      icon: Icons.campaign_rounded,
                      label: l.menuNotices,
                      color: FeatureColors.notices,
                      onTap: () => context.push('/notices'),
                    ),
                    FeatureTile(
                      icon: Icons.insights_rounded,
                      label: l.teacherReports,
                      color: FeatureColors.reports,
                      onTap: () => context.push('/dashboard/reports'),
                    ),
                    if (ref.watch(calendarEnabledProvider))
                      FeatureTile(
                        icon: Icons.calendar_month_rounded,
                        label: l.calendarTitle,
                        color: FeatureColors.calendar,
                        onTap: () => context.push('/calendar'),
                      ),
                    // Consent forms belong to the calendar module (events).
                    if (ref.watch(calendarEnabledProvider))
                      FeatureTile(
                        icon: Icons.assignment_turned_in_rounded,
                        label: l.consentTitle,
                        color: FeatureColors.notices,
                        badge: ref.watch(consentPendingCountProvider),
                        onTap: () => context.push('/consent'),
                      ),
                    FeatureTile(
                      icon: Icons.notifications_rounded,
                      label: l.notificationsTitle,
                      color: FeatureColors.notifications,
                      onTap: () => context.push('/dashboard/notifications'),
                    ),
                  ]),
                  if (home != null) ...[
                    const SizedBox(height: 24),
                    _AttendanceCard(home: home),
                    const SizedBox(height: 24),
                    SectionHeader(title: l.homeTodayTitle),
                    _TodaySection(home: home),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One pill per child (name over class); tapping switches the whole home screen.
class _ChildSwitcher extends ConsumerWidget {
  final List<Student> children;
  final Student selected;

  const _ChildSwitcher({required this.children, required this.selected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canSwitch = children.length > 1;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final c in children)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _ChildChip(
                student: c,
                selected: c.id == selected.id,
                tooltip: canSwitch ? context.l10n.homeSwitchChild : null,
                onTap: canSwitch ? () => selectChild(ref, c.id) : null,
              ),
            ),
        ],
      ),
    );
  }
}

class _ChildChip extends StatelessWidget {
  final Student student;
  final bool selected;
  final String? tooltip;
  final VoidCallback? onTap;

  const _ChildChip({required this.student, required this.selected, this.tooltip, this.onTap});

  @override
  Widget build(BuildContext context) {
    final className = student.studentClass?.name;
    final chip = Material(
      color: selected ? Colors.white : Colors.white.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              InitialAvatar(
                name: student.name,
                radius: 16,
                background: selected ? AppColors.coral : Colors.white.withValues(alpha: 0.2),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    student.name,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: selected ? AppColors.teal : Colors.white,
                    ),
                  ),
                  if (className != null)
                    Text(
                      className,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: selected ? AppColors.muted : Colors.white70,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    return tooltip == null ? chip : Tooltip(message: tooltip!, child: chip);
  }
}

class _FeeCard extends StatelessWidget {
  final FeeSummary fees;

  const _FeeCard({required this.fees});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final next = fees.next;
    final l = context.l10n;
    final muted = theme.brightness == Brightness.dark ? Colors.white70 : AppColors.muted;

    if (fees.claimsUnderReview > 0 || fees.allPaid || next == null) {
      final underReview = fees.claimsUnderReview > 0;
      return SoftCard(
        onTap: () => context.push('/dashboard/fees'),
        child: Row(
          children: [
            IconBadge(
              icon: underReview ? Icons.hourglass_top_rounded : Icons.verified_rounded,
              color: underReview ? FeatureColors.fees : FeatureColors.attendance,
              size: 52,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                underReview
                    ? (fees.claimAmount == null
                        ? l.homeClaimUnderReview
                        : l.homeClaimAmountUnderReview(formatRupees(fees.claimAmount)))
                    : l.homeAllFeesPaid,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            TextButton(onPressed: () => context.push('/dashboard/fees'), child: Text(l.homeViewFees)),
          ],
        ),
      );
    }

    final dueColor = next.overdue ? const Color(0xFFDC2626) : theme.colorScheme.onSurface;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(l.homeAmountDue,
                            style: theme.textTheme.labelLarge?.copyWith(color: muted, fontWeight: FontWeight.w700)),
                        if (next.overdue)
                          StatusPill(
                            label: l.homeOverdue,
                            color: const Color(0xFFDC2626),
                            icon: Icons.error_outline_rounded,
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        formatRupees(next.outstanding),
                        style: theme.textTheme.headlineMedium
                            ?.copyWith(fontWeight: FontWeight.w900, color: dueColor, letterSpacing: -0.5),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(next.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    Text(l.feesDueOn(displayYmd(next.dueDate)), style: theme.textTheme.bodySmall?.copyWith(color: muted)),
                    if (fees.openCount > 1)
                      Text(l.homeMoreDues(fees.openCount - 1), style: theme.textTheme.bodySmall?.copyWith(color: muted)),
                  ],
                ),
              ),
              const IconBadge(icon: Icons.account_balance_wallet_rounded, color: FeatureColors.fees, size: 56),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push('/dashboard/fees'),
                  child: Text(l.homeViewFees, textAlign: TextAlign.center),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push('/fees/${next.studentFeeId}/pay'),
                  icon: const Icon(Icons.bolt_rounded, size: 20),
                  label: Text(l.homePayNow, textAlign: TextAlign.center),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  final ParentHome home;

  const _AttendanceCard({required this.home});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = context.l10n;
    final today = home.attendanceToday;
    final marked = home.attendanceDaysMarked;
    final rate = marked == 0 ? 0.0 : home.attendanceDaysPresent / marked;
    final ringColor = rate >= 0.85 || marked == 0
        ? FeatureColors.attendance
        : rate >= 0.75
            ? AttendanceColors.late
            : AttendanceColors.absent;

    return SoftCard(
      onTap: () => context.push('/attendance/student/${home.studentId}'),
      child: Row(
        children: [
          RingStat(
            value: rate,
            color: ringColor,
            centerText: marked == 0 ? '–' : '${(rate * 100).round()}%',
            size: 68,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.homeAttendanceRate, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  l.attendanceThisMonth(home.attendanceDaysPresent, marked),
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                StatusPill(
                  label: l.attendanceToday(today?.label(l) ?? l.attendanceNotMarkedYet),
                  color: today == null ? AttendanceColors.holiday : AttendanceColors.of(today),
                  icon: Icons.today_rounded,
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

/// Today's homework as a swipeable row of photo cards, then the latest notice.
class _TodaySection extends StatelessWidget {
  final ParentHome home;

  const _TodaySection({required this.home});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final notice = home.latestNotice;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (home.homework.isEmpty)
          ListCard(
            leading: const IconBadge(icon: Icons.menu_book_rounded, color: FeatureColors.homework),
            title: l.homeNoHomeworkToday,
          )
        else
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: home.homework.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, i) => _HomeworkCard(hw: home.homework[i], fullWidth: home.homework.length == 1),
            ),
          ),
        const SizedBox(height: 12),
        if (notice == null)
          ListCard(
            leading: const IconBadge(icon: Icons.campaign_rounded, color: FeatureColors.notices),
            title: l.noticesEmpty,
          )
        else
          ListCard(
            leading: const IconBadge(icon: Icons.campaign_rounded, color: FeatureColors.notices),
            title: notice.title ?? l.homeLatestNotice,
            subtitle: notice.body,
            trailing: DateLabel(displayDate(notice.createdAt)),
            onTap: () => context.push('/notices/detail', extra: {
              'title': notice.title ?? l.homeLatestNotice,
              'body': notice.body,
              'attachments': notice.attachments,
              'broadcastId': notice.broadcastId,
            }),
          ),
      ],
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  final HomeworkItem hw;
  final bool fullWidth;

  const _HomeworkCard({required this.hw, required this.fullWidth});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = context.l10n;
    final width = fullWidth ? MediaQuery.sizeOf(context).width - 32 : 250.0;
    final placeholder = Container(
      color: FeatureColors.homework.withValues(alpha: 0.12),
      child: const Center(child: Icon(Icons.menu_book_rounded, color: FeatureColors.homework, size: 40)),
    );

    return SizedBox(
      width: width,
      child: Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/notices/detail', extra: {
            'title': l.homeworkKind,
            'body': hw.caption,
            'attachments': hw.photoUrls.isNotEmpty ? hw.photoUrls : [if (hw.photoUrl != null) hw.photoUrl],
            'broadcastId': hw.broadcastId,
          }),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    hw.photoUrl == null
                        ? placeholder
                        : CachedNetworkImage(
                            imageUrl: hw.photoUrl!,
                            fit: BoxFit.cover,
                            // Signed URLs change on every load; cache by path so the photo isn't refetched each time.
                            cacheKey: Uri.tryParse(hw.photoUrl!)?.path,
                            placeholder: (_, __) => placeholder,
                            errorWidget: (_, __, ___) => placeholder,
                          ),
                    if (hw.subject != null)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(hw.subject!,
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hw.caption.isEmpty ? l.homeworkKind : hw.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(hw.teacherName,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
