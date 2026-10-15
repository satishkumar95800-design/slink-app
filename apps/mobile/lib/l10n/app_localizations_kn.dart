// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kannada (`kn`).
class AppLocalizationsKn extends AppLocalizations {
  AppLocalizationsKn([String locale = 'kn']) : super(locale);

  @override
  String get appName => 'Schoolinkd';

  @override
  String get languageNativeName => 'ಕನ್ನಡ';

  @override
  String get languageTitle => 'ಭಾಷೆ';

  @override
  String get languageChoose => 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get languageSaveFailed =>
      'ಈ ಫೋನ್‌ನಲ್ಲಿ ಭಾಷೆ ಬದಲಾಗಿದೆ. ನಿಮ್ಮ ಖಾತೆಗೆ ಉಳಿಸಲಾಗಲಿಲ್ಲ — ಮುಂದಿನ ಬಾರಿ ಬದಲಿಸಿದಾಗ ಉಳಿಸಲಾಗುತ್ತದೆ.';

  @override
  String get commonCancel => 'ರದ್ದುಮಾಡಿ';

  @override
  String get commonConfirm => 'ದೃಢೀಕರಿಸಿ';

  @override
  String get commonSubmit => 'ಸಲ್ಲಿಸಿ';

  @override
  String get commonUpdate => 'ನವೀಕರಿಸಿ';

  @override
  String get commonRetry => 'ಈಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get commonContinue => 'ಮುಂದುವರಿಸಿ';

  @override
  String get commonRemove => 'ತೆಗೆದುಹಾಕಿ';

  @override
  String get commonClass => 'ತರಗತಿ';

  @override
  String get commonStudent => 'ವಿದ್ಯಾರ್ಥಿ';

  @override
  String get commonSendToClass => 'ತರಗತಿಗೆ ಕಳುಹಿಸಿ';

  @override
  String get commonCouldNotLoadClasses => 'ನಿಮ್ಮ ತರಗತಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get commonNotAssignedToClass =>
      'ನಿಮಗೆ ಇನ್ನೂ ಯಾವುದೇ ತರಗತಿ ನಿಗದಿಯಾಗಿಲ್ಲ.';

  @override
  String get commonPullToRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String commonListItem(String first, String second) {
    return '$first · $second';
  }

  @override
  String get errorNetworkTimeout =>
      'ನೆಟ್‌ವರ್ಕ್ ಸಮಯ ಮೀರಿದೆ — ನಿಮ್ಮ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorNoInternet => 'ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವಿಲ್ಲ.';

  @override
  String get errorGeneric => 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorTryAgain => 'ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorPhoneNotRegistered =>
      'ಈ ಸಂಖ್ಯೆ ನೋಂದಾಯಿತವಾಗಿಲ್ಲ. ಸೇರಿಸಲು ನಿಮ್ಮ ಶಾಲಾ ನಿರ್ವಾಹಕರನ್ನು ಸಂಪರ್ಕಿಸಿ.';

  @override
  String get errorSchoolNotFound =>
      'ಈ ಕೋಡ್‌ನ ಶಾಲೆ ಸಿಗಲಿಲ್ಲ. ಕೋಡ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get authSchoolCodeIntro =>
      'ಆರಂಭಿಸಲು ನಿಮ್ಮ ಶಾಲೆ ನೀಡಿದ ಶಾಲಾ ಕೋಡ್ ನಮೂದಿಸಿ.';

  @override
  String get authSchoolCodeLabel => 'ಶಾಲಾ ಕೋಡ್';

  @override
  String get authSchoolCodeHint => 'ಉದಾ. greenfield-school';

  @override
  String get authSchoolCodeRequired => 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಶಾಲಾ ಕೋಡ್ ನಮೂದಿಸಿ.';

  @override
  String get authSignIn => 'ಲಾಗಿನ್';

  @override
  String get authEnterMobile => 'ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ';

  @override
  String get authOtpExplainer =>
      'ನೀವೇ ಎಂದು ಖಚಿತಪಡಿಸಲು ಒಂದು ಬಾರಿಯ ಕೋಡ್ ಕಳುಹಿಸುತ್ತೇವೆ.';

  @override
  String get authInvalidMobile => 'ಸರಿಯಾದ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.';

  @override
  String get authMobileLabel => 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ';

  @override
  String get authSendCode => 'ಕೋಡ್ ಕಳುಹಿಸಿ';

  @override
  String get authCouldNotVerifyNumber =>
      'ನಿಮ್ಮ ಸಂಖ್ಯೆ ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get authCouldNotSendCode => 'ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ.';

  @override
  String get authCouldNotSendCodeRetry =>
      'ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get authVerifyCodeTitle => 'ಕೋಡ್ ಪರಿಶೀಲಿಸಿ';

  @override
  String get authEnterSixDigit => '6 ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ';

  @override
  String authSentTo(String phone) {
    return '$phone ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ';
  }

