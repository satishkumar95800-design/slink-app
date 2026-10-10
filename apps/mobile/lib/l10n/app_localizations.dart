import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_kn.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('kn')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Schoolinkd'**
  String get appName;

  /// This language's own name, in its own script. Shown in the language switcher.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageNativeName;

  /// No description provided for @languageTitle.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageTitle;

  /// No description provided for @languageChoose.
  ///
  /// In en, this message translates to:
  /// **'Choose your language'**
  String get languageChoose;

  /// No description provided for @languageSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Language changed on this phone. We couldn\'t save it to your account — it will be saved next time you change it.'**
  String get languageSaveFailed;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get commonSubmit;

  /// No description provided for @commonUpdate.
  ///
  /// In en, this message translates to:
  /// **'Update'**
  String get commonUpdate;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry now'**
  String get commonRetry;

  /// No description provided for @commonContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get commonContinue;

  /// No description provided for @commonRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get commonRemove;

  /// No description provided for @commonClass.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get commonClass;

  /// No description provided for @commonStudent.
  ///
  /// In en, this message translates to:
  /// **'Student'**
  String get commonStudent;

  /// No description provided for @commonSendToClass.
  ///
  /// In en, this message translates to:
  /// **'Send to class'**
  String get commonSendToClass;

  /// No description provided for @commonCouldNotLoadClasses.
  ///
  /// In en, this message translates to:
  /// **'Could not load your classes.'**
  String get commonCouldNotLoadClasses;

  /// No description provided for @commonNotAssignedToClass.
  ///
  /// In en, this message translates to:
  /// **'You aren\'t assigned to any class yet.'**
  String get commonNotAssignedToClass;

  /// No description provided for @commonPullToRetry.
  ///
  /// In en, this message translates to:
  /// **'Pull down to retry.'**
  String get commonPullToRetry;

  /// No description provided for @commonListItem.
  ///
  /// In en, this message translates to:
  /// **'{first} · {second}'**
  String commonListItem(String first, String second);

  /// No description provided for @errorNetworkTimeout.
  ///
  /// In en, this message translates to:
  /// **'Network timeout — check your connection and try again.'**
  String get errorNetworkTimeout;

  /// No description provided for @errorNoInternet.
  ///
  /// In en, this message translates to:
  /// **'No internet connection.'**
  String get errorNoInternet;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @errorTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Please try again.'**
  String get errorTryAgain;

  /// No description provided for @errorPhoneNotRegistered.
  ///
  /// In en, this message translates to:
  /// **'This number isn\'t registered. Please contact your school admin to add it.'**
  String get errorPhoneNotRegistered;

  /// No description provided for @errorSchoolNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find a school with this code. Check the code and try again.'**
  String get errorSchoolNotFound;

  /// No description provided for @authSchoolCodeIntro.
  ///
  /// In en, this message translates to:
  /// **'Enter the school code your school gave you to get started.'**
  String get authSchoolCodeIntro;

  /// No description provided for @authSchoolCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'School code'**
  String get authSchoolCodeLabel;

  /// No description provided for @authSchoolCodeHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. greenfield-school'**
  String get authSchoolCodeHint;

  /// No description provided for @authSchoolCodeRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your school code to continue.'**
  String get authSchoolCodeRequired;

  /// No description provided for @authSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authSignIn;

  /// No description provided for @authEnterMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter your mobile number'**
  String get authEnterMobile;

  /// No description provided for @authOtpExplainer.
  ///
  /// In en, this message translates to:
  /// **'We\'ll send a one-time code to verify it\'s you.'**
  String get authOtpExplainer;

  /// No description provided for @authInvalidMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit mobile number.'**
  String get authInvalidMobile;

  /// No description provided for @authMobileLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get authMobileLabel;

  /// No description provided for @authSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get authSendCode;

  /// No description provided for @authCouldNotVerifyNumber.
  ///
  /// In en, this message translates to:
  /// **'Could not verify your number. Please try again.'**
  String get authCouldNotVerifyNumber;

  /// No description provided for @authCouldNotSendCode.
  ///
  /// In en, this message translates to:
  /// **'Could not send verification code.'**
  String get authCouldNotSendCode;

  /// No description provided for @authCouldNotSendCodeRetry.
  ///
  /// In en, this message translates to:
  /// **'Could not send verification code. Please try again.'**
  String get authCouldNotSendCodeRetry;

  /// No description provided for @authVerifyCodeTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify code'**
  String get authVerifyCodeTitle;

  /// No description provided for @authEnterSixDigit.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get authEnterSixDigit;

  /// No description provided for @authSentTo.
  ///
  /// In en, this message translates to:
  /// **'Sent to {phone}'**
  String authSentTo(String phone);

  /// No description provided for @authVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get authVerify;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authInvalidCode.
  ///
  /// In en, this message translates to:
  /// **'Invalid code. Please try again.'**
  String get authInvalidCode;

  /// No description provided for @authCodeExpired.
  ///
  /// In en, this message translates to:
  /// **'This code has expired. Please request a new one.'**
  String get authCodeExpired;

  /// No description provided for @roleParent.
  ///
  /// In en, this message translates to:
  /// **'Parent'**
  String get roleParent;

  /// No description provided for @roleTeacher.
  ///
  /// In en, this message translates to:
  /// **'Teacher'**
  String get roleTeacher;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get roleAdmin;

  /// No description provided for @roleAccounts.
  ///
  /// In en, this message translates to:
  /// **'Accounts'**
  String get roleAccounts;

  /// No description provided for @roleSuperAdmin.
  ///
  /// In en, this message translates to:
  /// **'Super admin'**
  String get roleSuperAdmin;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @profileNoUser.
  ///
  /// In en, this message translates to:
  /// **'No user profile available.'**
  String get profileNoUser;

  /// No description provided for @profileSchool.
  ///
  /// In en, this message translates to:
  /// **'School'**
  String get profileSchool;

  /// No description provided for @profileLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get profileLogout;

  /// No description provided for @profileLogoutConfirm.
  ///
  /// In en, this message translates to:
  /// **'Log out of Schoolinkd on this phone?'**
  String get profileLogoutConfirm;

  /// No description provided for @dashboardGreeting.
  ///
  /// In en, this message translates to:
  /// **'Hi, {name}'**
  String dashboardGreeting(String name);

  /// No description provided for @dashboardNoChildren.
  ///
  /// In en, this message translates to:
  /// **'No children are linked to your account yet. Please contact the school office.'**
  String get dashboardNoChildren;

  /// No description provided for @dashboardCouldNotLoadChildren.
  ///
  /// In en, this message translates to:
  /// **'Could not load your children.'**
  String get dashboardCouldNotLoadChildren;

  /// No description provided for @teacherDashboardTitle.
  ///
  /// In en, this message translates to:
  /// **'Teacher dashboard'**
  String get teacherDashboardTitle;

  /// No description provided for @teacherSignedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {name}'**
  String teacherSignedInAs(String name);

  /// No description provided for @teacherSendHomework.
  ///
  /// In en, this message translates to:
  /// **'Send Homework'**
  String get teacherSendHomework;

  /// No description provided for @teacherSendHomeworkSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Photos and a note for a class'**
  String get teacherSendHomeworkSubtitle;

  /// No description provided for @teacherSendNotice.
  ///
  /// In en, this message translates to:
  /// **'Send Notice'**
  String get teacherSendNotice;

  /// No description provided for @teacherSendNoticeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Message all parents in your class'**
  String get teacherSendNoticeSubtitle;

  /// No description provided for @teacherReports.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get teacherReports;

  /// No description provided for @teacherReportsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Progress reports and report cards'**
  String get teacherReportsSubtitle;

  /// No description provided for @teacherAddStudentNote.
  ///
  /// In en, this message translates to:
  /// **'Add Student Note'**
  String get teacherAddStudentNote;

  /// No description provided for @teacherAddStudentNoteSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Internal note, MOM, complaint or parent discussion'**
  String get teacherAddStudentNoteSubtitle;

  /// No description provided for @teacherWeeklyRoutine.
  ///
  /// In en, this message translates to:
  /// **'Weekly Routine'**
  String get teacherWeeklyRoutine;

  /// No description provided for @teacherWeeklyRoutineSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your own class timetable for the week'**
  String get teacherWeeklyRoutineSubtitle;

  /// No description provided for @teacherAboutMyClasses.
  ///
  /// In en, this message translates to:
  /// **'About My Class(es)'**
  String get teacherAboutMyClasses;

  /// No description provided for @teacherAboutMyClassesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Strength, subjects, and recent reports for your classes'**
  String get teacherAboutMyClassesSubtitle;

  /// No description provided for @todayNow.
  ///
  /// In en, this message translates to:
  /// **'Now: {className} · {subject}'**
  String todayNow(String className, String subject);

  /// No description provided for @todayNowWithTime.
  ///
  /// In en, this message translates to:
  /// **'Now: {className} · {subject} ({time})'**
  String todayNowWithTime(String className, String subject, String time);

  /// No description provided for @todayNext.
  ///
  /// In en, this message translates to:
  /// **'Next: {className} · {subject}'**
  String todayNext(String className, String subject);

  /// No description provided for @todayNextWithTime.
  ///
  /// In en, this message translates to:
  /// **'Next: {className} · {subject} ({time})'**
  String todayNextWithTime(String className, String subject, String time);

  /// No description provided for @todayNoMorePeriods.
  ///
  /// In en, this message translates to:
  /// **'No more periods today'**
  String get todayNoMorePeriods;

  /// No description provided for @todayNoPeriods.
  ///
  /// In en, this message translates to:
  /// **'No periods today'**
  String get todayNoPeriods;

  /// No description provided for @todayPeriodLabel.
  ///
  /// In en, this message translates to:
  /// **'P{period} · {className} · {subject}'**
  String todayPeriodLabel(int period, String className, String subject);

  /// No description provided for @myClassesEmpty.
  ///
  /// In en, this message translates to:
  /// **'You are not linked to any classes yet.'**
  String get myClassesEmpty;

  /// No description provided for @myClassesCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load your classes. Pull down to retry.'**
  String get myClassesCouldNotLoad;

  /// No description provided for @myClassesStrength.
  ///
  /// In en, this message translates to:
  /// **'Boys: {boys} · Girls: {girls} · Total: {total}'**
  String myClassesStrength(int boys, int girls, int total);

  /// No description provided for @myClassesRecentReports.
  ///
  /// In en, this message translates to:
  /// **'Recent reports'**
  String get myClassesRecentReports;

  /// No description provided for @myClassesRead.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get myClassesRead;

  /// No description provided for @myClassesUnread.
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get myClassesUnread;

  /// No description provided for @attendanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get attendanceTitle;

  /// No description provided for @attendanceMark.
  ///
  /// In en, this message translates to:
  /// **'Mark Attendance'**
  String get attendanceMark;

  /// No description provided for @attendanceMarkSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Take today\'s attendance for your class'**
  String get attendanceMarkSubtitle;

  /// No description provided for @attendanceDoneForToday.
  ///
  /// In en, this message translates to:
  /// **'Done for today'**
  String get attendanceDoneForToday;

  /// No description provided for @attendanceDoneForClasses.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} classes done today'**
  String attendanceDoneForClasses(int done, int total);

  /// No description provided for @attendancePickClass.
  ///
  /// In en, this message translates to:
  /// **'Pick a class'**
  String get attendancePickClass;

  /// No description provided for @attendanceStudentCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 student} other{{count} students}}'**
  String attendanceStudentCount(int count);

  /// No description provided for @attendancePresent.
  ///
  /// In en, this message translates to:
  /// **'Present'**
  String get attendancePresent;

  /// No description provided for @attendanceAbsent.
  ///
  /// In en, this message translates to:
  /// **'Absent'**
  String get attendanceAbsent;

  /// No description provided for @attendanceLate.
  ///
  /// In en, this message translates to:
  /// **'Late'**
  String get attendanceLate;

  /// No description provided for @attendanceLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get attendanceLeave;

  /// No description provided for @attendanceNotMarkedYet.
  ///
  /// In en, this message translates to:
  /// **'Not marked yet'**
  String get attendanceNotMarkedYet;

  /// No description provided for @attendanceHoliday.
  ///
  /// In en, this message translates to:
  /// **'Holiday'**
  String get attendanceHoliday;

  /// No description provided for @attendanceHolidayToday.
  ///
  /// In en, this message translates to:
  /// **'Today is a holiday: {name}'**
  String attendanceHolidayToday(String name);

  /// No description provided for @attendanceTapHint.
  ///
  /// In en, this message translates to:
  /// **'Tap to mark absent · long-press for Late or Leave'**
  String get attendanceTapHint;

  /// No description provided for @attendanceCounts.
  ///
  /// In en, this message translates to:
  /// **'{present} present · {absent} absent'**
  String attendanceCounts(int present, int absent);

  /// No description provided for @attendanceCountsWithOther.
  ///
  /// In en, this message translates to:
  /// **'{present} present · {absent} absent · {other} late/leave'**
  String attendanceCountsWithOther(int present, int absent, int other);

  /// No description provided for @attendanceConfirmSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit attendance: {present} present, {absent} absent?'**
  String attendanceConfirmSubmit(int present, int absent);

  /// No description provided for @attendanceSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Attendance submitted'**
  String get attendanceSubmitted;

  /// No description provided for @attendanceQueuedOffline.
  ///
  /// In en, this message translates to:
  /// **'No connection — saved on this phone. It will be sent automatically.'**
  String get attendanceQueuedOffline;

  /// No description provided for @attendancePendingSend.
  ///
  /// In en, this message translates to:
  /// **'Waiting to send…'**
  String get attendancePendingSend;

  /// No description provided for @attendanceSendingNow.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get attendanceSendingNow;

  /// No description provided for @attendanceAlreadySubmitted.
  ///
  /// In en, this message translates to:
  /// **'Already submitted today — you can still change it until midnight.'**
  String get attendanceAlreadySubmitted;

  /// No description provided for @attendanceReadOnlyDay.
  ///
  /// In en, this message translates to:
  /// **'Attendance for this day can only be changed by an admin.'**
  String get attendanceReadOnlyDay;

  /// No description provided for @attendanceNoStudents.
  ///
  /// In en, this message translates to:
  /// **'No students in this class yet.'**
  String get attendanceNoStudents;

  /// No description provided for @attendanceNoClassesToMark.
  ///
  /// In en, this message translates to:
  /// **'You\'re not the class teacher of any class yet.'**
  String get attendanceNoClassesToMark;

  /// No description provided for @attendanceCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load attendance.'**
  String get attendanceCouldNotLoad;

  /// No description provided for @attendanceThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month: {present}/{marked} days'**
  String attendanceThisMonth(int present, int marked);

  /// No description provided for @attendanceYearPercentage.
  ///
  /// In en, this message translates to:
  /// **'Academic year {year}: {percent}'**
  String attendanceYearPercentage(String year, String percent);

  /// No description provided for @attendanceToday.
  ///
  /// In en, this message translates to:
  /// **'Today: {status}'**
  String attendanceToday(String status);

  /// No description provided for @attendanceChooseStatus.
  ///
  /// In en, this message translates to:
  /// **'Mark as'**
  String get attendanceChooseStatus;

  /// No description provided for @homeChildWithClass.
  ///
  /// In en, this message translates to:
  /// **'{name} · {className}'**
  String homeChildWithClass(String name, String className);

  /// No description provided for @homeSwitchChild.
  ///
  /// In en, this message translates to:
  /// **'Switch child'**
  String get homeSwitchChild;

  /// No description provided for @homeDueBy.
  ///
  /// In en, this message translates to:
  /// **'{amount} due by {date}'**
  String homeDueBy(String amount, String date);

  /// No description provided for @homeOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get homeOverdue;

  /// No description provided for @homeMoreDues.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{+ 1 more fee pending} other{+ {count} more fees pending}}'**
  String homeMoreDues(int count);

  /// No description provided for @homeAllFeesPaid.
  ///
  /// In en, this message translates to:
  /// **'All fees paid'**
  String get homeAllFeesPaid;

  /// No description provided for @homeClaimUnderReview.
  ///
  /// In en, this message translates to:
  /// **'Payment claim under review'**
  String get homeClaimUnderReview;

  /// No description provided for @homeClaimAmountUnderReview.
  ///
  /// In en, this message translates to:
  /// **'{amount} claim under review'**
  String homeClaimAmountUnderReview(String amount);

  /// No description provided for @homePayNow.
  ///
  /// In en, this message translates to:
  /// **'Pay Now'**
  String get homePayNow;

  /// No description provided for @homeViewFees.
  ///
  /// In en, this message translates to:
  /// **'View fees'**
  String get homeViewFees;

  /// No description provided for @homeTodayTitle.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get homeTodayTitle;

  /// No description provided for @homeNoHomeworkToday.
  ///
  /// In en, this message translates to:
  /// **'No homework today'**
  String get homeNoHomeworkToday;

  /// No description provided for @homeLatestNotice.
  ///
  /// In en, this message translates to:
  /// **'Latest notice'**
  String get homeLatestNotice;

  /// No description provided for @homeCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load this child\'s summary.'**
  String get homeCouldNotLoad;

  /// No description provided for @menuFees.
  ///
  /// In en, this message translates to:
  /// **'Fees'**
  String get menuFees;

  /// No description provided for @menuFeesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Dues, online payment, upload proof, receipts'**
  String get menuFeesSubtitle;

  /// No description provided for @menuHomework.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get menuHomework;

  /// No description provided for @menuHomeworkSubtitle.
  ///
  /// In en, this message translates to:
  /// **'All homework sent to this child\'s class'**
  String get menuHomeworkSubtitle;

  /// No description provided for @menuNotices.
  ///
  /// In en, this message translates to:
  /// **'Notices'**
  String get menuNotices;

  /// No description provided for @menuNoticesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Class and school notices'**
  String get menuNoticesSubtitle;

  /// No description provided for @menuReports.
  ///
  /// In en, this message translates to:
  /// **'Report Cards & Reports'**
  String get menuReports;

  /// No description provided for @menuReportsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Report cards and progress reports'**
  String get menuReportsSubtitle;

  /// No description provided for @menuAttendanceSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Monthly calendar'**
  String get menuAttendanceSubtitle;

  /// No description provided for @feesPayOnline.
  ///
  /// In en, this message translates to:
  /// **'Pay Online'**
  String get feesPayOnline;

  /// No description provided for @feesPaidByCashOrCheque.
  ///
  /// In en, this message translates to:
  /// **'I paid by cash/cheque – upload proof'**
  String get feesPaidByCashOrCheque;

  /// No description provided for @feesReceipts.
  ///
  /// In en, this message translates to:
  /// **'Receipts'**
  String get feesReceipts;

  /// No description provided for @feesPaidInFull.
  ///
  /// In en, this message translates to:
  /// **'Paid in full'**
  String get feesPaidInFull;

  /// No description provided for @feesDueOn.
  ///
  /// In en, this message translates to:
  /// **'Due {date}'**
  String feesDueOn(String date);

  /// No description provided for @feesAmountDue.
  ///
  /// In en, this message translates to:
  /// **'{amount} due'**
  String feesAmountDue(String amount);

  /// No description provided for @feesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No fees found.'**
  String get feesEmpty;

  /// No description provided for @feesMyClaims.
  ///
  /// In en, this message translates to:
  /// **'Payment proofs you uploaded'**
  String get feesMyClaims;

  /// No description provided for @feesCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load fees. Pull down to retry.'**
  String get feesCouldNotLoad;

  /// No description provided for @feeStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get feeStatusPaid;

  /// No description provided for @feeStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get feeStatusPending;

  /// No description provided for @feeStatusOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get feeStatusOverdue;

  /// No description provided for @feeStatusPartial.
  ///
  /// In en, this message translates to:
  /// **'Partly paid'**
  String get feeStatusPartial;

  /// No description provided for @feeStatusWaived.
  ///
  /// In en, this message translates to:
  /// **'Waived'**
  String get feeStatusWaived;

  /// No description provided for @paymentModeCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get paymentModeCash;

  /// No description provided for @paymentModeCheque.
  ///
  /// In en, this message translates to:
  /// **'Cheque'**
  String get paymentModeCheque;

  /// No description provided for @paymentModeBankTransfer.
  ///
  /// In en, this message translates to:
  /// **'Bank Transfer'**
  String get paymentModeBankTransfer;

  /// No description provided for @paymentModeUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get paymentModeUpi;

  /// No description provided for @paymentModeDemandDraft.
  ///
  /// In en, this message translates to:
  /// **'Demand Draft'**
  String get paymentModeDemandDraft;

  /// No description provided for @paymentModeOnline.
  ///
  /// In en, this message translates to:
  /// **'Online Payment'**
  String get paymentModeOnline;

  /// No description provided for @claimStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get claimStatusPending;

  /// No description provided for @claimStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get claimStatusApproved;

  /// No description provided for @claimStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get claimStatusRejected;

  /// No description provided for @claimSubmittedOn.
  ///
  /// In en, this message translates to:
  /// **'Submitted {date}'**
  String claimSubmittedOn(String date);

  /// No description provided for @claimClaimedAmount.
  ///
  /// In en, this message translates to:
  /// **'Claimed amount: {amount}'**
  String claimClaimedAmount(String amount);

  /// No description provided for @claimMode.
  ///
  /// In en, this message translates to:
  /// **'Mode: {mode}'**
  String claimMode(String mode);

  /// No description provided for @claimRejectedReason.
  ///
  /// In en, this message translates to:
  /// **'Reason: {reason}'**
  String claimRejectedReason(String reason);

  /// No description provided for @claimsTitle.
  ///
  /// In en, this message translates to:
  /// **'My Payment Claims'**
  String get claimsTitle;

  /// No description provided for @claimsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No payment claims submitted yet.'**
  String get claimsEmpty;

  /// No description provided for @claimsCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load your payment claims. Pull down to retry.'**
  String get claimsCouldNotLoad;

  /// No description provided for @claimFormTitle.
  ///
  /// In en, this message translates to:
  /// **'Already Paid?'**
  String get claimFormTitle;

  /// No description provided for @claimFormIntro.
  ///
  /// In en, this message translates to:
  /// **'Attach a photo or screenshot of your payment (bank transfer, cash receipt, cheque, etc.). The school will review it before it is recorded.'**
  String get claimFormIntro;

  /// No description provided for @claimTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get claimTakePhoto;

  /// No description provided for @claimRetakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Retake photo'**
  String get claimRetakePhoto;

  /// No description provided for @claimChooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get claimChooseFromGallery;

  /// No description provided for @claimAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount paid (optional)'**
  String get claimAmountLabel;

  /// No description provided for @claimDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Date paid (optional)'**
  String get claimDateLabel;

  /// No description provided for @claimSelectDate.
  ///
  /// In en, this message translates to:
  /// **'Select a date'**
  String get claimSelectDate;

  /// No description provided for @claimModeLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment mode (optional)'**
  String get claimModeLabel;

  /// No description provided for @claimNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get claimNoteLabel;

  /// No description provided for @claimSubmitForReview.
  ///
  /// In en, this message translates to:
  /// **'Submit for review'**
  String get claimSubmitForReview;

  /// No description provided for @claimAttachProofFirst.
  ///
  /// In en, this message translates to:
  /// **'Attach a photo or screenshot of the payment proof first.'**
  String get claimAttachProofFirst;

  /// No description provided for @claimSubmittedToast.
  ///
  /// In en, this message translates to:
  /// **'Submitted — your school will review it shortly'**
  String get claimSubmittedToast;

  /// No description provided for @claimCouldNotSubmit.
  ///
  /// In en, this message translates to:
  /// **'Could not submit your claim. {reason}'**
  String claimCouldNotSubmit(String reason);

  /// No description provided for @checkoutTitle.
  ///
  /// In en, this message translates to:
  /// **'Pay fee'**
  String get checkoutTitle;

  /// No description provided for @checkoutCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load this fee.'**
  String get checkoutCouldNotLoad;

  /// No description provided for @checkoutAmountDue.
  ///
  /// In en, this message translates to:
  /// **'Amount due'**
  String get checkoutAmountDue;

  /// No description provided for @checkoutPayAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount}'**
  String checkoutPayAmount(String amount);

  /// No description provided for @checkoutConfirmingWithBank.
  ///
  /// In en, this message translates to:
  /// **'Payment received — confirming with the bank. Check back on this fee shortly.'**
  String get checkoutConfirmingWithBank;

  /// No description provided for @checkoutConfirming.
  ///
  /// In en, this message translates to:
  /// **'Confirming your payment…'**
  String get checkoutConfirming;

  /// No description provided for @checkoutSuccess.
  ///
  /// In en, this message translates to:
  /// **'Payment successful'**
  String get checkoutSuccess;

  /// No description provided for @checkoutBackToFees.
  ///
  /// In en, this message translates to:
  /// **'Back to fees'**
  String get checkoutBackToFees;

  /// No description provided for @checkoutNotSetUp.
  ///
  /// In en, this message translates to:
  /// **'Payment is not set up for this school yet. Please contact the school office.'**
  String get checkoutNotSetUp;

  /// No description provided for @checkoutCouldNotStart.
  ///
  /// In en, this message translates to:
  /// **'Could not start payment. Please try again.'**
  String get checkoutCouldNotStart;

  /// No description provided for @checkoutNotCompleted.
  ///
  /// In en, this message translates to:
  /// **'Payment was not completed.'**
  String get checkoutNotCompleted;

  /// No description provided for @checkoutCouldNotConfirm.
  ///
  /// In en, this message translates to:
  /// **'The payment could not be confirmed. Please try again.'**
  String get checkoutCouldNotConfirm;

  /// No description provided for @checkoutDescription.
  ///
  /// In en, this message translates to:
  /// **'Fee payment — {studentName}'**
  String checkoutDescription(String studentName);

  /// No description provided for @receiptTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipt'**
  String get receiptTitle;

  /// No description provided for @receiptCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load this receipt.'**
  String get receiptCouldNotLoad;

  /// No description provided for @receiptAmountReceived.
  ///
  /// In en, this message translates to:
  /// **'Amount Received'**
  String get receiptAmountReceived;

  /// No description provided for @receiptDiscountApplied.
  ///
  /// In en, this message translates to:
  /// **'Discount applied'**
  String get receiptDiscountApplied;

  /// No description provided for @receiptDiscountAppliedNamed.
  ///
  /// In en, this message translates to:
  /// **'Discount applied: {name}'**
  String receiptDiscountAppliedNamed(String name);

  /// No description provided for @receiptMethod.
  ///
  /// In en, this message translates to:
  /// **'Method: {method}'**
  String receiptMethod(String method);

  /// No description provided for @receiptPaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on: {date}'**
  String receiptPaidOn(String date);

  /// No description provided for @receiptReference.
  ///
  /// In en, this message translates to:
  /// **'Reference: {reference}'**
  String receiptReference(String reference);

  /// No description provided for @receiptNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get receiptNotes;

  /// No description provided for @receiptDownload.
  ///
  /// In en, this message translates to:
  /// **'Download receipt'**
  String get receiptDownload;

  /// No description provided for @receiptOpening.
  ///
  /// In en, this message translates to:
  /// **'Opening…'**
  String get receiptOpening;

  /// No description provided for @receiptCouldNotOpen.
  ///
  /// In en, this message translates to:
  /// **'Could not open the receipt. Please try again.'**
  String get receiptCouldNotOpen;

  /// No description provided for @receiptsCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load receipts.'**
  String get receiptsCouldNotLoad;

  /// No description provided for @receiptsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No receipts yet for this fee.'**
  String get receiptsEmpty;

  /// No description provided for @receiptsRowWithDiscount.
  ///
  /// In en, this message translates to:
  /// **'{date} · Discount applied'**
  String receiptsRowWithDiscount(String date);

  /// No description provided for @noticeKind.
  ///
  /// In en, this message translates to:
  /// **'Notice'**
  String get noticeKind;

  /// No description provided for @homeworkKind.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get homeworkKind;

  /// No description provided for @noticesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notices yet'**
  String get noticesEmpty;

  /// No description provided for @noticesCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load notices.'**
  String get noticesCouldNotLoad;

  /// No description provided for @noticeOpenPdf.
  ///
  /// In en, this message translates to:
  /// **'Open PDF'**
  String get noticeOpenPdf;

  /// No description provided for @noticeEnterMessage.
  ///
  /// In en, this message translates to:
  /// **'Enter a message.'**
  String get noticeEnterMessage;

  /// No description provided for @noticeSent.
  ///
  /// In en, this message translates to:
  /// **'Notice sent'**
  String get noticeSent;

  /// No description provided for @noticeCouldNotSend.
  ///
  /// In en, this message translates to:
  /// **'Could not send the notice. {reason}'**
  String noticeCouldNotSend(String reason);

  /// No description provided for @noticeNotClassTeacher.
  ///
  /// In en, this message translates to:
  /// **'You aren\'t set as the class teacher for any class yet.'**
  String get noticeNotClassTeacher;

  /// No description provided for @noticeTitleLabel.
  ///
  /// In en, this message translates to:
  /// **'Title (optional)'**
  String get noticeTitleLabel;

  /// No description provided for @noticeMessageLabel.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get noticeMessageLabel;

  /// No description provided for @homeworkEmpty.
  ///
  /// In en, this message translates to:
  /// **'No homework yet'**
  String get homeworkEmpty;

  /// No description provided for @homeworkCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load homework.'**
  String get homeworkCouldNotLoad;

  /// No description provided for @homeworkBy.
  ///
  /// In en, this message translates to:
  /// **'{teacher} · {subject}'**
  String homeworkBy(String teacher, String subject);

  /// No description provided for @homeworkAddPhotoFirst.
  ///
  /// In en, this message translates to:
  /// **'Add at least one photo.'**
  String get homeworkAddPhotoFirst;

  /// No description provided for @homeworkDefaultBody.
  ///
  /// In en, this message translates to:
  /// **'New homework has been posted.'**
  String get homeworkDefaultBody;

  /// No description provided for @homeworkSent.
  ///
  /// In en, this message translates to:
  /// **'Homework sent'**
  String get homeworkSent;

  /// No description provided for @homeworkCouldNotSend.
  ///
  /// In en, this message translates to:
  /// **'Could not send the homework. {reason}'**
  String homeworkCouldNotSend(String reason);

  /// No description provided for @homeworkCaptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Caption (optional)'**
  String get homeworkCaptionLabel;

  /// No description provided for @homeworkSubjectOptional.
  ///
  /// In en, this message translates to:
  /// **'Subject (optional)'**
  String get homeworkSubjectOptional;

  /// No description provided for @homeworkNoSubject.
  ///
  /// In en, this message translates to:
  /// **'No subject'**
  String get homeworkNoSubject;

  /// No description provided for @attachCamera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get attachCamera;

  /// No description provided for @attachGallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get attachGallery;

  /// No description provided for @attachPdf.
  ///
  /// In en, this message translates to:
  /// **'Attach PDF'**
  String get attachPdf;

  /// No description provided for @attachHintPhotos.
  ///
  /// In en, this message translates to:
  /// **'Up to 3 photos'**
  String get attachHintPhotos;

  /// No description provided for @attachHintPhotosOrPdf.
  ///
  /// In en, this message translates to:
  /// **'Up to 3 photos, or 1 PDF'**
  String get attachHintPhotosOrPdf;

  /// No description provided for @sentTitle.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get sentTitle;

  /// No description provided for @sentSeenBy.
  ///
  /// In en, this message translates to:
  /// **'{total, plural, =1{Seen by {seen}/1 parent} other{Seen by {seen}/{total} parents}}'**
  String sentSeenBy(int seen, int total);

  /// No description provided for @sentNotSeenYet.
  ///
  /// In en, this message translates to:
  /// **'Haven\'t opened it yet'**
  String get sentNotSeenYet;

  /// No description provided for @sentEveryoneSeen.
  ///
  /// In en, this message translates to:
  /// **'Every parent has opened it'**
  String get sentEveryoneSeen;

  /// No description provided for @sentEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing sent yet'**
  String get sentEmpty;

  /// No description provided for @sentCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load sent items.'**
  String get sentCouldNotLoad;

  /// No description provided for @noteTypeLabel.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get noteTypeLabel;

  /// No description provided for @noteTextLabel.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get noteTextLabel;

  /// No description provided for @noteTypeNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get noteTypeNote;

  /// No description provided for @noteTypeMom.
  ///
  /// In en, this message translates to:
  /// **'MOM'**
  String get noteTypeMom;

  /// No description provided for @noteTypeComplaint.
  ///
  /// In en, this message translates to:
  /// **'Complaint'**
  String get noteTypeComplaint;

  /// No description provided for @noteTypeParentDiscussion.
  ///
  /// In en, this message translates to:
  /// **'Parent Discussion'**
  String get noteTypeParentDiscussion;

  /// No description provided for @noteInternalHint.
  ///
  /// In en, this message translates to:
  /// **'Only school staff can see this. Parents never see student notes.'**
  String get noteInternalHint;

  /// No description provided for @noteSave.
  ///
  /// In en, this message translates to:
  /// **'Save note'**
  String get noteSave;

  /// No description provided for @noteSaved.
  ///
  /// In en, this message translates to:
  /// **'Note saved'**
  String get noteSaved;

  /// No description provided for @noteEnterFirst.
  ///
  /// In en, this message translates to:
  /// **'Type the note first.'**
  String get noteEnterFirst;

  /// No description provided for @noteRecent.
  ///
  /// In en, this message translates to:
  /// **'Recent notes'**
  String get noteRecent;

  /// No description provided for @noteCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load notes.'**
  String get noteCouldNotLoad;

  /// No description provided for @reportsEmptyTeacher.
  ///
  /// In en, this message translates to:
  /// **'No reports yet.'**
  String get reportsEmptyTeacher;

  /// No description provided for @reportsEmptyParent.
  ///
  /// In en, this message translates to:
  /// **'No report cards or reports yet'**
  String get reportsEmptyParent;

  /// No description provided for @reportsCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load reports. Pull down to retry.'**
  String get reportsCouldNotLoad;

  /// No description provided for @reportsUploadTooltip.
  ///
  /// In en, this message translates to:
  /// **'Upload Report Card'**
  String get reportsUploadTooltip;

  /// No description provided for @reportTitle.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get reportTitle;

  /// No description provided for @reportCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load this report.'**
  String get reportCouldNotLoad;

  /// No description provided for @reportBy.
  ///
  /// In en, this message translates to:
  /// **'By {name}'**
  String reportBy(String name);

  /// No description provided for @reportTypeAcademic.
  ///
  /// In en, this message translates to:
  /// **'Academic'**
  String get reportTypeAcademic;

  /// No description provided for @reportTypeAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get reportTypeAttendance;

  /// No description provided for @reportTypeBehavior.
  ///
  /// In en, this message translates to:
  /// **'Behaviour'**
  String get reportTypeBehavior;

  /// No description provided for @reportTypeHomework.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get reportTypeHomework;

  /// No description provided for @reportTypeReportCard.
  ///
  /// In en, this message translates to:
  /// **'Report card'**
  String get reportTypeReportCard;

  /// No description provided for @uploadTitle.
  ///
  /// In en, this message translates to:
  /// **'Upload Report Card'**
  String get uploadTitle;

  /// No description provided for @uploadCouldNotLoadStudents.
  ///
  /// In en, this message translates to:
  /// **'Could not load students.'**
  String get uploadCouldNotLoadStudents;

  /// No description provided for @uploadFillAll.
  ///
  /// In en, this message translates to:
  /// **'Fill in all fields and choose a PDF.'**
  String get uploadFillAll;

  /// No description provided for @uploadYearFormat.
  ///
  /// In en, this message translates to:
  /// **'Academic year must be in format YYYY-YY, e.g. 2026-27.'**
  String get uploadYearFormat;

  /// No description provided for @uploadSuccess.
  ///
  /// In en, this message translates to:
  /// **'Report card uploaded'**
  String get uploadSuccess;

  /// No description provided for @uploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not upload the report card.'**
  String get uploadFailed;

  /// No description provided for @uploadTermLabel.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get uploadTermLabel;

  /// No description provided for @uploadTermHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Term 1'**
  String get uploadTermHint;

  /// No description provided for @uploadYearLabel.
  ///
  /// In en, this message translates to:
  /// **'Academic Year'**
  String get uploadYearLabel;

  /// No description provided for @uploadYearHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. 2026-27'**
  String get uploadYearHint;

  /// No description provided for @uploadChoosePdf.
  ///
  /// In en, this message translates to:
  /// **'Choose PDF'**
  String get uploadChoosePdf;

  /// No description provided for @uploadPublishNow.
  ///
  /// In en, this message translates to:
  /// **'Publish now (parent can see it immediately)'**
  String get uploadPublishNow;

  /// No description provided for @uploadButton.
  ///
  /// In en, this message translates to:
  /// **'Upload'**
  String get uploadButton;

  /// No description provided for @timetableEmpty.
  ///
  /// In en, this message translates to:
  /// **'No timetable has been set up for you yet.'**
  String get timetableEmpty;

  /// No description provided for @timetableCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load your routine. Pull down to retry.'**
  String get timetableCouldNotLoad;

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get notificationsEmpty;

  /// No description provided for @notificationsCouldNotLoad.
  ///
  /// In en, this message translates to:
  /// **'Could not load notifications. Pull down to retry.'**
  String get notificationsCouldNotLoad;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi', 'kn'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
    case 'kn':
      return AppLocalizationsKn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
