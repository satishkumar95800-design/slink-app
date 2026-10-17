/// A parent's answer on a consent form.
enum ConsentStatus { approved, declined, pending }

ConsentStatus _status(String? s) => switch (s) {
      'APPROVED' => ConsentStatus.approved,
      'DECLINED' => ConsentStatus.declined,
      _ => ConsentStatus.pending,
    };

class ConsentEvent {
  final String title;
  final String? description;
  final DateTime startDate;
  final DateTime endDate;
  final String? startTime;
  final String? endTime;
  final String? venue;

  const ConsentEvent({
    required this.title,
    this.description,
    required this.startDate,
    required this.endDate,
    this.startTime,
    this.endTime,
    this.venue,
  });

  factory ConsentEvent.fromJson(Map<String, dynamic> j) => ConsentEvent(
        title: j['title'] as String,
        description: j['description'] as String?,
        startDate: DateTime.parse(j['startDate'] as String),
        endDate: DateTime.parse(j['endDate'] as String),
        startTime: j['startTime'] as String?,
        endTime: j['endTime'] as String?,
        venue: j['venue'] as String?,
      );
}

class ConsentAnswer {
  final ConsentStatus decision;
  final String signedName;
  final DateTime signedAt;
  final String? note;
  final bool signedByMe;
  final String? signedBy;

  const ConsentAnswer({
    required this.decision,
    required this.signedName,
    required this.signedAt,
    this.note,
    this.signedByMe = true,
    this.signedBy,
  });

  factory ConsentAnswer.fromJson(Map<String, dynamic> j) => ConsentAnswer(
        decision: _status(j['decision'] as String?),
        signedName: j['signedName'] as String,
        signedAt: DateTime.parse(j['signedAt'] as String).toLocal(),
        note: j['note'] as String?,
        signedByMe: j['signedByMe'] as bool? ?? true,
        signedBy: j['signedBy'] as String?,
      );
}

/// One consent form for one child (GET /consent-forms/mine).
class ConsentItem {
  final String formId;
  final String studentId;
  final String studentName;
  final String className;
  final ConsentEvent event;
  final String body;
  final DateTime deadline;
  final bool open;
  final ConsentStatus status;
  final ConsentAnswer? response;

  const ConsentItem({
    required this.formId,
    required this.studentId,
    required this.studentName,
    required this.className,
    required this.event,
    required this.body,
    required this.deadline,
    required this.open,
    required this.status,
    this.response,
  });

  bool get needsAnswer => open && status == ConsentStatus.pending;

  factory ConsentItem.fromJson(Map<String, dynamic> j) => ConsentItem(
        formId: j['formId'] as String,
        studentId: j['studentId'] as String,
        studentName: j['studentName'] as String,
        className: j['className'] as String? ?? '',
        event: ConsentEvent.fromJson(j['event'] as Map<String, dynamic>),
        body: j['body'] as String,
        deadline: DateTime.parse(j['deadline'] as String),
        open: j['open'] as bool? ?? false,
        status: _status(j['status'] as String?),
        response: j['response'] == null ? null : ConsentAnswer.fromJson(j['response'] as Map<String, dynamic>),
      );
}