  @override
  String get authVerify => 'ಪರಿಶೀಲಿಸಿ';

  @override
  String get authResendCode => 'ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ';

  @override
  String get authInvalidCode => 'ಕೋಡ್ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get authCodeExpired => 'ಈ ಕೋಡ್‌ನ ಅವಧಿ ಮುಗಿದಿದೆ. ಹೊಸ ಕೋಡ್ ಕೇಳಿ.';

  @override
  String get roleParent => 'ಪೋಷಕರು';

  @override
  String get roleTeacher => 'ಶಿಕ್ಷಕರು';

  @override
  String get roleAdmin => 'ನಿರ್ವಾಹಕರು';

  @override
  String get roleAccounts => 'ಲೆಕ್ಕಪತ್ರ';

  @override
  String get roleSuperAdmin => 'ಸೂಪರ್ ನಿರ್ವಾಹಕರು';

  @override
  String get profileTitle => 'ಪ್ರೊಫೈಲ್';

  @override
  String get profileNoUser => 'ಬಳಕೆದಾರರ ಪ್ರೊಫೈಲ್ ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get profileSchool => 'ಶಾಲೆ';

  @override
  String get profileDarkTheme => 'ಡಾರ್ಕ್ ಥೀಮ್';

  @override
  String get profileLogout => 'ಲಾಗ್ ಔಟ್';

  @override
  String get profileLogoutConfirm =>
      'ಈ ಫೋನ್‌ನಲ್ಲಿ Schoolinkd ನಿಂದ ಲಾಗ್ ಔಟ್ ಆಗುವುದೇ?';

  @override
  String dashboardGreeting(String name) {
    return 'ನಮಸ್ಕಾರ, $name';
  }

  @override
  String get dashboardNoChildren =>
      'ನಿಮ್ಮ ಖಾತೆಗೆ ಇನ್ನೂ ಯಾವುದೇ ಮಕ್ಕಳನ್ನು ಜೋಡಿಸಿಲ್ಲ. ದಯವಿಟ್ಟು ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.';

  @override
  String get dashboardCouldNotLoadChildren =>
      'ನಿಮ್ಮ ಮಕ್ಕಳ ಮಾಹಿತಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get teacherDashboardTitle => 'ಶಿಕ್ಷಕರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್';

  @override
  String teacherSignedInAs(String name) {
    return '$name ಆಗಿ ಲಾಗಿನ್ ಆಗಿದ್ದೀರಿ';
  }

  @override
  String get teacherSendHomework => 'ಮನೆಗೆಲಸ ಕಳುಹಿಸಿ';

  @override
  String get teacherSendHomeworkSubtitle => 'ತರಗತಿಗೆ ಫೋಟೋಗಳು ಮತ್ತು ಟಿಪ್ಪಣಿ';

  @override
  String get teacherSendNotice => 'ಸೂಚನೆ ಕಳುಹಿಸಿ';

  @override
  String get teacherSendNoticeSubtitle => 'ನಿಮ್ಮ ತರಗತಿಯ ಎಲ್ಲಾ ಪೋಷಕರಿಗೆ ಸಂದೇಶ';

  @override
  String get teacherReports => 'ವರದಿಗಳು';

  @override
  String get teacherReportsSubtitle => 'ಪ್ರಗತಿ ವರದಿಗಳು ಮತ್ತು ಪ್ರಗತಿ ಪತ್ರಗಳು';

  @override
  String get teacherAddStudentNote => 'ವಿದ್ಯಾರ್ಥಿ ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ';

  @override
  String get teacherAddStudentNoteSubtitle =>
      'ಆಂತರಿಕ ಟಿಪ್ಪಣಿ, ಸಭೆಯ ನಡಾವಳಿ, ದೂರು ಅಥವಾ ಪೋಷಕರೊಂದಿಗೆ ಚರ್ಚೆ';

  @override
  String get teacherWeeklyRoutine => 'ವಾರದ ವೇಳಾಪಟ್ಟಿ';

  @override
  String get teacherWeeklyRoutineSubtitle => 'ವಾರದ ನಿಮ್ಮ ತರಗತಿ ವೇಳಾಪಟ್ಟಿ';

  @override
  String get teacherAboutMyClasses => 'ನನ್ನ ತರಗತಿಗಳ ಬಗ್ಗೆ';

  @override
  String get teacherAboutMyClassesSubtitle =>
      'ನಿಮ್ಮ ತರಗತಿಗಳ ಸಂಖ್ಯೆ, ವಿಷಯಗಳು ಮತ್ತು ಇತ್ತೀಚಿನ ವರದಿಗಳು';

  @override
  String todayNow(String className, String subject) {
    return 'ಈಗ: $className · $subject';
  }

  @override
  String todayNowWithTime(String className, String subject, String time) {
    return 'ಈಗ: $className · $subject ($time)';
  }

