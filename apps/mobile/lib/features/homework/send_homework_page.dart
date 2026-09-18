import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../shared/services/broadcast_repository.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../classes/classes_repository.dart';

/// Lets any teacher linked to a class (class teacher or subject teacher) pick
/// that class, attach a photo, and send it as homework — POST /files/upload
/// followed by POST /notifications/broadcast with the resulting fileKey.
class SendHomeworkPage extends ConsumerStatefulWidget {
  const SendHomeworkPage({super.key});

  @override
  ConsumerState<SendHomeworkPage> createState() => _SendHomeworkPageState();
}

class _SendHomeworkPageState extends ConsumerState<SendHomeworkPage> {
  final _captionController = TextEditingController();
  String? _selectedClassId;
  File? _photo;
  bool _isSending = false;
  String? _error;

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85);
    if (picked != null) {
      setState(() {
        _photo = File(picked.path);
        _error = null;
      });
    }
  }

  Future<void> _send(String classId) async {
    if (_photo == null) {
      setState(() => _error = 'Take a photo first.');
      return;
    }
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      final fileKey = await ref.read(filesRepositoryProvider).upload(_photo!, category: 'attachment');
      await ref.read(broadcastRepositoryProvider).sendToClass(
            classId: classId,
            title: 'Homework',
            body: _captionController.text.trim().isEmpty ? 'New homework has been posted.' : _captionController.text.trim(),
            fileKey: fileKey,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Homework sent')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = 'Could not send the homework. $e');
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Send Homework')),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Could not load your classes.\n$error')),
        data: (classes) {
          if (classes.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text("You aren't assigned to any class yet.", textAlign: TextAlign.center),
              ),
            );
          }

          _selectedClassId ??= classes.first.id;

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
                  items: [
                    for (final cls in classes) DropdownMenuItem(value: cls.id, child: Text(cls.displayName)),
                  ],
                  onChanged: (value) => setState(() => _selectedClassId = value),
                ),
                const SizedBox(height: 16),
                if (_photo != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.file(_photo!, height: 220, width: double.infinity, fit: BoxFit.cover),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _pickPhoto,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: Text(_photo == null ? 'Take photo' : 'Retake photo'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _captionController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Caption (optional)', border: OutlineInputBorder()),
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
