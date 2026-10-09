import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/strings.dart';

const maxPhotos = 3;

bool isPdf(File f) => f.path.toLowerCase().endsWith('.pdf');

/// Up to 3 photos (camera or gallery), or — when [allowPdf] — a single PDF instead.
/// The parent widget owns the list; this only renders it and reports changes.
class AttachmentPicker extends StatelessWidget {
  final List<File> files;
  final bool allowPdf;
  final ValueChanged<List<File>> onChanged;

  const AttachmentPicker({super.key, required this.files, required this.allowPdf, required this.onChanged});

  bool get _hasPdf => files.any(isPdf);
  bool get _canAddPhoto => !_hasPdf && files.length < maxPhotos;

  Future<void> _addPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 80, maxWidth: 1920, maxHeight: 1920);
    if (picked != null) onChanged([...files, File(picked.path)]);
  }

  Future<void> _addPdf() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    final path = result?.files.single.path;
    // A PDF replaces any photos — it's one PDF or up to 3 photos, not both.
    if (path != null) onChanged([File(path)]);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (files.isNotEmpty)
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: files.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final f = files[i];
                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: isPdf(f)
                          ? Container(
                              width: 96,
                              height: 96,
                              color: Theme.of(context).colorScheme.secondaryContainer,
                              child: const Icon(Icons.picture_as_pdf, size: 40),
                            )
                          : Image.file(f, width: 96, height: 96, fit: BoxFit.cover),
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: IconButton.filledTonal(
                        visualDensity: VisualDensity.compact,
                        tooltip: AppStrings.remove,
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: () => onChanged([...files]..removeAt(i)),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: _canAddPhoto ? () => _addPhoto(ImageSource.camera) : null,
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text(AppStrings.takePhoto),
            ),
            OutlinedButton.icon(
              onPressed: _canAddPhoto ? () => _addPhoto(ImageSource.gallery) : null,
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text(AppStrings.fromGallery),
            ),
            if (allowPdf)
              OutlinedButton.icon(
                onPressed: files.isEmpty ? _addPdf : null,
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text(AppStrings.attachPdf),
              ),
          ],
        ),
        const SizedBox(height: 4),
        Text(AppStrings.attachmentsHint(allowPdf), style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
