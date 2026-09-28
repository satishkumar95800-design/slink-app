import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/timetable_slot.dart';
import '../../shared/services/api_client.dart';

class TimetableRepository {
  final Dio _dio;

  TimetableRepository(this._dio);

  /// GET /timetable/mine — the logged-in teacher's own weekly timetable.
  Future<List<TimetableSlot>> getMyTimetable() async {
    final response = await _dio.get<List<dynamic>>('/timetable/mine');
    return response.data!.map((e) => TimetableSlot.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final timetableRepositoryProvider = Provider<TimetableRepository>((ref) {
  return TimetableRepository(ref.watch(apiClientProvider));
});

final myTimetableProvider = FutureProvider.autoDispose<List<TimetableSlot>>((ref) {
  return ref.watch(timetableRepositoryProvider).getMyTimetable();
});
