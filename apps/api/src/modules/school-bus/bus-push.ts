import { BusTripDirection } from '@prisma/client';
import { Language } from '../../common/i18n/languages';

type Text = { title: string; body: string };

/** "The bus has started" push to the parents of every child on the route. */
export function tripStartedText(
  language: Language,
  direction: BusTripDirection,
  route: string,
): Text {
  const pickup = direction === BusTripDirection.pickup;
  switch (language) {
    case 'kn':
      return pickup
        ? {
            title: 'ಶಾಲಾ ಬಸ್ ಹೊರಟಿದೆ',
            body: `${route} ಬಸ್ ಮಕ್ಕಳನ್ನು ಕರೆದುಕೊಂಡು ಬರಲು ಹೊರಟಿದೆ. ಆ್ಯಪ್‌ನಲ್ಲಿ ಲೈವ್ ಆಗಿ ನೋಡಿ.`,
          }
        : {
            title: 'ಶಾಲಾ ಬಸ್ ಶಾಲೆಯಿಂದ ಹೊರಟಿದೆ',
            body: `${route} ಬಸ್ ಮಕ್ಕಳನ್ನು ಮನೆಗೆ ಬಿಡಲು ಹೊರಟಿದೆ. ಆ್ಯಪ್‌ನಲ್ಲಿ ಲೈವ್ ಆಗಿ ನೋಡಿ.`,
          };
    case 'hi':
      return pickup
        ? {
            title: 'स्कूल बस चल पड़ी है',
            body: `${route} की बस बच्चों को लेने निकल पड़ी है। ऐप में लाइव देखें।`,
          }
        : {
            title: 'स्कूल बस स्कूल से निकल गई है',
            body: `${route} की बस बच्चों को घर छोड़ने निकल पड़ी है। ऐप में लाइव देखें।`,
          };
    default:
      return pickup
        ? {
            title: 'The school bus has started',
            body: `${route} has started its pickup run. Track it live in the app.`,
          }
        : {
            title: 'The school bus has left school',
            body: `${route} is on its way to drop the children. Track it live in the app.`,
          };
  }
}

/** "Arriving in about N minutes" push to the parents of children at a stop. */
export function arrivingText(
  language: Language,
  direction: BusTripDirection,
  route: string,
  stop: string,
  minutes: number,
): Text {
  const pickup = direction === BusTripDirection.pickup;
  switch (language) {
    case 'kn':
      return {
        title: `ಸುಮಾರು ${minutes} ನಿಮಿಷದಲ್ಲಿ ಬಸ್ ಬರಲಿದೆ`,
        body: pickup
          ? `${route} ಬಸ್ ಸುಮಾರು ${minutes} ನಿಮಿಷದಲ್ಲಿ ${stop} ತಲುಪಲಿದೆ. ದಯವಿಟ್ಟು ನಿಲ್ದಾಣದಲ್ಲಿರಿ.`
          : `${route} ಬಸ್ ಸುಮಾರು ${minutes} ನಿಮಿಷದಲ್ಲಿ ${stop} ತಲುಪಲಿದೆ. ನಿಮ್ಮ ಮಗುವನ್ನು ಕರೆದುಕೊಳ್ಳಲು ದಯವಿಟ್ಟು ನಿಲ್ದಾಣದಲ್ಲಿರಿ.`,
      };
    case 'hi':
      return {
        title: `बस लगभग ${minutes} मिनट में पहुँचेगी`,
        body: pickup
          ? `${route} की बस लगभग ${minutes} मिनट में ${stop} पहुँचेगी। कृपया स्टॉप पर रहें।`
          : `${route} की बस लगभग ${minutes} मिनट में ${stop} पहुँचेगी। अपने बच्चे को लेने के लिए कृपया स्टॉप पर रहें।`,
      };
    default:
      return {
        title: `Bus arriving in about ${minutes} min`,
        body: pickup
          ? `${route} will reach ${stop} in about ${minutes} minutes. Please be at the stop.`
          : `${route} will reach ${stop} in about ${minutes} minutes. Please be at the stop to receive your child.`,
      };
  }
}
