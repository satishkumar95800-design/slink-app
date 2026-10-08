import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shared/models/api_exception.dart';
import '../auth/session_controller.dart';
import 'attendance_models.dart';
import 'attendance_repository.dart';

const _prefsKey = 'attendance_outbox_v1';
const _retryEvery = Duration(seconds: 30);

/// An attendance submission that couldn't reach the server yet (weak/no connection).
class PendingAttendance {
  final String userId;
  final String classId;
  final String classLabel;
  final String date;
  final Map<String, AttendanceStatus> statuses;
  final DateTime queuedAt;

  /// Set when the server refused it (e.g. it's now past midnight) — those stop retrying.
  final String? rejectedReason;
  final bool sending;

  const PendingAttendance({
    required this.userId,
    required this.classId,
    required this.classLabel,
    required this.date,
    required this.statuses,
    required this.queuedAt,
    this.rejectedReason,
    this.sending = false,
  });

  String get key => '$classId|$date';

  PendingAttendance copyWith({String? rejectedReason, bool? sending}) => PendingAttendance(
        userId: userId,
        classId: classId,
        classLabel: classLabel,
        date: date,
        statuses: statuses,
        queuedAt: queuedAt,
        rejectedReason: rejectedReason ?? this.rejectedReason,
        sending: sending ?? this.sending,
      );

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'classId': classId,
        'classLabel': classLabel,
        'date': date,
        'statuses': statuses.map((k, v) => MapEntry(k, v.name)),
        'queuedAt': queuedAt.toIso8601String(),
        if (rejectedReason != null) 'rejectedReason': rejectedReason,
      };

  factory PendingAttendance.fromJson(Map<String, dynamic> json) => PendingAttendance(
        userId: json['userId'] as String,
        classId: json['classId'] as String,
        classLabel: json['classLabel'] as String,
        date: json['date'] as String,
        statuses: (json['statuses'] as Map<String, dynamic>)
            .map((k, v) => MapEntry(k, parseAttendanceStatus(v) ?? AttendanceStatus.present)),
        queuedAt: DateTime.parse(json['queuedAt'] as String),
        rejectedReason: json['rejectedReason'] as String?,
      );
}

/// Persists unsent attendance on the phone and retries it: every 30s while
/// anything is waiting, and whenever the app comes back to the foreground.
/// Re-sending is safe — the server upserts by class + date.
class AttendanceOutbox extends StateNotifier<List<PendingAttendance>> {
  final Ref _ref;
  Timer? _timer;
  AppLifecycleListener? _lifecycle;
  bool _flushing = false;

  AttendanceOutbox(this._ref) : super(const []) {
    _load();
    _lifecycle = AppLifecycleListener(onResume: flush);
  }

  String? get _userId => _ref.read(sessionControllerProvider).user?.id;

  /// Pending item for this class/date belonging to the signed-in user, if any.
  PendingAttendance? pendingFor(String classId, String date) {
    for (final p in state) {
      if (p.classId == classId && p.date == date && p.userId == _userId) return p;
    }
    return null;
  }

  Future<void> enqueue({
    required String classId,
    required String classLabel,
    required String date,
    required Map<String, AttendanceStatus> statuses,
  }) async {
    final userId = _userId;
    if (userId == null) return;
    final item = PendingAttendance(
      userId: userId,
      classId: classId,
      classLabel: classLabel,
      date: date,
      statuses: Map.of(statuses),
      queuedAt: DateTime.now(),
    );
    // The newest submission for a class/date replaces any older unsent one.
    state = [...state.where((p) => p.key != item.key), item];
    await _save();
    _scheduleRetry();
  }

  Future<void> discard(PendingAttendance item) async {
    state = state.where((p) => p.key != item.key).toList();
    await _save();
  }

  Future<void> flush() async {
    if (_flushing) return;
    final userId = _userId;
    final due = state.where((p) => p.userId == userId && p.rejectedReason == null).toList();
    if (due.isEmpty) return;

    _flushing = true;
    try {
      for (final item in due) {
        _replace(item.copyWith(sending: true));
        try {
          await _ref
              .read(attendanceRepositoryProvider)
              .submit(classId: item.classId, date: item.date, statuses: item.statuses);
          state = state.where((p) => p.key != item.key).toList();
          _ref.invalidate(myAttendanceClassesProvider);
        } on DioException catch (e) {
          if (isConnectivityError(e)) {
            _replace(item.copyWith(sending: false));
          } else {
            // The server answered and said no; retrying won't change that.
            _replace(item.copyWith(sending: false, rejectedReason: ApiException.fromDioError(e).message));
          }
        }
      }
      await _save();
    } finally {
      _flushing = false;
      _scheduleRetry();
    }
  }

  void _replace(PendingAttendance item) {
    state = [for (final p in state) p.key == item.key ? item : p];
  }

  void _scheduleRetry() {
    final waiting = state.any((p) => p.rejectedReason == null);
    if (!waiting) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(_retryEvery, (_) => flush());
    }
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    try {
      state = (jsonDecode(raw) as List<dynamic>)
          .map((e) => PendingAttendance.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      await prefs.remove(_prefsKey);
      return;
    }
    await flush();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    if (state.isEmpty) {
      await prefs.remove(_prefsKey);
    } else {
      await prefs.setString(_prefsKey, jsonEncode(state.map((p) => p.toJson()).toList()));
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _lifecycle?.dispose();
    super.dispose();
  }
}

/// No response at all (offline, DNS, timeout) — worth queueing and retrying.
bool isConnectivityError(DioException e) =>
    e.response == null &&
    (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.unknown);

final attendanceOutboxProvider = StateNotifierProvider<AttendanceOutbox, List<PendingAttendance>>((ref) {
  return AttendanceOutbox(ref);
});
