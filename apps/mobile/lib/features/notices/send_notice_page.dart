import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/teacher_class.dart';
import '../../shared/services/broadcast_repository.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../auth/session_controller.dart';
import '../classes/classes_repository.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import '../../core/strings.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/attachment_picker.dart';

/// Lets a class teacher send a text notice to all parents of one of their
/// classes — POST /notifications/broadcast (no fileKey).
class SendNoticePage extends ConsumerStatefulWidget {
  const SendNoticePage({super.key});

  @override
  ConsumerState<SendNoticePage> createState() => _SendNoticePageState();
}

class _SendNoticePageState extends ConsumerState<SendNoticePage> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  String? _selectedClassId;
  List<File> _attachments = [];
  bool _isSending = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _send(String classId) async {
    if (_bodyController.text.trim().isEmpty) {
      setState(() => _error = 'Enter a message.');
      return;
    }
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      final files = ref.read(filesRepositoryProvider);
      final fileKeys = [for (final f in _attachments) await files.upload(f, category: 'attachment')];
      await ref.read(broadcastRepositoryProvider).sendToClass(
            classId: classId,
            kind: BroadcastKind.notice,
            title: _titleController.text.trim().isEmpty ? 'Notice' : _titleController.text.trim(),
            body: _bodyController.text.trim(),
            fileKeys: fileKeys,
          );
      ref.invalidate(sentItemsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notice sent')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = 'Could not send the notice. ${_describeError(e)}');
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(sessionControllerProvider).user?.id;
    final classesAsync = ref.watch(myClassesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.sendNotice),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/broadcasts/sent'),
            icon: const Icon(Icons.done_all),
            label: const Text(AppStrings.sentItems),
          ),
        ],
      ),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Could not load your classes.\n$error')),
        data: (classes) {
          final classTeacherClasses = userId == null
              ? <TeacherClass>[]
              : classes.where((c) => c.isClassTeacherFor(userId)).toList();

          if (classTeacherClasses.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  "You aren't set as the class teacher for any class yet.",
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          _selectedClassId ??= classTeacherClasses.first.id;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
                  items: [
                    for (final cls in classTeacherClasses)
                      DropdownMenuItem(value: cls.id, child: Text(cls.displayName)),
                  ],
                  onChanged: (value) => setState(() => _selectedClassId = value),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _titleController,
                  decoration: const InputDecoration(labelText: 'Title (optional)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _bodyController,
                  minLines: 4,
                  maxLines: 8,
                  decoration: const InputDecoration(labelText: 'Message', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                AttachmentPicker(
                  files: _attachments,
                  allowPdf: true,
                  onChanged: (files) => setState(() => _attachments = files),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: 'Send to class',
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

String _describeError(Object e) => switch (e) {
      ApiException() => e.message,
      DioException() => ApiException.fromDioError(e).message,
      _ => 'Please try again.',
    };
