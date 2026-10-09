import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/active_user.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../auth/session_controller.dart';
import '../classes/classes_repository.dart';
import 'students_repository.dart';
import 'today_strip.dart';
import '../home/parent_home_body.dart';
import '../../core/strings.dart';
import '../attendance/attendance_outbox.dart';
import '../attendance/attendance_repository.dart';
import '../attendance/attendance_status_colors.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final user = session.user;
    final isTeacher = user?.role == UserRole.teacher;

    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(user != null ? 'Hi, ${user.name}' : AppStrings.appName),
        actions: [
          if (user != null)
            IconButton(
              icon: const Icon(Icons.person_outline),
              tooltip: 'Profile',
              onPressed: () => context.push('/profile'),
            ),
        ],
      ),
      body: isTeacher
          ? _TeacherDashboardBody(user: user!)
          : _ParentDashboardBody(user: user),
    );
  }
}

class _ParentDashboardBody extends ConsumerWidget {
  final ActiveUser? user;

  const _ParentDashboardBody({required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(myChildrenProvider);

    return childrenAsync.when(
      data: (children) {
        if (children.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                "No children are linked to your account yet. Please contact the school office.",
                textAlign: TextAlign.center,
              ),
            ),
          );
        }
        return ParentHomeBody(children: children);
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Could not load your children.\n$error',
              textAlign: TextAlign.center),
        ),
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
    final isClassTeacherOfAny =
        classesAsync.valueOrNull?.any((c) => c.isClassTeacherFor(user.id)) ??
            false;
    final hasAnyClass = classesAsync.valueOrNull?.isNotEmpty ?? false;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(teacherTodayProvider);
        ref.invalidate(myAttendanceClassesProvider);
        ref.invalidate(myClassesProvider);
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Teacher dashboard',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('Signed in as ${user.name}',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 24),
            const TodayStrip(),
            const _MarkAttendanceCard(),
            if (hasAnyClass) ...[
              _NavCard(
                icon: Icons.camera_alt_outlined,
                title: AppStrings.sendHomework,
                subtitle: AppStrings.sendHomeworkSubtitle,
                onTap: () => context.push('/homework/send'),
              ),
              const SizedBox(height: 12),
            ],
            if (isClassTeacherOfAny) ...[
              _NavCard(
                icon: Icons.campaign_outlined,
                title: AppStrings.sendNotice,
                subtitle: AppStrings.sendNoticeSubtitle,
                onTap: () => context.push('/notices/send'),
              ),
              const SizedBox(height: 12),
            ],
            _NavCard(
              icon: Icons.assignment,
              title: AppStrings.reportsCard,
              subtitle: AppStrings.reportsCardSubtitle,
              onTap: () => context.push('/dashboard/reports'),
            ),
            const SizedBox(height: 12),
            if (hasAnyClass) ...[
              _NavCard(
                icon: Icons.sticky_note_2_outlined,
                title: AppStrings.addStudentNote,
                subtitle: AppStrings.addStudentNoteSubtitle,
                onTap: () => context.push('/student-notes/add'),
              ),
              const SizedBox(height: 12),
            ],
            _NavCard(
              icon: Icons.calendar_view_week,
              title: AppStrings.weeklyRoutine,
              subtitle: AppStrings.weeklyRoutineSubtitle,
              onTap: () => context.push('/dashboard/routine'),
            ),
            const SizedBox(height: 12),
            _NavCard(
              icon: Icons.groups_outlined,
              title: AppStrings.aboutMyClasses,
              subtitle: AppStrings.aboutMyClassesSubtitle,
              onTap: () => context.push('/dashboard/my-classes'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _NavCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, size: 32),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
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
    final waiting = ref
        .watch(attendanceOutboxProvider)
        .any((p) => p.rejectedReason == null);
    final data = classesAsync.valueOrNull;
    if (data == null && !classesAsync.isLoading) return const SizedBox.shrink();
    if (data != null && data.classes.isEmpty) return const SizedBox.shrink();

    final done = data?.allDone ?? false;
    final String subtitle;
    if (waiting) {
      subtitle = AppStrings.pendingSend;
    } else if (data?.holidayName != null) {
      subtitle = AppStrings.holidayToday(data!.holidayName!);
    } else if (done) {
      subtitle = AppStrings.doneForToday;
    } else if (data != null && data.classes.length > 1 && data.doneCount > 0) {
      subtitle = AppStrings.doneForClasses(data.doneCount, data.classes.length);
    } else {
      subtitle = AppStrings.markAttendanceSubtitle;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: ListTile(
          minVerticalPadding: 16,
          leading: Icon(
            done ? Icons.check_circle : Icons.fact_check_outlined,
            size: 32,
            color: done ? AttendanceColors.present : null,
          ),
          title: Text(AppStrings.markAttendance,
              style: Theme.of(context).textTheme.titleMedium),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            await context.push('/attendance/mark');
            ref.invalidate(myAttendanceClassesProvider);
          },
        ),
      ),
    );
  }
}
