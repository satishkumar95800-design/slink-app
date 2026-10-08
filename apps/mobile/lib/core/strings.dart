/// User-facing text added from docs/SPEC-improvements.md onwards lives here, so
/// Kannada/Hindi can be added later without touching widgets.
abstract final class AppStrings {
  static const appName = 'Schoolinkd';

  static String amountDue(String amount) => '$amount due';
  static String payAmount(String amount) => 'Pay $amount';
  static String claimedAmount(String amount) => 'Claimed amount: $amount';

  // ── Attendance (Phase 2) ──
  static const markAttendance = 'Mark Attendance';
  static const markAttendanceSubtitle = "Take today's attendance for your class";
  static const doneForToday = 'Done for today';
  static String doneForClasses(int done, int total) => '$done of $total classes done today';
  static const pickClass = 'Pick a class';
  static const attendance = 'Attendance';
  static const attendanceSubtitle = 'Monthly calendar and attendance percentage';
  static const present = 'Present';
  static const absent = 'Absent';
  static const late = 'Late';
  static const leave = 'Leave';
  static const notMarkedYet = 'Not marked yet';
  static const holiday = 'Holiday';
  static String holidayToday(String name) => 'Today is a holiday: $name';
  static const tapHint = 'Tap to mark absent · long-press for Late or Leave';
  static String countsLine(int present, int absent, int other) =>
      '$present present · $absent absent${other > 0 ? ' · $other late/leave' : ''}';
  static const submit = 'Submit';
  static const update = 'Update';
  static String confirmSubmit(int present, int absent) => 'Submit attendance: $present present, $absent absent?';
  static const cancel = 'Cancel';
  static const confirm = 'Confirm';
  static const submitted = 'Attendance submitted';
  static const queuedOffline = "No connection — saved on this phone. It will be sent automatically.";
  static const pendingSend = 'Waiting to send…';
  static const sendingNow = 'Sending…';
  static const sendFailed = "Couldn't send yet — will keep retrying";
  static const retryNow = 'Retry now';
  static const alreadySubmittedEditable = 'Already submitted today — you can still change it until midnight.';
  static const readOnlyDay = 'Attendance for this day can only be changed by an admin.';
  static const noStudents = 'No students in this class yet.';
  static const noClassesToMark = "You're not the class teacher of any class yet.";
  static const couldNotLoad = 'Could not load attendance.';
  static String thisMonth(int present, int marked) => 'This month: $present/$marked days';
  static String yearPercentage(String label, double? pct) =>
      'Academic year $label: ${pct == null ? '—' : '${pct.toStringAsFixed(pct.truncateToDouble() == pct ? 0 : 1)}%'}';
  static String todayStatus(String status) => 'Today: $status';
  static const weekdayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  static const legendTitle = 'Key';
  static const chooseStatus = 'Mark as';
}
