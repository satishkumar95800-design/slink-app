import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'calendar_models.dart';

class CalendarRepository {
  final Dio _dio;

  CalendarRepository(this._dio);

  /// GET /calendar?from=&to= — holidays, events and PTMs overlapping the range, date-sorted.
  Future<CalendarMonth> getRange(DateTime from, DateTime to) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/calendar',
      queryParameters: {'from': dateKey(from), 'to': dateKey(to)},
    );
    final data = response.data!['data'] as List<dynamic>;
    return CalendarMonth([for (final e in data) CalendarItem.fromJson(e as Map<String, dynamic>)]);
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return CalendarRepository(ref.watch(apiClientProvider));
});

/// One month of the school calendar, keyed by the first day of that month.
final calendarMonthProvider = FutureProvider.autoDispose.family<CalendarMonth, DateTime>((ref, firstOfMonth) {
  final last = DateTime(firstOfMonth.year, firstOfMonth.month + 1, 0);
  return ref.watch(calendarRepositoryProvider).getRange(firstOfMonth, last);
});
