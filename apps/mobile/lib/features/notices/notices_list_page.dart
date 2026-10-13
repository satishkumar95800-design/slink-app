import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../dashboard/students_repository.dart';
import '../home/parent_home_models.dart';
import '../home/parent_home_repository.dart';

/// Parent: class and school notices for the selected child, newest first.
class NoticesListPage extends ConsumerWidget {
  const NoticesListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = ref.watch(selectedChildIdProvider);
    if (studentId == null) {
      return const AuthenticatedScaffold(body: Center(child: CircularProgressIndicator()));
    }
    final noticesAsync = ref.watch(parentNoticesProvider(studentId));
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.menuNotices)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentNoticesProvider(studentId)),
        child: noticesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => EmptyState(icon: Icons.cloud_off_rounded, color: AppColors.coral, message: l.noticesCouldNotLoad),
          data: (notices) {
            if (notices.isEmpty) {
              return EmptyState(icon: Icons.campaign_rounded, color: FeatureColors.notices, message: l.noticesEmpty);
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: notices.length,
              itemBuilder: (context, i) {
                final n = notices[i];
                return ListCard(
                  leading: IconBadge(
                    icon: n.attachments.isEmpty ? Icons.campaign_rounded : Icons.attach_file_rounded,
                    color: FeatureColors.notices,
                    size: 48,
                  ),
                  title: n.title ?? l.noticeKind,
                  subtitle: n.body,
                  trailing: DateLabel(displayDate(n.createdAt)),
                  onTap: () => context.push('/notices/detail', extra: {
                    'title': n.title ?? l.noticeKind,
                    'body': n.body,
                    'attachments': n.attachments,
                    'broadcastId': n.broadcastId,
                  }),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
