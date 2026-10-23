import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/active_user.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../auth/session_controller.dart';
import '../classes/classes_repository.dart';
import 'home_header.dart';
import 'students_repository.dart';
import 'today_strip.dart';
import '../home/parent_home_body.dart';
import '../../core/l10n/l10n.dart';
import '../attendance/attendance_outbox.dart';
import '../attendance/attendance_repository.dart';
import '../../shared/services/ai_repository.dart';
import '../../shared/services/branding_repository.dart';
import '../admin_home/admin_home_body.dart';
import '../driver/driver_home_body.dart';

const _overlap = 36.0;

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).user;
    return AuthenticatedScaffold(
      appBar: statusBarOnly(context),
      body: switch (user?.role) {
        UserRole.teacher => _TeacherDashboardBody(user: user!),
        // The admin's phone: today at a glance; details stay in the console.
        UserRole.admin => AdminHomeBody(user: user!),
        UserRole.driver => DriverHomeBody(user: user!),
        // Office staff use the app for their own leave, payslips and the
        // calendar; they run the school from the console.
        UserRole.accounts || UserRole.superAdmin => _StaffDashboardBody(user: user!),
        UserRole.librarian || UserRole.receptionist => _ConsoleOnlyBody(user: user!),
        _ => _ParentDashboardBody(user: user),
      },
    );
  }
}

/// Home for admin and accounts staff: their own HR self-service and the
/// school calendar and documents, with a pointer to the console.
class _StaffDashboardBody extends ConsumerWidget {
  final ActiveUser user;

