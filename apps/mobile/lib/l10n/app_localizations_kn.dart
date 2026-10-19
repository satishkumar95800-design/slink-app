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
  String get homeworkAddPhotoFirst => 'ಫೋಟೋ ಸೇರಿಸಿ ಅಥವಾ ಮನೆಗೆಲಸ ಬರೆಯಿರಿ.';

  @override
  String get homeworkDefaultBody => 'ಹೊಸ ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಿದೆ.';

  @override
  String get homeworkSent => 'ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಿದೆ';

  @override
  String homeworkCouldNotSend(String reason) {
    return 'ಮನೆಗೆಲಸ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. $reason';
  }

  @override
  String get homeworkCaptionLabel => 'ಮನೆಗೆಲಸ / ವಿವರಣೆ';

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

  @override
  String get uploadRemarkLabel => 'ಶಿಕ್ಷಕರ ಅಭಿಪ್ರಾಯ (ಐಚ್ಛಿಕ)';

  @override
  String get uploadRemarkHint => 'ಪ್ರಗತಿ ಪತ್ರದೊಂದಿಗೆ ಪೋಷಕರಿಗೆ ಕಾಣಿಸುತ್ತದೆ';

  @override
  String get uploadRemarkHintAi =>
      'ಕೆಲವು ಅಂಶಗಳು (ಉದಾ. ಗಣಿತದಲ್ಲಿ ಉತ್ತಮ, ಹೆಚ್ಚು ಓದಬೇಕು), ಅಥವಾ ಖಾಲಿ ಬಿಡಿ';

  @override
  String get aiDraftWithAi => 'AI ಮೂಲಕ ಕರಡು';

  @override
  String get aiDrafting => 'ಕರಡು ರಚಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get aiPickStudentFirst => 'ಮೊದಲು ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get aiUnavailable =>
      'AI ಸಹಾಯಕ ಸದ್ಯಕ್ಕೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ನೀವೇ ಬರೆಯಿರಿ ಅಥವಾ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get insightsTitle => 'ಒಳನೋಟಗಳು';

  @override
  String get insightsExplainer =>
      'ಹಾಜರಾತಿ ಮತ್ತು ಟಿಪ್ಪಣಿಗಳಿಂದ ಕಂಡ ಮಾದರಿಗಳು, ಪ್ರತಿ ಬೆಳಿಗ್ಗೆ ನವೀಕರಣ. ಇವು ಸಲಹೆಗಳು ಮಾತ್ರ — ನಿಭಾಯಿಸಿದ ನಂತರ ತೆಗೆದುಹಾಕಿ.';

  @override
  String get insightsEmpty => 'ಸದ್ಯಕ್ಕೆ ಗಮನಿಸಬೇಕಾದದ್ದು ಏನೂ ಇಲ್ಲ.';

  @override
  String get insightsCouldNotLoad =>
      'ಒಳನೋಟಗಳು ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get insightsDismiss => 'ತೆಗೆದುಹಾಕಿ';

  @override
  String get insightKindAbsenceStreak => 'ಸತತ ಹಲವು ದಿನ ಗೈರು';

  @override
  String get insightKindWeekdayAbsence => 'ಒಂದೇ ವಾರದ ದಿನ ಗೈರು';

  @override
  String get insightKindAttendanceDrop => 'ಹಾಜರಾತಿ ಕುಸಿಯುತ್ತಿದೆ';

  @override
  String get insightKindParentDisengaged => 'ಪೋಷಕರು ಸೂಚನೆಗಳನ್ನು ಓದುತ್ತಿಲ್ಲ';

  @override
  String get insightKindStudentAtRisk => 'ಬೆಂಬಲ ಬೇಕಾಗಬಹುದು';

  @override
  String insightReasonAbsentInARow(int days) {
    return 'ಸತತ $days ಶಾಲಾ ದಿನ ಗೈರು';
  }

  @override
  String insightReasonSameWeekday(int count, int total, String weekday) {
    return '$total ಗೈರುಗಳಲ್ಲಿ $count $weekday ದಂದು';
  }

  @override
  String insightReasonAttendanceFell(int before, int now) {
    return 'ಹಾಜರಾತಿ $before% ರಿಂದ $now% ಗೆ ಇಳಿದಿದೆ';
  }

  @override
  String insightReasonParentNotReading(int unread) {
    return 'ಪೋಷಕರು ಕೊನೆಯ $unread ಸೂಚನೆಗಳನ್ನು ತೆರೆದಿಲ್ಲ';
  }

  @override
  String insightReasonLowAttendance(int pct) {
    return 'ಇತ್ತೀಚಿನ ಹಾಜರಾತಿ $pct%';
  }

  @override
  String insightReasonComplaints(int count, int days) {
    return 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ $count ದೂರುಗಳು';
  }

  @override
  String get askTitle => 'ಶಾಲಾ ಆ್ಯಪ್‌ಗೆ ಕೇಳಿ';

  @override
  String get askTile => 'ಕೇಳಿ';

  @override
  String get askIntro =>
      'ಹಾಜರಾತಿ, ಶುಲ್ಕ, ಮನೆಗೆಲಸ ಅಥವಾ ಸೂಚನೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ — English, ಕನ್ನಡ ಅಥವಾ हिन्दी ಯಲ್ಲಿ.';

  @override
  String get askPlaceholder => 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಬರೆಯಿರಿ…';

  @override
  String get askSend => 'ಕೇಳಿ';

  @override
  String get askThinking => 'ಹುಡುಕಲಾಗುತ್ತಿದೆ…';

  @override
  String get askFootnote => 'ಉತ್ತರಗಳು ಶಾಲೆಯ ದಾಖಲೆಗಳಿಂದ ಬರುತ್ತವೆ.';

  @override
  String get askExampleAttendance => 'ಈ ವಾರ ನನ್ನ ಮಗು ಹಾಜರಿತ್ತೇ?';

  @override
  String get askExampleFees => 'ಎಷ್ಟು ಶುಲ್ಕ ಬಾಕಿ ಇದೆ?';

  @override
  String get askExampleHomework => 'ಈ ವಾರ ಮನೆಗೆಲಸ ಇದೆಯೇ?';

  @override
  String get askExampleNotices => 'ಶಾಲೆಯಿಂದ ಏನಾದರೂ ಸೂಚನೆ ಇದೆಯೇ?';

  @override
  String askChildAttendance(
      String name, int present, int marked, int pct, String from, String to) {
    return '$name: $marked ದಿನಗಳಲ್ಲಿ $present ದಿನ ಹಾಜರು ($pct%), $from ರಿಂದ $to';
  }

  @override
  String askChildFees(String name, String amount) {
    return '$name: $amount ಬಾಕಿ';
  }

  @override
  String askChildNoFees(String name) {
    return '$name ಅವರಿಗೆ ಯಾವುದೇ ಶುಲ್ಕ ಬಾಕಿ ಇಲ್ಲ.';
  }

  @override
  String askChildHomework(String name, int count, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ $name ಗೆ $count ಮನೆಗೆಲಸ',
      one: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ $name ಗೆ 1 ಮನೆಗೆಲಸ',
      zero: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ $name ಗೆ ಮನೆಗೆಲಸ ಇಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String askRecentNotices(int count, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ $count ಸೂಚನೆಗಳು',
      one: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ 1 ಸೂಚನೆ',
      zero: 'ಕಳೆದ $days ದಿನಗಳಲ್ಲಿ ಸೂಚನೆಗಳಿಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String askWhichChild(String names) {
    return 'ಯಾವ ಮಗು? $names';
  }

  @override
  String get askCantAnswer => 'ಇದಕ್ಕೆ ಸದ್ಯಕ್ಕೆ ಉತ್ತರಿಸಲಾಗದು.';

  @override
  String get askCantAnswerHelp =>
      'ಹಾಜರಾತಿ, ಬಾಕಿ ಶುಲ್ಕ, ಮನೆಗೆಲಸ ಮತ್ತು ಸೂಚನೆಗಳ ಬಗ್ಗೆ ಹೇಳಬಲ್ಲೆ.';

  @override
  String get calendarTitle => 'ಶಾಲಾ ಕ್ಯಾಲೆಂಡರ್';

  @override
  String get calendarToday => 'ಇಂದು';

  @override
  String get calendarHoliday => 'ರಜೆ';

  @override
  String get calendarEvent => 'ಕಾರ್ಯಕ್ರಮ';

  @override
  String get calendarPtm => 'ಪಿಟಿಎಂ';

  @override
  String get calendarPreviousMonth => 'ಹಿಂದಿನ ತಿಂಗಳು';

  @override
  String get calendarNextMonth => 'ಮುಂದಿನ ತಿಂಗಳು';

  @override
  String get calendarNothingOnDay => 'ಈ ದಿನಕ್ಕೆ ಏನೂ ನಿಗದಿಯಾಗಿಲ್ಲ.';

  @override
  String get calendarCouldNotLoad => 'ಕ್ಯಾಲೆಂಡರ್ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.';

  @override
  String calendarDayHeading(String weekday, String date) {
    return '$weekday, $date';
  }

  @override
  String get hrmsPayslipsTitle => 'ನನ್ನ ವೇತನ ಚೀಟಿಗಳು';

  @override
  String get hrmsLeaveTitle => 'ರಜೆ';

  @override
  String get hrmsNoRecord =>
      'ನಿಮ್ಮ ಖಾತೆಗೆ ಇನ್ನೂ ಯಾವುದೇ ಎಚ್‌ಆರ್ ದಾಖಲೆ ಜೋಡಿಸಿಲ್ಲ. ದಯವಿಟ್ಟು ಶಾಲಾ ಆಡಳಿತಾಧಿಕಾರಿಯನ್ನು ಕೇಳಿ.';

  @override
  String get hrmsPayslipsEmpty =>
      'ಇನ್ನೂ ವೇತನ ಚೀಟಿಗಳಿಲ್ಲ. ಶಾಲೆ ತಿಂಗಳ ವೇತನವನ್ನು ಅಂತಿಮಗೊಳಿಸಿದ ನಂತರ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get hrmsCouldNotLoad =>
      'ಇದನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get hrmsNetPay => 'ನಿವ್ವಳ ವೇತನ';

  @override
  String get hrmsGross => 'ಒಟ್ಟು';

  @override
  String get hrmsDeductions => 'ಕಡಿತಗಳು';

  @override
  String hrmsPaidOn(String date) {
    return '$date ರಂದು ಪಾವತಿಸಲಾಗಿದೆ';
  }

  @override
  String get hrmsNotPaidYet => 'ಪಾವತಿ ಬಾಕಿ';

  @override
  String get hrmsPayslipOpenFailed => 'ವೇತನ ಚೀಟಿಯನ್ನು ತೆರೆಯಲಾಗಲಿಲ್ಲ.';

  @override
  String hrmsPayslipViewerTitle(String month) {
    return 'ವೇತನ ಚೀಟಿ $month';
  }

  @override
  String get hrmsBalances => 'ರಜೆಯ ಬಾಕಿ';

  @override
  String hrmsAvailable(String days) {
    return '$days ಲಭ್ಯ';
  }

  @override
  String hrmsBalanceDetail(
      String allowance, String carried, String used, String pending) {
    return 'ಅನುಮತಿ $allowance · ತಂದದ್ದು $carried · ಬಳಸಿದ್ದು $used · ಬಾಕಿ $pending';
  }

  @override
  String get hrmsUnpaidLeave => 'ವೇತನರಹಿತ';

  @override
  String get hrmsRequests => 'ನನ್ನ ಕೋರಿಕೆಗಳು';

  @override
  String get hrmsNoRequests => 'ನೀವು ಇನ್ನೂ ರಜೆಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿಲ್ಲ.';

  @override
  String get hrmsApplyLeave => 'ರಜೆಗೆ ಅರ್ಜಿ';

  @override
  String get hrmsStatusPending => 'ಬಾಕಿ';

  @override
  String get hrmsStatusApproved => 'ಅನುಮೋದಿಸಲಾಗಿದೆ';

  @override
  String get hrmsStatusRejected => 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ';

  @override
  String get hrmsStatusCancelled => 'ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ';

  @override
  String hrmsDaysCount(String days) {
    return '$days ದಿನಗಳು';
  }

  @override
  String get hrmsHalfDayLabel => 'ಅರ್ಧ ದಿನ';

  @override
  String get hrmsCancelRequest => 'ಕೋರಿಕೆ ರದ್ದುಮಾಡಿ';

  @override
  String get hrmsCancelConfirm => 'ಈ ರಜೆ ಕೋರಿಕೆಯನ್ನು ರದ್ದುಮಾಡಬೇಕೇ?';

  @override
  String get hrmsKeepRequest => 'ಇರಲಿ';

  @override
  String hrmsDecisionNote(String note) {
    return 'ಟಿಪ್ಪಣಿ: $note';
  }

  @override
  String get hrmsLeaveType => 'ರಜೆಯ ವಿಧ';

  @override
  String get hrmsFromDate => 'ಇಂದ';

  @override
  String get hrmsToDate => 'ವರೆಗೆ';

  @override
  String get hrmsPickDate => 'ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get hrmsHalfDayToggle => 'ಅರ್ಧ ದಿನ';

  @override
  String get hrmsReason => 'ಕಾರಣ';

  @override
  String get hrmsReasonRequired => 'ದಯವಿಟ್ಟು ಕಾರಣ ತಿಳಿಸಿ.';

  @override
  String get hrmsChooseTypeAndDates => 'ರಜೆಯ ವಿಧ ಮತ್ತು ದಿನಾಂಕಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get hrmsEndBeforeStart => 'ಅಂತಿಮ ದಿನಾಂಕ ಆರಂಭ ದಿನಾಂಕಕ್ಕಿಂತ ಮೊದಲಿದೆ.';

  @override
  String get hrmsSubmitRequest => 'ಕೋರಿಕೆ ಸಲ್ಲಿಸಿ';

  @override
  String get hrmsRequestSent => 'ರಜೆ ಕೋರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ.';

  @override
  String get hrmsErrInsufficientBalance =>
      'ಈ ಕೋರಿಕೆಗೆ ನಿಮ್ಮ ರಜೆ ಬಾಕಿ ಸಾಕಾಗುವುದಿಲ್ಲ.';

  @override
  String get hrmsErrOverlap =>
      'ಈ ದಿನಗಳಲ್ಲಿ ಕೆಲವನ್ನು ಬೇರೊಂದು ರಜೆ ಕೋರಿಕೆ ಈಗಾಗಲೇ ಒಳಗೊಂಡಿದೆ.';

  @override
  String get hrmsErrNoWorkingDays =>
      'ಈ ದಿನಾಂಕಗಳಲ್ಲಿ ಕೆಲಸದ ದಿನಗಳಿಲ್ಲ (ವಾರದ ರಜೆ ಅಥವಾ ಹಬ್ಬದ ರಜೆ).';

  @override
  String get hrmsErrNoRecord =>
      'ನಿಮ್ಮ ಖಾತೆಗೆ ಎಚ್‌ಆರ್ ದಾಖಲೆ ಜೋಡಿಸಿಲ್ಲ. ಶಾಲಾ ಆಡಳಿತಾಧಿಕಾರಿಯನ್ನು ಕೇಳಿ.';

  @override
  String get hrmsErrLeaveStarted =>
      'ಆರಂಭವಾದ ರಜೆಯನ್ನು ಆಡಳಿತಾಧಿಕಾರಿ ಮಾತ್ರ ರದ್ದುಮಾಡಬಹುದು.';

  @override
  String get hrmsErrFeatureOff => 'ಈ ಸೌಲಭ್ಯ ನಿಮ್ಮ ಶಾಲೆಗೆ ಸಕ್ರಿಯಗೊಂಡಿಲ್ಲ.';

  @override
  String get hrmsPayslipSave => 'ಉಳಿಸಿ ಅಥವಾ ಹಂಚಿಕೊಳ್ಳಿ';

  @override
  String get staffDocsTitle => 'ಹಂಚಿದ ದಾಖಲೆಗಳು';

  @override
  String get staffDocsIntro =>
      'ಶಾಲೆಯ ಪ್ರತಿ ಶಿಕ್ಷಕರು ನೋಡಬಹುದಾದ ಮತ್ತು ಡೌನ್‌ಲೋಡ್ ಮಾಡಬಹುದಾದ ಫೋಲ್ಡರ್‌ಗಳು ಮತ್ತು ಫೈಲ್‌ಗಳು.';

  @override
  String get staffDocsNewFolder => 'ಹೊಸ ಫೋಲ್ಡರ್';

  @override
  String get staffDocsRenameFolder => 'ಫೋಲ್ಡರ್ ಮರುಹೆಸರಿಸಿ';

  @override
  String get staffDocsDeleteFolder => 'ಫೋಲ್ಡರ್ ಅಳಿಸಿ';

  @override
  String get staffDocsFolderName => 'ಫೋಲ್ಡರ್ ಹೆಸರು';

  @override
  String get staffDocsFolderNameHint => 'ಉದಾ. ಪಾಠ ಯೋಜನೆಗಳು';

  @override
  String get staffDocsSave => 'ಉಳಿಸಿ';

  @override
  String get staffDocsNoFolders =>
      'ಇನ್ನೂ ಫೋಲ್ಡರ್‌ಗಳಿಲ್ಲ. ಒಂದನ್ನು ರಚಿಸಿ ಮತ್ತು ಎಲ್ಲಾ ಶಿಕ್ಷಕರು ನೋಡಲು ಫೈಲ್‌ಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.';

  @override
  String get staffDocsNoFiles =>
      'ಈ ಫೋಲ್ಡರ್ ಖಾಲಿಯಾಗಿದೆ. PDF, ಚಿತ್ರಗಳು, Word, Excel ಅಥವಾ PowerPoint ಫೈಲ್‌ಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ (ಪ್ರತಿಯೊಂದೂ 20 MB ವರೆಗೆ).';

  @override
  String staffDocsFileCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಫೈಲ್‌ಗಳು',
      one: '1 ಫೈಲ್',
      zero: 'ಫೈಲ್‌ಗಳಿಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String staffDocsCreatedBy(String name) {
    return '$name ರಚಿಸಿದ್ದಾರೆ';
  }

  @override
  String get staffDocsUpload => 'ಫೈಲ್‌ಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String staffDocsUploaded(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಫೈಲ್‌ಗಳು ಅಪ್‌ಲೋಡ್ ಆಗಿವೆ',
      one: '1 ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ',
    );
    return '$_temp0';
  }

  @override
  String staffDocsTooBig(String name) {
    return '$name 20 MB ಗಿಂತ ದೊಡ್ಡದಾಗಿದೆ.';
  }

  @override
  String get staffDocsDownload => 'ಡೌನ್‌ಲೋಡ್';

  @override
  String get staffDocsDelete => 'ಅಳಿಸಿ';

  @override
  String staffDocsDeleteFileConfirm(String name) {
    return '\"$name\" ಅಳಿಸಬೇಕೇ? ಇತರ ಶಿಕ್ಷಕರಿಗೆ ಇದು ಇನ್ನು ಕಾಣಿಸುವುದಿಲ್ಲ.';
  }

  @override
  String staffDocsDeleteFolderConfirm(String name) {
    return '\"$name\" ಫೋಲ್ಡರ್ ಅಳಿಸಬೇಕೇ?';
  }

  @override
  String get staffDocsOpenFailed => 'ಫೈಲ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ.';

  @override
  String get staffDocsErrFolderExists => 'ಈ ಹೆಸರಿನ ಫೋಲ್ಡರ್ ಈಗಾಗಲೇ ಇದೆ.';

  @override
  String get staffDocsErrFolderNotEmpty =>
      'ಮೊದಲು ಈ ಫೋಲ್ಡರ್‌ನಲ್ಲಿರುವ ಫೈಲ್‌ಗಳನ್ನು ಅಳಿಸಿ.';

  @override
  String get staffDocsErrNotOwner =>
      'ಇದನ್ನು ಸೇರಿಸಿದವರು ಅಥವಾ ನಿರ್ವಾಹಕರು ಮಾತ್ರ ಇದನ್ನು ಬದಲಾಯಿಸಬಹುದು.';

  @override
  String routinePeriod(int period) {
    return 'ಅವಧಿ $period';
  }

  @override
  String get consentTitle => 'ಒಪ್ಪಿಗೆ ಪತ್ರಗಳು';

  @override
  String get consentEmpty => 'ಶಾಲೆಯಿಂದ ಇನ್ನೂ ಯಾವುದೇ ಒಪ್ಪಿಗೆ ಪತ್ರಗಳಿಲ್ಲ.';

  @override
  String get consentNeedsAnswer => 'ಈಗ ಸಹಿ ಮಾಡಿ';

  @override
  String get consentApproved => 'ಒಪ್ಪಿದ್ದೀರಿ';

  @override
  String get consentDeclined => 'ಒಪ್ಪಿಲ್ಲ';

  @override
  String get consentClosed => 'ಮುಚ್ಚಲಾಗಿದೆ';

  @override
  String consentSignBy(String date) {
    return '$date ರೊಳಗೆ ಸಹಿ ಮಾಡಿ';
  }

  @override
  String consentForChild(String name) {
    return '$name ಗಾಗಿ';
  }

  @override
  String consentForChildClass(String name, String className) {
    return '$name ಗಾಗಿ · $className';
  }

  @override
  String get consentAgreeingTo => 'ನೀವು ಒಪ್ಪುತ್ತಿರುವುದು';

  @override
  String get consentYourAnswer => 'ನಿಮ್ಮ ಉತ್ತರ';

  @override
  String get consentAllow => 'ನಾನು ಒಪ್ಪುತ್ತೇನೆ';

  @override
  String get consentDecline => 'ನಾನು ಒಪ್ಪುವುದಿಲ್ಲ';

  @override
  String get consentSignatureLabel => 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು';

  @override
  String get consentSignatureHint => 'ನಿಮ್ಮ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡುವುದೇ ನಿಮ್ಮ ಸಹಿ';

  @override
  String get consentNoteLabel => 'ಶಾಲೆಗೆ ಸಂದೇಶ (ಐಚ್ಛಿಕ)';

  @override
  String consentConfirm(String name) {
    return 'ನಾನು $name ಅವರ ಪೋಷಕ ಅಥವಾ ರಕ್ಷಕ, ಮತ್ತು ಈ ಉತ್ತರವನ್ನು ದೃಢೀಕರಿಸುತ್ತೇನೆ.';
  }

  @override
  String get consentSubmit => 'ಸಹಿ ಮಾಡಿ ಕಳುಹಿಸಿ';

  @override
  String get consentSubmitted => 'ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಉತ್ತರ ಶಾಲೆಗೆ ತಲುಪಿದೆ.';

  @override
  String consentSignedBy(String name, String date) {
    return '$name ಅವರು $date ರಂದು ಸಹಿ ಮಾಡಿದ್ದಾರೆ';
  }

  @override
  String consentCanChange(String date) {
    return '$date ರವರೆಗೆ ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಬದಲಾಯಿಸಬಹುದು.';
  }

  @override
  String get consentChange => 'ಉತ್ತರ ಬದಲಾಯಿಸಿ';

  @override
  String consentClosedNote(String date) {
    return 'ಸಹಿ ಮಾಡಲು ಕೊನೆಯ ದಿನ $date ಆಗಿತ್ತು.';
  }

  @override
  String get consentErrClosed => 'ಸಹಿ ಮಾಡುವ ಕೊನೆಯ ದಿನ ಕಳೆದಿದೆ.';

  @override
  String get consentErrNotFound => 'ಈ ಒಪ್ಪಿಗೆ ಪತ್ರ ಈಗ ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get syllabusTitle => 'ಪಠ್ಯಕ್ರಮ';

  @override
  String get syllabusStatusOnTime => 'ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ';

  @override
  String syllabusStatusLate(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days ದಿನ ತಡ',
      one: '1 ದಿನ ತಡ',
    );
    return '$_temp0';
  }

  @override
  String get syllabusStatusCompleted => 'ಮುಗಿದಿದೆ';

  @override
  String get syllabusStatusNotPlanned => 'ಯೋಜಿಸಿಲ್ಲ';

  @override
  String get syllabusMineEmpty => 'ನೀವು ಇನ್ನೂ ಯಾವುದೇ ತರಗತಿಯ ವಿಷಯ ಶಿಕ್ಷಕರಲ್ಲ.';

  @override
  String syllabusSubjectInClass(String subject, String className) {
    return '$subject · $className';
  }

  @override
  String get syllabusNoTopics => 'ಇನ್ನೂ ಪಾಠಗಳನ್ನು ಯೋಜಿಸಿಲ್ಲ';

  @override
  String get syllabusNoTopicsTeacher =>
      'ಶಾಲೆ ಈ ವಿಷಯದ ಪಾಠಗಳನ್ನು ಇನ್ನೂ ಯೋಜಿಸಿಲ್ಲ.';

  @override
  String syllabusCoveredOf(int covered, int total, int percent) {
    return '$total ರಲ್ಲಿ $covered ಪಾಠಗಳು ಮುಗಿದಿವೆ · $percent%';
  }

  @override
  String syllabusNextTopic(String title, String date) {
    return 'ಮುಂದಿನದು: $title ($date ರೊಳಗೆ)';
  }

  @override
  String get syllabusTickHelp =>
      'ಪಾಠವನ್ನು ಕಲಿಸಿದ ನಂತರ ಅದರ ಮೇಲೆ ಒತ್ತಿ. ನೀವು ಗುರುತಿಸಿದ ಪಾಠಗಳನ್ನು ಪೋಷಕರು ನೋಡುತ್ತಾರೆ.';

  @override
  String get syllabusPickDateHelp => 'ಈ ಪಾಠವನ್ನು ಯಾವಾಗ ಕಲಿಸಲಾಯಿತು?';

  @override
  String get syllabusMarked => 'ಮುಗಿದಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ';

  @override
  String get syllabusUnmarked => 'ಮುಗಿದಿಲ್ಲ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ';

  @override
  String get syllabusUndoTitle => 'ಮುಗಿದಿಲ್ಲ ಎಂದು ಗುರುತಿಸಬೇಕೇ?';

  @override
  String syllabusUndoBody(String title) {
    return '\"$title\" ಮುಗಿದಿಲ್ಲ ಎಂದು ತೋರುತ್ತದೆ, ಪೋಷಕರಿಗೂ.';
  }

  @override
  String get syllabusUndoConfirm => 'ಮುಗಿದಿಲ್ಲ ಎಂದು ಗುರುತಿಸಿ';

  @override
  String get syllabusCoveredLabel => 'ಮುಗಿದಿದೆ';

  @override
  String get syllabusNotCoveredLabel => 'ಇನ್ನೂ ಮುಗಿದಿಲ್ಲ';

  @override
  String syllabusCoveredOn(String date) {
    return '$date ರಂದು ಮುಗಿದಿದೆ';
  }

  @override
  String syllabusDueBy(String date) {
    return '$date ರೊಳಗೆ';
  }

  @override
  String syllabusLateDue(String date) {
    return 'ತಡ: $date ರೊಳಗೆ ಮುಗಿಯಬೇಕಿತ್ತು';
  }

  @override
  String syllabusChildEmpty(String name) {
    return '$name ಅವರ ತರಗತಿಯ ಪಠ್ಯಕ್ರಮವನ್ನು ಶಾಲೆ ಇನ್ನೂ ಹಂಚಿಕೊಂಡಿಲ್ಲ.';
  }

  @override
  String syllabusChildIntro(String name, String className) {
    return '$name ಅವರ ತರಗತಿಯಲ್ಲಿ ($className) ಪ್ರತಿ ವಿಷಯ ಎಷ್ಟು ಕಲಿಸಲಾಗಿದೆ.';
  }

  @override
  String syllabusPercent(int percent) {
    return '$percent%';
  }

  @override
  String syllabusTopicsCovered(int covered, int total) {
    return '$total ರಲ್ಲಿ $covered ಪಾಠಗಳು ಮುಗಿದಿವೆ';
  }

  @override
  String syllabusLastCovered(String date) {
    return 'ಕೊನೆಯ ಪಾಠ $date ರಂದು ಮುಗಿದಿದೆ';
  }

  @override
  String get syllabusErrNotTeacher =>
      'ನೀವು ಈ ತರಗತಿಯಲ್ಲಿ ಈ ವಿಷಯವನ್ನು ಕಲಿಸುವುದಿಲ್ಲ.';

  @override
  String get syllabusErrFutureDate =>
      'ಮುಂದಿನ ದಿನಾಂಕದಲ್ಲಿ ಪಾಠವನ್ನು ಮುಗಿದಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗದು.';

  @override
  String get syllabusErrTopicGone =>
      'ಈ ಪಾಠವನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ. ನವೀಕರಿಸಲು ಕೆಳಗೆ ಎಳೆಯಿರಿ.';

  @override
  String get errSubscriptionExpired =>
      'ಈ ಶಾಲೆಯ Schoolinkd ಚಂದಾದಾರಿಕೆ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.';

  @override
  String get busTitle => 'ಶಾಲಾ ಬಸ್';

  @override
  String busNotOnRoute(String name) {
    return '$name ಯಾವುದೇ ಶಾಲಾ ಬಸ್ ಮಾರ್ಗದಲ್ಲಿಲ್ಲ.';
  }

  @override
  String busVehicle(String number) {
    return 'ವಾಹನ $number';
  }

  @override
  String get busStop => 'ನಿಲ್ದಾಣ';

  @override
  String busPickup(String time) {
    return 'ಹತ್ತಿಸಿಕೊಳ್ಳುವುದು $time';
  }

  @override
  String busDrop(String time) {
    return 'ಇಳಿಸುವುದು $time';
  }

  @override
  String get busNoStop => 'ಇನ್ನೂ ನಿಲ್ದಾಣ ನಿಗದಿಯಾಗಿಲ್ಲ. ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಕೇಳಿ.';

  @override
  String get busDriver => 'ಚಾಲಕ';

  @override
  String get busAttendant => 'ಸಹಾಯಕ';

  @override
  String get busNoDriver => 'ಇನ್ನೂ ಚಾಲಕರನ್ನು ನಿಯೋಜಿಸಿಲ್ಲ.';

  @override
  String get busCall => 'ಕರೆ ಮಾಡಿ';

  @override
  String busCallName(String name) {
    return '$name ಅವರಿಗೆ ಕರೆ ಮಾಡಿ';
  }

  @override
  String get busCouldNotCall => 'ಫೋನ್ ಆ್ಯಪ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ.';

  @override
  String get errImageNotAllowed =>
      'ಈ ಫೋಟೋ ಕಳುಹಿಸಲಾಗದು: ಶಾಲೆಗೆ ಸೂಕ್ತವಲ್ಲ ಎನಿಸುತ್ತದೆ. ಬರೆದ ಕೆಲಸದ ಫೋಟೋ ಕಳುಹಿಸಿ.';

  @override
  String get errImageCheckUnavailable =>
      'ಫೋಟೋ ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errImageTooLarge =>
      'ಈ ಫೋಟೋ ಪರಿಶೀಲಿಸಲು ತುಂಬಾ ದೊಡ್ಡದು. 5 MB ಗಿಂತ ಚಿಕ್ಕ ಫೋಟೋ ಬಳಸಿ.';

  @override
  String get errImageNotChecked =>
      'ಈ ಫೋಟೋ ಪರಿಶೀಲನೆ ಆಗಿಲ್ಲ. ಮತ್ತೆ ಸೇರಿಸಿ ಕಳುಹಿಸಿ.';

  @override
  String get calendarPickMonth => 'ತಿಂಗಳು ಆರಿಸಿ';

  @override
  String get calendarPrevYear => 'ಹಿಂದಿನ ವರ್ಷ';

  @override
  String get calendarNextYear => 'ಮುಂದಿನ ವರ್ಷ';
}
