import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../auth/session_controller.dart';
import '../../shared/models/active_user.dart';
import '../classes/classes_repository.dart';
import 'albums_models.dart';
import 'albums_repository.dart';
import 'child_albums_page.dart' show albumColor, saveAllToGallery;

final _date = DateFormat('dd/MM/yyyy', 'en');

/// A teacher's photo albums: those made for parents, and the staff folder
/// (teachers and office staff only, never parents).
class StaffAlbumsPage extends ConsumerStatefulWidget {
  const StaffAlbumsPage({super.key});

  @override
  ConsumerState<StaffAlbumsPage> createState() => _StaffAlbumsPageState();
}

class _StaffAlbumsPageState extends ConsumerState<StaffAlbumsPage> with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: 2, vsync: this)..addListener(() => setState(() {}));

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  bool get _staff => _tabs.index == 1;

  Future<void> _create() async {
    final album = await showModalBottomSheet<StaffAlbum>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _NewAlbumSheet(forStaff: _staff),
    );
    if (album == null || !mounted) return;
    ref.invalidate(myAlbumsProvider);
    context.push('/albums/${album.id}');
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final async = ref.watch(myAlbumsProvider);
    // Accounts only see the staff folder; they don't make albums.
    final canCreate = ref.watch(sessionControllerProvider).user?.role != UserRole.accounts;
    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(l.albumsTitle),
        actions: [
          if (canCreate)
            TextButton.icon(
              onPressed: _create,
              icon: const Icon(Icons.add_photo_alternate_rounded),
              label: Text(_staff ? l.albumsNewStaff : l.albumsNew),
            ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: [Tab(text: l.albumsFolderParents), Tab(text: l.albumsFolderStaff)],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myAlbumsProvider.future),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => EmptyState(icon: Icons.cloud_off_rounded, message: describeError(e), actionLabel: l.commonRetry, onAction: () => ref.invalidate(myAlbumsProvider)),
          data: (all) {
            final albums = all.where((a) => a.forStaff == _staff).toList();
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_staff) ...[
                  Text(l.albumsStaffHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                  const SizedBox(height: 12),
                ],
                if (albums.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 48),
                    child: EmptyState(
                      icon: Icons.photo_library_rounded,
                      message: _staff ? l.albumsEmptyStaffFolder : l.albumsEmptyStaff,
                      color: albumColor,
                    ),
                  )
                else
                  for (final a in albums) ...[_AlbumTile(album: a), const SizedBox(height: 10)],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AlbumTile extends StatelessWidget {
  final StaffAlbum album;

  const _AlbumTile({required this.album});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final a = album;
    return SoftCard(
      onTap: () => context.push('/albums/${a.id}'),
      child: Row(
        children: [
          IconBadge(icon: a.forStaff ? Icons.badge_rounded : Icons.photo_library_rounded, color: albumColor),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(a.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _StatusPill(album: a),
                    Text(l.albumsPhotoCount(a.photoCount), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final StaffAlbum album;

  const _StatusPill({required this.album});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (album.isDraft) return StatusPill(label: l.albumsStatusDraft, color: AppColors.muted);
    if (album.isLive) {
      return StatusPill(
        label: album.expiresAt == null ? l.albumsStatusLive : l.albumsUntil(_date.format(album.expiresAt!)),
        color: FeatureColors.attendance,
      );
    }
    return StatusPill(label: l.albumsExpired, color: AppColors.coral);
  }
}

/// Name the album and pick the classes it is for.
class _NewAlbumSheet extends ConsumerStatefulWidget {
  /// The staff folder: no classes to pick.
  final bool forStaff;

  const _NewAlbumSheet({required this.forStaff});

  @override
  ConsumerState<_NewAlbumSheet> createState() => _NewAlbumSheetState();
}

class _NewAlbumSheetState extends ConsumerState<_NewAlbumSheet> {
  final _title = TextEditingController();
  final _classIds = <String>{};
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final album = await ref.read(albumsRepositoryProvider).create(_title.text.trim(), _classIds.toList(), forStaff: widget.forStaff);
      if (mounted) Navigator.of(context).pop(album);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeError(e))));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final classes = ref.watch(myClassesProvider);
    final ok = _title.text.trim().isNotEmpty && (widget.forStaff || _classIds.isNotEmpty);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.forStaff ? l.albumsNewStaff : l.albumsNew, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            maxLength: 120,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(labelText: l.albumsName, hintText: l.albumsNameHint),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          if (widget.forStaff)
            Text(l.albumsStaffHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted))
          else ...[
          Text(l.albumsShareWith, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          classes.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(describeError(e)),
            data: (list) => Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in list)
                  FilterChip(
                    label: Text([c.name, if (c.section != null) c.section!].join(' ')),
                    selected: _classIds.contains(c.id),
                    onSelected: (on) => setState(() => on ? _classIds.add(c.id) : _classIds.remove(c.id)),
                  ),
              ],
            ),
          ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: ok && !_busy ? _save : null,
            child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.albumsCreate),
          ),
        ],
      ),
    );
  }
}

