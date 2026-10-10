import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
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

/// Note types in the order the chips show, keyed by the API value.
Map<String, String> noteTypeLabels(AppLocalizations l) => {
      'note': l.noteTypeNote,
      'mom': l.noteTypeMom,
      'complaint': l.noteTypeComplaint,
      'parent_discussion': l.noteTypeParentDiscussion,
    };

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
      setState(() => _error = context.l10n.noteEnterFirst);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final savedMessage = context.l10n.noteSaved;
    try {
      await ref.read(studentNotesRepositoryProvider).create(studentId: studentId, type: _type, content: text);
      _textController.clear();
      ref.invalidate(studentNotesProvider(studentId));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(savedMessage)));
    } on DioException catch (e) {
      setState(() => _error = ApiException.fromDioError(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.teacherAddStudentNote)),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(l.commonCouldNotLoadClasses)),
        data: (classes) {
          if (classes.isEmpty) return Center(child: Text(l.commonNotAssignedToClass));
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
                child: Row(children: [
                  const Icon(Icons.lock_outline, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l.noteInternalHint)),
                ]),
              ),
              const SizedBox(height: 16),
              if (_error != null) ErrorBanner(message: _error!),
              DropdownButtonFormField<String>(
                initialValue: _classId,
                decoration: InputDecoration(labelText: l.commonClass, border: const OutlineInputBorder()),
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
                  labelText: l.commonStudent,
                  border: const OutlineInputBorder(),
                  suffixIcon: studentsAsync.isLoading
                      ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
                      : null,
                ),
                items: [for (final s in students) DropdownMenuItem(value: s.id, child: Text('${s.name} · ${s.admissionNo}'))],
                onChanged: (v) => setState(() => _studentId = v),
              ),
              const SizedBox(height: 16),
              Text(l.noteTypeLabel, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in noteTypeLabels(l).entries)
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
                decoration: InputDecoration(labelText: l.noteTextLabel, border: const OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              PrimaryButton(label: l.noteSave, isLoading: _saving, onPressed: _studentId == null ? null : _save),
              if (_studentId != null) ...[
                const SizedBox(height: 24),
                Text(l.noteRecent, style: Theme.of(context).textTheme.titleMedium),
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
    final l = context.l10n;
    final types = noteTypeLabels(l);
    return ref.watch(studentNotesProvider(studentId)).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Text(l.noteCouldNotLoad),
          data: (notes) => Column(
            children: [
              for (final n in notes.take(10))
                Card(
                  child: ListTile(
                    title: Text(n.content, maxLines: 3, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${types[n.type] ?? n.type} · ${n.authorName} · ${displayDate(n.createdAt)}'),
                  ),
                ),
            ],
          ),
        );
  }
}
