import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
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
          error: (_, __) => ListView(children: [const SizedBox(height: 120), Center(child: Text(l.noticesCouldNotLoad))]),
          data: (notices) {
            if (notices.isEmpty) {
              return ListView(children: [const SizedBox(height: 120), Center(child: Text(l.noticesEmpty))]);
            }
            return ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notices.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final n = notices[i];
                return ListTile(
                  leading: const Icon(Icons.campaign_outlined),
                  title: Text(n.title ?? l.noticeKind),
                  subtitle: Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Text(displayDate(n.createdAt), style: Theme.of(context).textTheme.bodySmall),
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
