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

  // ── Parent home (Phase 3) ──
  static String childWithClass(String name, String? className) => className == null ? name : '$name · $className';
  static const switchChild = 'Switch child';
  static String dueBy(String amount, String date) => '$amount due by $date';
  static const overdue = 'Overdue';
  static String moreDues(int n) => '+ $n more ${n == 1 ? 'fee' : 'fees'} pending';
  static const allFeesPaid = 'All fees paid';
  static String claimUnderReview(String? amount) =>
      amount == null ? 'Payment claim under review' : '$amount claim under review';
  static const payNow = 'Pay Now';
  static const viewFees = 'View fees';
  static const todayCardTitle = 'Today';
  static const noHomeworkToday = 'No homework today';
  static String homeworkBy(String teacher, String? subject) => subject == null ? teacher : '$teacher · $subject';
  static const latestNotice = 'Latest notice';
  static const noNotices = 'No notices yet';
  static const attendanceCardTitle = 'Attendance';
  static const couldNotLoadHome = "Couldn't load this child's summary.";

  // ── Menu ──
  static const menuFees = 'Fees';
  static const menuFeesSubtitle = 'Dues, online payment, upload proof, receipts';
  static const menuHomework = 'Homework';
  static const menuHomeworkSubtitle = "All homework sent to this child's class";
  static const menuNotices = 'Notices';
  static const menuNoticesSubtitle = 'Class and school notices';
  static const menuReports = 'Report Cards & Reports';
  static const menuReportsSubtitle = 'Report cards and progress reports';
  static const menuAttendance = 'Attendance';
  static const menuAttendanceSubtitle = 'Monthly calendar';

  // ── Lists ──
  static const noHomework = 'No homework yet';
  static const noReports = 'No report cards or reports yet';

  // ── Fees screen (3.4, 3.5) ──
  static const payOnline = 'Pay Online';
  static const paidByCashOrCheque = 'I paid by cash/cheque – upload proof';
  static const viewReceipts = 'Receipts';
  static const paidInFull = 'Paid in full';
  static String dueOn(String date) => 'Due $date';
  static const noFees = 'No fees found.';
  static const myClaims = 'Payment proofs you uploaded';
  static const claimStatusPending = 'Under review';
  static const claimStatusApproved = 'Approved';
  static const claimStatusRejected = 'Rejected';
  static String claimSubmitted(String date) => 'Submitted $date';
  static String claimRejectedReason(String reason) => 'Reason: $reason';
  static const downloadReceipt = 'Download receipt';
  static const openingReceipt = 'Opening…';
  static const couldNotOpenReceipt = 'Could not open the receipt. Please try again.';

  // ── Profile (3.6) ──
  static const logout = 'Log out';
  static const logoutConfirm = 'Log out of Schoolinkd on this phone?';
}
