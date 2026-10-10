import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../home/parent_home_models.dart';
import '../reports/reports_providers.dart';

/// Parent: all homework sent to the selected child's class, newest first.
class HomeworkListPage extends ConsumerWidget {
  const HomeworkListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkProvider);
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.menuHomework)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(homeworkProvider),
        child: homeworkAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => ListView(children: [const SizedBox(height: 120), Center(child: Text(l.homeworkCouldNotLoad))]),
          data: (items) {
            if (items.isEmpty) {
              return ListView(children: [const SizedBox(height: 120), Center(child: Text(l.homeworkEmpty))]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final r = items[i];
                final caption = r.content['caption'] as String? ?? '';
                final photos = (r.content['attachmentUrls'] as List<dynamic>?)?.cast<String>() ??
                    [if (r.content['attachmentUrl'] is String) r.content['attachmentUrl'] as String];
                final photo = photos.isEmpty ? null : photos.first;
                final subject = r.content['subject'] as String?;
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/notices/detail', extra: {
                      'title': l.homeworkKind,
                      'body': caption,
                      'attachments': photos,
                      'broadcastId': r.content['broadcastId'],
                    }),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (photo != null)
                          AspectRatio(
                            aspectRatio: 16 / 9,
                            child: CachedNetworkImage(
                              imageUrl: photo,
                              cacheKey: Uri.tryParse(photo)?.path,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => const Center(child: Icon(Icons.broken_image_outlined)),
                            ),
                          ),
                        ListTile(
                          title: Text(caption.isEmpty ? l.homeworkKind : caption),
                          subtitle: Text([
                            subject == null ? r.teacher.name : l.homeworkBy(r.teacher.name, subject),
                            if (r.publishedAt != null) displayDate(r.publishedAt!),
                          ].join(' · ')),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
