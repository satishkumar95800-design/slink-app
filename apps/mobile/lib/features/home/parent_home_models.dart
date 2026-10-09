import '../attendance/attendance_models.dart';

/// GET /parent/home — everything the parent home cards need for one child.
class ParentHome {
  final String studentId;
  final String studentName;
  final String today;
  final FeeSummary fees;
  final List<HomeworkItem> homework;
  final NoticeItem? latestNotice;
  final int attendanceDaysPresent;
  final int attendanceDaysMarked;
  final AttendanceStatus? attendanceToday;

  const ParentHome({
    required this.studentId,
    required this.studentName,
    required this.today,
    required this.fees,
    required this.homework,
    this.latestNotice,
    required this.attendanceDaysPresent,
    required this.attendanceDaysMarked,
    this.attendanceToday,
  });

  factory ParentHome.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>;
    final attendance = json['attendance'] as Map<String, dynamic>;
    final month = attendance['month'] as Map<String, dynamic>;
    return ParentHome(
      studentId: student['id'] as String,
      studentName: student['name'] as String,
      today: json['today'] as String,
      fees: FeeSummary.fromJson(json['fees'] as Map<String, dynamic>),
      homework: (json['homework'] as List<dynamic>)
          .map((e) => HomeworkItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      latestNotice: json['latestNotice'] == null
          ? null
          : NoticeItem.fromJson(json['latestNotice'] as Map<String, dynamic>),
      attendanceDaysPresent: month['daysPresent'] as int,
      attendanceDaysMarked: month['daysMarked'] as int,
      attendanceToday: parseAttendanceStatus(attendance['todayStatus']),
    );
  }
}

class FeeSummary {
  final double totalOutstanding;
  final int openCount;
  final bool overdue;
  final NextFee? next;
  final int claimsUnderReview;
  final double? claimAmount;

  const FeeSummary({
    required this.totalOutstanding,
    required this.openCount,
    required this.overdue,
    this.next,
    required this.claimsUnderReview,
    this.claimAmount,
  });

  bool get allPaid => openCount == 0;

  factory FeeSummary.fromJson(Map<String, dynamic> json) {
    final claim = json['claimUnderReview'] as Map<String, dynamic>?;
    return FeeSummary(
      totalOutstanding: (json['totalOutstanding'] as num).toDouble(),
      openCount: json['openCount'] as int,
      overdue: json['overdue'] as bool,
      next: json['next'] == null ? null : NextFee.fromJson(json['next'] as Map<String, dynamic>),
      claimsUnderReview: claim == null ? 0 : claim['count'] as int,
      claimAmount: (claim?['amount'] as num?)?.toDouble(),
    );
  }
}

class NextFee {
  final String studentFeeId;
  final String name;
  final double outstanding;
  final String dueDate;
  final bool overdue;

  const NextFee({
    required this.studentFeeId,
    required this.name,
    required this.outstanding,
    required this.dueDate,
    required this.overdue,
  });

  factory NextFee.fromJson(Map<String, dynamic> json) => NextFee(
        studentFeeId: json['studentFeeId'] as String,
        name: json['name'] as String,
        outstanding: (json['outstanding'] as num).toDouble(),
        dueDate: json['dueDate'] as String,
        overdue: json['overdue'] as bool,
      );
}

class HomeworkItem {
  final String id;
  final String? broadcastId;
  final List<String> photoUrls;
  final String caption;
  final String teacherName;
  final String? subject;
  final String? photoUrl;
  final DateTime? publishedAt;

  const HomeworkItem({
    required this.id,
    this.broadcastId,
    this.photoUrls = const [],
    required this.caption,
    required this.teacherName,
    this.subject,
    this.photoUrl,
    this.publishedAt,
  });

  factory HomeworkItem.fromJson(Map<String, dynamic> json) => HomeworkItem(
        id: json['id'] as String,
        broadcastId: json['broadcastId'] as String?,
        photoUrls: (json['photoUrls'] as List<dynamic>? ?? []).cast<String>(),
        caption: json['caption'] as String? ?? '',
        teacherName: json['teacherName'] as String? ?? '',
        subject: json['subject'] as String?,
        photoUrl: json['photoUrl'] as String?,
        publishedAt: json['publishedAt'] == null ? null : DateTime.parse(json['publishedAt'] as String),
      );
}

class NoticeItem {
  final String id;
  final String? broadcastId;
  final String? title;
  final String body;
  final DateTime createdAt;

  /// [{url, contentType}] — passed straight to the notice detail route.
  final List<Map<String, dynamic>> attachments;

  const NoticeItem({
    required this.id,
    this.broadcastId,
    this.title,
    required this.body,
    required this.createdAt,
    this.attachments = const [],
  });

  factory NoticeItem.fromJson(Map<String, dynamic> json) => NoticeItem(
        id: json['id'] as String,
        broadcastId: json['broadcastId'] as String?,
        title: json['title'] as String?,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        attachments: (json['attachments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      );
}

/// "YYYY-MM-DD" -> "DD/MM/YYYY".
String displayYmd(String ymd) {
  final p = ymd.split('-');
  return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : ymd;
}

/// Local calendar date of [dt] as DD/MM/YYYY.
String displayDate(DateTime dt) {
  final l = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(l.day)}/${two(l.month)}/${l.year}';
}
