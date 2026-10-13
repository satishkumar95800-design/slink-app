import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
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
          error: (_, __) => EmptyState(icon: Icons.cloud_off_rounded, color: AppColors.coral, message: l.homeworkCouldNotLoad),
          data: (items) {
            if (items.isEmpty) {
              return EmptyState(icon: Icons.menu_book_rounded, color: FeatureColors.homework, message: l.homeworkEmpty);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, i) {
                final r = items[i];
                final caption = r.content['caption'] as String? ?? '';
                final photos = (r.content['attachmentUrls'] as List<dynamic>?)?.cast<String>() ??
                    [if (r.content['attachmentUrl'] is String) r.content['attachmentUrl'] as String];
                final photo = photos.isEmpty ? null : photos.first;
                final subject = r.content['subject'] as String?;
                return Card(
                  margin: EdgeInsets.zero,
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
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                CachedNetworkImage(
                                  imageUrl: photo,
                                  cacheKey: Uri.tryParse(photo)?.path,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => const Center(child: Icon(Icons.broken_image_outlined)),
                                ),
                                if (photos.length > 1)
                                  Positioned(
                                    right: 10,
                                    bottom: 10,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.55),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                                        const Icon(Icons.photo_library_rounded, size: 14, color: Colors.white),
                                        const SizedBox(width: 4),
                                        Text('${photos.length}',
                                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                                      ]),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              if (photo == null) ...[
                                const IconBadge(icon: Icons.menu_book_rounded, color: FeatureColors.homework),
                                const SizedBox(width: 12),
                              ],
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (subject != null) ...[
                                      StatusPill(label: subject, color: FeatureColors.homework),
                                      const SizedBox(height: 6),
                                    ],
                                    Text(
                                      caption.isEmpty ? l.homeworkKind : caption,
                                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                                    ),
                                    Text(r.teacher.name, style: Theme.of(context).textTheme.bodySmall),
                                  ],
                                ),
                              ),
                              if (r.publishedAt != null) DateLabel(displayDate(r.publishedAt!)),
                            ],
                          ),
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
