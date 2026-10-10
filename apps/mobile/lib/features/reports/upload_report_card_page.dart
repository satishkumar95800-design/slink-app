import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
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
      if (mounted) setState(() => _error = '${currentL10n.uploadCouldNotLoadStudents} $e');
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
      setState(() => _error = context.l10n.uploadFillAll);
      return;
    }
    if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(academicYear)) {
      setState(() => _error = context.l10n.uploadYearFormat);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    final l = context.l10n;
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
          SnackBar(content: Text(l.uploadSuccess)),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = '${l.uploadFailed} $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(myClassesProvider);
    final l = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l.uploadTitle)),
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

          return Padding(
            padding: const EdgeInsets.all(24),
            child: ListView(
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClassId,
                  decoration: InputDecoration(labelText: l.commonClass, border: const OutlineInputBorder()),
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
                    decoration: InputDecoration(labelText: l.commonStudent, border: const OutlineInputBorder()),
                    items: [
                      for (final s in _students)
                        DropdownMenuItem(value: s.id, child: Text('${s.name} (${s.admissionNo})')),
                    ],
                    onChanged: (value) => setState(() => _selectedStudentId = value),
                  ),
                const SizedBox(height: 16),
                TextField(
                  controller: _termController,
                  decoration: InputDecoration(labelText: l.uploadTermLabel, hintText: l.uploadTermHint, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _academicYearController,
                  decoration: InputDecoration(
                    labelText: l.uploadYearLabel,
                    hintText: l.uploadYearHint,
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _pickPdf,
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(_pdf == null ? l.uploadChoosePdf : _pdf!.path.split('/').last),
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  value: _publishNow,
                  onChanged: (value) => setState(() => _publishNow = value ?? false),
                  title: Text(l.uploadPublishNow),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: l.uploadButton,
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
