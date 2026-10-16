import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'staff_docs_models.dart';
import 'staff_docs_repository.dart';

/// Asks for a folder name; null when cancelled.
Future<String?> _askFolderName(BuildContext context, {String initial = ''}) {
  final l = context.l10n;
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(initial.isEmpty ? l.staffDocsNewFolder : l.staffDocsRenameFolder),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 80,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(labelText: l.staffDocsFolderName, hintText: l.staffDocsFolderNameHint),
        onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.commonCancel)),
        FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: Text(l.staffDocsSave)),
      ],
    ),
  ).then((v) => (v == null || v.isEmpty) ? null : v);
}

Future<bool> _confirm(BuildContext context, String message, String action) async {
  final l = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(action)),
      ],
    ),
  );
  return ok == true;
}

/// Folders shared by all staff of the school. Anyone can add a folder.
class StaffDocsPage extends ConsumerWidget {
  const StaffDocsPage({super.key});

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final name = await _askFolderName(context);
    if (name == null) return;
    try {
      await ref.read(staffDocsRepositoryProvider).createFolder(name);
      ref.invalidate(staffFoldersProvider);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(describeError(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(staffFoldersProvider);
    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(l.staffDocsTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.create_new_folder_rounded),
            tooltip: l.staffDocsNewFolder,
            onPressed: () => _create(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(staffFoldersProvider.future),
        child: async.when(
          loading: () => ListView(padding: const EdgeInsets.all(16), children: const [LoadingBlock(height: 72), SizedBox(height: 10), LoadingBlock(height: 72)]),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(staffFoldersProvider),
          ),
          data: (folders) {
            if (folders.isEmpty) {
              return EmptyState(
                icon: Icons.folder_open_rounded,
                message: l.staffDocsNoFolders,
                color: FeatureColors.documents,
                actionLabel: l.staffDocsNewFolder,
                onAction: () => _create(context, ref),
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(l.staffDocsIntro, style: Theme.of(context).textTheme.bodySmall),
                ),
                for (final f in folders)
                  ListCard(
                    leading: const IconBadge(icon: Icons.folder_rounded, color: FeatureColors.documents, size: 44),
                    title: f.name,
                    subtitle: [
                      l.staffDocsFileCount(f.fileCount),
                      if (f.createdBy != null) l.staffDocsCreatedBy(f.createdBy!),
                    ].join(' · '),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => StaffFolderPage(folderId: f.id, name: f.name),
                    )),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// One folder's files: download any, upload new ones, delete your own.
class StaffFolderPage extends ConsumerStatefulWidget {
  final String folderId;
  final String name;

  const StaffFolderPage({super.key, required this.folderId, required this.name});

  @override
  ConsumerState<StaffFolderPage> createState() => _StaffFolderPageState();
}

class _StaffFolderPageState extends ConsumerState<StaffFolderPage> {
  bool _uploading = false;
  String? _busyId;

  StaffDocsRepository get _repo => ref.read(staffDocsRepositoryProvider);

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  void _refresh() {
    ref.invalidate(staffFolderFilesProvider(widget.folderId));
    ref.invalidate(staffFoldersProvider);
  }

  Future<void> _upload() async {
    final l = context.l10n;
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: staffDocExtensions,
    );
    final picked = [for (final f in result?.files ?? <PlatformFile>[]) if (f.path != null) f];
    if (picked.isEmpty) return;
    final tooBig = picked.where((f) => f.size > staffDocMaxBytes).firstOrNull;
    if (tooBig != null) {
      _snack(l.staffDocsTooBig(tooBig.name));
      return;
    }
    setState(() => _uploading = true);
    var done = 0;
    try {
      for (final f in picked) {
        await _repo.upload(widget.folderId, File(f.path!), f.name);
        done++;
      }
      if (mounted) _snack(l.staffDocsUploaded(done));
    } catch (e) {
      if (mounted) _snack(describeError(e));
    } finally {
      if (mounted) setState(() => _uploading = false);
      if (done > 0) _refresh();
    }
  }

  Future<void> _download(StaffFile f) async {
    final l = context.l10n;
    setState(() => _busyId = f.id);
    try {
      final uri = await _repo.downloadLink(widget.folderId, f.id);
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) _snack(l.staffDocsOpenFailed);
    } catch (e) {
      if (mounted) _snack(describeError(e));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _deleteFile(StaffFile f) async {
    final l = context.l10n;
    if (!await _confirm(context, l.staffDocsDeleteFileConfirm(f.fileName), l.staffDocsDelete)) return;
    setState(() => _busyId = f.id);
    try {
      await _repo.deleteFile(widget.folderId, f.id);
      _refresh();
    } catch (e) {
      if (mounted) _snack(describeError(e));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _rename(String current) async {
    final name = await _askFolderName(context, initial: current);
    if (name == null || name == current) return;
    try {
      await _repo.renameFolder(widget.folderId, name);
      _refresh();
    } catch (e) {
      if (mounted) _snack(describeError(e));
    }
  }

  Future<void> _deleteFolder(String name) async {
    final l = context.l10n;
    if (!await _confirm(context, l.staffDocsDeleteFolderConfirm(name), l.staffDocsDelete)) return;
    try {
      await _repo.deleteFolder(widget.folderId);
      ref.invalidate(staffFoldersProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) _snack(describeError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final async = ref.watch(staffFolderFilesProvider(widget.folderId));
    final folder = async.valueOrNull?.folder;
    final name = folder?.name ?? widget.name;
    final date = DateFormat('dd/MM/yyyy', 'en');
    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          if (_uploading)
            const Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else
            IconButton(icon: const Icon(Icons.upload_file_rounded), tooltip: l.staffDocsUpload, onPressed: _upload),
          if (folder?.canManage == true)
            PopupMenuButton<String>(
              onSelected: (v) => v == 'rename' ? _rename(name) : _deleteFolder(name),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'rename', child: Text(l.staffDocsRenameFolder)),
                PopupMenuItem(value: 'delete', child: Text(l.staffDocsDeleteFolder)),
              ],
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(staffFolderFilesProvider(widget.folderId).future),
        child: async.when(
          loading: () => ListView(padding: const EdgeInsets.all(16), children: const [LoadingBlock(height: 72), SizedBox(height: 10), LoadingBlock(height: 72)]),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(staffFolderFilesProvider(widget.folderId)),
          ),
          data: (c) {
            if (c.files.isEmpty) {
              return EmptyState(
                icon: Icons.upload_file_rounded,
                message: l.staffDocsNoFiles,
                color: FeatureColors.documents,
                actionLabel: l.staffDocsUpload,
                onAction: _uploading ? null : _upload,
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final f in c.files)
                  ListCard(
                    leading: IconBadge(icon: _iconFor(f), color: FeatureColors.documents, size: 44),
                    title: f.fileName,
                    subtitle: [
                      formatFileSize(f.size),
                      if (f.uploadedBy != null) f.uploadedBy!,
                      date.format(f.createdAt),
                    ].join(' · '),
                    onTap: _busyId == null ? () => _download(f) : null,
                    trailing: _busyId == f.id
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.download_rounded),
                                tooltip: l.staffDocsDownload,
                                onPressed: () => _download(f),
                              ),
                              if (f.canManage)
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, color: AppColors.coral),
                                  tooltip: l.staffDocsDelete,
                                  onPressed: () => _deleteFile(f),
                                ),
                            ],
                          ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  IconData _iconFor(StaffFile f) {
    final n = f.fileName.toLowerCase();
    if (n.endsWith('.pdf')) return Icons.picture_as_pdf_rounded;
    if (f.contentType.startsWith('image/')) return Icons.image_rounded;
    if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return Icons.table_chart_rounded;
    if (n.endsWith('.ppt') || n.endsWith('.pptx')) return Icons.slideshow_rounded;
    return Icons.description_rounded;
  }
}
