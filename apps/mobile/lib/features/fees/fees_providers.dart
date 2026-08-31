import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/student_fee.dart';
import '../dashboard/students_repository.dart';
import 'fees_repository.dart';

final studentFeesProvider = FutureProvider.autoDispose<List<StudentFee>>((ref) async {
  final studentId = ref.watch(selectedChildIdProvider);
  final result = await ref.watch(feesRepositoryProvider).getStudentFees(studentId: studentId);
  return result.data;
});
