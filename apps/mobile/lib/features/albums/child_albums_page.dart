import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gal/gal.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'albums_models.dart';
import 'albums_repository.dart';

final _date = DateFormat('dd/MM/yyyy', 'en');
const albumColor = Color(0xFFD9467A);

/// The parent's child's photo albums: shared ones, and recently removed ones.
class ChildAlbumsPage extends ConsumerWidget {
  final String studentId;

  const ChildAlbumsPage({super.key, required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(childAlbumsProvider(studentId));
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.albumsTitle)),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(childAlbumsProvider(studentId).future),
        child: async.when(
          loading: () => ListView(padding: const EdgeInsets.all(16), children: const [LoadingBlock(height: 200), SizedBox(height: 12), LoadingBlock(height: 200)]),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(childAlbumsProvider(studentId)),
          ),
          data: (albums) => albums.isEmpty
              ? EmptyState(icon: Icons.photo_library_rounded, message: l.albumsEmptyParent, color: albumColor)
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: albums.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _AlbumCard(album: albums[i], studentId: studentId),
                ),
        ),
      ),
    );
  }
}

class _AlbumCard extends StatelessWidget {
  final ChildAlbum album;
  final String studentId;

  const _AlbumCard({required this.album, required this.studentId});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    return SoftCard(
      padding: EdgeInsets.zero,
      onTap: album.expired ? null : () => context.push('/photos/child/$studentId/${album.id}'),
      child: Opacity(
        opacity: album.expired ? 0.55 : 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: album.coverUrl == null
                    ? Container(
                        color: albumColor.withValues(alpha: 0.10),
                        child: const Icon(Icons.photo_library_rounded, size: 48, color: albumColor),
                      )
                    : CachedNetworkImage(
                        imageUrl: album.coverUrl!,
                        // The link changes each time; cache by album.
                        cacheKey: 'album-cover-${album.id}',
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(color: albumColor.withValues(alpha: 0.10)),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(album.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (album.expired)
                        StatusPill(label: l.albumsExpired, color: AppColors.muted)
                      else ...[
                        Text(l.albumsPhotoCount(album.photoCount), style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                        if (album.expiresAt != null)
                          StatusPill(label: l.albumsUntil(_date.format(album.expiresAt!)), color: AppColors.coral, icon: Icons.schedule_rounded),
                        if (album.saved) StatusPill(label: l.albumsSaved, color: FeatureColors.attendance, icon: Icons.check_rounded),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One album: a grid of thumbnails, Save all, and a full-screen viewer.
class AlbumPhotosPage extends ConsumerStatefulWidget {
  final String studentId;
  final String albumId;

  const AlbumPhotosPage({super.key, required this.studentId, required this.albumId});

  @override
  ConsumerState<AlbumPhotosPage> createState() => _AlbumPhotosPageState();
}

class _AlbumPhotosPageState extends ConsumerState<AlbumPhotosPage> {
  late Future<AlbumPhotos> _future = _load();
  ({int done, int total})? _saving;

  Future<AlbumPhotos> _load() => ref.read(albumsRepositoryProvider).photos(widget.studentId, widget.albumId);

  Future<void> _saveAll(AlbumPhotos album) async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    if (!await _ensureAccess()) {
      messenger.showSnackBar(SnackBar(content: Text(l.albumsSaveFailed)));
      return;
    }
    final repo = ref.read(albumsRepositoryProvider);
    var saved = 0;
    setState(() => _saving = (done: 0, total: album.photos.length));
    for (final p in album.photos) {
      try {
        await Gal.putImageBytes(await repo.download(p.url), album: 'Schoolinkd');
        saved++;
      } catch (_) {
        // Keep going; the count tells how many made it.
      }
      if (!mounted) return;
      setState(() => _saving = (done: _saving!.done + 1, total: album.photos.length));
    }
    setState(() => _saving = null);
    if (saved > 0) await _markSaved();
    messenger.showSnackBar(SnackBar(content: Text(saved > 0 ? l.albumsSavedAll(saved) : l.albumsSaveFailed)));
  }

  Future<void> _markSaved() async {
    try {
      await ref.read(albumsRepositoryProvider).markSaved(widget.studentId, widget.albumId);
      ref.invalidate(childAlbumsProvider(widget.studentId));
    } catch (_) {
      // Only the school's "saved by" count; never block the parent.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return FutureBuilder<AlbumPhotos>(
      future: _future,
      builder: (context, snap) {
        final album = snap.data;
        return AuthenticatedScaffold(
          appBar: AppBar(
            title: Text(album?.title ?? l.albumsTitle),
            actions: [
              if (album != null && album.photos.isNotEmpty && _saving == null)
                TextButton.icon(
                  onPressed: () => _saveAll(album),
                  icon: const Icon(Icons.download_rounded),
                  label: Text(l.albumsSaveAll),
                ),
            ],
          ),
          body: snap.hasError
              ? EmptyState(
                  icon: Icons.photo_library_rounded,
                  message: describeError(snap.error!),
                  actionLabel: l.commonRetry,
                  onAction: () => setState(() => _future = _load()),
                )
              : album == null
                  ? const Center(child: CircularProgressIndicator())
                  : Column(
                      children: [
                        if (_saving != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(l.albumsSaving(_saving!.done, _saving!.total)),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(value: _saving!.total == 0 ? null : _saving!.done / _saving!.total),
                              ],
                            ),
                          ),
                        if (album.expiresAt != null || album.description != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (album.description != null) Text(album.description!),
                                if (album.expiresAt != null)
                                  Text(
                                    l.albumsLeaveNote(_date.format(album.expiresAt!)),
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.coral, fontWeight: FontWeight.w700),
                                  ),
                              ],
                            ),
                          ),
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(12),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 6, crossAxisSpacing: 6),
                            itemCount: album.photos.length,
                            itemBuilder: (context, i) => GestureDetector(
                              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                                builder: (_) => PhotoViewerPage(photos: album.photos, initial: i, onSaved: _markSaved),
                              )),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: CachedNetworkImage(
                                  imageUrl: album.photos[i].thumbUrl,
                                  cacheKey: 'album-thumb-${album.photos[i].id}',
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(color: Theme.of(context).colorScheme.surfaceContainerHighest),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
        );
      },
    );
  }
}

Future<bool> _ensureAccess() async {
  try {
    if (await Gal.hasAccess(toAlbum: true)) return true;
    return await Gal.requestAccess(toAlbum: true);
  } catch (_) {
    return false;
  }
}

/// Full screen, swipe between photos, pinch to zoom, save the one on screen.
class PhotoViewerPage extends ConsumerStatefulWidget {
  final List<AlbumPhoto> photos;
  final int initial;
  final Future<void> Function() onSaved;

  const PhotoViewerPage({super.key, required this.photos, required this.initial, required this.onSaved});

  @override
  ConsumerState<PhotoViewerPage> createState() => _PhotoViewerPageState();
}

class _PhotoViewerPageState extends ConsumerState<PhotoViewerPage> {
  late final _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;
  bool _busy = false;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      if (!await _ensureAccess()) throw Exception('no access');
      final bytes = await ref.read(albumsRepositoryProvider).download(widget.photos[_index].url);
      await Gal.putImageBytes(bytes, album: 'Schoolinkd');
      await widget.onSaved();
      messenger.showSnackBar(SnackBar(content: Text(l.albumsSavedOne)));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.albumsSaveFailed)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_index + 1} / ${widget.photos.length}'),
        actions: [
          IconButton(
            tooltip: l.albumsSaveOne,
            onPressed: _busy ? null : _save,
            icon: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.download_rounded),
          ),
        ],
      ),
      body: PageView.builder(
        controller: _pages,
        itemCount: widget.photos.length,
        onPageChanged: (i) => setState(() => _index = i),
        itemBuilder: (_, i) => InteractiveViewer(
          maxScale: 4,
          child: Center(
            child: CachedNetworkImage(
              imageUrl: widget.photos[i].url,
              cacheKey: 'album-photo-${widget.photos[i].id}',
              fit: BoxFit.contain,
              placeholder: (_, __) => CachedNetworkImage(
                imageUrl: widget.photos[i].thumbUrl,
                cacheKey: 'album-thumb-${widget.photos[i].id}',
                fit: BoxFit.contain,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
