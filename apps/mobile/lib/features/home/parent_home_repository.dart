import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'parent_home_models.dart';

class ParentHomeRepository {
  final Dio _dio;

  ParentHomeRepository(this._dio);

  Future<ParentHome> getHome(String studentId) async {
    final response = await _dio.get<Map<String, dynamic>>('/parent/home', queryParameters: {'studentId': studentId});
    return ParentHome.fromJson(response.data!);
  }

  Future<List<NoticeItem>> getNotices(String studentId) async {
    final response = await _dio.get<List<dynamic>>('/parent/notices', queryParameters: {'studentId': studentId});
    return (response.data ?? []).map((e) => NoticeItem.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final parentHomeRepositoryProvider = Provider<ParentHomeRepository>((ref) {
  return ParentHomeRepository(ref.watch(apiClientProvider));
});

final parentHomeProvider = FutureProvider.autoDispose.family<ParentHome, String>((ref, studentId) {
  return ref.watch(parentHomeRepositoryProvider).getHome(studentId);
});

final parentNoticesProvider = FutureProvider.autoDispose.family<List<NoticeItem>, String>((ref, studentId) {
  return ref.watch(parentHomeRepositoryProvider).getNotices(studentId);
});