  const _StaffDashboardBody({required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        HeroHeader(overlap: _overlap, child: HomeHeader(name: user.name)),
        OverlapUp(
          by: _overlap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SoftCard(
                  child: Row(
                    children: [
                      const IconBadge(icon: Icons.desktop_windows_rounded, color: FeatureColors.classes),
                      const SizedBox(width: 14),
                      Expanded(child: Text(l.staffHomeConsoleHint, style: Theme.of(context).textTheme.bodyMedium)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FeatureGrid(tiles: [
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
                  if (ref.watch(staffDocumentsEnabledProvider))
                    FeatureTile(
                      icon: Icons.folder_shared_rounded,
                      label: l.staffDocsTitle,
                      color: FeatureColors.documents,
                      onTap: () => context.push('/staff-docs'),
                    ),
                  FeatureTile(
                    icon: Icons.notifications_rounded,
                    label: l.notificationsTitle,
                    color: FeatureColors.notifications,
                    onTap: () => context.push('/dashboard/notifications'),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Librarians and receptionists work in the console; the app only says so.
class _ConsoleOnlyBody extends StatelessWidget {
  final ActiveUser user;

  const _ConsoleOnlyBody({required this.user});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        HeroHeader(child: HomeHeader(name: user.name)),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 24),
              const IconBadge(icon: Icons.desktop_windows_rounded, color: FeatureColors.classes, size: 84),
              const SizedBox(height: 20),
              Text(l.consoleOnlyMessage, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            ],
          ),
        ),
      ],
    );
  }
}

class _ParentDashboardBody extends ConsumerWidget {
  final ActiveUser? user;

  const _ParentDashboardBody({required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(myChildrenProvider);
    final name = user?.name ?? '';
    final l = context.l10n;

    // Header plus a message, for the states before there's a child to show.
    Widget withHeader(Widget below) => ListView(
          padding: EdgeInsets.zero,
          children: [
            HeroHeader(child: HomeHeader(name: name)),
            Padding(padding: const EdgeInsets.all(24), child: below),
          ],
        );

    return childrenAsync.when(
      data: (children) {
        if (children.isEmpty) {
          return withHeader(Column(
            children: [
              const SizedBox(height: 32),
              const IconBadge(icon: Icons.family_restroom_rounded, color: AppColors.coral, size: 84),
              const SizedBox(height: 20),
              Text(l.dashboardNoChildren, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            ],
          ));
        }
        return ParentHomeBody(children: children, userName: name);
      },
      loading: () => withHeader(const Column(children: [
        LoadingBlock(height: 150),
        SizedBox(height: 16),
        LoadingBlock(height: 220),
      ])),
      error: (error, _) => withHeader(
        Text('${l.dashboardCouldNotLoadChildren}\n${describeError(error)}', textAlign: TextAlign.center),
      ),
    );
  }
}

class _TeacherDashboardBody extends ConsumerWidget {
  final ActiveUser user;

  const _TeacherDashboardBody({required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(myClassesProvider);
    final isClassTeacherOfAny = classesAsync.valueOrNull?.any((c) => c.isClassTeacherFor(user.id)) ?? false;
    final hasAnyClass = classesAsync.valueOrNull?.isNotEmpty ?? false;
    final aiAvailable = ref.watch(aiAvailableProvider).valueOrNull ?? false;
    final l = context.l10n;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(teacherTodayProvider);
        ref.invalidate(myAttendanceClassesProvider);
        ref.invalidate(myClassesProvider);
      },
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeroHeader(
            overlap: _overlap,
            child: HomeHeader(name: user.name, bottom: const TodayStrip()),
          ),
          OverlapUp(
            by: _overlap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _MarkAttendanceCard(),
                  FeatureGrid(tiles: [
                    // Premium: pattern warnings for the teacher's own students.
                    if (aiAvailable)
                      FeatureTile(
                        icon: Icons.auto_awesome_rounded,
                        label: l.insightsTitle,
                        color: FeatureColors.reports,
                        onTap: () => context.push('/dashboard/insights'),
                      ),
                    if (hasAnyClass)
                      FeatureTile(
                        icon: Icons.photo_camera_rounded,
                        label: l.teacherSendHomework,
                        color: FeatureColors.homework,
                        onTap: () => context.push('/homework/send'),
                      ),
                    if (isClassTeacherOfAny)
                      FeatureTile(
                        icon: Icons.campaign_rounded,
                        label: l.teacherSendNotice,
                        color: FeatureColors.notices,
                        onTap: () => context.push('/notices/send'),
                      ),
                    FeatureTile(
                      icon: Icons.insights_rounded,
                      label: l.teacherReports,
                      color: FeatureColors.reports,
                      onTap: () => context.push('/dashboard/reports'),
                    ),
                    FeatureTile(
                      icon: Icons.upload_file_rounded,
                      label: l.uploadTitle,
                      color: FeatureColors.reports,
                      onTap: () => context.push('/reports/upload'),
                    ),
                    if (hasAnyClass)
                      FeatureTile(
                        icon: Icons.sticky_note_2_rounded,
                        label: l.teacherAddStudentNote,
                        color: FeatureColors.notes,
                        onTap: () => context.push('/student-notes/add'),
                      ),
                    if (ref.watch(timetableEnabledProvider))
                      FeatureTile(
                        icon: Icons.calendar_view_week_rounded,
                        label: l.teacherWeeklyRoutine,
                        color: FeatureColors.timetable,
                        onTap: () => context.push('/dashboard/routine'),
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
                    if (ref.watch(syllabusEnabledProvider))
                      FeatureTile(
                        icon: Icons.checklist_rounded,
                        label: l.syllabusTitle,
                        color: FeatureColors.syllabus,
                        onTap: () => context.push('/syllabus'),
                      ),
                    if (ref.watch(photoAlbumsEnabledProvider))
                      FeatureTile(
                        icon: Icons.photo_library_rounded,
                        label: l.albumsTitle,
                        color: FeatureColors.notifications,
                        onTap: () => context.push('/albums'),
                      ),
                    if (ref.watch(staffDocumentsEnabledProvider))
                      FeatureTile(
                        icon: Icons.folder_shared_rounded,
                        label: l.staffDocsTitle,
                        color: FeatureColors.documents,
                        onTap: () => context.push('/staff-docs'),
                      ),
                    FeatureTile(
                      icon: Icons.groups_rounded,
                      label: l.teacherAboutMyClasses,
                      color: FeatureColors.classes,
                      onTap: () => context.push('/dashboard/my-classes'),
                    ),
                    if (hasAnyClass)
                      FeatureTile(
                        icon: Icons.outbox_rounded,
                        label: l.sentTitle,
                        color: FeatureColors.sent,
                        onTap: () => context.push('/broadcasts/sent'),
                      ),
                    FeatureTile(
                      icon: Icons.notifications_rounded,
                      label: l.notificationsTitle,
                      color: FeatureColors.notifications,
                      onTap: () => context.push('/dashboard/notifications'),
                    ),
                  ]),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// First teacher card: today's attendance, ticked once every class is submitted.
/// Hidden when the teacher has no class to mark. Watching the outbox also
/// starts its retry loop for anything queued offline.
class _MarkAttendanceCard extends ConsumerWidget {
  const _MarkAttendanceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(myAttendanceClassesProvider);
    final waiting = ref.watch(attendanceOutboxProvider).any((p) => p.rejectedReason == null);
    final data = classesAsync.valueOrNull;
    if (data == null && !classesAsync.isLoading) return const SizedBox.shrink();
    if (data != null && data.classes.isEmpty) return const SizedBox.shrink();

    final done = data?.allDone ?? false;
    final l = context.l10n;
    final theme = Theme.of(context);
    final String subtitle;
    if (waiting) {
      subtitle = l.attendancePendingSend;
    } else if (data?.holidayName != null) {
      subtitle = l.attendanceHolidayToday(data!.holidayName!);
    } else if (done) {
      subtitle = l.attendanceDoneForToday;
    } else if (data != null && data.classes.length > 1 && data.doneCount > 0) {
      subtitle = l.attendanceDoneForClasses(data.doneCount, data.classes.length);
    } else {
      subtitle = l.attendanceMarkSubtitle;
    }
    final showProgress = data != null && data.classes.length > 1 && data.holidayName == null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: SoftCard(
        onTap: () async {
          await context.push('/attendance/mark');
          ref.invalidate(myAttendanceClassesProvider);
        },
        child: Row(
          children: [
            IconBadge(
              icon: done ? Icons.check_circle_rounded : Icons.fact_check_rounded,
              color: FeatureColors.attendance,
              size: 56,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.attendanceMark, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: theme.textTheme.bodySmall),
                  if (showProgress) ...[
                    const SizedBox(height: 10),
                    RoundedBar(
                      value: data.doneCount / data.classes.length,
                      color: FeatureColors.attendance,
                      height: 8,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (done)
              const Icon(Icons.chevron_right_rounded)
            else
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(color: AppColors.coral, shape: BoxShape.circle),
                child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
              ),
          ],
        ),
      ),
    );
  }
}
