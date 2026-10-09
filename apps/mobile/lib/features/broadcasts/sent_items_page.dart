import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/strings.dart';
import '../../shared/services/broadcast_repository.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../home/parent_home_models.dart';

/// Teacher: notices and homework they've sent, each with "Seen by X/Y parents".
class SentItemsPage extends ConsumerWidget {
  const SentItemsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(sentItemsProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text(AppStrings.sentItems)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(sentItemsProvider),
        child: itemsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => ListView(children: const [SizedBox(height: 120), Center(child: Text(AppStrings.couldNotLoad))]),
          data: (items) {
            if (items.isEmpty) {
              return ListView(children: const [SizedBox(height: 120), Center(child: Text(AppStrings.noSentItems))]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _SentCard(item: items[i]),
            );
          },
        ),
      ),
    );
  }
}

class _SentCard extends StatelessWidget {
  final SentItem item;

  const _SentCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ratio = item.recipients == 0 ? 0.0 : item.seen / item.recipients;
    final meta = [
      item.kind == BroadcastKind.homework ? AppStrings.homeworkKind : AppStrings.noticeKind,
      if (item.classLabel != null) item.classLabel!,
      if (item.subject != null) item.subject!,
      displayDate(item.createdAt),
    ].join(' · ');

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (_) => _UnseenSheet(item: item),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(meta, style: theme.textTheme.labelMedium),
              const SizedBox(height: 4),
              Text(
                (item.title?.isNotEmpty ?? false) ? '${item.title}: ${item.body}' : item.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(value: ratio, minHeight: 6),
              ),
              const SizedBox(height: 6),
              Text(AppStrings.seenBy(item.seen, item.recipients), style: theme.textTheme.titleSmall),
            ],
          ),
        ),
      ),
    );
  }
}

final _unseenProvider = FutureProvider.autoDispose.family<List<UnseenParent>, String>((ref, id) {
  return ref.watch(broadcastRepositoryProvider).getUnseen(id);
});

class _UnseenSheet extends ConsumerWidget {
  final SentItem item;

  const _UnseenSheet({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unseenAsync = ref.watch(_unseenProvider(item.id));
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ListTile(
              title: Text(AppStrings.notSeenYet, style: Theme.of(context).textTheme.titleMedium),
              subtitle: Text(AppStrings.seenBy(item.seen, item.recipients)),
            ),
            const Divider(height: 1),
            Flexible(
              child: unseenAsync.when(
                loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                error: (_, __) => const Padding(padding: EdgeInsets.all(24), child: Text(AppStrings.couldNotLoad)),
                data: (parents) => parents.isEmpty
                    ? const Padding(padding: EdgeInsets.all(24), child: Text(AppStrings.everyoneSeen))
                    : ListView(
                        shrinkWrap: true,
                        children: [
                          for (final p in parents)
                            ListTile(
                              leading: const Icon(Icons.person_outline),
                              title: Text(p.name),
                              subtitle: Text([if (p.children.isNotEmpty) p.children.join(', '), if (p.phone != null) p.phone!].join(' · ')),
                            ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
