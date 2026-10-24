import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';

/// Teachers today from staff attendance (HR & payroll); without it only [total].
class TeachersToday {
  final int total;
  final bool tracked;
  final int present;
  final int halfDay;
  final int absent;
  final int onLeave;
  final int notMarked;

  /// Absent or on leave today: (name, ABSENT | ON_LEAVE).
  final List<(String, String)> away;

  const TeachersToday({
    required this.total,
    required this.tracked,
    this.present = 0,
    this.halfDay = 0,
    this.absent = 0,
    this.onLeave = 0,
    this.notMarked = 0,
    this.away = const [],
  });

  factory TeachersToday.fromJson(Map<String, dynamic> j) => TeachersToday(
        total: j['total'] as int,
        tracked: j['tracked'] == true,
        present: (j['present'] as int?) ?? 0,
        halfDay: (j['halfDay'] as int?) ?? 0,
        absent: (j['absent'] as int?) ?? 0,
        onLeave: (j['onLeave'] as int?) ?? 0,
        notMarked: (j['notMarked'] as int?) ?? 0,
        away: [
          for (final a in (j['away'] as List?) ?? const [])
            ((a as Map<String, dynamic>)['name'] as String, a['status'] as String),
        ],
      );
}

/// An event, PTM or holiday in the next two weeks.
class ComingUp {
  final String title;

  /// event | ptm | holiday
  final String kind;
  final DateTime date;
  final DateTime? endDate;
  final String? time;

  const ComingUp({required this.title, required this.kind, required this.date, this.endDate, this.time});

  factory ComingUp.fromJson(Map<String, dynamic> j) => ComingUp(
        title: j['title'] as String,
        kind: j['kind'] as String,
        date: DateTime.parse(j['date'] as String),
        endDate: j['endDate'] == null ? null : DateTime.parse(j['endDate'] as String),
        time: j['time'] as String?,
      );
}

/// Today at the front desk: appointments, campus tours, and the week ahead.
class DeskToday {
  /// (time, kind, name, withWhom, status)
  final List<({String time, String kind, String name, String? withWhom, String status})> appointments;

  /// (childName, parentName)
  final List<({String child, String parent})> tours;
  final int laterThisWeek;

  const DeskToday({required this.appointments, required this.tours, required this.laterThisWeek});

  factory DeskToday.fromJson(Map<String, dynamic> j) => DeskToday(
        appointments: [
          for (final a in j['today'] as List)
            (
              time: (a as Map<String, dynamic>)['time'] as String,
              kind: a['kind'] as String,
              name: a['name'] as String,
              withWhom: a['withWhom'] as String?,
              status: a['status'] as String,
            ),
        ],
        tours: [
          for (final t in j['tours'] as List)
            (child: (t as Map<String, dynamic>)['childName'] as String, parent: t['parentName'] as String),
        ],
        laterThisWeek: j['laterThisWeek'] as int,
      );
}

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
  final TeachersToday? teachers;
  final List<ComingUp> events;
  final DeskToday? desk;

  /// What needs the admin's attention, most pressing first: (kind, count).
  final List<(String, int)> urgent;

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
    this.teachers,
    this.events = const [],
    this.desk,
    this.urgent = const [],
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
      teachers: j['teachers'] is Map<String, dynamic> ? TeachersToday.fromJson(j['teachers'] as Map<String, dynamic>) : null,
      events: [for (final e in (j['events'] as List?) ?? const []) ComingUp.fromJson(e as Map<String, dynamic>)],
      desk: j['appointments'] is Map<String, dynamic> ? DeskToday.fromJson(j['appointments'] as Map<String, dynamic>) : null,
      urgent: [
        for (final u in (j['urgent'] as List?) ?? const [])
          ((u as Map<String, dynamic>)['kind'] as String, u['count'] as int),
      ],
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
