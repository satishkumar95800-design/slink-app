import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';

/// GET /admin-home: today's numbers for the admin's phone. Sections for
/// modules the school doesn't have are null (the app hides them).
class AdminHome {
  final String date;
  final String? holiday;
  final int totalStudents;
  final int present;
  final int absent;
  final int late;
  final int onLeave;
  final List<String> classesNotMarked;
  final num collectedToday;
  final int receiptsToday;
  final num collectedThisMonth;
  final int paymentClaims;
  final int? leaveRequests;
  final int? pettyCash;
  final int? staffOnLeaveToday;
  final ({int newThisWeek, int followUpsDue})? admissions;
  final Map<String, int>? alerts;
  final ({int routes, int onTheMove})? buses;
  final int? libraryOverdue;

  const AdminHome({
    required this.date,
    required this.holiday,
    required this.totalStudents,
    required this.present,
    required this.absent,
    required this.late,
    required this.onLeave,
    required this.classesNotMarked,
    required this.collectedToday,
    required this.receiptsToday,
    required this.collectedThisMonth,
    required this.paymentClaims,
    required this.leaveRequests,
    required this.pettyCash,
    required this.staffOnLeaveToday,
    required this.admissions,
    required this.alerts,
    required this.buses,
    required this.libraryOverdue,
  });

  /// Students counted in marked classes.
  int get marked => present + absent + late + onLeave;

  /// Present (and late) as a share of marked students, or null before anyone is marked.
  int? get presentPercent => marked == 0 ? null : ((present + late) * 100 / marked).round();

  /// Things waiting for an admin's decision in the console.
  int get waiting => paymentClaims + (leaveRequests ?? 0) + (pettyCash ?? 0);

  factory AdminHome.fromJson(Map<String, dynamic> j) {
    final att = j['attendance'] as Map<String, dynamic>;
    final fees = j['fees'] as Map<String, dynamic>;
    final appr = j['approvals'] as Map<String, dynamic>;
    final adm = j['admissions'] as Map<String, dynamic>?;
    final bus = j['buses'] as Map<String, dynamic>?;
    final alerts = j['alerts'] as Map<String, dynamic>?;
    return AdminHome(
      date: j['date'] as String,
      holiday: att['holiday'] as String?,
      totalStudents: att['totalStudents'] as int,
      present: att['present'] as int,
      absent: att['absent'] as int,
      late: att['late'] as int,
      onLeave: att['leave'] as int,
      classesNotMarked: (att['classesNotMarked'] as List).cast<String>(),
      collectedToday: num.parse(fees['collectedToday'] as String),
      receiptsToday: fees['receiptsToday'] as int,
      collectedThisMonth: num.parse(fees['collectedThisMonth'] as String),
      paymentClaims: appr['paymentClaims'] as int,
      leaveRequests: appr['leaveRequests'] as int?,
      pettyCash: appr['pettyCash'] as int?,
      staffOnLeaveToday: j['staffOnLeaveToday'] as int?,
      admissions: adm == null ? null : (newThisWeek: adm['newThisWeek'] as int, followUpsDue: adm['followUpsDue'] as int),
      alerts: alerts?.map((k, v) => MapEntry(k, v as int)),
      buses: bus == null ? null : (routes: bus['routes'] as int, onTheMove: bus['onTheMove'] as int),
      libraryOverdue: j['libraryOverdue'] as int?,
    );
  }
}

class AdminHomeRepository {
  final Dio _dio;

  AdminHomeRepository(this._dio);

  Future<AdminHome> load() async {
    final r = await _dio.get<Map<String, dynamic>>('/admin-home');
    return AdminHome.fromJson(r.data!);
  }
}

final adminHomeRepositoryProvider = Provider((ref) => AdminHomeRepository(ref.watch(apiClientProvider)));

final adminHomeProvider = FutureProvider.autoDispose<AdminHome>((ref) => ref.watch(adminHomeRepositoryProvider).load());
