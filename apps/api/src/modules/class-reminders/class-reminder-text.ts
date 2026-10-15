import type { Language } from '../../common/i18n/languages';

interface ReminderText {
  minutes: number;
  periodNumber: number;
  subject: string;
  className: string;
  startTime: string;
}

/** The "next class" push in the teacher's language. */
export function classReminderText(
  language: Language,
  r: ReminderText,
): { title: string; body: string } {
  switch (language) {
    case 'kn':
      return {
        title: `${r.minutes} ನಿಮಿಷದಲ್ಲಿ ತರಗತಿ`,
        body: `${r.subject} · ${r.className} · ಅವಧಿ ${r.periodNumber}, ${r.startTime}ಕ್ಕೆ`,
      };
    case 'hi':
      return {
        title: `${r.minutes} मिनट में कक्षा`,
        body: `${r.subject} · ${r.className} · पीरियड ${r.periodNumber}, ${r.startTime} बजे`,
      };
    default:
      return {
        title:
          r.minutes === 1
            ? 'Class in 1 minute'
            : `Class in ${r.minutes} minutes`,
        body: `${r.subject} · ${r.className} · Period ${r.periodNumber} at ${r.startTime}`,
      };
  }
}
