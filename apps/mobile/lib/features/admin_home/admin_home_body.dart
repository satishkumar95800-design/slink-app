import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/active_user.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/branding_repository.dart';
import '../../shared/widgets/ui_kit.dart';
import '../dashboard/home_header.dart';
import 'admin_home_repository.dart';

const _overlap = 36.0;

/// The admin's phone: today at a glance (attendance, money, what is waiting
/// for them) with a pointer to the console for details.
class AdminHomeBody extends ConsumerWidget {
  final ActiveUser user;

  const AdminHomeBody({super.key, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(adminHomeProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(adminHomeProvider.future),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeroHeader(overlap: _overlap, child: HomeHeader(name: user.name)),
          OverlapUp(
            by: _overlap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: async.when(
                loading: () => const Column(children: [
                  LoadingBlock(height: 150),
                  SizedBox(height: 12),
                  LoadingBlock(height: 110),
                  SizedBox(height: 12),
                  LoadingBlock(height: 110),
                ]),
                error: (e, _) => SoftCard(
                  child: Column(
                    children: [
                      Text(describeError(e), textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: () => ref.invalidate(adminHomeProvider), child: Text(l.commonRetry)),
                    ],
                  ),
                ),
                data: (h) => _Content(home: h),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  final AdminHome home;

  const _Content({required this.home});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final h = home;
    final stats = <_Stat>[
      if (h.staffOnLeaveToday != null)
        _Stat(Icons.beach_access_rounded, FeatureColors.payroll, '${h.staffOnLeaveToday}', l.adminStaffOnLeave),
      if (h.admissions != null) ...[
        _Stat(Icons.person_add_alt_1_rounded, FeatureColors.classes, '${h.admissions!.newThisWeek}', l.adminNewEnquiries),
        _Stat(Icons.phone_callback_rounded, FeatureColors.notices, '${h.admissions!.followUpsDue}', l.adminFollowUpsDue),
      ],
      if (h.alerts != null)
        _Stat(Icons.warning_amber_rounded, AppColors.coral, '${(h.alerts!['critical'] ?? 0) + (h.alerts!['warning'] ?? 0)}', l.adminAlerts),
      if (h.buses != null)
        _Stat(Icons.directions_bus_rounded, FeatureColors.bus, l.adminBusesValue(h.buses!.onTheMove, h.buses!.routes), l.adminBusesMoving,
            onTap: () => context.push('/buses/live')),
      if (h.libraryOverdue != null)
        _Stat(Icons.menu_book_rounded, FeatureColors.reports, '${h.libraryOverdue}', l.adminLibraryOverdue),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AttendanceCard(home: h),
        const SizedBox(height: 12),
        SoftCard(
          child: Row(
            children: [
              const IconBadge(icon: Icons.currency_rupee_rounded, color: FeatureColors.fees),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.adminCollectedToday, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                    Text(formatRupees(h.collectedToday),
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                    Text(l.adminReceiptsAndMonth(h.receiptsToday, formatRupees(h.collectedThisMonth)),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _WaitingCard(home: h),
        if (stats.isNotEmpty) ...[
          const SizedBox(height: 12),
          // Two per row; each tile is as tall as its text needs (large fonts too).
          LayoutBuilder(
            builder: (context, box) => Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final s in stats) SizedBox(width: (box.maxWidth - 12) / 2, child: _StatTile(stat: s)),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        FeatureGrid(tiles: [
          if (ref.watch(busTrackingEnabledProvider))
            FeatureTile(
              icon: Icons.near_me_rounded,
              label: l.adminLiveBuses,
              color: FeatureColors.bus,
              onTap: () => context.push('/buses/live'),
            ),
          if (ref.watch(calendarEnabledProvider))
            FeatureTile(
              icon: Icons.calendar_month_rounded,
              label: l.calendarTitle,
              color: FeatureColors.calendar,
              onTap: () => context.push('/calendar'),
            ),
          if (ref.watch(hrmsEnabledProvider)) ...[
            FeatureTile(
              icon: Icons.receipt_long_rounded,
              label: l.hrmsPayslipsTitle,
              color: FeatureColors.payroll,
              onTap: () => context.push('/hrms/payslips'),
            ),
            FeatureTile(
              icon: Icons.beach_access_rounded,
              label: l.hrmsLeaveTitle,
              color: FeatureColors.attendance,
              onTap: () => context.push('/hrms/leave'),
            ),
          ],
          FeatureTile(
            icon: Icons.notifications_rounded,
            label: l.notificationsTitle,
            color: FeatureColors.notifications,
            onTap: () => context.push('/dashboard/notifications'),
          ),
        ]),
        const SizedBox(height: 12),
        Text(l.adminConsoleHint, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
      ],
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  final AdminHome home;

  const _AttendanceCard({required this.home});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final h = home;
    if (h.holiday != null) {
      return SoftCard(
        child: Row(
          children: [
            const IconBadge(icon: Icons.celebration_rounded, color: FeatureColors.calendar),
            const SizedBox(width: 14),
            Expanded(child: Text(l.adminHolidayToday(h.holiday!), style: theme.textTheme.titleMedium)),
          ],
        ),
      );
    }
    final pct = h.presentPercent;
    final notMarked = h.classesNotMarked;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconBadge(icon: Icons.fact_check_rounded, color: FeatureColors.attendance),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.adminAttendanceToday, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                    Text(pct == null ? l.adminNotMarkedYet : l.adminPresentPercent(pct),
                        style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
              if (h.marked > 0)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${h.absent}', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900, color: AppColors.coral)),
                    Text(l.adminAbsent, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                  ],
                ),
            ],
          ),
          if (h.marked > 0) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: h.totalStudents == 0 ? 0 : h.marked / h.totalStudents,
                minHeight: 6,
                backgroundColor: FeatureColors.attendance.withValues(alpha: 0.12),
                color: FeatureColors.attendance,
              ),
            ),
            const SizedBox(height: 6),
            Text(l.adminMarkedOf(h.marked, h.totalStudents), style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
          ],
          if (notMarked.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(l.adminClassesNotMarked(notMarked.length),
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.coralDark)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final c in notMarked.take(12)) StatusPill(label: c, color: AppColors.coral),
                if (notMarked.length > 12) StatusPill(label: '+${notMarked.length - 12}', color: AppColors.muted),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _WaitingCard extends StatelessWidget {
  final AdminHome home;

  const _WaitingCard({required this.home});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final rows = <(IconData, String, int)>[
      (Icons.receipt_rounded, l.adminWaitingClaims, home.paymentClaims),
      if (home.leaveRequests != null) (Icons.event_busy_rounded, l.adminWaitingLeave, home.leaveRequests!),
      if (home.pettyCash != null) (Icons.savings_rounded, l.adminWaitingPettyCash, home.pettyCash!),
    ];
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.adminWaitingTitle, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (home.waiting == 0)
            Text(l.adminNothingWaiting, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted))
          else ...[
            for (final (icon, label, count) in rows)
              if (count > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Icon(icon, size: 20, color: AppColors.muted),
                      const SizedBox(width: 10),
                      Expanded(child: Text(label)),
                      StatusPill(label: '$count', color: AppColors.coral),
                    ],
                  ),
                ),
            const SizedBox(height: 6),
            Text(l.adminApproveInConsole, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
          ],
        ],
      ),
    );
  }
}

class _Stat {
  final IconData icon;
  final Color color;
  final String value;
  final String label;
  final VoidCallback? onTap;

  const _Stat(this.icon, this.color, this.value, this.label, {this.onTap});
}

class _StatTile extends StatelessWidget {
  final _Stat stat;

  const _StatTile({required this.stat});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      onTap: stat.onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconBadge(icon: stat.icon, color: stat.color, size: 34),
          const SizedBox(height: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(stat.value, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
              Text(stat.label, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
            ],
          ),
        ],
      ),
    );
  }
}
