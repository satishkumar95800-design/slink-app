import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../home/parent_home_models.dart';
import 'notifications_providers.dart';

class NotificationHistoryPage extends ConsumerWidget {
  const NotificationHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(notificationHistoryProvider);
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.notificationsTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationHistoryProvider),
        child: historyAsync.when(
          data: (items) {
            if (items.isEmpty) {
              return EmptyState(
                icon: Icons.notifications_none_rounded,
                color: FeatureColors.notifications,
                message: l.notificationsEmpty,
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final hasAttachment = item.attachmentUrl != null && item.attachmentUrl!.isNotEmpty;
                return ListCard(
                  leading: IconBadge(
                    icon: hasAttachment ? Icons.menu_book_rounded : Icons.campaign_rounded,
                    color: hasAttachment ? FeatureColors.homework : FeatureColors.notices,
                    size: 48,
                  ),
                  title: item.title ?? (hasAttachment ? l.homeworkKind : l.noticeKind),
                  subtitle: item.body,
                  trailing: DateLabel(displayDate(item.createdAt)),
                  onTap: () => context.push('/notices/detail', extra: {
                    'title': item.title ?? (hasAttachment ? l.homeworkKind : l.noticeKind),
                    'body': item.body,
                    'attachmentUrl': item.attachmentUrl,
                  }),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            color: AppColors.coral,
            message: l.notificationsCouldNotLoad,
          ),
        ),
      ),
    );
  }
}
