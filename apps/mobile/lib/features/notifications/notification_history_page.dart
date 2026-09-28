import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'notifications_providers.dart';

class NotificationHistoryPage extends ConsumerWidget {
  const NotificationHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(notificationHistoryProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationHistoryProvider),
        child: historyAsync.when(
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('No notifications yet.')),
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
                  title: Text(item.title ?? (hasAttachment ? 'Homework' : 'Notice')),
                  subtitle: Text(item.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Text(_formatDate(item.createdAt)),
                  onTap: () => context.push('/notices/detail', extra: {
                    'title': item.title ?? (hasAttachment ? 'Homework' : 'Notice'),
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
              child: Text('Could not load notifications. Pull down to retry.\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dateTime) {
    final local = dateTime.toLocal();
    return '${local.day}/${local.month}/${local.year}';
  }
}