  @override
  String todayNext(String className, String subject) {
    return 'ಮುಂದೆ: $className · $subject';
  }

  @override
  String todayNextWithTime(String className, String subject, String time) {
    return 'ಮುಂದೆ: $className · $subject ($time)';
  }

  @override
  String get todayNoMorePeriods => 'ಇಂದು ಇನ್ನು ಅವಧಿಗಳಿಲ್ಲ';

  @override
  String get todayNoPeriods => 'ಇಂದು ಅವಧಿಗಳಿಲ್ಲ';

  @override
  String todayPeriodLabel(int period, String className, String subject) {
    return 'ಅ$period · $className · $subject';
  }

  @override
  String get myClassesEmpty => 'ನಿಮಗೆ ಇನ್ನೂ ಯಾವುದೇ ತರಗತಿ ಜೋಡಿಸಿಲ್ಲ.';

  @override
  String get myClassesCouldNotLoad =>
      'ನಿಮ್ಮ ತರಗತಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String myClassesStrength(int boys, int girls, int total) {
    return 'ಹುಡುಗರು: $boys · ಹುಡುಗಿಯರು: $girls · ಒಟ್ಟು: $total';
  }

  @override
  String get myClassesRecentReports => 'ಇತ್ತೀಚಿನ ವರದಿಗಳು';

  @override
  String get myClassesRead => 'ಓದಿದೆ';

  @override
  String get myClassesUnread => 'ಓದಿಲ್ಲ';

  @override
  String get attendanceTitle => 'ಹಾಜರಾತಿ';

  @override
  String get attendanceMark => 'ಹಾಜರಾತಿ ಗುರುತಿಸಿ';

  @override
  String get attendanceMarkSubtitle =>
      'ನಿಮ್ಮ ತರಗತಿಯ ಇಂದಿನ ಹಾಜರಾತಿ ತೆಗೆದುಕೊಳ್ಳಿ';

  @override
  String get attendanceDoneForToday => 'ಇಂದಿನದು ಮುಗಿದಿದೆ';

  @override
  String attendanceDoneForClasses(int done, int total) {
    return 'ಇಂದು $total ರಲ್ಲಿ $done ತರಗತಿಗಳು ಮುಗಿದಿವೆ';
  }

  @override
  String get attendancePickClass => 'ತರಗತಿ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String attendanceStudentCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ವಿದ್ಯಾರ್ಥಿಗಳು',
      one: '1 ವಿದ್ಯಾರ್ಥಿ',
    );
    return '$_temp0';
  }

  @override
  String get attendancePresent => 'ಹಾಜರು';

  @override
  String get attendanceAbsent => 'ಗೈರು';

  @override
  String get attendanceLate => 'ತಡ';

  @override
  String get attendanceLeave => 'ರಜೆ';

  @override
  String get attendanceNotMarkedYet => 'ಇನ್ನೂ ಗುರುತಿಸಿಲ್ಲ';

  @override
  String get attendanceHoliday => 'ರಜೆ';

  @override
  String attendanceHolidayToday(String name) {
    return 'ಇಂದು ರಜೆ: $name';
  }

  @override
  String get attendanceTapHint =>
      'ಗೈರು ಎಂದು ಗುರುತಿಸಲು ಒತ್ತಿ · ತಡ ಅಥವಾ ರಜೆಗೆ ದೀರ್ಘವಾಗಿ ಒತ್ತಿ';

  @override
  String attendanceCounts(int present, int absent) {
    return '$present ಹಾಜರು · $absent ಗೈರು';
  }

  @override
  String attendanceCountsWithOther(int present, int absent, int other) {
    return '$present ಹಾಜರು · $absent ಗೈರು · $other ತಡ/ರಜೆ';
  }

  @override
  String attendanceConfirmSubmit(int present, int absent) {
    return 'ಹಾಜರಾತಿ ಸಲ್ಲಿಸುವುದೇ: $present ಹಾಜರು, $absent ಗೈರು?';
  }

  @override
  String get attendanceSubmitted => 'ಹಾಜರಾತಿ ಸಲ್ಲಿಸಲಾಗಿದೆ';

  @override
  String get attendanceQueuedOffline =>
      'ಸಂಪರ್ಕವಿಲ್ಲ — ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ. ತಾನಾಗಿಯೇ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.';

  @override
  String get attendancePendingSend => 'ಕಳುಹಿಸಲು ಕಾಯುತ್ತಿದೆ…';

  @override
  String get attendanceSendingNow => 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get attendanceAlreadySubmitted =>
      'ಇಂದು ಈಗಾಗಲೇ ಸಲ್ಲಿಸಲಾಗಿದೆ — ಮಧ್ಯರಾತ್ರಿಯವರೆಗೆ ಬದಲಿಸಬಹುದು.';

  @override
  String get attendanceReadOnlyDay =>
      'ಈ ದಿನದ ಹಾಜರಾತಿಯನ್ನು ನಿರ್ವಾಹಕರು ಮಾತ್ರ ಬದಲಿಸಬಹುದು.';

  @override
  String get attendanceNoStudents => 'ಈ ತರಗತಿಯಲ್ಲಿ ಇನ್ನೂ ವಿದ್ಯಾರ್ಥಿಗಳಿಲ್ಲ.';

  @override
  String get attendanceNoClassesToMark =>
      'ನೀವು ಇನ್ನೂ ಯಾವುದೇ ತರಗತಿಯ ತರಗತಿ ಶಿಕ್ಷಕರಲ್ಲ.';

  @override
  String get attendanceCouldNotLoad => 'ಹಾಜರಾತಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String attendanceThisMonth(int present, int marked) {
    return 'ಈ ತಿಂಗಳು: $present/$marked ದಿನಗಳು';
  }

  @override
  String attendanceYearPercentage(String year, String percent) {
    return 'ಶೈಕ್ಷಣಿಕ ವರ್ಷ $year: $percent';
  }

  @override
  String attendanceToday(String status) {
    return 'ಇಂದು: $status';
  }

  @override
  String get attendanceChooseStatus => 'ಹೀಗೆ ಗುರುತಿಸಿ';

  @override
  String homeChildWithClass(String name, String className) {
    return '$name · $className';
  }

  @override
  String get homeSwitchChild => 'ಮಗುವನ್ನು ಬದಲಿಸಿ';

  @override
  String homeDueBy(String amount, String date) {
    return '$date ರೊಳಗೆ $amount ಪಾವತಿಸಬೇಕು';
  }

  @override
  String get homeOverdue => 'ಅವಧಿ ಮೀರಿದೆ';

  @override
  String homeMoreDues(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+ ಇನ್ನೂ $count ಶುಲ್ಕಗಳು ಬಾಕಿ',
      one: '+ ಇನ್ನೂ 1 ಶುಲ್ಕ ಬಾಕಿ',
    );
    return '$_temp0';
  }

  @override
  String get homeAllFeesPaid => 'ಎಲ್ಲಾ ಶುಲ್ಕ ಪಾವತಿಸಲಾಗಿದೆ';

  @override
  String get homeClaimUnderReview => 'ಪಾವತಿ ಕ್ಲೇಮ್ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ';

  @override
  String homeClaimAmountUnderReview(String amount) {
    return '$amount ಕ್ಲೇಮ್ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ';
  }

  @override
  String get homePayNow => 'ಈಗ ಪಾವತಿಸಿ';

  @override
  String get homeViewFees => 'ಶುಲ್ಕ ನೋಡಿ';

  @override
  String get homeTodayTitle => 'ಇಂದು';

  @override
  String get homeNoHomeworkToday => 'ಇಂದು ಮನೆಗೆಲಸ ಇಲ್ಲ';

  @override
  String get homeLatestNotice => 'ಇತ್ತೀಚಿನ ಸೂಚನೆ';

  @override
  String get homeCouldNotLoad => 'ಈ ಮಗುವಿನ ಸಾರಾಂಶ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get menuFees => 'ಶುಲ್ಕ';

  @override
  String get menuFeesSubtitle =>
      'ಬಾಕಿ, ಆನ್‌ಲೈನ್ ಪಾವತಿ, ಪುರಾವೆ ಅಪ್‌ಲೋಡ್, ರಸೀದಿಗಳು';

  @override
  String get menuHomework => 'ಮನೆಗೆಲಸ';

  @override
  String get menuHomeworkSubtitle => 'ಈ ಮಗುವಿನ ತರಗತಿಗೆ ಕಳುಹಿಸಿದ ಎಲ್ಲಾ ಮನೆಗೆಲಸ';

  @override
  String get menuNotices => 'ಸೂಚನೆಗಳು';

  @override
  String get menuNoticesSubtitle => 'ತರಗತಿ ಮತ್ತು ಶಾಲಾ ಸೂಚನೆಗಳು';

  @override
  String get menuReports => 'ಪ್ರಗತಿ ಪತ್ರಗಳು ಮತ್ತು ವರದಿಗಳು';

  @override
  String get menuReportsSubtitle => 'ಪ್ರಗತಿ ಪತ್ರಗಳು ಮತ್ತು ಪ್ರಗತಿ ವರದಿಗಳು';

  @override
  String get menuAttendanceSubtitle => 'ತಿಂಗಳ ಕ್ಯಾಲೆಂಡರ್';

  @override
  String get feesPayOnline => 'ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಪಾವತಿಸಿ';

  @override
  String get feesPaidByCashOrCheque =>
      'ನಗದು/ಚೆಕ್ ಮೂಲಕ ಪಾವತಿಸಿದ್ದೇನೆ – ಪುರಾವೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String get feesReceipts => 'ರಸೀದಿಗಳು';

  @override
  String get feesPaidInFull => 'ಪೂರ್ಣ ಪಾವತಿ';

  @override
  String feesDueOn(String date) {
    return 'ಕೊನೆಯ ದಿನಾಂಕ $date';
  }

  @override
  String feesAmountDue(String amount) {
    return '$amount ಬಾಕಿ';
  }

  @override
  String get feesEmpty => 'ಯಾವುದೇ ಶುಲ್ಕ ಸಿಗಲಿಲ್ಲ.';

  @override
  String get feesMyClaims => 'ನೀವು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಪಾವತಿ ಪುರಾವೆಗಳು';

  @override
  String get feesCouldNotLoad =>
      'ಶುಲ್ಕ ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get feeStatusPaid => 'ಪಾವತಿಸಲಾಗಿದೆ';

  @override
  String get feeStatusPending => 'ಬಾಕಿ';

  @override
  String get feeStatusOverdue => 'ಅವಧಿ ಮೀರಿದೆ';

  @override
  String get feeStatusPartial => 'ಭಾಗಶಃ ಪಾವತಿ';

  @override
  String get feeStatusWaived => 'ಮನ್ನಾ';

  @override
  String get paymentModeCash => 'ನಗದು';

  @override
  String get paymentModeCheque => 'ಚೆಕ್';

  @override
  String get paymentModeBankTransfer => 'ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ';

  @override
  String get paymentModeUpi => 'UPI';

  @override
  String get paymentModeDemandDraft => 'ಡಿಮ್ಯಾಂಡ್ ಡ್ರಾಫ್ಟ್';

  @override
  String get paymentModeOnline => 'ಆನ್‌ಲೈನ್ ಪಾವತಿ';

  @override
  String get claimStatusPending => 'ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ';

  @override
  String get claimStatusApproved => 'ಅನುಮೋದಿಸಲಾಗಿದೆ';

  @override
  String get claimStatusRejected => 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ';

  @override
  String claimSubmittedOn(String date) {
    return '$date ರಂದು ಸಲ್ಲಿಸಲಾಗಿದೆ';
  }

  @override
  String claimClaimedAmount(String amount) {
    return 'ಕ್ಲೇಮ್ ಮಾಡಿದ ಮೊತ್ತ: $amount';
  }

  @override
  String claimMode(String mode) {
    return 'ವಿಧಾನ: $mode';
  }

  @override
  String claimRejectedReason(String reason) {
    return 'ಕಾರಣ: $reason';
  }

  @override
  String get claimsTitle => 'ನನ್ನ ಪಾವತಿ ಕ್ಲೇಮ್‌ಗಳು';

  @override
  String get claimsEmpty => 'ಇನ್ನೂ ಯಾವುದೇ ಪಾವತಿ ಕ್ಲೇಮ್ ಸಲ್ಲಿಸಿಲ್ಲ.';

  @override
  String get claimsCouldNotLoad =>
      'ನಿಮ್ಮ ಪಾವತಿ ಕ್ಲೇಮ್‌ಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get claimFormTitle => 'ಈಗಾಗಲೇ ಪಾವತಿಸಿದ್ದೀರಾ?';

  @override
  String get claimFormIntro =>
      'ನಿಮ್ಮ ಪಾವತಿಯ ಫೋಟೋ ಅಥವಾ ಸ್ಕ್ರೀನ್‌ಶಾಟ್ ಲಗತ್ತಿಸಿ (ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ, ನಗದು ರಸೀದಿ, ಚೆಕ್ ಇತ್ಯಾದಿ). ದಾಖಲಿಸುವ ಮೊದಲು ಶಾಲೆ ಇದನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.';

  @override
  String get claimTakePhoto => 'ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get claimRetakePhoto => 'ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get claimChooseFromGallery => 'ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get claimAmountLabel => 'ಪಾವತಿಸಿದ ಮೊತ್ತ (ಐಚ್ಛಿಕ)';

  @override
  String get claimDateLabel => 'ಪಾವತಿಸಿದ ದಿನಾಂಕ (ಐಚ್ಛಿಕ)';

  @override
  String get claimSelectDate => 'ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get claimModeLabel => 'ಪಾವತಿ ವಿಧಾನ (ಐಚ್ಛಿಕ)';

  @override
  String get claimNoteLabel => 'ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)';

  @override
  String get claimSubmitForReview => 'ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ';

  @override
  String get claimAttachProofFirst =>
      'ಮೊದಲು ಪಾವತಿ ಪುರಾವೆಯ ಫೋಟೋ ಅಥವಾ ಸ್ಕ್ರೀನ್‌ಶಾಟ್ ಲಗತ್ತಿಸಿ.';

  @override
  String get claimSubmittedToast =>
      'ಸಲ್ಲಿಸಲಾಗಿದೆ — ನಿಮ್ಮ ಶಾಲೆ ಶೀಘ್ರದಲ್ಲೇ ಪರಿಶೀಲಿಸುತ್ತದೆ';

  @override
  String claimCouldNotSubmit(String reason) {
    return 'ನಿಮ್ಮ ಕ್ಲೇಮ್ ಸಲ್ಲಿಸಲಾಗಲಿಲ್ಲ. $reason';
  }

  @override
  String get checkoutTitle => 'ಶುಲ್ಕ ಪಾವತಿಸಿ';

  @override
  String get checkoutCouldNotLoad => 'ಈ ಶುಲ್ಕ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get checkoutAmountDue => 'ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ';

  @override
  String checkoutPayAmount(String amount) {
    return '$amount ಪಾವತಿಸಿ';
  }

  @override
  String get checkoutConfirmingWithBank =>
      'ಪಾವತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ — ಬ್ಯಾಂಕ್‌ನೊಂದಿಗೆ ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಈ ಶುಲ್ಕವನ್ನು ಮತ್ತೆ ನೋಡಿ.';

  @override
  String get checkoutConfirming => 'ನಿಮ್ಮ ಪಾವತಿ ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get checkoutSuccess => 'ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ';

  @override
  String get checkoutBackToFees => 'ಶುಲ್ಕಕ್ಕೆ ಹಿಂತಿರುಗಿ';

  @override
  String get checkoutNotSetUp =>
      'ಈ ಶಾಲೆಗೆ ಇನ್ನೂ ಆನ್‌ಲೈನ್ ಪಾವತಿ ವ್ಯವಸ್ಥೆ ಇಲ್ಲ. ದಯವಿಟ್ಟು ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.';

  @override
  String get checkoutCouldNotStart =>
      'ಪಾವತಿ ಆರಂಭಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get checkoutNotCompleted => 'ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ.';

  @override
  String get checkoutCouldNotConfirm =>
      'ಪಾವತಿ ದೃಢೀಕರಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String checkoutDescription(String studentName) {
    return 'ಶುಲ್ಕ ಪಾವತಿ — $studentName';
  }

  @override
  String get receiptTitle => 'ರಸೀದಿ';

  @override
  String get receiptCouldNotLoad => 'ಈ ರಸೀದಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get receiptAmountReceived => 'ಸ್ವೀಕರಿಸಿದ ಮೊತ್ತ';

  @override
  String get receiptDiscountApplied => 'ರಿಯಾಯಿತಿ ಅನ್ವಯಿಸಲಾಗಿದೆ';

  @override
  String receiptDiscountAppliedNamed(String name) {
    return 'ರಿಯಾಯಿತಿ ಅನ್ವಯಿಸಲಾಗಿದೆ: $name';
  }

  @override
  String receiptMethod(String method) {
    return 'ವಿಧಾನ: $method';
  }

  @override
  String receiptPaidOn(String date) {
    return 'ಪಾವತಿ ದಿನಾಂಕ: $date';
  }

  @override
  String receiptReference(String reference) {
    return 'ಉಲ್ಲೇಖ: $reference';
  }

  @override
  String get receiptNotes => 'ಟಿಪ್ಪಣಿಗಳು';

  @override
  String get receiptDownload => 'ರಸೀದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String get receiptOpening => 'ತೆರೆಯಲಾಗುತ್ತಿದೆ…';

  @override
  String get receiptCouldNotOpen =>
      'ರಸೀದಿ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get receiptsCouldNotLoad => 'ರಸೀದಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get receiptsEmpty => 'ಈ ಶುಲ್ಕಕ್ಕೆ ಇನ್ನೂ ರಸೀದಿಗಳಿಲ್ಲ.';

  @override
  String receiptsRowWithDiscount(String date) {
    return '$date · ರಿಯಾಯಿತಿ ಅನ್ವಯಿಸಲಾಗಿದೆ';
  }

  @override
  String get noticeKind => 'ಸೂಚನೆ';

  @override
  String get homeworkKind => 'ಮನೆಗೆಲಸ';

  @override
  String get noticesEmpty => 'ಇನ್ನೂ ಸೂಚನೆಗಳಿಲ್ಲ';

  @override
  String get noticesCouldNotLoad => 'ಸೂಚನೆಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get noticeOpenPdf => 'PDF ತೆರೆಯಿರಿ';

  @override
  String get noticeEnterMessage => 'ಸಂದೇಶ ನಮೂದಿಸಿ.';

  @override
  String get noticeSent => 'ಸೂಚನೆ ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String noticeCouldNotSend(String reason) {
    return 'ಸೂಚನೆ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. $reason';
  }

  @override
  String get noticeNotClassTeacher =>
      'ನಿಮ್ಮನ್ನು ಇನ್ನೂ ಯಾವುದೇ ತರಗತಿಯ ತರಗತಿ ಶಿಕ್ಷಕರಾಗಿ ನೇಮಿಸಿಲ್ಲ.';

  @override
  String get noticeTitleLabel => 'ಶೀರ್ಷಿಕೆ (ಐಚ್ಛಿಕ)';

  @override
  String get noticeMessageLabel => 'ಸಂದೇಶ';

  @override
  String get homeworkEmpty => 'ಇನ್ನೂ ಮನೆಗೆಲಸ ಇಲ್ಲ';

  @override
  String get homeworkCouldNotLoad => 'ಮನೆಗೆಲಸ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String homeworkBy(String teacher, String subject) {
    return '$teacher · $subject';
  }

  @override
  String get homeworkAddPhotoFirst => 'ಕನಿಷ್ಠ ಒಂದು ಫೋಟೋ ಸೇರಿಸಿ.';

  @override
  String get homeworkDefaultBody => 'ಹೊಸ ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಿದೆ.';

  @override
  String get homeworkSent => 'ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String homeworkCouldNotSend(String reason) {
    return 'ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. $reason';
  }

  @override
  String get homeworkCaptionLabel => 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)';

  @override
  String get homeworkSubjectOptional => 'ವಿಷಯ (ಐಚ್ಛಿಕ)';

  @override
  String get homeworkNoSubject => 'ವಿಷಯ ಇಲ್ಲ';

  @override
  String get attachCamera => 'ಕ್ಯಾಮೆರಾ';

  @override
  String get attachGallery => 'ಗ್ಯಾಲರಿ';

  @override
  String get attachPdf => 'PDF ಲಗತ್ತಿಸಿ';

  @override
  String get attachHintPhotos => '3 ಫೋಟೋಗಳವರೆಗೆ';

  @override
  String get attachHintPhotosOrPdf => '3 ಫೋಟೋಗಳವರೆಗೆ, ಅಥವಾ 1 PDF';

  @override
  String get sentTitle => 'ಕಳುಹಿಸಿದವು';

  @override
  String sentSeenBy(int seen, int total) {
    String _temp0 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: '$seen/$total ಪೋಷಕರು ನೋಡಿದ್ದಾರೆ',
      one: '$seen/1 ಪೋಷಕರು ನೋಡಿದ್ದಾರೆ',
    );
    return '$_temp0';
  }

  @override
  String get sentNotSeenYet => 'ಇನ್ನೂ ತೆರೆದಿಲ್ಲ';

  @override
  String get sentEveryoneSeen => 'ಎಲ್ಲಾ ಪೋಷಕರು ತೆರೆದಿದ್ದಾರೆ';

  @override
  String get sentEmpty => 'ಇನ್ನೂ ಏನನ್ನೂ ಕಳುಹಿಸಿಲ್ಲ';

  @override
  String get sentCouldNotLoad => 'ಕಳುಹಿಸಿದವು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get noteTypeLabel => 'ಬಗೆ';

  @override
  String get noteTextLabel => 'ಟಿಪ್ಪಣಿ';

  @override
  String get noteTypeNote => 'ಟಿಪ್ಪಣಿ';

  @override
  String get noteTypeMom => 'ಸಭೆಯ ನಡಾವಳಿ';

  @override
  String get noteTypeComplaint => 'ದೂರು';

  @override
  String get noteTypeParentDiscussion => 'ಪೋಷಕರೊಂದಿಗೆ ಚರ್ಚೆ';

  @override
  String get noteInternalHint =>
      'ಇದನ್ನು ಶಾಲಾ ಸಿಬ್ಬಂದಿ ಮಾತ್ರ ನೋಡಬಹುದು. ಪೋಷಕರಿಗೆ ವಿದ್ಯಾರ್ಥಿ ಟಿಪ್ಪಣಿಗಳು ಕಾಣಿಸುವುದಿಲ್ಲ.';

  @override
  String get noteSave => 'ಟಿಪ್ಪಣಿ ಉಳಿಸಿ';

  @override
  String get noteSaved => 'ಟಿಪ್ಪಣಿ ಉಳಿಸಲಾಗಿದೆ';

  @override
  String get noteEnterFirst => 'ಮೊದಲು ಟಿಪ್ಪಣಿ ಬರೆಯಿರಿ.';

  @override
  String get noteRecent => 'ಇತ್ತೀಚಿನ ಟಿಪ್ಪಣಿಗಳು';

  @override
  String get noteCouldNotLoad => 'ಟಿಪ್ಪಣಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get reportsEmptyTeacher => 'ಇನ್ನೂ ವರದಿಗಳಿಲ್ಲ.';

  @override
  String get reportsEmptyParent => 'ಇನ್ನೂ ಪ್ರಗತಿ ಪತ್ರಗಳು ಅಥವಾ ವರದಿಗಳಿಲ್ಲ';

  @override
  String get reportsCouldNotLoad =>
      'ವರದಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get reportsUploadTooltip => 'ಪ್ರಗತಿ ಪತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String get reportTitle => 'ವರದಿ';

  @override
  String get reportCouldNotLoad => 'ಈ ವರದಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String reportBy(String name) {
    return '$name ಅವರಿಂದ';
  }

  @override
  String get reportTypeAcademic => 'ಶೈಕ್ಷಣಿಕ';

  @override
  String get reportTypeAttendance => 'ಹಾಜರಾತಿ';

  @override
  String get reportTypeBehavior => 'ನಡವಳಿಕೆ';

  @override
  String get reportTypeHomework => 'ಮನೆಗೆಲಸ';

  @override
  String get reportTypeReportCard => 'ಪ್ರಗತಿ ಪತ್ರ';

  @override
  String get uploadTitle => 'ಪ್ರಗತಿ ಪತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String get uploadCouldNotLoadStudents => 'ವಿದ್ಯಾರ್ಥಿಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get uploadFillAll => 'ಎಲ್ಲಾ ವಿವರಗಳನ್ನು ತುಂಬಿ ಮತ್ತು PDF ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get uploadYearFormat =>
      'ಶೈಕ್ಷಣಿಕ ವರ್ಷ YYYY-YY ರೂಪದಲ್ಲಿರಬೇಕು, ಉದಾ. 2026-27.';

  @override
  String get uploadSuccess => 'ಪ್ರಗತಿ ಪತ್ರ ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ';

  @override
  String get uploadFailed => 'ಪ್ರಗತಿ ಪತ್ರ ಅಪ್‌ಲೋಡ್ ಆಗಲಿಲ್ಲ.';

  @override
  String get uploadTermLabel => 'ಅವಧಿ';

  @override
  String get uploadTermHint => 'ಉದಾ. ಅವಧಿ 1';

  @override
  String get uploadYearLabel => 'ಶೈಕ್ಷಣಿಕ ವರ್ಷ';

  @override
  String get uploadYearHint => 'ಉದಾ. 2026-27';

  @override
  String get uploadChoosePdf => 'PDF ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get uploadPublishNow => 'ಈಗಲೇ ಪ್ರಕಟಿಸಿ (ಪೋಷಕರು ತಕ್ಷಣ ನೋಡಬಹುದು)';

  @override
  String get uploadButton => 'ಅಪ್‌ಲೋಡ್';

  @override
  String get timetableEmpty => 'ನಿಮಗೆ ಇನ್ನೂ ವೇಳಾಪಟ್ಟಿ ರಚಿಸಿಲ್ಲ.';

  @override
  String get timetableCouldNotLoad =>
      'ನಿಮ್ಮ ವೇಳಾಪಟ್ಟಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get notificationsTitle => 'ಅಧಿಸೂಚನೆಗಳು';

  @override
  String get notificationsEmpty => 'ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.';

  @override
  String get notificationsCouldNotLoad =>
      'ಅಧಿಸೂಚನೆಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get homeQuickAccess => 'ತ್ವರಿತ ಪ್ರವೇಶ';

  @override
  String get homeAmountDue => 'ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ';

  @override
  String get homeAttendanceRate => 'ಈ ತಿಂಗಳ ಹಾಜರಾತಿ';

  @override
  String get teacherQuickActions => 'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು';

  @override
  String get teacherTodayClasses => 'ಇಂದಿನ ತರಗತಿಗಳು';

  @override
  String get reportSubjects => 'ವಿಷಯಗಳು';

  @override
  String get reportTeacherRemark => 'ಶಿಕ್ಷಕರ ಅಭಿಪ್ರಾಯ';

  @override
  String get reportOpenPdf => 'ಪ್ರಗತಿ ಪತ್ರ ತೆರೆಯಿರಿ';

  @override
  String get reportPdfFailed => 'ಪ್ರಗತಿ ಪತ್ರ ತೆರೆಯಲಾಗಲಿಲ್ಲ.';

  @override
  String get authTagline =>
      'ಶುಲ್ಕ, ಮನೆಗೆಲಸ, ಹಾಜರಾತಿ ಮತ್ತು ವರದಿಗಳು — ಎಲ್ಲವೂ ಒಂದೇ ಆ್ಯಪ್‌ನಲ್ಲಿ.';

  @override
  String get classReminderTitle => 'ತರಗತಿ ಜ್ಞಾಪನೆ';

  @override
  String get classReminderChoose => 'ಪ್ರತಿ ತರಗತಿಗೆ ಮೊದಲು ನೆನಪಿಸಿ';

  @override
  String get classReminderOff => 'ಆಫ್';

  @override
  String classReminderMinutes(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: 'ತರಗತಿಗೆ $minutes ನಿಮಿಷ ಮೊದಲು',
      one: 'ತರಗತಿಗೆ 1 ನಿಮಿಷ ಮೊದಲು',
    );
    return '$_temp0';
  }

  @override
  String get classReminderSaveFailed =>
      'ಜ್ಞಾಪನೆ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';
}