/// One album: add photos from the phone, remove them, share with parents.
class StaffAlbumPage extends ConsumerStatefulWidget {
  final String albumId;

  const StaffAlbumPage({super.key, required this.albumId});

  @override
  ConsumerState<StaffAlbumPage> createState() => _StaffAlbumPageState();
}

class _StaffAlbumPageState extends ConsumerState<StaffAlbumPage> {
  StaffAlbum? _album;
  Object? _error;
  ({int done, int total, int failed})? _upload;
  ({int done, int total})? _saving;
  bool _busy = false;

  Future<void> _saveAll() async {
    final album = _album!;
    final repo = ref.read(albumsRepositoryProvider);
    await saveAllToGallery(
      context,
      repo,
      album.photos,
      onProgress: (done, total) => setState(() => _saving = (done: done, total: total)),
      onSaved: () => repo.markSavedByStaff(album.id),
    );
    if (mounted) setState(() => _saving = null);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final a = await ref.read(albumsRepositoryProvider).detail(widget.albumId);
      if (mounted) {
        setState(() {
          _album = a;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// A small PNG made on the phone for the parents' grid (longer side 400 px).
  static Future<({Uint8List bytes, int width, int height})> _thumbOf(Uint8List photo) async {
    final buffer = await ui.ImmutableBuffer.fromUint8List(photo);
    final desc = await ui.ImageDescriptor.encoded(buffer);
    final landscape = desc.width >= desc.height;
    final codec = await desc.instantiateCodec(targetWidth: landscape ? 400 : null, targetHeight: landscape ? null : 400);
    final frame = await codec.getNextFrame();
    final data = await frame.image.toByteData(format: ui.ImageByteFormat.png);
    final out = (bytes: data!.buffer.asUint8List(), width: desc.width, height: desc.height);
    frame.image.dispose();
    codec.dispose();
    desc.dispose();
    buffer.dispose();
    return out;
  }

  Future<void> _addPhotos() async {
    final album = _album!;
    final room = album.maxPhotos - album.photos.length;
    // Resized on the phone: about 1600 px JPEG, 300-500 KB each.
    final picked = await ImagePicker().pickMultiImage(maxWidth: 1600, maxHeight: 1600, imageQuality: 82, limit: room > 1 ? room : null);
    if (picked.isEmpty || !mounted) return;
    final files = picked.take(room).toList();
    final repo = ref.read(albumsRepositoryProvider);
    var failed = 0;
    setState(() => _upload = (done: 0, total: files.length, failed: 0));
    for (final f in files) {
      try {
        final thumb = await _thumbOf(await f.readAsBytes());
        await repo.addPhoto(album.id, f.path, thumb.bytes, width: thumb.width, height: thumb.height);
      } catch (_) {
        failed++;
      }
      if (!mounted) return;
      setState(() => _upload = (done: _upload!.done + 1, total: files.length, failed: failed));
    }
    final l = context.l10n;
    setState(() => _upload = null);
    if (failed > 0) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.albumsUploadFailed(failed))));
    await _load();
    ref.invalidate(myAlbumsProvider);
  }

  Future<void> _remove(AlbumPhoto p) async {
    try {
      await ref.read(albumsRepositoryProvider).removePhoto(widget.albumId, p.id);
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeError(e))));
    }
  }

  Future<void> _publish() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(l.albumsPublishTitle),
        content: Text(_album!.forStaff ? l.albumsPublishStaffBody : l.albumsPublishBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(l.commonCancel)),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(l.albumsPublish)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(albumsRepositoryProvider).publish(widget.albumId);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.albumsPublished)));
      await _load();
      ref.invalidate(myAlbumsProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeError(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final album = _album;
    if (album == null) {
      return AuthenticatedScaffold(
        appBar: AppBar(title: Text(l.albumsTitle)),
        body: _error != null
            ? EmptyState(icon: Icons.cloud_off_rounded, message: describeError(_error!), actionLabel: l.commonRetry, onAction: _load)
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final manage = album.canManage;
    final canAdd = manage && album.status != 'expired' && album.photos.length < album.maxPhotos && _upload == null;
    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(album.title),
        actions: [
          // Anyone who can see a shared album can keep its photos.
          if (album.isLive && album.photos.isNotEmpty && _saving == null)
            TextButton.icon(
              onPressed: _saveAll,
              icon: const Icon(Icons.download_rounded),
              label: Text(l.albumsSaveAll),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [_StatusPill(album: album)]),
                const SizedBox(height: 8),
                if (album.forStaff) ...[
                  Text(l.albumsStaffHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                  const SizedBox(height: 6),
                ],
                if (_saving != null) ...[
                  Text(l.albumsSaving(_saving!.done, _saving!.total)),
                  const SizedBox(height: 6),
                  LinearProgressIndicator(value: _saving!.total == 0 ? null : _saving!.done / _saving!.total),
                  const SizedBox(height: 6),
                ],
                if (album.isLive)
                  Text(album.forStaff
                      ? l.albumsSavedByStaff(album.savedCount, album.recipientCount)
                      : l.albumsSavedBy(album.savedCount, album.recipientCount))
                else if (album.isDraft)
                  Text(l.albumsDraftNoPhotos, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                if (album.isDraft && manage) ...[
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: album.photos.isEmpty || _busy || _upload != null ? null : _publish,
                    icon: const Icon(Icons.send_rounded),
                    label: Text(l.albumsPublish),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: Text(l.albumsLimit(album.photos.length, album.maxPhotos), style: const TextStyle(fontWeight: FontWeight.w800))),
              if (manage)
                OutlinedButton.icon(
                  onPressed: canAdd ? _addPhotos : null,
                  icon: const Icon(Icons.add_photo_alternate_rounded),
                  label: Text(l.albumsAddPhotos),
                ),
            ],
          ),
          if (_upload != null) ...[
            const SizedBox(height: 12),
            Text(l.albumsUploading(_upload!.done, _upload!.total)),
            const SizedBox(height: 6),
            LinearProgressIndicator(value: _upload!.total == 0 ? null : _upload!.done / _upload!.total),
          ],
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 6, crossAxisSpacing: 6),
            itemCount: album.photos.length,
            itemBuilder: (context, i) {
              final p = album.photos[i];
              return Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: CachedNetworkImage(imageUrl: p.thumbUrl, cacheKey: 'album-thumb-${p.id}', fit: BoxFit.cover),
                  ),
                  if (manage && album.status != 'expired')
                    Positioned(
                      top: 2,
                      right: 2,
                      child: IconButton.filledTonal(
                        visualDensity: VisualDensity.compact,
                        tooltip: l.albumsRemovePhoto,
                        onPressed: () => _remove(p),
                        icon: const Icon(Icons.close_rounded, size: 16),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
