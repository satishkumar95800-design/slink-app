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
      'आप अभी किसी कक्षा के कक्षा शिक्षक नहीं हैं।';

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
  String get homeworkAddPhotoFirst => 'कम से कम एक फ़ोटो जोड़ें।';

  @override
  String get homeworkDefaultBody => 'नया होमवर्क दिया गया है।';

  @override
  String get homeworkSent => 'होमवर्क भेजा गया';

  @override
  String homeworkCouldNotSend(String reason) {
    return 'होमवर्क नहीं भेजा जा सका। $reason';
  }

  @override
  String get homeworkCaptionLabel => 'विवरण (वैकल्पिक)';

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
}
