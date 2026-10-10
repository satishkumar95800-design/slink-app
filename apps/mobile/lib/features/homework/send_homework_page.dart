import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/broadcast_repository.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/attachment_picker.dart';
import '../../shared/widgets/primary_button.dart';
import '../../core/l10n/l10n.dart';
import '../classes/classes_repository.dart';
import '../dashboard/teacher_classes_repository.dart';

/// Lets any teacher linked to a class (class teacher or subject teacher) pick
/// that class, attach up to 3 photos and an optional subject, and send it as
/// homework — POST /files/upload per photo, then POST /notifications/broadcast.
class SendHomeworkPage extends ConsumerStatefulWidget {
  const SendHomeworkPage({super.key});

  @override
  ConsumerState<SendHomeworkPage> createState() => _SendHomeworkPageState();
}

class _SendHomeworkPageState extends ConsumerState<SendHomeworkPage> {
  final _captionController = TextEditingController();
  String? _selectedClassId;
  String? _subjectId;
  List<File> _photos = [];
  bool _isSending = false;
  String? _error;

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _send(String classId) async {
    if (_photos.isEmpty) {
      setState(() => _error = context.l10n.homeworkAddPhotoFirst);
      return;
    }
    setState(() {
      _isSending = true;
      _error = null;
    });
    final l = context.l10n;
    try {
      final files = ref.read(filesRepositoryProvider);
      final fileKeys = [for (final photo in _photos) await files.upload(photo, category: 'attachment')];
      await ref.read(broadcastRepositoryProvider).sendToClass(
            classId: classId,
            kind: BroadcastKind.homework,
            // Stored with the homework, so in the sender's language (see SPEC-languages Stage 3).
            title: l.homeworkKind,
            body: _captionController.text.trim().isEmpty ? l.homeworkDefaultBody : _captionController.text.trim(),
            fileKeys: fileKeys,
            subjectId: _subjectId,
          );
      ref.invalidate(sentItemsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l.homeworkSent)),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = l.homeworkCouldNotSend(describeError(e)));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);
    final l = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l.teacherSendHomework),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/broadcasts/sent'),
            icon: const Icon(Icons.done_all),
            label: Text(l.sentTitle),
          ),
        ],
      ),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('${l.commonCouldNotLoadClasses}\n$error')),
        data: (classes) {
          if (classes.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(l.commonNotAssignedToClass, textAlign: TextAlign.center),
              ),
            );
          }

          _selectedClassId ??= classes.first.id;
          final subjects = ref
                  .watch(myClassOverviewsProvider)
                  .valueOrNull
                  ?.where((o) => o.studentClass.id == _selectedClassId)
                  .expand((o) => o.subjects)
                  .toList() ??
              const [];

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClassId,
                  decoration: InputDecoration(labelText: l.commonClass, border: const OutlineInputBorder()),
                  items: [
                    for (final cls in classes) DropdownMenuItem(value: cls.id, child: Text(cls.displayName)),
                  ],
                  onChanged: (value) => setState(() {
                    _selectedClassId = value;
                    _subjectId = null;
                  }),
                ),
                if (subjects.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String?>(
                    key: ValueKey(_selectedClassId),
                    initialValue: _subjectId,
                    decoration: InputDecoration(labelText: l.homeworkSubjectOptional, border: const OutlineInputBorder()),
                    items: [
                      DropdownMenuItem<String?>(value: null, child: Text(l.homeworkNoSubject)),
                      for (final subject in subjects) DropdownMenuItem<String?>(value: subject.id, child: Text(subject.name)),
                    ],
                    onChanged: (value) => setState(() => _subjectId = value),
                  ),
                ],
                const SizedBox(height: 16),
                AttachmentPicker(
                  files: _photos,
                  allowPdf: false,
                  onChanged: (files) => setState(() {
                    _photos = files;
                    _error = null;
                  }),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _captionController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(labelText: l.homeworkCaptionLabel, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: l.commonSendToClass,
                  isLoading: _isSending,
                  onPressed: () => _send(_selectedClassId!),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
