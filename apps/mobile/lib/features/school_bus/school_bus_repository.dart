import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'school_bus_models.dart';

/// A parent's view of their own child's school bus.
class SchoolBusRepository {
  final Dio _dio;

  SchoolBusRepository(this._dio);

  Future<ChildBusInfo> child(String studentId) async {
    final r = await _dio.get<Map<String, dynamic>>('/transport/child/$studentId');
    return ChildBusInfo.fromJson(r.data!);
  }
}

final schoolBusRepositoryProvider = Provider<SchoolBusRepository>((ref) => SchoolBusRepository(ref.watch(apiClientProvider)));

final childBusProvider = FutureProvider.autoDispose.family<ChildBusInfo, String>(
  (ref, studentId) => ref.watch(schoolBusRepositoryProvider).child(studentId),
);
