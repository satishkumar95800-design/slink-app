import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
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
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(child: Text(l.notificationsEmpty)),
                  ),
                ],
              );
            }
            return ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final hasAttachment = item.attachmentUrl != null && item.attachmentUrl!.isNotEmpty;
                return ListTile(
                  leading: CircleAvatar(child: Icon(hasAttachment ? Icons.assignment : Icons.campaign_outlined)),
                  title: Text(item.title ?? (hasAttachment ? l.homeworkKind : l.noticeKind)),
                  subtitle: Text(item.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Text(displayDate(item.createdAt)),
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
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('${l.notificationsCouldNotLoad}\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}
