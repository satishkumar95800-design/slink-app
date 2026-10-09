import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/strings.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/models/student.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../classes/classes_repository.dart';
import '../dashboard/students_repository.dart';
import '../home/parent_home_models.dart';
import 'student_notes_repository.dart';

final _classStudentsProvider = FutureProvider.autoDispose.family<List<Student>, String>((ref, classId) {
  return ref.watch(studentsRepositoryProvider).getStudentsForClass(classId);
});

/// Teacher: pick class → student → type, write the note, save. Internal only.
class AddStudentNotePage extends ConsumerStatefulWidget {
  const AddStudentNotePage({super.key});

  @override
  ConsumerState<AddStudentNotePage> createState() => _AddStudentNotePageState();
}

class _AddStudentNotePageState extends ConsumerState<AddStudentNotePage> {
  final _textController = TextEditingController();
  String? _classId;
  String? _studentId;
  String _type = 'note';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final studentId = _studentId;
    final text = _textController.text.trim();
    if (studentId == null) return;
    if (text.isEmpty) {
      setState(() => _error = AppStrings.enterNote);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(studentNotesRepositoryProvider).create(studentId: studentId, type: _type, content: text);
      _textController.clear();
      ref.invalidate(studentNotesProvider(studentId));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text(AppStrings.noteSaved)));
    } on DioException catch (e) {
      setState(() => _error = ApiException.fromDioError(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text(AppStrings.addStudentNote)),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text(AppStrings.couldNotLoad)),
        data: (classes) {
          if (classes.isEmpty) return const Center(child: Text(AppStrings.noClassesToMark));
          _classId ??= classes.first.id;
          final studentsAsync = ref.watch(_classStudentsProvider(_classId!));
          final students = studentsAsync.valueOrNull ?? const <Student>[];

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(children: [
                  Icon(Icons.lock_outline, size: 18),
                  SizedBox(width: 8),
                  Expanded(child: Text(AppStrings.noteInternalHint)),
                ]),
              ),
              const SizedBox(height: 16),
              if (_error != null) ErrorBanner(message: _error!),
              DropdownButtonFormField<String>(
                initialValue: _classId,
                decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
                items: [for (final c in classes) DropdownMenuItem(value: c.id, child: Text(c.displayName))],
                onChanged: (v) => setState(() {
                  _classId = v;
                  _studentId = null;
                }),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                key: ValueKey('students-$_classId-${students.length}'),
                initialValue: _studentId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: AppStrings.pickStudent,
                  border: const OutlineInputBorder(),
                  suffixIcon: studentsAsync.isLoading
                      ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
                      : null,
                ),
                items: [for (final s in students) DropdownMenuItem(value: s.id, child: Text('${s.name} · ${s.admissionNo}'))],
                onChanged: (v) => setState(() => _studentId = v),
              ),
              const SizedBox(height: 16),
              Text(AppStrings.noteType, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in AppStrings.noteTypes.entries)
                    ChoiceChip(
                      label: Text(entry.value),
                      selected: _type == entry.key,
                      onSelected: (_) => setState(() => _type = entry.key),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _textController,
                minLines: 4,
                maxLines: 10,
                maxLength: 5000,
                decoration: const InputDecoration(labelText: AppStrings.noteText, border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              PrimaryButton(label: AppStrings.saveNote, isLoading: _saving, onPressed: _studentId == null ? null : _save),
              if (_studentId != null) ...[
                const SizedBox(height: 24),
                Text(AppStrings.recentNotes, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                _RecentNotes(studentId: _studentId!),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _RecentNotes extends ConsumerWidget {
  final String studentId;

  const _RecentNotes({required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(studentNotesProvider(studentId)).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => const Text(AppStrings.couldNotLoad),
          data: (notes) => Column(
            children: [
              for (final n in notes.take(10))
                Card(
                  child: ListTile(
                    title: Text(n.content, maxLines: 3, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${AppStrings.noteTypes[n.type] ?? n.type} · ${n.authorName} · ${displayDate(n.createdAt)}'),
                  ),
                ),
            ],
          ),
        );
  }
}
