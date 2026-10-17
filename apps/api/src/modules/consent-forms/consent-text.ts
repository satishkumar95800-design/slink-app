import type { Language } from '../../common/i18n/languages';

/** The "please sign" push in the parent's language. `deadline` is DD/MM/YYYY. */
export function consentRequestText(
  language: Language,
  eventTitle: string,
  deadline: string,
  reminder: boolean,
): { title: string; body: string } {
  switch (language) {
    case 'kn':
      return {
        title: reminder
          ? `ಜ್ಞಾಪನೆ: ಒಪ್ಪಿಗೆ ಬೇಕು · ${eventTitle}`
          : `ಒಪ್ಪಿಗೆ ಬೇಕು · ${eventTitle}`,
        body: `ದಯವಿಟ್ಟು ${deadline} ರೊಳಗೆ ಆ್ಯಪ್‌ನಲ್ಲಿ ಒಪ್ಪಿಗೆ ಪತ್ರಕ್ಕೆ ಸಹಿ ಮಾಡಿ.`,
      };
    case 'hi':
      return {
        title: reminder
          ? `याद दिलाना: सहमति चाहिए · ${eventTitle}`
          : `सहमति चाहिए · ${eventTitle}`,
        body: `कृपया ${deadline} तक ऐप में सहमति पत्र पर हस्ताक्षर करें।`,
      };
    default:
      return {
        title: reminder
          ? `Reminder: consent needed · ${eventTitle}`
          : `Consent needed · ${eventTitle}`,
        body: `Please sign the consent form in the app by ${deadline}.`,
      };
  }
}
