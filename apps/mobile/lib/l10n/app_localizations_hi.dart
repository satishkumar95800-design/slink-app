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
      'इस फ़ोन पर भाषा बदल गई। आपके खाते में सहेजी नहीं जा सकी — अगली बार बदलने पर सहेज ली जाएगी।';

  @override
  String get commonCancel => 'रद्द करें';

  @override
  String get commonConfirm => 'पुष्टि करें';

  @override
  String get commonSubmit => 'जमा करें';

  @override
  String get commonUpdate => 'अपडेट करें';

  @override
  String get commonRetry => 'फिर से कोशिश करें';

  @override
  String get commonContinue => 'जारी रखें';

  @override
  String get commonRemove => 'हटाएँ';

  @override
  String get commonClass => 'कक्षा';

  @override
  String get commonStudent => 'छात्र';

  @override
  String get commonSendToClass => 'कक्षा को भेजें';

  @override
  String get commonCouldNotLoadClasses => 'आपकी कक्षाएँ लोड नहीं हो सकीं।';

  @override
  String get commonNotAssignedToClass => 'आपको अभी कोई कक्षा नहीं दी गई है।';

  @override
  String get commonPullToRetry => 'फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String commonListItem(String first, String second) {
    return '$first · $second';
  }

  @override
  String get errorNetworkTimeout =>
      'नेटवर्क टाइमआउट — अपना कनेक्शन जाँचें और फिर से कोशिश करें।';

  @override
  String get errorNoInternet => 'इंटरनेट कनेक्शन नहीं है।';

  @override
  String get errorGeneric => 'कुछ गलत हो गया। कृपया फिर से कोशिश करें।';

  @override
  String get errorTryAgain => 'कृपया फिर से कोशिश करें।';

  @override
  String get errorPhoneNotRegistered =>
      'यह नंबर पंजीकृत नहीं है। इसे जुड़वाने के लिए अपने स्कूल एडमिन से संपर्क करें।';

  @override
  String get errorSchoolNotFound =>
      'इस कोड वाला स्कूल नहीं मिला। कोड जाँचें और फिर से कोशिश करें।';

  @override
  String get authSchoolCodeIntro =>
      'शुरू करने के लिए अपने स्कूल का दिया हुआ स्कूल कोड दर्ज करें।';

  @override
  String get authSchoolCodeLabel => 'स्कूल कोड';

  @override
  String get authSchoolCodeHint => 'जैसे greenfield-school';

  @override
  String get authSchoolCodeRequired =>
      'आगे बढ़ने के लिए अपना स्कूल कोड दर्ज करें।';

  @override
  String get authSignIn => 'साइन इन';

  @override
  String get authEnterMobile => 'अपना मोबाइल नंबर दर्ज करें';

  @override
  String get authOtpExplainer =>
      'आपकी पहचान की पुष्टि के लिए हम एक बार का कोड भेजेंगे।';

  @override
  String get authInvalidMobile => 'सही 10 अंकों का मोबाइल नंबर दर्ज करें।';

  @override
  String get authMobileLabel => 'मोबाइल नंबर';

  @override
  String get authSendCode => 'कोड भेजें';

  @override
  String get authCouldNotVerifyNumber =>
      'आपका नंबर सत्यापित नहीं हो सका। कृपया फिर से कोशिश करें।';

  @override
  String get authCouldNotSendCode => 'सत्यापन कोड नहीं भेजा जा सका।';

  @override
  String get authCouldNotSendCodeRetry =>
      'सत्यापन कोड नहीं भेजा जा सका। कृपया फिर से कोशिश करें।';

  @override
  String get authVerifyCodeTitle => 'कोड सत्यापित करें';

  @override
  String get authEnterSixDigit => '6 अंकों का कोड दर्ज करें';

  @override
  String authSentTo(String phone) {
    return '$phone पर भेजा गया';
  }

  @override
  String get authVerify => 'सत्यापित करें';

  @override
  String get authResendCode => 'कोड फिर से भेजें';

  @override
  String get authInvalidCode => 'कोड गलत है। कृपया फिर से कोशिश करें।';

  @override
  String get authCodeExpired =>
      'इस कोड की समय-सीमा खत्म हो गई है। नया कोड मँगाएँ।';

  @override
  String get roleParent => 'अभिभावक';

  @override
  String get roleTeacher => 'शिक्षक';

  @override
  String get roleAdmin => 'एडमिन';

  @override
  String get roleAccounts => 'लेखा';

  @override
  String get roleSuperAdmin => 'सुपर एडमिन';

  @override
  String get profileTitle => 'प्रोफ़ाइल';

  @override
  String get profileNoUser => 'उपयोगकर्ता प्रोफ़ाइल उपलब्ध नहीं है।';

  @override
  String get profileSchool => 'स्कूल';

  @override
  String get profileDarkTheme => 'डार्क थीम';

  @override
  String get profileLogout => 'लॉग आउट';

  @override
  String get profileLogoutConfirm => 'इस फ़ोन पर Schoolinkd से लॉग आउट करें?';

  @override
  String dashboardGreeting(String name) {
    return 'नमस्ते, $name';
  }

  @override
  String get dashboardNoChildren =>
      'आपके खाते से अभी कोई बच्चा नहीं जुड़ा है। कृपया स्कूल कार्यालय से संपर्क करें।';

  @override
  String get dashboardCouldNotLoadChildren =>
      'आपके बच्चों की जानकारी लोड नहीं हो सकी।';

  @override
  String get teacherDashboardTitle => 'शिक्षक डैशबोर्ड';

  @override
  String teacherSignedInAs(String name) {
    return '$name के रूप में साइन इन';
  }

  @override
  String get teacherSendHomework => 'होमवर्क भेजें';

  @override
  String get teacherSendHomeworkSubtitle => 'कक्षा के लिए फ़ोटो और नोट';

  @override
  String get teacherSendNotice => 'सूचना भेजें';

  @override
  String get teacherSendNoticeSubtitle =>
      'अपनी कक्षा के सभी अभिभावकों को संदेश';

  @override
  String get teacherReports => 'रिपोर्ट';

  @override
  String get teacherReportsSubtitle => 'प्रगति रिपोर्ट और रिपोर्ट कार्ड';

  @override
  String get teacherAddStudentNote => 'छात्र नोट जोड़ें';

  @override
  String get teacherAddStudentNoteSubtitle =>
      'आंतरिक नोट, बैठक विवरण, शिकायत या अभिभावक से चर्चा';

  @override
  String get teacherWeeklyRoutine => 'साप्ताहिक समय-सारणी';

  @override
  String get teacherWeeklyRoutineSubtitle =>
      'हफ़्ते भर की आपकी कक्षाओं की समय-सारणी';

  @override
  String get teacherAboutMyClasses => 'मेरी कक्षाओं के बारे में';

  @override
  String get teacherAboutMyClassesSubtitle =>
      'आपकी कक्षाओं की संख्या, विषय और हाल की रिपोर्ट';

  @override
  String todayNow(String className, String subject) {
    return 'अभी: $className · $subject';
  }

  @override
  String todayNowWithTime(String className, String subject, String time) {
    return 'अभी: $className · $subject ($time)';
  }

  @override
  String todayNext(String className, String subject) {
    return 'अगला: $className · $subject';
  }

  @override
  String todayNextWithTime(String className, String subject, String time) {
    return 'अगला: $className · $subject ($time)';
  }

  @override
  String get todayNoMorePeriods => 'आज और कोई पीरियड नहीं';

  @override
  String get todayNoPeriods => 'आज कोई पीरियड नहीं';

  @override
  String todayPeriodLabel(int period, String className, String subject) {
    return 'P$period · $className · $subject';
  }

  @override
  String get myClassesEmpty => 'आप अभी किसी कक्षा से नहीं जुड़े हैं।';

  @override
  String get myClassesCouldNotLoad =>
      'आपकी कक्षाएँ लोड नहीं हो सकीं। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String myClassesStrength(int boys, int girls, int total) {
    return 'लड़के: $boys · लड़कियाँ: $girls · कुल: $total';
  }

  @override
  String myClassesGenderNotSet(int count) {
    return 'लिंग दर्ज नहीं: $count';
  }

  @override
  String get myClassesRecentReports => 'हाल की रिपोर्ट';

  @override
  String get myClassesRead => 'पढ़ी गई';

  @override
  String get myClassesUnread => 'नहीं पढ़ी';

  @override
  String get attendanceTitle => 'उपस्थिति';

  @override
  String get attendanceMark => 'उपस्थिति दर्ज करें';

  @override
  String get attendanceMarkSubtitle => 'अपनी कक्षा की आज की उपस्थिति लें';

  @override
  String get attendanceDoneForToday => 'आज का काम पूरा';

  @override
  String attendanceDoneForClasses(int done, int total) {
    return 'आज $total में से $done कक्षाएँ पूरी';
  }

  @override
  String get attendancePickClass => 'कक्षा चुनें';

  @override
  String attendanceStudentCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count छात्र',
      one: '1 छात्र',
    );
    return '$_temp0';
  }

  @override
  String get attendancePresent => 'उपस्थित';

  @override
  String get attendanceAbsent => 'अनुपस्थित';

  @override
  String get attendanceLate => 'देर से';

  @override
  String get attendanceLeave => 'छुट्टी';

  @override
  String get attendanceNotMarkedYet => 'अभी दर्ज नहीं';

  @override
  String get attendanceHoliday => 'छुट्टी';

  @override
  String attendanceHolidayToday(String name) {
    return 'आज छुट्टी है: $name';
  }

  @override
  String get attendanceTapHint =>
      'अनुपस्थित करने के लिए टैप करें · देर से या छुट्टी के लिए देर तक दबाएँ';

  @override
  String attendanceCounts(int present, int absent) {
    return '$present उपस्थित · $absent अनुपस्थित';
  }

  @override
  String attendanceCountsWithOther(int present, int absent, int other) {
    return '$present उपस्थित · $absent अनुपस्थित · $other देर से/छुट्टी';
  }

  @override
  String attendanceConfirmSubmit(int present, int absent) {
    return 'उपस्थिति जमा करें: $present उपस्थित, $absent अनुपस्थित?';
  }

  @override
  String get attendanceSubmitted => 'उपस्थिति जमा हो गई';

  @override
  String get attendanceQueuedOffline =>
      'कनेक्शन नहीं है — इस फ़ोन पर सहेजी गई। यह अपने आप भेज दी जाएगी।';

  @override
  String get attendancePendingSend => 'भेजने का इंतज़ार…';

  @override
  String get attendanceSendingNow => 'भेजी जा रही है…';

  @override
  String get attendanceAlreadySubmitted =>
      'आज पहले ही जमा हो चुकी है — आधी रात तक बदल सकते हैं।';

  @override
  String get attendanceReadOnlyDay =>
      'इस दिन की उपस्थिति केवल एडमिन बदल सकते हैं।';

  @override
  String get attendanceNoStudents => 'इस कक्षा में अभी कोई छात्र नहीं है।';

  @override
  String get attendanceNoClassesToMark =>
      'आज हाज़िरी लगाने के लिए कोई कक्षा नहीं। कक्षा अध्यापक या पहले पीरियड के अध्यापक हाज़िरी लगाते हैं।';

  @override
  String get attendanceCouldNotLoad => 'उपस्थिति लोड नहीं हो सकी।';

  @override
  String attendanceThisMonth(int present, int marked) {
    return 'इस महीने: $present/$marked दिन';
  }

  @override
  String attendanceYearPercentage(String year, String percent) {
    return 'शैक्षणिक वर्ष $year: $percent';
  }

  @override
  String attendanceToday(String status) {
    return 'आज: $status';
  }

  @override
  String get attendanceChooseStatus => 'इस रूप में दर्ज करें';

  @override
  String homeChildWithClass(String name, String className) {
    return '$name · $className';
  }

  @override
  String get homeSwitchChild => 'बच्चा बदलें';

  @override
  String homeDueBy(String amount, String date) {
    return '$date तक $amount देय';
  }

  @override
  String get homeOverdue => 'देय तिथि निकल गई';

  @override
  String homeMoreDues(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '+ $count और शुल्क बकाया',
      one: '+ 1 और शुल्क बकाया',
    );
    return '$_temp0';
  }

  @override
  String get homeAllFeesPaid => 'सभी शुल्क जमा';

  @override
  String get homeClaimUnderReview => 'भुगतान दावा समीक्षा में है';

  @override
  String homeClaimAmountUnderReview(String amount) {
    return '$amount का दावा समीक्षा में है';
  }

  @override
  String get homePayNow => 'अभी भुगतान करें';

  @override
  String get homeViewFees => 'शुल्क देखें';

  @override
  String get homeTodayTitle => 'आज';

  @override
  String get homeNoHomeworkToday => 'आज कोई होमवर्क नहीं';

  @override
  String get homeLatestNotice => 'नवीनतम सूचना';

  @override
  String get homeCouldNotLoad => 'इस बच्चे का सारांश लोड नहीं हो सका।';

  @override
  String get menuFees => 'शुल्क';

  @override
  String get menuFeesSubtitle => 'बकाया, ऑनलाइन भुगतान, प्रमाण अपलोड, रसीदें';

  @override
  String get menuHomework => 'होमवर्क';

  @override
  String get menuHomeworkSubtitle =>
      'इस बच्चे की कक्षा को भेजा गया सारा होमवर्क';

  @override
  String get menuNotices => 'सूचनाएँ';

  @override
  String get menuNoticesSubtitle => 'कक्षा और स्कूल की सूचनाएँ';

  @override
  String get menuReports => 'रिपोर्ट कार्ड और रिपोर्ट';

  @override
  String get menuReportsSubtitle => 'रिपोर्ट कार्ड और प्रगति रिपोर्ट';

  @override
  String get menuAttendanceSubtitle => 'मासिक कैलेंडर';

  @override
  String get feesPayOnline => 'ऑनलाइन भुगतान करें';

  @override
  String get feesPaidByCashOrCheque =>
      'मैंने नकद/चेक से भुगतान किया – प्रमाण अपलोड करें';

  @override
  String get feesReceipts => 'रसीदें';

  @override
  String get feesPaidInFull => 'पूरा भुगतान';

  @override
  String feesDueOn(String date) {
    return 'अंतिम तिथि $date';
  }

  @override
  String feesAmountDue(String amount) {
    return '$amount देय';
  }

  @override
  String get feesEmpty => 'कोई शुल्क नहीं मिला।';

  @override
  String get feesMyClaims => 'आपके अपलोड किए भुगतान प्रमाण';

  @override
  String get feesCouldNotLoad =>
      'शुल्क लोड नहीं हो सका। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get feeStatusPaid => 'भुगतान हुआ';

  @override
  String get feeStatusPending => 'बकाया';

  @override
  String get feeStatusOverdue => 'देय तिथि निकल गई';

  @override
  String get feeStatusPartial => 'आंशिक भुगतान';

  @override
  String get feeStatusWaived => 'माफ़';

  @override
  String get paymentModeCash => 'नकद';

  @override
  String get paymentModeCheque => 'चेक';

  @override
  String get paymentModeBankTransfer => 'बैंक ट्रांसफ़र';

  @override
  String get paymentModeUpi => 'UPI';

  @override
  String get paymentModeDemandDraft => 'डिमांड ड्राफ़्ट';

  @override
  String get paymentModeOnline => 'ऑनलाइन भुगतान';

  @override
  String get claimStatusPending => 'समीक्षा में';

  @override
  String get claimStatusApproved => 'स्वीकृत';

  @override
  String get claimStatusRejected => 'अस्वीकृत';

  @override
  String claimSubmittedOn(String date) {
    return '$date को भेजा गया';
  }

  @override
  String claimClaimedAmount(String amount) {
    return 'दावा की गई राशि: $amount';
  }

  @override
  String claimMode(String mode) {
    return 'तरीका: $mode';
  }

  @override
  String claimRejectedReason(String reason) {
    return 'कारण: $reason';
  }

  @override
  String get claimsTitle => 'मेरे भुगतान दावे';

  @override
  String get claimsEmpty => 'अभी तक कोई भुगतान दावा नहीं भेजा गया।';

  @override
  String get claimsCouldNotLoad =>
      'आपके भुगतान दावे लोड नहीं हो सके। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get claimFormTitle => 'पहले ही भुगतान कर दिया?';

  @override
  String get claimFormIntro =>
      'अपने भुगतान की फ़ोटो या स्क्रीनशॉट लगाएँ (बैंक ट्रांसफ़र, नकद रसीद, चेक आदि)। दर्ज करने से पहले स्कूल इसकी जाँच करेगा।';

  @override
  String get claimTakePhoto => 'फ़ोटो लें';

  @override
  String get claimRetakePhoto => 'फिर से फ़ोटो लें';

  @override
  String get claimChooseFromGallery => 'गैलरी से चुनें';

  @override
  String get claimAmountLabel => 'भुगतान की गई राशि (वैकल्पिक)';

  @override
  String get claimDateLabel => 'भुगतान की तिथि (वैकल्पिक)';

  @override
  String get claimSelectDate => 'तिथि चुनें';

  @override
  String get claimModeLabel => 'भुगतान का तरीका (वैकल्पिक)';

  @override
  String get claimNoteLabel => 'नोट (वैकल्पिक)';

  @override
  String get claimSubmitForReview => 'समीक्षा के लिए भेजें';

  @override
  String get claimAttachProofFirst =>
      'पहले भुगतान प्रमाण की फ़ोटो या स्क्रीनशॉट लगाएँ।';

  @override
  String get claimSubmittedToast =>
      'भेज दिया गया — आपका स्कूल जल्द ही इसकी जाँच करेगा';

  @override
  String claimCouldNotSubmit(String reason) {
    return 'आपका दावा नहीं भेजा जा सका। $reason';
  }

  @override
  String get checkoutTitle => 'शुल्क भुगतान';

  @override
  String get checkoutCouldNotLoad => 'यह शुल्क लोड नहीं हो सका।';

  @override
  String get checkoutAmountDue => 'देय राशि';

  @override
  String checkoutPayAmount(String amount) {
    return '$amount का भुगतान करें';
  }

  @override
  String get checkoutConfirmingWithBank =>
      'भुगतान प्राप्त हुआ — बैंक से पुष्टि हो रही है। थोड़ी देर बाद यह शुल्क फिर से देखें।';

  @override
  String get checkoutConfirming => 'आपके भुगतान की पुष्टि हो रही है…';

  @override
  String get checkoutSuccess => 'भुगतान सफल रहा';

  @override
  String get checkoutBackToFees => 'शुल्क पर वापस जाएँ';

  @override
  String get checkoutNotSetUp =>
      'इस स्कूल के लिए अभी ऑनलाइन भुगतान की व्यवस्था नहीं है। कृपया स्कूल कार्यालय से संपर्क करें।';

  @override
  String get checkoutCouldNotStart =>
      'भुगतान शुरू नहीं हो सका। कृपया फिर से कोशिश करें।';

  @override
  String get checkoutNotCompleted => 'भुगतान पूरा नहीं हुआ।';

  @override
  String get checkoutCouldNotConfirm =>
      'भुगतान की पुष्टि नहीं हो सकी। कृपया फिर से कोशिश करें।';

  @override
  String checkoutDescription(String studentName) {
    return 'शुल्क भुगतान — $studentName';
  }

  @override
  String get receiptTitle => 'रसीद';

  @override
  String get receiptCouldNotLoad => 'यह रसीद लोड नहीं हो सकी।';

  @override
  String get receiptAmountReceived => 'प्राप्त राशि';

  @override
  String get receiptDiscountApplied => 'छूट लागू की गई';

  @override
  String receiptDiscountAppliedNamed(String name) {
    return 'छूट लागू की गई: $name';
  }

  @override
  String receiptMethod(String method) {
    return 'तरीका: $method';
  }

  @override
  String receiptPaidOn(String date) {
    return 'भुगतान तिथि: $date';
  }

  @override
  String receiptReference(String reference) {
    return 'संदर्भ: $reference';
  }

  @override
  String get receiptNotes => 'नोट';

  @override
  String get receiptDownload => 'रसीद डाउनलोड करें';

  @override
  String get receiptOpening => 'खुल रही है…';

  @override
  String get receiptCouldNotOpen =>
      'रसीद नहीं खुल सकी। कृपया फिर से कोशिश करें।';

  @override
  String get receiptsCouldNotLoad => 'रसीदें लोड नहीं हो सकीं।';

  @override
  String get receiptsEmpty => 'इस शुल्क की अभी कोई रसीद नहीं।';

  @override
  String receiptsRowWithDiscount(String date) {
    return '$date · छूट लागू की गई';
  }

  @override
  String get noticeKind => 'सूचना';

  @override
  String get homeworkKind => 'होमवर्क';

  @override
  String get noticesEmpty => 'अभी कोई सूचना नहीं';

  @override
  String get noticesCouldNotLoad => 'सूचनाएँ लोड नहीं हो सकीं।';

  @override
  String get noticeOpenPdf => 'PDF खोलें';

  @override
  String get noticeEnterMessage => 'संदेश दर्ज करें।';

  @override
  String get noticeSent => 'सूचना भेजी गई';

  @override
  String noticeCouldNotSend(String reason) {
    return 'सूचना नहीं भेजी जा सकी। $reason';
  }

  @override
  String get noticeNotClassTeacher =>
      'आपको अभी किसी कक्षा का कक्षा शिक्षक नहीं बनाया गया है।';

  @override
  String get noticeTitleLabel => 'शीर्षक (वैकल्पिक)';

  @override
  String get noticeMessageLabel => 'संदेश';

  @override
  String get homeworkEmpty => 'अभी कोई होमवर्क नहीं';

  @override
  String get homeworkCouldNotLoad => 'होमवर्क लोड नहीं हो सका।';

  @override
  String homeworkBy(String teacher, String subject) {
    return '$teacher · $subject';
  }

  @override
  String get homeworkAddPhotoFirst => 'फ़ोटो जोड़ें या होमवर्क लिखें।';

  @override
  String get homeworkDefaultBody => 'नया होमवर्क दिया गया है।';

  @override
  String get homeworkSent => 'होमवर्क भेजा गया';

  @override
  String homeworkCouldNotSend(String reason) {
    return 'होमवर्क नहीं भेजा जा सका। $reason';
  }

  @override
  String get homeworkCaptionLabel => 'होमवर्क / विवरण';

  @override
  String get homeworkSubjectOptional => 'विषय (वैकल्पिक)';

  @override
  String get homeworkNoSubject => 'कोई विषय नहीं';

  @override
  String get attachCamera => 'कैमरा';

  @override
  String get attachGallery => 'गैलरी';

  @override
  String get attachPdf => 'PDF लगाएँ';

  @override
  String get attachHintPhotos => 'अधिकतम 3 फ़ोटो';

  @override
  String get attachHintPhotosOrPdf => 'अधिकतम 3 फ़ोटो, या 1 PDF';

  @override
  String get sentTitle => 'भेजे गए';

  @override
  String sentSeenBy(int seen, int total) {
    String _temp0 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: '$seen/$total अभिभावकों ने देखा',
      one: '$seen/1 अभिभावक ने देखा',
    );
    return '$_temp0';
  }

  @override
  String get sentNotSeenYet => 'अभी तक नहीं खोला';

  @override
  String get sentEveryoneSeen => 'सभी अभिभावकों ने खोल लिया';

  @override
  String get sentEmpty => 'अभी कुछ नहीं भेजा गया';

  @override
  String get sentCouldNotLoad => 'भेजे गए आइटम लोड नहीं हो सके।';

  @override
  String get noteTypeLabel => 'प्रकार';

  @override
  String get noteTextLabel => 'नोट';

  @override
  String get noteTypeNote => 'नोट';

  @override
  String get noteTypeMom => 'बैठक का विवरण';

  @override
  String get noteTypeComplaint => 'शिकायत';

  @override
  String get noteTypeParentDiscussion => 'अभिभावक से चर्चा';

  @override
  String get noteInternalHint =>
      'इसे केवल स्कूल के कर्मचारी देख सकते हैं। अभिभावकों को छात्र नोट कभी नहीं दिखते।';

  @override
  String get noteSave => 'नोट सहेजें';

  @override
  String get noteSaved => 'नोट सहेजा गया';

  @override
  String get noteEnterFirst => 'पहले नोट लिखें।';

  @override
  String get noteRecent => 'हाल के नोट';

  @override
  String get noteCouldNotLoad => 'नोट लोड नहीं हो सके।';

  @override
  String get reportsEmptyTeacher => 'अभी कोई रिपोर्ट नहीं।';

  @override
  String get reportsEmptyParent => 'अभी कोई रिपोर्ट कार्ड या रिपोर्ट नहीं';

  @override
  String get reportsCouldNotLoad =>
      'रिपोर्ट लोड नहीं हो सकीं। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get reportsUploadTooltip => 'रिपोर्ट कार्ड अपलोड करें';

  @override
  String get reportTitle => 'रिपोर्ट';

  @override
  String get reportCouldNotLoad => 'यह रिपोर्ट लोड नहीं हो सकी।';

  @override
  String reportBy(String name) {
    return '$name द्वारा';
  }

  @override
  String get reportTypeAcademic => 'शैक्षणिक';

  @override
  String get reportTypeAttendance => 'उपस्थिति';

  @override
  String get reportTypeBehavior => 'व्यवहार';

  @override
  String get reportTypeHomework => 'होमवर्क';

  @override
  String get reportTypeReportCard => 'रिपोर्ट कार्ड';

  @override
  String get uploadTitle => 'रिपोर्ट कार्ड अपलोड करें';

  @override
  String get uploadCouldNotLoadStudents => 'छात्र लोड नहीं हो सके।';

  @override
  String get uploadFillAll => 'सभी जानकारी भरें और PDF चुनें।';

  @override
  String get uploadYearFormat =>
      'शैक्षणिक वर्ष YYYY-YY रूप में होना चाहिए, जैसे 2026-27।';

  @override
  String get uploadSuccess => 'रिपोर्ट कार्ड अपलोड हुआ';

  @override
  String get uploadFailed => 'रिपोर्ट कार्ड अपलोड नहीं हो सका।';

  @override
  String get uploadTermLabel => 'सत्र';

  @override
  String get uploadTermHint => 'जैसे सत्र 1';

  @override
  String get uploadYearLabel => 'शैक्षणिक वर्ष';

  @override
  String get uploadYearHint => 'जैसे 2026-27';

  @override
  String get uploadChoosePdf => 'PDF चुनें';

  @override
  String get uploadPublishNow => 'अभी प्रकाशित करें (अभिभावक तुरंत देख सकेंगे)';

  @override
  String get uploadButton => 'अपलोड करें';

  @override
  String get timetableEmpty => 'आपके लिए अभी कोई समय-सारणी नहीं बनाई गई है।';

  @override
  String get timetableCouldNotLoad =>
      'आपकी समय-सारणी लोड नहीं हो सकी। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get notificationsTitle => 'सूचनाएँ';

  @override
  String get notificationsEmpty => 'अभी कोई सूचना नहीं।';

  @override
  String get notificationsCouldNotLoad =>
      'सूचनाएँ लोड नहीं हो सकीं। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get homeQuickAccess => 'त्वरित पहुँच';

  @override
  String get homeAmountDue => 'देय राशि';

  @override
  String get homeAttendanceRate => 'इस महीने की उपस्थिति';

  @override
  String get teacherQuickActions => 'त्वरित कार्य';

  @override
  String get teacherTodayClasses => 'आज की कक्षाएँ';

  @override
  String get reportSubjects => 'विषय';

  @override
  String get reportTeacherRemark => 'शिक्षक की टिप्पणी';

  @override
  String get reportOpenPdf => 'रिपोर्ट कार्ड खोलें';

  @override
  String get reportPdfFailed => 'रिपोर्ट कार्ड नहीं खुल सका।';

  @override
  String get authTagline =>
      'शुल्क, होमवर्क, उपस्थिति और रिपोर्ट — सब एक ही ऐप में।';

  @override
  String get classReminderTitle => 'कक्षा रिमाइंडर';

  @override
  String get classReminderChoose => 'हर कक्षा से पहले याद दिलाएँ';

  @override
  String get classReminderOff => 'बंद';

  @override
  String classReminderMinutes(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: 'कक्षा से $minutes मिनट पहले',
      one: 'कक्षा से 1 मिनट पहले',
    );
    return '$_temp0';
  }

  @override
  String get classReminderSaveFailed =>
      'रिमाइंडर सहेजा नहीं जा सका। फिर से कोशिश करें।';

  @override
  String get uploadRemarkLabel => 'शिक्षक की टिप्पणी (वैकल्पिक)';

  @override
  String get uploadRemarkHint => 'रिपोर्ट कार्ड के साथ अभिभावकों को दिखेगी';

  @override
  String get uploadRemarkHintAi =>
      'कुछ बिंदु (जैसे गणित में अच्छा, और पढ़ना चाहिए), या खाली छोड़ें';

  @override
  String get aiDraftWithAi => 'AI से ड्राफ़्ट';

  @override
  String get aiDrafting => 'ड्राफ़्ट बन रहा है…';

  @override
  String get aiPickStudentFirst => 'पहले छात्र चुनें।';

  @override
  String get aiUnavailable =>
      'AI सहायक अभी उपलब्ध नहीं है। कृपया खुद लिखें या बाद में कोशिश करें।';

  @override
  String get insightsTitle => 'इनसाइट्स';

  @override
  String get insightsExplainer =>
      'उपस्थिति और नोट्स से दिखे पैटर्न, हर सुबह अपडेट। ये केवल सुझाव हैं — निपटाने के बाद हटा दें।';

  @override
  String get insightsEmpty => 'अभी किसी बात पर ध्यान देने की ज़रूरत नहीं है।';

  @override
  String get insightsCouldNotLoad =>
      'इनसाइट्स लोड नहीं हो सकीं। फिर से कोशिश करने के लिए नीचे खींचें।';

  @override
  String get insightsDismiss => 'हटाएँ';

  @override
  String get insightKindAbsenceStreak => 'लगातार कई दिन अनुपस्थित';

  @override
  String get insightKindWeekdayAbsence => 'एक ही दिन बार-बार अनुपस्थित';

  @override
  String get insightKindAttendanceDrop => 'उपस्थिति घट रही है';

  @override
  String get insightKindParentDisengaged => 'अभिभावक सूचनाएँ नहीं पढ़ रहे';

  @override
  String get insightKindStudentAtRisk => 'सहायता की ज़रूरत हो सकती है';

  @override
  String insightReasonAbsentInARow(int days) {
    return 'लगातार $days स्कूल दिन अनुपस्थित';
  }

  @override
  String insightReasonSameWeekday(int count, int total, String weekday) {
    return '$total में से $count अनुपस्थितियाँ $weekday को';
  }

  @override
  String insightReasonAttendanceFell(int before, int now) {
    return 'उपस्थिति $before% से घटकर $now% हुई';
  }

  @override
  String insightReasonParentNotReading(int unread) {
    return 'अभिभावक ने पिछली $unread सूचनाएँ नहीं खोलीं';
  }

  @override
  String insightReasonLowAttendance(int pct) {
    return 'हाल की उपस्थिति $pct%';
  }

  @override
  String insightReasonComplaints(int count, int days) {
    return 'पिछले $days दिनों में $count शिकायतें';
  }

  @override
  String get askTitle => 'स्कूल ऐप से पूछें';

  @override
  String get askTile => 'पूछें';

  @override
  String get askIntro =>
      'उपस्थिति, शुल्क, होमवर्क या सूचनाओं के बारे में पूछें — English, ಕನ್ನಡ या हिन्दी में।';

  @override
  String get askPlaceholder => 'अपना सवाल लिखें…';

  @override
  String get askSend => 'पूछें';

  @override
  String get askThinking => 'खोजा जा रहा है…';

  @override
  String get askFootnote => 'जवाब स्कूल के रिकॉर्ड से आते हैं।';

  @override
  String get askExampleAttendance => 'क्या मेरा बच्चा इस हफ़्ते उपस्थित था?';

  @override
  String get askExampleFees => 'कितना शुल्क बाकी है?';

  @override
  String get askExampleHomework => 'इस हफ़्ते कोई होमवर्क है?';

  @override
  String get askExampleNotices => 'स्कूल से कोई सूचना है?';

  @override
  String askChildAttendance(
      String name, int present, int marked, int pct, String from, String to) {
    return '$name: $marked में से $present दिन उपस्थित ($pct%), $from से $to';
  }

  @override
  String askChildFees(String name, String amount) {
    return '$name: $amount बाकी';
  }

  @override
  String askChildNoFees(String name) {
    return '$name का कोई शुल्क बाकी नहीं है।';
  }

  @override
  String askChildHomework(String name, int count, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'पिछले $days दिनों में $name के लिए $count होमवर्क',
      one: 'पिछले $days दिनों में $name के लिए 1 होमवर्क',
      zero: 'पिछले $days दिनों में $name के लिए कोई होमवर्क नहीं',
    );
    return '$_temp0';
  }

  @override
  String askRecentNotices(int count, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'पिछले $days दिनों में $count सूचनाएँ',
      one: 'पिछले $days दिनों में 1 सूचना',
      zero: 'पिछले $days दिनों में कोई सूचना नहीं',
    );
    return '$_temp0';
  }

  @override
  String askWhichChild(String names) {
    return 'कौन सा बच्चा? $names';
  }

  @override
  String get askCantAnswer => 'इसका जवाब अभी नहीं दे सकता।';

  @override
  String get askCantAnswerHelp =>
      'मैं उपस्थिति, बाकी शुल्क, होमवर्क और सूचनाओं के बारे में बता सकता हूँ।';

  @override
  String get calendarTitle => 'स्कूल कैलेंडर';

  @override
  String get calendarToday => 'आज';

  @override
  String get calendarHoliday => 'छुट्टी';

  @override
  String get calendarEvent => 'कार्यक्रम';

  @override
  String get calendarPtm => 'पीटीएम';

  @override
  String get calendarPreviousMonth => 'पिछला महीना';

  @override
  String get calendarNextMonth => 'अगला महीना';

  @override
  String get calendarNothingOnDay => 'इस दिन के लिए कुछ निर्धारित नहीं है।';

  @override
  String get calendarCouldNotLoad => 'कैलेंडर लोड नहीं हो सका।';

  @override
  String calendarDayHeading(String weekday, String date) {
    return '$weekday, $date';
  }

  @override
  String get hrmsPayslipsTitle => 'मेरी पेस्लिप';

  @override
  String get hrmsLeaveTitle => 'छुट्टी';

  @override
  String get hrmsNoRecord =>
      'आपके खाते से अभी कोई एचआर रिकॉर्ड जुड़ा नहीं है। कृपया अपने स्कूल एडमिन से पूछें।';

  @override
  String get hrmsPayslipsEmpty =>
      'अभी कोई पेस्लिप नहीं है। स्कूल द्वारा महीने का वेतन अंतिम करने के बाद यहाँ दिखेगी।';

  @override
  String get hrmsCouldNotLoad => 'यह लोड नहीं हो सका। कृपया फिर कोशिश करें।';

  @override
  String get hrmsNetPay => 'शुद्ध वेतन';

  @override
  String get hrmsGross => 'सकल';

  @override
  String get hrmsDeductions => 'कटौतियाँ';

  @override
  String hrmsPaidOn(String date) {
    return '$date को भुगतान हुआ';
  }

  @override
  String get hrmsNotPaidYet => 'भुगतान लंबित';

  @override
  String get hrmsPayslipOpenFailed => 'पेस्लिप नहीं खुल सकी।';

  @override
  String hrmsPayslipViewerTitle(String month) {
    return 'पेस्लिप $month';
  }

  @override
  String get hrmsBalances => 'छुट्टी शेष';

  @override
  String hrmsAvailable(String days) {
    return '$days उपलब्ध';
  }

  @override
  String hrmsBalanceDetail(
      String allowance, String carried, String used, String pending) {
    return 'सीमा $allowance · आगे लाया $carried · उपयोग $used · लंबित $pending';
  }

  @override
  String get hrmsUnpaidLeave => 'बिना वेतन';

  @override
  String get hrmsRequests => 'मेरे अनुरोध';

  @override
  String get hrmsNoRequests => 'आपने अभी तक छुट्टी के लिए आवेदन नहीं किया है।';

  @override
  String get hrmsApplyLeave => 'छुट्टी के लिए आवेदन';

  @override
  String get hrmsStatusPending => 'लंबित';

  @override
  String get hrmsStatusApproved => 'स्वीकृत';

  @override
  String get hrmsStatusRejected => 'अस्वीकृत';

  @override
  String get hrmsStatusCancelled => 'रद्द';

  @override
  String hrmsDaysCount(String days) {
    return '$days दिन';
  }

  @override
  String get hrmsHalfDayLabel => 'आधा दिन';

  @override
  String get hrmsCancelRequest => 'अनुरोध रद्द करें';

  @override
  String get hrmsCancelConfirm => 'क्या यह छुट्टी अनुरोध रद्द करें?';

  @override
  String get hrmsKeepRequest => 'रहने दें';

  @override
  String hrmsDecisionNote(String note) {
    return 'टिप्पणी: $note';
  }

  @override
  String get hrmsLeaveType => 'छुट्टी का प्रकार';

  @override
  String get hrmsFromDate => 'से';

  @override
  String get hrmsToDate => 'तक';

  @override
  String get hrmsPickDate => 'तारीख चुनें';

  @override
  String get hrmsHalfDayToggle => 'आधा दिन';

  @override
  String get hrmsReason => 'कारण';

  @override
  String get hrmsReasonRequired => 'कृपया कारण बताएं।';

  @override
  String get hrmsChooseTypeAndDates => 'छुट्टी का प्रकार और तारीखें चुनें।';

  @override
  String get hrmsEndBeforeStart => 'अंतिम तारीख शुरुआती तारीख से पहले है।';

  @override
  String get hrmsSubmitRequest => 'अनुरोध भेजें';

  @override
  String get hrmsRequestSent => 'छुट्टी का अनुरोध भेज दिया गया।';

  @override
  String get hrmsErrInsufficientBalance =>
      'इस अनुरोध के लिए आपकी छुट्टी शेष पर्याप्त नहीं है।';

  @override
  String get hrmsErrOverlap =>
      'इनमें से कुछ दिन पहले से किसी अन्य छुट्टी अनुरोध में शामिल हैं।';

  @override
  String get hrmsErrNoWorkingDays =>
      'इन तारीखों में कोई कार्यदिवस नहीं है (साप्ताहिक अवकाश या छुट्टियाँ)।';

  @override
  String get hrmsErrNoRecord =>
      'आपके खाते से कोई एचआर रिकॉर्ड जुड़ा नहीं है। स्कूल एडमिन से पूछें।';

  @override
  String get hrmsErrLeaveStarted =>
      'शुरू हो चुकी छुट्टी केवल एडमिन रद्द कर सकता है।';

  @override
  String get hrmsErrFeatureOff => 'यह सुविधा आपके स्कूल के लिए चालू नहीं है।';

  @override
  String get hrmsPayslipSave => 'सेव या शेयर करें';

  @override
  String get staffDocsTitle => 'साझा दस्तावेज़';

  @override
  String get staffDocsIntro =>
      'फ़ोल्डर और फ़ाइलें जिन्हें स्कूल का हर शिक्षक देख और डाउनलोड कर सकता है।';

  @override
  String get staffDocsNewFolder => 'नया फ़ोल्डर';

  @override
  String get staffDocsRenameFolder => 'फ़ोल्डर का नाम बदलें';

  @override
  String get staffDocsDeleteFolder => 'फ़ोल्डर हटाएँ';

  @override
  String get staffDocsFolderName => 'फ़ोल्डर का नाम';

  @override
  String get staffDocsFolderNameHint => 'जैसे पाठ योजनाएँ';

  @override
  String get staffDocsSave => 'सेव करें';

  @override
  String get staffDocsNoFolders =>
      'अभी कोई फ़ोल्डर नहीं। एक बनाएँ और सभी शिक्षकों के देखने के लिए फ़ाइलें अपलोड करें।';

  @override
  String get staffDocsNoFiles =>
      'यह फ़ोल्डर खाली है। PDF, चित्र, Word, Excel या PowerPoint फ़ाइलें अपलोड करें (हर एक 20 MB तक)।';

  @override
  String staffDocsFileCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ाइलें',
      one: '1 फ़ाइल',
      zero: 'कोई फ़ाइल नहीं',
    );
    return '$_temp0';
  }

  @override
  String staffDocsCreatedBy(String name) {
    return '$name द्वारा बनाया गया';
  }

  @override
  String get staffDocsUpload => 'फ़ाइलें अपलोड करें';

  @override
  String staffDocsUploaded(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ाइलें अपलोड हुईं',
      one: '1 फ़ाइल अपलोड हुई',
    );
    return '$_temp0';
  }

  @override
  String staffDocsTooBig(String name) {
    return '$name 20 MB से बड़ी है।';
  }

  @override
  String get staffDocsDownload => 'डाउनलोड';

  @override
  String get staffDocsDelete => 'हटाएँ';

  @override
  String staffDocsDeleteFileConfirm(String name) {
    return '\"$name\" हटाएँ? अन्य शिक्षक इसे अब नहीं देख पाएँगे।';
  }

  @override
  String staffDocsDeleteFolderConfirm(String name) {
    return '\"$name\" फ़ोल्डर हटाएँ?';
  }

  @override
  String get staffDocsOpenFailed => 'फ़ाइल नहीं खुल सकी।';

  @override
  String get staffDocsErrFolderExists => 'इस नाम का फ़ोल्डर पहले से मौजूद है।';

  @override
  String get staffDocsErrFolderNotEmpty => 'पहले इस फ़ोल्डर की फ़ाइलें हटाएँ।';

  @override
  String get staffDocsErrNotOwner =>
      'इसे केवल जोड़ने वाला व्यक्ति या एडमिन ही बदल सकता है।';

  @override
  String routinePeriod(int period) {
    return 'पीरियड $period';
  }

  @override
  String get consentTitle => 'सहमति पत्र';

  @override
  String get consentEmpty => 'स्कूल से अभी कोई सहमति पत्र नहीं आया है।';

  @override
  String get consentNeedsAnswer => 'अभी हस्ताक्षर करें';

  @override
  String get consentApproved => 'सहमत';

  @override
  String get consentDeclined => 'सहमत नहीं';

  @override
  String get consentClosed => 'बंद';

  @override
  String consentSignBy(String date) {
    return '$date तक हस्ताक्षर करें';
  }

  @override
  String consentForChild(String name) {
    return '$name के लिए';
  }

  @override
  String consentForChildClass(String name, String className) {
    return '$name के लिए · $className';
  }

  @override
  String get consentAgreeingTo => 'आप किस बात पर सहमति दे रहे हैं';

  @override
  String get consentYourAnswer => 'आपका जवाब';

  @override
  String get consentAllow => 'मैं सहमत हूँ';

  @override
  String get consentDecline => 'मैं सहमत नहीं हूँ';

  @override
  String get consentSignatureLabel => 'आपका पूरा नाम';

  @override
  String get consentSignatureHint => 'अपना नाम टाइप करना ही आपका हस्ताक्षर है';

  @override
  String get consentNoteLabel => 'स्कूल के लिए संदेश (वैकल्पिक)';

  @override
  String consentConfirm(String name) {
    return 'मैं $name का/की माता-पिता या अभिभावक हूँ और इस जवाब की पुष्टि करता/करती हूँ।';
  }

  @override
  String get consentSubmit => 'हस्ताक्षर करके भेजें';

  @override
  String get consentSubmitted => 'धन्यवाद। स्कूल को आपका जवाब मिल गया है।';

  @override
  String consentSignedBy(String name, String date) {
    return '$name ने $date को हस्ताक्षर किए';
  }

  @override
  String consentCanChange(String date) {
    return 'आप $date तक अपना जवाब बदल सकते हैं।';
  }

  @override
  String get consentChange => 'जवाब बदलें';

  @override
  String consentClosedNote(String date) {
    return 'हस्ताक्षर की अंतिम तिथि $date थी।';
  }

  @override
  String get consentErrClosed => 'हस्ताक्षर की अंतिम तिथि निकल चुकी है।';

  @override
  String get consentErrNotFound => 'यह सहमति पत्र अब उपलब्ध नहीं है।';

  @override
  String get syllabusTitle => 'पाठ्यक्रम';

  @override
  String get syllabusStatusOnTime => 'समय पर';

  @override
  String syllabusStatusLate(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिन देर',
      one: '1 दिन देर',
    );
    return '$_temp0';
  }

  @override
  String get syllabusStatusCompleted => 'पूरा';

  @override
  String get syllabusStatusNotPlanned => 'योजना नहीं';

  @override
  String get syllabusMineEmpty => 'आप अभी किसी कक्षा के विषय शिक्षक नहीं हैं।';

  @override
  String syllabusSubjectInClass(String subject, String className) {
    return '$subject · $className';
  }

  @override
  String get syllabusNoTopics => 'अभी कोई पाठ तय नहीं';

  @override
  String get syllabusNoTopicsTeacher =>
      'स्कूल ने इस विषय के पाठ अभी तय नहीं किए हैं।';

  @override
  String syllabusCoveredOf(int covered, int total, int percent) {
    return '$total में से $covered पाठ पढ़ाए गए · $percent%';
  }

  @override
  String syllabusNextTopic(String title, String date) {
    return 'अगला: $title ($date तक)';
  }

  @override
  String get syllabusTickHelp =>
      'पाठ पढ़ा लेने पर उस पर टैप करें। आपके चिह्नित पाठ अभिभावक देखते हैं।';

  @override
  String get syllabusPickDateHelp => 'यह पाठ कब पढ़ाया गया?';

  @override
  String get syllabusMarked => 'पढ़ाया गया चिह्नित किया';

  @override
  String get syllabusUnmarked => 'नहीं पढ़ाया गया चिह्नित किया';

  @override
  String get syllabusUndoTitle => 'नहीं पढ़ाया गया चिह्नित करें?';

  @override
  String syllabusUndoBody(String title) {
    return '\"$title\" अभिभावकों को भी नहीं पढ़ाया गया दिखेगा।';
  }

  @override
  String get syllabusUndoConfirm => 'नहीं पढ़ाया गया';

  @override
  String get syllabusCoveredLabel => 'पढ़ाया गया';

  @override
  String get syllabusNotCoveredLabel => 'अभी नहीं पढ़ाया गया';

  @override
  String syllabusCoveredOn(String date) {
    return '$date को पढ़ाया गया';
  }

  @override
  String syllabusDueBy(String date) {
    return '$date तक';
  }

  @override
  String syllabusLateDue(String date) {
    return 'देर: $date तक पूरा होना था';
  }

  @override
  String syllabusChildEmpty(String name) {
    return 'स्कूल ने अभी $name की कक्षा का पाठ्यक्रम साझा नहीं किया है।';
  }

  @override
  String syllabusChildIntro(String name, String className) {
    return '$name की कक्षा ($className) में हर विषय कितना पढ़ाया गया है।';
  }

  @override
  String syllabusPercent(int percent) {
    return '$percent%';
  }

  @override
  String syllabusTopicsCovered(int covered, int total) {
    return '$total में से $covered पाठ पढ़ाए गए';
  }

  @override
  String syllabusLastCovered(String date) {
    return 'आखिरी पाठ $date को पढ़ाया गया';
  }

  @override
  String get syllabusErrNotTeacher => 'आप इस कक्षा में यह विषय नहीं पढ़ाते।';

  @override
  String get syllabusErrFutureDate =>
      'भविष्य की तारीख पर पाठ को पढ़ाया गया नहीं चिह्नित कर सकते।';

  @override
  String get syllabusErrTopicGone =>
      'यह पाठ हटा दिया गया है। रीफ़्रेश करने के लिए नीचे खींचें।';

  @override
  String get errSubscriptionExpired =>
      'इस स्कूल की Schoolinkd सदस्यता समाप्त हो गई है। कृपया स्कूल कार्यालय से संपर्क करें।';

  @override
  String get busTitle => 'स्कूल बस';

  @override
  String busNotOnRoute(String name) {
    return '$name किसी स्कूल बस रूट पर नहीं है।';
  }

  @override
  String busVehicle(String number) {
    return 'वाहन $number';
  }

  @override
  String get busStop => 'स्टॉप';

  @override
  String busPickup(String time) {
    return 'पिक-अप $time';
  }

  @override
  String busDrop(String time) {
    return 'ड्रॉप $time';
  }

  @override
  String get busNoStop => 'अभी स्टॉप तय नहीं है। स्कूल ऑफ़िस से पूछें।';

  @override
  String get busDriver => 'ड्राइवर';

  @override
  String get busAttendant => 'सहायक';

  @override
  String get busNoDriver => 'अभी ड्राइवर तय नहीं है।';

  @override
  String get busCall => 'कॉल करें';

  @override
  String busCallName(String name) {
    return '$name को कॉल करें';
  }

  @override
  String get busCouldNotCall => 'फ़ोन ऐप नहीं खुल सका।';

  @override
  String get errImageNotAllowed =>
      'यह फ़ोटो नहीं भेजी जा सकती: यह स्कूल के लिए उपयुक्त नहीं लगती। लिखे हुए काम की फ़ोटो भेजें।';

  @override
  String get errFileContentMismatch =>
      'इस फ़ाइल की सामग्री उसके प्रकार से मेल नहीं खाती (जैसे, नाम बदली हुई फ़ाइल)। इसे खोलें, सही प्रकार में फिर से सेव करें और अपलोड करें।';

  @override
  String get errWrongSchool =>
      'यह लॉगिन किसी दूसरे स्कूल का है। लॉग आउट करें और इस स्कूल के कोड से लॉगिन करें।';

  @override
  String get errImageCheckUnavailable =>
      'फ़ोटो की जाँच नहीं हो सकी। थोड़ी देर में फिर कोशिश करें।';

  @override
  String get errImageTooLarge =>
      'यह फ़ोटो जाँच के लिए बहुत बड़ी है। 5 MB से छोटी फ़ोटो लें।';

  @override
  String get errImageNotChecked =>
      'इस फ़ोटो की जाँच नहीं हुई। इसे फिर से जोड़कर भेजें।';

  @override
  String get calendarPickMonth => 'महीना चुनें';

  @override
  String get calendarPrevYear => 'पिछला साल';

  @override
  String get calendarNextYear => 'अगला साल';

  @override
  String get attendanceClassTitle => 'कक्षा की हाज़िरी';

  @override
  String attendanceClassCounts(int present, int late, int absent, int leave) {
    return '$present उपस्थित · $late देर · $absent अनुपस्थित · $leave छुट्टी';
  }

  @override
  String attendanceClassPercent(int percent) {
    return '$percent%';
  }

  @override
  String attendanceClassAverage(int percent) {
    return 'कक्षा का औसत: $percent%';
  }

  @override
  String get attendanceClassEmpty => 'इस महीने हाज़िरी नहीं लगी।';

  @override
  String get attendanceFirstPeriodNote => 'आज पहला पीरियड आपका है';

  @override
  String get staffHomeConsoleHint =>
      'स्कूल का प्रबंधन schoolinkd.in कंसोल से करें। यहाँ आपकी छुट्टी, वेतन पर्ची और स्कूल कैलेंडर हैं।';

  @override
  String get modeStaff => 'स्टाफ़';

  @override
  String get modeParent => 'अभिभावक';

  @override
  String get errNoChildren => 'आपके खाते से अब कोई बच्चा जुड़ा नहीं है।';

  @override
  String get authCountryCode => 'देश का कोड';

  @override
  String get authSearchCountry => 'देश या कोड खोजें';

  @override
  String get authInvalidMobileIntl =>
      'इस देश के लिए सही मोबाइल नंबर दर्ज करें।';

  @override
  String get roleDriver => 'बस चालक';

  @override
  String get roleLibrarian => 'पुस्तकालयाध्यक्ष';

  @override
  String get roleReceptionist => 'रिसेप्शनिस्ट';

  @override
  String get consoleOnlyMessage =>
      'आपका काम schoolinkd.in स्कूल कंसोल में है। वहाँ अपने ईमेल और पासवर्ड से साइन इन करें।';

  @override
  String get adminAttendanceToday => 'आज की उपस्थिति';

  @override
  String adminPresentPercent(int percent) {
    return '$percent% उपस्थित';
  }

  @override
  String get adminNotMarkedYet => 'अभी दर्ज नहीं';

  @override
  String get adminAbsent => 'अनुपस्थित';

  @override
  String adminMarkedOf(int marked, int total) {
    return '$total में से $marked छात्र दर्ज';
  }

  @override
  String adminClassesNotMarked(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count कक्षाएँ अभी दर्ज नहीं',
      one: '1 कक्षा अभी दर्ज नहीं',
    );
    return '$_temp0';
  }

  @override
  String adminHolidayToday(String name) {
    return 'आज छुट्टी: $name';
  }

  @override
  String get adminCollectedToday => 'आज वसूली गई फ़ीस';

  @override
  String adminReceiptsAndMonth(int count, String month) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count रसीदें',
      one: '1 रसीद',
    );
    return '$_temp0 · इस महीने $month';
  }

  @override
  String get adminWaitingTitle => 'आपका इंतज़ार';

  @override
  String get adminNothingWaiting => 'आपकी मंज़ूरी के लिए कुछ बाकी नहीं है।';

  @override
  String get adminWaitingClaims => 'जाँचने के लिए भुगतान प्रमाण';

  @override
  String get adminWaitingLeave => 'छुट्टी के अनुरोध';

  @override
  String get adminWaitingPettyCash => 'पेटी कैश प्रविष्टियाँ';

  @override
  String get adminApproveInConsole => 'इन्हें कंसोल में मंज़ूर करें।';

  @override
  String get adminStaffOnLeave => 'छुट्टी पर कर्मचारी';

  @override
  String get adminNewEnquiries => 'इस सप्ताह नई पूछताछ';

  @override
  String get adminFollowUpsDue => 'बाकी प्रवेश फ़ॉलो-अप';

  @override
  String get adminAlerts => 'शुरुआती चेतावनियाँ';

  @override
  String get adminBusesMoving => 'यात्रा पर बसें';

  @override
  String adminBusesValue(int moving, int total) {
    return '$total में से $moving';
  }

  @override
  String get adminLibraryOverdue => 'देर वाली पुस्तकालय किताबें';

  @override
  String get adminLiveBuses => 'लाइव बसें';

  @override
  String get adminConsoleHint =>
      'विवरण और मंज़ूरी के लिए schoolinkd.in कंसोल खोलें।';

  @override
  String get busTrackLive => 'बस को लाइव देखें';

  @override
  String get busLiveTitle => 'नक्शे पर बस';

  @override
  String get busLiveNoRoute => 'आपका बच्चा किसी बस रूट पर नहीं है।';

  @override
  String get busLiveNotRunning =>
      'बस अभी यात्रा पर नहीं है। चालक के यात्रा शुरू करने पर यहाँ दिखेगी।';

  @override
  String get busLiveNotRunningShort => 'यात्रा पर नहीं';

  @override
  String get busLiveWaitingGps =>
      'यात्रा शुरू हो गई है। बस की लोकेशन का इंतज़ार…';

  @override
  String get busLiveWaitingGpsShort => 'लोकेशन का इंतज़ार';

  @override
  String get busLiveNoSignal => 'सिग्नल नहीं';

  @override
  String get busLiveOnWayPickup => 'पिक-अप के लिए आ रही है';

  @override
  String get busLiveOnWayDrop => 'ड्रॉप के लिए जा रही है';

  @override
  String busLiveStop(String stop, String time) {
    return 'स्टॉप: $stop · $time';
  }

  @override
  String busUpdatedSeconds(int seconds) {
    String _temp0 = intl.Intl.pluralLogic(
      seconds,
      locale: localeName,
      other: '$seconds सेकंड पहले अपडेट',
      one: '1 सेकंड पहले अपडेट',
      zero: 'अभी अपडेट हुआ',
    );
    return '$_temp0';
  }

  @override
  String busUpdatedMinutes(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes मिनट पहले अपडेट',
      one: '1 मिनट पहले अपडेट',
    );
    return '$_temp0';
  }

  @override
  String busUpdatedAt(String time) {
    return '$time पर अपडेट';
  }

  @override
  String busCallDriver(String name) {
    return '$name को कॉल करें';
  }

  @override
  String get busNoneMoving => 'अभी कोई बस यात्रा पर नहीं है।';

  @override
  String get busMoving => 'चल रही है';

  @override
  String get busTripPickup => 'सुबह पिक-अप';

  @override
  String get busTripDrop => 'दोपहर ड्रॉप';

  @override
  String get driverNoRoutes =>
      'आपको अभी कोई बस रूट नहीं दिया गया है। स्कूल कार्यालय से पूछें।';

  @override
  String driverStopsAndChildren(int stops, int children) {
    String _temp0 = intl.Intl.pluralLogic(
      stops,
      locale: localeName,
      other: '$stops स्टॉप',
      one: '1 स्टॉप',
    );
    String _temp1 = intl.Intl.pluralLogic(
      children,
      locale: localeName,
      other: '$children बच्चे',
      one: '1 बच्चा',
    );
    return '$_temp0 · $_temp1';
  }

  @override
  String driverFirstStop(String stop, String time) {
    return 'पहला स्टॉप: $stop · $time';
  }

  @override
  String get driverStartPickup => 'सुबह का पिक-अप शुरू करें';

  @override
  String get driverStartDrop => 'दोपहर का ड्रॉप शुरू करें';

  @override
  String get driverSharingNow => 'बस की लोकेशन साझा हो रही है';

  @override
  String get driverWaitingGps => 'GPS का इंतज़ार…';

  @override
  String driverLastSent(String time) {
    return 'आखिरी बार भेजा $time';
  }

  @override
  String get driverEndTrip => 'यात्रा समाप्त करें';

  @override
  String get driverEndTripTitle => 'यह यात्रा समाप्त करें?';

  @override
  String get driverEndTripBody =>
      'अभिभावकों को नक्शे पर बस दिखना बंद हो जाएगा।';

  @override
  String get driverTip =>
      'यात्रा के दौरान ऐप चालू रखें। फ़ोन लॉक कर सकते हैं; ऐप बंद न करें।';

  @override
  String get driverSharingTitle => 'बस यात्रा चल रही है';

  @override
  String get driverSharingText => 'अभिभावक बस को नक्शे पर देख सकते हैं।';

  @override
  String get driverLocationOff =>
      'इस फ़ोन में लोकेशन बंद है। बस साझा करने के लिए इसे चालू करें।';

  @override
  String get driverLocationDenied =>
      'अभिभावक बस देख सकें, इसके लिए लोकेशन की अनुमति दें।';

  @override
  String get driverLocationBlocked =>
      'इस ऐप के लिए लोकेशन बंद है। सेटिंग्स में अनुमति दें।';

  @override
  String get driverOpenSettings => 'सेटिंग्स खोलें';

  @override
  String busEtaMinutes(int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: 'लगभग $minutes मिनट में पहुँचेगी',
      one: 'लगभग 1 मिनट में पहुँचेगी',
    );
    return '$_temp0';
  }

  @override
  String get busEtaArrivingNow => 'बस पहुँच रही है';

  @override
  String get busEtaReached => 'बस आपके स्टॉप पर पहुँच गई है';

  @override
  String get driverStopsTitle => 'स्टॉप';

  @override
  String get driverStopHere => 'यहाँ का स्थान सेव करें';

  @override
  String driverStopSaved(String stop) {
    return '$stop का स्थान सेव हो गया';
  }

  @override
  String get driverStopNoLocation => 'अभी स्थान नहीं है';

  @override
  String get driverStopReached => 'पहुँच गए';

  @override
  String get driverStopsHint =>
      'बिना स्थान वाले स्टॉप पर हैं? माता-पिता को बस के पहुँचने का समय मिले, इसके लिए \"यहाँ का स्थान सेव करें\" दबाएँ।';

  @override
  String get driverErrNoFix =>
      'फ़ोन की लोकेशन मिल रही है। कुछ सेकंड बाद फिर कोशिश करें।';

  @override
  String get busPushTrack => 'देखें';

  @override
  String get busTrackLink => 'बस ट्रैक करें';

  @override
  String get busTrackLinkHint => 'बस कंपनी का ट्रैकिंग पेज खुलेगा';

  @override
  String get busTrackLinkFailed =>
      'ट्रैकिंग लिंक नहीं खुल सका। कृपया फिर से कोशिश करें।';

  @override
  String get libraryTitle => 'पुस्तकालय';

  @override
  String get libraryWithChild => 'आपके बच्चे के पास किताबें';

  @override
  String get libraryNoneOut => 'अभी घर पर कोई पुस्तकालय किताब नहीं है।';

  @override
  String get libraryNothingBorrowed =>
      'आपके बच्चे ने अभी तक कोई पुस्तकालय किताब नहीं ली है।';

  @override
  String libraryReturnBy(String date) {
    return '$date तक लौटाएँ';
  }

  @override
  String libraryOverdueBy(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिन देर',
      one: '1 दिन देर',
    );
    return '$_temp0';
  }

  @override
  String get libraryRecentlyReturned => 'हाल में लौटाई गईं';

  @override
  String libraryFineDue(String amount) {
    return 'जुर्माना $amount';
  }

  @override
  String get mapAttribution => '© OpenStreetMap contributors';

  @override
  String get albumsTitle => 'फ़ोटो एल्बम';

  @override
  String get albumsTile => 'फ़ोटो';

  @override
  String get albumsEmptyParent =>
      'अभी कोई फ़ोटो नहीं। स्कूल किसी गतिविधि की फ़ोटो साझा करेगा तो यहाँ दिखेंगी।';

  @override
  String albumsUntil(String date) {
    return '$date तक';
  }

  @override
  String get albumsExpired => 'हटा दी गईं';

  @override
  String get albumsSaved => 'सेव किया';

  @override
  String albumsPhotoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ोटो',
      one: 'एक फ़ोटो',
    );
    return '$_temp0';
  }

  @override
  String get albumsSaveAll => 'सभी सेव करें';

  @override
  String albumsSaving(int done, int total) {
    return '$total में से $done सेव हो रही हैं…';
  }

  @override
  String albumsSavedAll(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ोटो गैलरी में सेव हुईं',
      one: 'एक फ़ोटो गैलरी में सेव हुई',
    );
    return '$_temp0';
  }

  @override
  String get albumsSaveOne => 'गैलरी में सेव करें';

  @override
  String get albumsSavedOne => 'आपकी गैलरी में सेव हुई';

  @override
  String get albumsSaveFailed =>
      'सेव नहीं हो सका। फ़ोटो की अनुमति दें और फिर कोशिश करें।';

  @override
  String albumsLeaveNote(String date) {
    return 'ये फ़ोटो $date को हटा दी जाएँगी। जो रखनी हों, सेव कर लें।';
  }

  @override
  String get albumsExpiredNote => 'ये फ़ोटो हटा दी गई हैं।';

  @override
  String get albumsNew => 'नया एल्बम';

  @override
  String get albumsEmptyStaff =>
      'अभी कोई एल्बम नहीं। किसी गतिविधि का एल्बम बनाएँ, फ़ोटो जोड़ें और माता-पिता से साझा करें।';

  @override
  String get albumsName => 'एल्बम का नाम';

  @override
  String get albumsNameHint => 'जैसे खेल दिवस 2026';

  @override
  String get albumsShareWith => 'किसके साथ साझा करें';

  @override
  String get albumsCreate => 'बनाएँ';

  @override
  String get albumsStatusDraft => 'ड्राफ़्ट';

  @override
  String get albumsStatusLive => 'साझा किया गया';

  @override
  String get albumsAddPhotos => 'फ़ोटो जोड़ें';

  @override
  String albumsUploading(int done, int total) {
    return '$total में से $done अपलोड हो रही हैं…';
  }

  @override
  String albumsUploadFailed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ोटो अपलोड नहीं हुईं',
      one: 'एक फ़ोटो अपलोड नहीं हुई',
    );
    return '$_temp0';
  }

  @override
  String get albumsPublish => 'माता-पिता से साझा करें';

  @override
  String get albumsPublishTitle => 'यह एल्बम साझा करें?';

  @override
  String get albumsPublishBody =>
      'चुनी कक्षाओं के माता-पिता को सूचना जाएगी और वे 30 दिन तक फ़ोटो सेव कर सकेंगे।';

  @override
  String get albumsPublished => 'माता-पिता से साझा किया गया';

  @override
  String albumsLimit(int count, int max) {
    return 'फ़ोटो ($max में से $count)';
  }

  @override
  String get albumsRemovePhoto => 'फ़ोटो हटाएँ';

  @override
  String albumsSavedBy(int saved, int total) {
    return '$total में से $saved अभिभावकों ने सेव किया';
  }

  @override
  String get albumsDraftNoPhotos =>
      'फ़ोटो जोड़ें, फिर एल्बम माता-पिता से साझा करें।';

  @override
  String get albumsFolderParents => 'माता-पिता के लिए';

  @override
  String get albumsFolderStaff => 'स्टाफ़ फ़ोल्डर';

  @override
  String get albumsStaffHint =>
      'इन्हें सिर्फ़ शिक्षक और ऑफ़िस स्टाफ़ देखते हैं। माता-पिता को नहीं दिखतीं।';

  @override
  String get albumsNewStaff => 'नया स्टाफ़ एल्बम';

  @override
  String get albumsEmptyStaffFolder =>
      'अभी कोई स्टाफ़ एल्बम नहीं। स्टाफ़ कार्यक्रमों और प्रशिक्षण की फ़ोटो यहाँ रखें।';

  @override
  String albumsSavedByStaff(int saved, int total) {
    return '$total में से $saved स्टाफ़ ने सेव किया';
  }

  @override
  String get albumsPublishStaffBody =>
      'सभी शिक्षकों और ऑफ़िस स्टाफ़ को सूचना जाएगी और वे 30 दिन तक फ़ोटो सेव कर सकेंगे। माता-पिता को नहीं दिखेगा।';

  @override
  String get adminNeedsAttention => 'ध्यान देने योग्य';

  @override
  String get adminAllClear => 'अभी कुछ भी ज़रूरी नहीं।';

  @override
  String adminUrgentCriticalAlerts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count गंभीर चेतावनियाँ',
      one: 'एक गंभीर चेतावनी',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentBusesNoSignal(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count बसें लोकेशन नहीं भेज रहीं',
      one: 'एक बस लोकेशन नहीं भेज रही',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentClassesNotMarked(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count कक्षाओं ने हाज़िरी नहीं लगाई',
      one: 'एक कक्षा ने हाज़िरी नहीं लगाई',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentStaffNotMarked(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count शिक्षकों की हाज़िरी नहीं लगी',
      one: 'एक शिक्षक की हाज़िरी नहीं लगी',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentAppointmentsWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count अपॉइंटमेंट का समय निकल गया',
      one: 'एक अपॉइंटमेंट का समय निकल गया',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentPaymentClaims(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'जाँचने के लिए $count भुगतान दावे',
      one: 'जाँचने के लिए एक भुगतान दावा',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentLeave(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'मंज़ूरी के लिए $count छुट्टी अनुरोध',
      one: 'मंज़ूरी के लिए एक छुट्टी अनुरोध',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentPettyCash(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'मंज़ूरी के लिए $count पेटी कैश एंट्री',
      one: 'मंज़ूरी के लिए एक पेटी कैश एंट्री',
    );
    return '$_temp0';
  }

  @override
  String adminUrgentFollowUps(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count एडमिशन फ़ॉलो-अप बाकी',
      one: 'एक एडमिशन फ़ॉलो-अप बाकी',
    );
    return '$_temp0';
  }

  @override
  String get adminTeachersToday => 'आज शिक्षक';

  @override
  String adminTeachersPresent(int present, int total) {
    return '$total में से $present उपस्थित';
  }

  @override
  String get adminTeachersAbsent => 'अनुपस्थित';

  @override
  String get adminTeachersOnLeave => 'छुट्टी पर';

  @override
  String get adminTeachersNotMarked => 'दर्ज नहीं';

  @override
  String adminTeachersUntracked(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count शिक्षक',
      one: 'एक शिक्षक',
    );
    return '$_temp0। रोज़ की स्टाफ़ हाज़िरी HR और पेरोल का हिस्सा है।';
  }

  @override
  String get adminAwayToday => 'आज अनुपस्थित';

  @override
  String get adminComingUp => 'आने वाले';

  @override
  String get adminNothingComingUp =>
      'अगले दो सप्ताह में कोई कार्यक्रम या छुट्टी नहीं।';

  @override
  String get adminEventHoliday => 'छुट्टी';

  @override
  String get adminEventPtm => 'PTM';

  @override
  String get adminEventEvent => 'कार्यक्रम';

  @override
  String get adminAppointmentsToday => 'आज के अपॉइंटमेंट';

  @override
  String get adminNoAppointments => 'आज कोई अपॉइंटमेंट नहीं।';

  @override
  String get adminCampusTour => 'कैंपस टूर';

  @override
  String adminLaterThisWeek(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'इस सप्ताह बाद में $count और',
      one: 'इस सप्ताह बाद में एक और',
    );
    return '$_temp0';
  }

  @override
  String get adminApptInterview => 'इंटरव्यू';

  @override
  String get adminApptParentMeeting => 'अभिभावक मीटिंग';

  @override
  String get adminApptAdmissionVisit => 'एडमिशन विज़िट';

  @override
  String get adminApptVendor => 'विक्रेता';

  @override
  String get adminApptOther => 'मुलाक़ात';

  @override
  String get adminApptArrived => 'आ गए';

  @override
  String get adminApptNoShow => 'नहीं आए';

  @override
  String adminApptWith(String who) {
    return '$who से';
  }
}
