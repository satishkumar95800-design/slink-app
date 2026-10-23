import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/api_exception.dart';
import '../school_bus/school_bus_models.dart';
import '../school_bus/school_bus_repository.dart';

/// Why location can't be shared.
enum LocationProblem { serviceOff, denied, deniedForever }

@immutable
class DriverTripState {
  final LiveTrip? trip;

  /// Route of the running trip (for its name).
  final String? routeId;
  final DateTime? lastSentAt;
  final LocationProblem? problem;
  final bool busy;

  const DriverTripState({this.trip, this.routeId, this.lastSentAt, this.problem, this.busy = false});

  DriverTripState copyWith({
    LiveTrip? trip,
    bool clearTrip = false,
    String? routeId,
    DateTime? lastSentAt,
    LocationProblem? problem,
    bool clearProblem = false,
    bool? busy,
  }) =>
      DriverTripState(
        trip: clearTrip ? null : trip ?? this.trip,
        routeId: clearTrip ? null : routeId ?? this.routeId,
        lastSentAt: clearTrip ? null : lastSentAt ?? this.lastSentAt,
        problem: clearProblem ? null : problem ?? this.problem,
        busy: busy ?? this.busy,
      );
}

/// A driver's trip: starts and ends it on the server and, while it runs,
/// streams the phone's position (a foreground service with a notification on
/// Android, background location on iOS), sending at most one fix every
/// [_minGap]. A fix that fails to send is kept and retried with the next one.
class DriverTripController extends StateNotifier<DriverTripState> {
  final Ref _ref;
  StreamSubscription<Position>? _sub;
  Position? _pending;
  DateTime? _lastSend;
  bool _sending = false;

  static const _minGap = Duration(seconds: 8);

  DriverTripController(this._ref) : super(const DriverTripState());

  SchoolBusRepository get _repo => _ref.read(schoolBusRepositoryProvider);

  /// After the home loads: carry on sharing for a trip that was running when
  /// the app was closed.
  Future<void> resume(LiveTrip? trip) async {
    if (trip == null) {
      await _stopStream();
      state = state.copyWith(clearTrip: true);
      return;
    }
    if (state.trip?.id == trip.id && _sub != null) return;
    state = state.copyWith(trip: trip, routeId: trip.routeId);
    await _startStream();
  }

  Future<void> start(String routeId, String direction) async {
    state = state.copyWith(busy: true, clearProblem: true);
    try {
      final problem = await _ensurePermission();
      if (problem != null) {
        state = state.copyWith(problem: problem, busy: false);
        return;
      }
      final trip = await _repo.startTrip(routeId, direction);
      state = DriverTripState(trip: trip, routeId: routeId);
      await _startStream();
    } finally {
      state = state.copyWith(busy: false);
    }
  }

  Future<void> end() async {
    final trip = state.trip;
    if (trip == null) return;
    state = state.copyWith(busy: true);
    try {
      await _flush(force: true);
      await _repo.endTrip(trip.id);
    } finally {
      await _stopStream();
      state = const DriverTripState();
    }
  }

  /// Ask again after the driver fixed a permission or switched location on.
  Future<void> retryLocation() async {
    final problem = await _ensurePermission();
    state = problem == null ? state.copyWith(clearProblem: true) : state.copyWith(problem: problem);
    if (problem == null && state.trip != null) await _startStream();
  }

  Future<LocationProblem?> _ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationProblem.serviceOff;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.deniedForever) return LocationProblem.deniedForever;
    if (p == LocationPermission.denied) return LocationProblem.denied;
    return null;
  }

  Future<void> _startStream() async {
    await _stopStream();
    if (await _ensurePermission() case final problem?) {
      state = state.copyWith(problem: problem);
      return;
    }
    final l = currentL10n;
    final LocationSettings settings = Platform.isAndroid
        ? AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 0,
            intervalDuration: const Duration(seconds: 10),
            foregroundNotificationConfig: ForegroundNotificationConfig(
              notificationTitle: l.driverSharingTitle,
              notificationText: l.driverSharingText,
              enableWakeLock: true,
              setOngoing: true,
            ),
          )
        : Platform.isIOS
            ? AppleSettings(
                accuracy: LocationAccuracy.high,
                activityType: ActivityType.automotiveNavigation,
                distanceFilter: 10,
                pauseLocationUpdatesAutomatically: false,
                showBackgroundLocationIndicator: true,
                allowBackgroundLocationUpdates: true,
              )
            : const LocationSettings(accuracy: LocationAccuracy.high);
    _sub = Geolocator.getPositionStream(locationSettings: settings).listen(
      (p) {
        _pending = p;
        _flush();
      },
      onError: (Object _) => state = state.copyWith(problem: LocationProblem.serviceOff),
    );
  }

  Future<void> _stopStream() async {
    await _sub?.cancel();
    _sub = null;
    _pending = null;
  }

  Future<void> _flush({bool force = false}) async {
    final trip = state.trip;
    final p = _pending;
    if (trip == null || p == null || _sending) return;
    final now = DateTime.now();
    if (!force && _lastSend != null && now.difference(_lastSend!) < _minGap) return;
    _sending = true;
    try {
      await _repo.sendPosition(trip.id, {
        'lat': p.latitude,
        'lng': p.longitude,
        if (p.speed >= 0) 'speed': p.speed.clamp(0, 100),
        if (p.heading >= 0) 'heading': p.heading.clamp(0, 360),
        if (p.accuracy >= 0) 'accuracy': p.accuracy,
        'at': p.timestamp.toUtc().toIso8601String(),
      });
      if (identical(_pending, p)) _pending = null;
      _lastSend = now;
      state = state.copyWith(lastSentAt: now, clearProblem: true);
    } on DioException catch (e) {
      // The server closed the trip (e.g. no fix for 30 minutes): stop sharing.
      if (ApiException.fromDioError(e).code == 'TRIP_NOT_RUNNING') {
        await _stopStream();
        state = const DriverTripState();
      }
      // Otherwise offline or a hiccup: the fix stays pending and goes with the next one.
    } catch (_) {
      // Same: retried with the next fix.
    } finally {
      _sending = false;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final driverTripProvider = StateNotifierProvider<DriverTripController, DriverTripState>((ref) => DriverTripController(ref));

final driverHomeProvider = FutureProvider.autoDispose<DriverHome>((ref) => ref.watch(schoolBusRepositoryProvider).driverHome());
