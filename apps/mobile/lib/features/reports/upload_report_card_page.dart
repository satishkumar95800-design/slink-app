import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/student.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../classes/classes_repository.dart';
import '../dashboard/students_repository.dart';
import 'reports_providers.dart';
import 'reports_repository.dart';

/// Teacher-only: pick a class, a student in that class, a term/academic year,
/// and a PDF, then run the create report -> upload PDF -> attach -> (optional)
/// publish sequence — same contract web-admin's Upload Report Card modal uses.
class UploadReportCardPage extends ConsumerStatefulWidget {
  const UploadReportCardPage({super.key});

  @override
  ConsumerState<UploadReportCardPage> createState() => _UploadReportCardPageState();
}

class _UploadReportCardPageState extends ConsumerState<UploadReportCardPage> {
  final _termController = TextEditingController();
  final _academicYearController = TextEditingController();
  String? _selectedClassId;
  String? _selectedStudentId;
  List<Student> _students = [];
  bool _loadingStudents = false;
  File? _pdf;
  bool _publishNow = false;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _termController.dispose();
    _academicYearController.dispose();
    super.dispose();
  }

  Future<void> _onClassChanged(String? classId) async {
    setState(() {
      _selectedClassId = classId;
      _selectedStudentId = null;
      _students = [];
    });
    if (classId == null) return;
    setState(() => _loadingStudents = true);
    try {
      final students = await ref.read(studentsRepositoryProvider).getStudentsForClass(classId);
      if (mounted) setState(() => _students = students);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load students. $e');
    } finally {
      if (mounted) setState(() => _loadingStudents = false);
    }
  }

  Future<void> _pickPdf() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );
    final path = result?.files.single.path;
    if (path != null) {
      setState(() {
        _pdf = File(path);
        _error = null;
      });
    }
  }

  Future<void> _submit() async {
    final studentId = _selectedStudentId;
    final term = _termController.text.trim();
    final academicYear = _academicYearController.text.trim();

    if (studentId == null || term.isEmpty || academicYear.isEmpty || _pdf == null) {
      setState(() => _error = 'Fill in all fields and choose a PDF.');
      return;
    }
    if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(academicYear)) {
      setState(() => _error = 'Academic year must be in format YYYY-YY, e.g. 2026-27.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final reportsRepository = ref.read(reportsRepositoryProvider);
      final report = await reportsRepository.createReportCard(
        studentId: studentId,
        term: term,
        academicYear: academicYear,
      );
      final key = await ref.read(filesRepositoryProvider).upload(
            _pdf!,
            category: 'report_pdf',
            entityId: report.id,
          );
      await reportsRepository.attachPdf(report.id, key);
      if (_publishNow) {
        await reportsRepository.publish(report.id);
      }
      ref.invalidate(reportsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report card uploaded')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = 'Could not upload the report card. $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Upload Report Card')),
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

          return Padding(
            padding: const EdgeInsets.all(24),
            child: ListView(
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
                  items: [
                    for (final cls in classes) DropdownMenuItem(value: cls.id, child: Text(cls.displayName)),
                  ],
                  onChanged: _onClassChanged,
                ),
                const SizedBox(height: 16),
                if (_loadingStudents)
                  const Center(child: CircularProgressIndicator())
                else
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStudentId,
                    decoration: const InputDecoration(labelText: 'Student', border: OutlineInputBorder()),
                    items: [
                      for (final s in _students)
                        DropdownMenuItem(value: s.id, child: Text('${s.name} (${s.admissionNo})')),
                    ],
                    onChanged: (value) => setState(() => _selectedStudentId = value),
                  ),
                const SizedBox(height: 16),
                TextField(
                  controller: _termController,
                  decoration: const InputDecoration(labelText: 'Term', hintText: 'e.g. Term 1', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _academicYearController,
                  decoration: const InputDecoration(
                    labelText: 'Academic Year',
                    hintText: 'e.g. 2026-27',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _pickPdf,
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(_pdf == null ? 'Choose PDF' : _pdf!.path.split('/').last),
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  value: _publishNow,
                  onChanged: (value) => setState(() => _publishNow = value ?? false),
                  title: const Text('Publish now (parent can see it immediately)'),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Upload',
                  isLoading: _isSubmitting,
                  onPressed: _submit,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
