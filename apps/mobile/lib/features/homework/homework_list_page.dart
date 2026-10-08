import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/strings.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../home/parent_home_models.dart';
import '../reports/reports_providers.dart';

/// Parent: all homework sent to the selected child's class, newest first.
class HomeworkListPage extends ConsumerWidget {
  const HomeworkListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text(AppStrings.menuHomework)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(homeworkProvider),
        child: homeworkAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => ListView(children: const [SizedBox(height: 120), Center(child: Text(AppStrings.couldNotLoad))]),
          data: (items) {
            if (items.isEmpty) {
              return ListView(children: const [SizedBox(height: 120), Center(child: Text(AppStrings.noHomework))]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final r = items[i];
                final caption = r.content['caption'] as String? ?? '';
                final photo = r.content['attachmentUrl'] as String?;
                final subject = r.content['subject'] as String?;
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/notices/detail', extra: {
                      'title': AppStrings.menuHomework,
                      'body': caption,
                      'attachmentUrl': photo,
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
                          title: Text(caption.isEmpty ? AppStrings.menuHomework : caption),
                          subtitle: Text([
                            AppStrings.homeworkBy(r.teacher.name, subject),
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
