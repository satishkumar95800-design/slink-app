import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/report.dart';
import '../dashboard/students_repository.dart';
import 'reports_repository.dart';

final reportsProvider = FutureProvider.autoDispose<List<Report>>((ref) async {
  final studentId = ref.watch(selectedChildIdProvider);
  final result = await ref.watch(reportsRepositoryProvider).getReports(studentId: studentId);
  return result.data;
});
