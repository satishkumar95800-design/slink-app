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

  /// The child's bus while a trip runs (Premium Max, busTracking).
  Future<ChildBusLive> childLive(String studentId) async {
    final r = await _dio.get<Map<String, dynamic>>('/transport/child/$studentId/live');
    return ChildBusLive.fromJson(r.data!);
  }

  /// Admin: every route with its running trip.
  Future<List<LiveRoute>> live() async {
    final r = await _dio.get<List<dynamic>>('/transport/live');
    return [for (final x in r.data!) LiveRoute.fromJson(x as Map<String, dynamic>)];
  }

  // ── Driver ──
  Future<DriverHome> driverHome() async {
    final r = await _dio.get<Map<String, dynamic>>('/transport/driver/me');
    return DriverHome.fromJson(r.data!);
  }

  Future<LiveTrip> startTrip(String routeId, String direction) async {
    final r = await _dio.post<Map<String, dynamic>>('/transport/driver/trips', data: {'routeId': routeId, 'direction': direction});
    return LiveTrip.fromJson(r.data!)!;
  }

  /// Returns the stops reached so far on the trip.
  Future<List<String>> sendPosition(String tripId, Map<String, dynamic> fix) async {
    final r = await _dio.post<Map<String, dynamic>>('/transport/driver/trips/$tripId/position', data: fix);
    return _reached(r.data);
  }

  /// The driver is standing at [stopId]: save its location from the latest fix.
  Future<List<String>> stopHere(String tripId, String stopId) async {
    final r = await _dio.post<Map<String, dynamic>>('/transport/driver/trips/$tripId/stops/$stopId/here');
    return _reached(r.data);
  }

  static List<String> _reached(Map<String, dynamic>? data) =>
      [for (final id in (data?['reachedStopIds'] as List?) ?? const []) id as String];

  Future<void> endTrip(String tripId) async {
    await _dio.post<void>('/transport/driver/trips/$tripId/end');
  }
}

final schoolBusRepositoryProvider = Provider<SchoolBusRepository>((ref) => SchoolBusRepository(ref.watch(apiClientProvider)));

final childBusProvider = FutureProvider.autoDispose.family<ChildBusInfo, String>(
  (ref, studentId) => ref.watch(schoolBusRepositoryProvider).child(studentId),
);
