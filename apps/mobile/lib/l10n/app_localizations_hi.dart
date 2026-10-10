// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'Schoolinkd';

  @override
  String get languageNativeName => 'हिन्दी';

  @override
  String get languageTitle => 'भाषा';

  @override
  String get languageChoose => 'अपनी भाषा चुनें';

  @override
  String get languageSaveFailed =>
      'Language changed on this phone. We couldn\'t save it to your account — it will be saved next time you change it.';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonSubmit => 'Submit';

  @override
  String get commonUpdate => 'Update';

  @override
  String get commonRetry => 'Retry now';

  @override
  String get commonContinue => 'Continue';

  @override
  String get commonRemove => 'Remove';

  @override
  String get commonClass => 'Class';

  @override
  String get commonStudent => 'Student';

  @override
  String get commonSendToClass => 'Send to class';

  @override
  String get commonCouldNotLoadClasses => 'Could not load your classes.';

  @override
  String get commonNotAssignedToClass =>
      'You aren\'t assigned to any class yet.';

  @override
  String get commonPullToRetry => 'Pull down to retry.';

  @override
  String commonListItem(String first, String second) {
    return '$first · $second';
  }

  @override
  String get errorNetworkTimeout =>
      'Network timeout — check your connection and try again.';

  @override
  String get errorNoInternet => 'No internet connection.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorTryAgain => 'Please try again.';

  @override
  String get errorPhoneNotRegistered =>
      'This number isn\'t registered. Please contact your school admin to add it.';

  @override
  String get errorSchoolNotFound =>
      'We couldn\'t find a school with this code. Check the code and try again.';

  @override
  String get authSchoolCodeIntro =>
      'Enter the school code your school gave you to get started.';

  @override
  String get authSchoolCodeLabel => 'School code';

  @override
  String get authSchoolCodeHint => 'e.g. greenfield-school';

  @override
  String get authSchoolCodeRequired => 'Enter your school code to continue.';

  @override
  String get authSignIn => 'Sign in';

  @override
  String get authEnterMobile => 'Enter your mobile number';

  @override
  String get authOtpExplainer =>
      'We\'ll send a one-time code to verify it\'s you.';

  @override
  String get authInvalidMobile => 'Enter a valid 10-digit mobile number.';

  @override
  String get authMobileLabel => 'Mobile number';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authCouldNotVerifyNumber =>
      'Could not verify your number. Please try again.';

  @override
  String get authCouldNotSendCode => 'Could not send verification code.';

  @override
  String get authCouldNotSendCodeRetry =>
      'Could not send verification code. Please try again.';

  @override
  String get authVerifyCodeTitle => 'Verify code';

  @override
  String get authEnterSixDigit => 'Enter the 6-digit code';

  @override
  String authSentTo(String phone) {
    return 'Sent to $phone';
  }

  @override
  String get authVerify => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String get authInvalidCode => 'Invalid code. Please try again.';

  @override
  String get authCodeExpired =>
      'This code has expired. Please request a new one.';

  @override
  String get roleParent => 'Parent';

  @override
  String get roleTeacher => 'Teacher';

  @override
  String get roleAdmin => 'Admin';

  @override
  String get roleAccounts => 'Accounts';

  @override
  String get roleSuperAdmin => 'Super admin';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileNoUser => 'No user profile available.';

  @override
  String get profileSchool => 'School';

  @override
  String get profileLogout => 'Log out';

  @override
  String get profileLogoutConfirm => 'Log out of Schoolinkd on this phone?';

  @override
  String dashboardGreeting(String name) {
    return 'Hi, $name';
  }

  @override
  String get dashboardNoChildren =>
      'No children are linked to your account yet. Please contact the school office.';

  @override
  String get dashboardCouldNotLoadChildren => 'Could not load your children.';

  @override
  String get teacherDashboardTitle => 'Teacher dashboard';

  @override
  String teacherSignedInAs(String name) {
    return 'Signed in as $name';
  }

  @override
  String get teacherSendHomework => 'Send Homework';

  @override
  String get teacherSendHomeworkSubtitle => 'Photos and a note for a class';

  @override
  String get teacherSendNotice => 'Send Notice';

  @override
  String get teacherSendNoticeSubtitle => 'Message all parents in your class';

  @override
  String get teacherReports => 'Reports';

  @override
  String get teacherReportsSubtitle => 'Progress reports and report cards';

  @override
  String get teacherAddStudentNote => 'Add Student Note';

  @override
  String get teacherAddStudentNoteSubtitle =>
      'Internal note, MOM, complaint or parent discussion';

  @override
  String get teacherWeeklyRoutine => 'Weekly Routine';

  @override
  String get teacherWeeklyRoutineSubtitle =>
      'Your own class timetable for the week';

  @override
  String get teacherAboutMyClasses => 'About My Class(es)';

  @override
  String get teacherAboutMyClassesSubtitle =>
      'Strength, subjects, and recent reports for your classes';

  @override
  String todayNow(String className, String subject) {
    return 'Now: $className · $subject';
  }

  @override
  String todayNowWithTime(String className, String subject, String time) {
    return 'Now: $className · $subject ($time)';
  }

  @override
  String todayNext(String className, String subject) {
    return 'Next: $className · $subject';
  }

  @override
  String todayNextWithTime(String className, String subject, String time) {
    return 'Next: $className · $subject ($time)';
  }

  @override
  String get todayNoMorePeriods => 'No more periods today';

  @override
  String get todayNoPeriods => 'No periods today';

  @override
  String todayPeriodLabel(int period, String className, String subject) {
    return 'P$period · $className · $subject';
  }

  @override
  String get myClassesEmpty => 'You are not linked to any classes yet.';

  @override
  String get myClassesCouldNotLoad =>
      'Could not load your classes. Pull down to retry.';

  @override
  String myClassesStrength(int boys, int girls, int total) {
    return 'Boys: $boys · Girls: $girls · Total: $total';
  }

  @override
  String get myClassesRecentReports => 'Recent reports';

  @override
  String get myClassesRead => 'Read';

  @override
  String get myClassesUnread => 'Unread';

  @override
  String get attendanceTitle => 'Attendance';

  @override
  String get attendanceMark => 'Mark Attendance';

  @override
  String get attendanceMarkSubtitle =>
      'Take today\'s attendance for your class';

  @override
  String get attendanceDoneForToday => 'Done for today';

  @override
  String attendanceDoneForClasses(int done, int total) {
    return '$done of $total classes done today';
  }

  @override
  String get attendancePickClass => 'Pick a class';

  @override
  String attendanceStudentCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count students',
      one: '1 student',
    );
    return '$_temp0';
  }

  @override
  String get attendancePresent => 'Present';

  @override
  String get attendanceAbsent => 'Absent';

  @override
  String get attendanceLate => 'Late';

  @override
  String get attendanceLeave => 'Leave';

  @override
  String get attendanceNotMarkedYet => 'Not marked yet';

  @override
  String get attendanceHoliday => 'Holiday';

  @override
  String attendanceHolidayToday(String name) {
    return 'Today is a holiday: $name';
  }

  @override
  String get attendanceTapHint =>
      'Tap to mark absent · long-press for Late or Leave';

  @override
  String attendanceCounts(int present, int absent) {
    return '$present present · $absent absent';
  }

  @override
  String attendanceCountsWithOther(int present, int absent, int other) {
    return '$present present · $absent absent · $other late/leave';
  }

  @override
  String attendanceConfirmSubmit(int present, int absent) {
    return 'Submit attendance: $present present, $absent absent?';
  }

  @override
  String get attendanceSubmitted => 'Attendance submitted';

  @override
  String get attendanceQueuedOffline =>
      'No connection — saved on this phone. It will be sent automatically.';

  @override
  String get attendancePendingSend => 'Waiting to send…';

  @override
  String get attendanceSendingNow => 'Sending…';

  @override
  String get attendanceAlreadySubmitted =>
      'Already submitted today — you can still change it until midnight.';

  @override
  String get attendanceReadOnlyDay =>
      'Attendance for this day can only be changed by an admin.';

  @override
  String get attendanceNoStudents => 'No students in this class yet.';

  @override
  String get attendanceNoClassesToMark =>
      'You\'re not the class teacher of any class yet.';

  @override
  String get attendanceCouldNotLoad => 'Could not load attendance.';

  @override
  String attendanceThisMonth(int present, int marked) {
    return 'This month: $present/$marked days';
  }

  @override
  String attendanceYearPercentage(String year, String percent) {
    return 'Academic year $year: $percent';
  }

  @override
  String attendanceToday(String status) {
    return 'Today: $status';
  }

  @override
  String get attendanceChooseStatus => 'Mark as';

  @override
  String homeChildWithClass(String name, String className) {
    return '$name · $className';
  }

  @override
  String get homeSwitchChild => 'Switch child';

  @override
  String homeDueBy(String amount, String date) {
    return '$amount due by $date';
  }

  @override
  String get homeOverdue => 'Overdue';

  @override
  String homeMoreDues(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+ $count more fees pending',
      one: '+ 1 more fee pending',
    );
    return '$_temp0';
  }

  @override
  String get homeAllFeesPaid => 'All fees paid';

  @override
  String get homeClaimUnderReview => 'Payment claim under review';

  @override
  String homeClaimAmountUnderReview(String amount) {
    return '$amount claim under review';
  }

  @override
  String get homePayNow => 'Pay Now';

  @override
  String get homeViewFees => 'View fees';

  @override
  String get homeTodayTitle => 'Today';

  @override
  String get homeNoHomeworkToday => 'No homework today';

  @override
  String get homeLatestNotice => 'Latest notice';

  @override
  String get homeCouldNotLoad => 'Couldn\'t load this child\'s summary.';

  @override
  String get menuFees => 'Fees';

  @override
  String get menuFeesSubtitle => 'Dues, online payment, upload proof, receipts';

  @override
  String get menuHomework => 'Homework';

  @override
  String get menuHomeworkSubtitle => 'All homework sent to this child\'s class';

  @override
  String get menuNotices => 'Notices';

  @override
  String get menuNoticesSubtitle => 'Class and school notices';

  @override
  String get menuReports => 'Report Cards & Reports';

  @override
  String get menuReportsSubtitle => 'Report cards and progress reports';

  @override
  String get menuAttendanceSubtitle => 'Monthly calendar';

  @override
  String get feesPayOnline => 'Pay Online';

  @override
  String get feesPaidByCashOrCheque => 'I paid by cash/cheque – upload proof';

  @override
  String get feesReceipts => 'Receipts';

  @override
  String get feesPaidInFull => 'Paid in full';

  @override
  String feesDueOn(String date) {
    return 'Due $date';
  }

  @override
  String feesAmountDue(String amount) {
    return '$amount due';
  }

  @override
  String get feesEmpty => 'No fees found.';

  @override
  String get feesMyClaims => 'Payment proofs you uploaded';

  @override
  String get feesCouldNotLoad => 'Could not load fees. Pull down to retry.';

  @override
  String get feeStatusPaid => 'Paid';

  @override
  String get feeStatusPending => 'Pending';

  @override
  String get feeStatusOverdue => 'Overdue';

  @override
  String get feeStatusPartial => 'Partly paid';

  @override
  String get feeStatusWaived => 'Waived';

  @override
  String get paymentModeCash => 'Cash';

  @override
  String get paymentModeCheque => 'Cheque';

  @override
  String get paymentModeBankTransfer => 'Bank Transfer';

  @override
  String get paymentModeUpi => 'UPI';

  @override
  String get paymentModeDemandDraft => 'Demand Draft';

  @override
  String get paymentModeOnline => 'Online Payment';

  @override
  String get claimStatusPending => 'Under review';

  @override
  String get claimStatusApproved => 'Approved';

  @override
  String get claimStatusRejected => 'Rejected';

  @override
  String claimSubmittedOn(String date) {
    return 'Submitted $date';
  }

  @override
  String claimClaimedAmount(String amount) {
    return 'Claimed amount: $amount';
  }

  @override
  String claimMode(String mode) {
    return 'Mode: $mode';
  }

  @override
  String claimRejectedReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get claimsTitle => 'My Payment Claims';

  @override
  String get claimsEmpty => 'No payment claims submitted yet.';

  @override
  String get claimsCouldNotLoad =>
      'Could not load your payment claims. Pull down to retry.';

  @override
  String get claimFormTitle => 'Already Paid?';

  @override
  String get claimFormIntro =>
      'Attach a photo or screenshot of your payment (bank transfer, cash receipt, cheque, etc.). The school will review it before it is recorded.';

  @override
  String get claimTakePhoto => 'Take photo';

  @override
  String get claimRetakePhoto => 'Retake photo';

  @override
  String get claimChooseFromGallery => 'Choose from gallery';

  @override
  String get claimAmountLabel => 'Amount paid (optional)';

  @override
  String get claimDateLabel => 'Date paid (optional)';

  @override
  String get claimSelectDate => 'Select a date';

  @override
  String get claimModeLabel => 'Payment mode (optional)';

  @override
  String get claimNoteLabel => 'Note (optional)';

  @override
  String get claimSubmitForReview => 'Submit for review';

  @override
  String get claimAttachProofFirst =>
      'Attach a photo or screenshot of the payment proof first.';

  @override
  String get claimSubmittedToast =>
      'Submitted — your school will review it shortly';

  @override
  String claimCouldNotSubmit(String reason) {
    return 'Could not submit your claim. $reason';
  }

  @override
  String get checkoutTitle => 'Pay fee';

  @override
  String get checkoutCouldNotLoad => 'Could not load this fee.';

  @override
  String get checkoutAmountDue => 'Amount due';

  @override
  String checkoutPayAmount(String amount) {
    return 'Pay $amount';
  }

  @override
  String get checkoutConfirmingWithBank =>
      'Payment received — confirming with the bank. Check back on this fee shortly.';

  @override
  String get checkoutConfirming => 'Confirming your payment…';

  @override
  String get checkoutSuccess => 'Payment successful';

  @override
  String get checkoutBackToFees => 'Back to fees';

  @override
  String get checkoutNotSetUp =>
      'Payment is not set up for this school yet. Please contact the school office.';

  @override
  String get checkoutCouldNotStart =>
      'Could not start payment. Please try again.';

  @override
  String get checkoutNotCompleted => 'Payment was not completed.';

  @override
  String get checkoutCouldNotConfirm =>
      'The payment could not be confirmed. Please try again.';

  @override
  String checkoutDescription(String studentName) {
    return 'Fee payment — $studentName';
  }

  @override
  String get receiptTitle => 'Receipt';

  @override
  String get receiptCouldNotLoad => 'Could not load this receipt.';

  @override
  String get receiptAmountReceived => 'Amount Received';

  @override
  String get receiptDiscountApplied => 'Discount applied';

  @override
  String receiptDiscountAppliedNamed(String name) {
    return 'Discount applied: $name';
  }

  @override
  String receiptMethod(String method) {
    return 'Method: $method';
  }

  @override
  String receiptPaidOn(String date) {
    return 'Paid on: $date';
  }

  @override
  String receiptReference(String reference) {
    return 'Reference: $reference';
  }

  @override
  String get receiptNotes => 'Notes';

  @override
  String get receiptDownload => 'Download receipt';

  @override
  String get receiptOpening => 'Opening…';

  @override
  String get receiptCouldNotOpen =>
      'Could not open the receipt. Please try again.';

  @override
  String get receiptsCouldNotLoad => 'Could not load receipts.';

  @override
  String get receiptsEmpty => 'No receipts yet for this fee.';

  @override
  String receiptsRowWithDiscount(String date) {
    return '$date · Discount applied';
  }

  @override
  String get noticeKind => 'Notice';

  @override
  String get homeworkKind => 'Homework';

  @override
  String get noticesEmpty => 'No notices yet';

  @override
  String get noticesCouldNotLoad => 'Could not load notices.';

  @override
  String get noticeOpenPdf => 'Open PDF';

  @override
  String get noticeEnterMessage => 'Enter a message.';

  @override
  String get noticeSent => 'Notice sent';

  @override
  String noticeCouldNotSend(String reason) {
    return 'Could not send the notice. $reason';
  }

  @override
  String get noticeNotClassTeacher =>
      'You aren\'t set as the class teacher for any class yet.';

  @override
  String get noticeTitleLabel => 'Title (optional)';

  @override
  String get noticeMessageLabel => 'Message';

  @override
  String get homeworkEmpty => 'No homework yet';

  @override
  String get homeworkCouldNotLoad => 'Could not load homework.';

  @override
  String homeworkBy(String teacher, String subject) {
    return '$teacher · $subject';
  }

  @override
  String get homeworkAddPhotoFirst => 'Add at least one photo.';

  @override
  String get homeworkDefaultBody => 'New homework has been posted.';

  @override
  String get homeworkSent => 'Homework sent';

  @override
  String homeworkCouldNotSend(String reason) {
    return 'Could not send the homework. $reason';
  }

  @override
  String get homeworkCaptionLabel => 'Caption (optional)';

  @override
  String get homeworkSubjectOptional => 'Subject (optional)';

  @override
  String get homeworkNoSubject => 'No subject';

  @override
  String get attachCamera => 'Camera';

  @override
  String get attachGallery => 'Gallery';

  @override
  String get attachPdf => 'Attach PDF';

  @override
  String get attachHintPhotos => 'Up to 3 photos';

  @override
  String get attachHintPhotosOrPdf => 'Up to 3 photos, or 1 PDF';

  @override
  String get sentTitle => 'Sent';

  @override
  String sentSeenBy(int seen, int total) {
    String _temp0 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: 'Seen by $seen/$total parents',
      one: 'Seen by $seen/1 parent',
    );
    return '$_temp0';
  }

  @override
  String get sentNotSeenYet => 'Haven\'t opened it yet';

  @override
  String get sentEveryoneSeen => 'Every parent has opened it';

  @override
  String get sentEmpty => 'Nothing sent yet';

  @override
  String get sentCouldNotLoad => 'Could not load sent items.';

  @override
  String get noteTypeLabel => 'Type';

  @override
  String get noteTextLabel => 'Note';

  @override
  String get noteTypeNote => 'Note';

  @override
  String get noteTypeMom => 'MOM';

  @override
  String get noteTypeComplaint => 'Complaint';

  @override
  String get noteTypeParentDiscussion => 'Parent Discussion';

  @override
  String get noteInternalHint =>
      'Only school staff can see this. Parents never see student notes.';

  @override
  String get noteSave => 'Save note';

  @override
  String get noteSaved => 'Note saved';

  @override
  String get noteEnterFirst => 'Type the note first.';

  @override
  String get noteRecent => 'Recent notes';

  @override
  String get noteCouldNotLoad => 'Could not load notes.';

  @override
  String get reportsEmptyTeacher => 'No reports yet.';

  @override
  String get reportsEmptyParent => 'No report cards or reports yet';

  @override
  String get reportsCouldNotLoad =>
      'Could not load reports. Pull down to retry.';

  @override
  String get reportsUploadTooltip => 'Upload Report Card';

  @override
  String get reportTitle => 'Report';

  @override
  String get reportCouldNotLoad => 'Could not load this report.';

  @override
  String reportBy(String name) {
    return 'By $name';
  }

  @override
  String get reportTypeAcademic => 'Academic';

  @override
  String get reportTypeAttendance => 'Attendance';

  @override
  String get reportTypeBehavior => 'Behaviour';

  @override
  String get reportTypeHomework => 'Homework';

  @override
  String get reportTypeReportCard => 'Report card';

  @override
  String get uploadTitle => 'Upload Report Card';

  @override
  String get uploadCouldNotLoadStudents => 'Could not load students.';

  @override
  String get uploadFillAll => 'Fill in all fields and choose a PDF.';

  @override
  String get uploadYearFormat =>
      'Academic year must be in format YYYY-YY, e.g. 2026-27.';

  @override
  String get uploadSuccess => 'Report card uploaded';

  @override
  String get uploadFailed => 'Could not upload the report card.';

  @override
  String get uploadTermLabel => 'Term';

  @override
  String get uploadTermHint => 'e.g. Term 1';

  @override
  String get uploadYearLabel => 'Academic Year';

  @override
  String get uploadYearHint => 'e.g. 2026-27';

  @override
  String get uploadChoosePdf => 'Choose PDF';

  @override
  String get uploadPublishNow => 'Publish now (parent can see it immediately)';

  @override
  String get uploadButton => 'Upload';

  @override
  String get timetableEmpty => 'No timetable has been set up for you yet.';

  @override
  String get timetableCouldNotLoad =>
      'Could not load your routine. Pull down to retry.';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsEmpty => 'No notifications yet.';

  @override
  String get notificationsCouldNotLoad =>
      'Could not load notifications. Pull down to retry.';
}
