import { Language } from '../../common/i18n/languages';

type Text = { title: string; body: string };

/** Push to the album's parents when it is published. */
export function publishedText(
  language: Language,
  album: string,
  count: number,
  until: string,
): Text {
  switch (language) {
    case 'kn':
      return {
        title: `ಹೊಸ ಫೋಟೋಗಳು: ${album}`,
        body: `${album} ನ ${count} ಫೋಟೋಗಳು. ${until} ರ ಒಳಗೆ ನಿಮಗೆ ಇಷ್ಟವಾದವನ್ನು ಉಳಿಸಿಕೊಳ್ಳಿ.`,
      };
    case 'hi':
      return {
        title: `नई फ़ोटो: ${album}`,
        body: `${album} की ${count} फ़ोटो। ${until} तक अपनी पसंद की फ़ोटो सेव कर लें।`,
      };
    default:
      return {
        title: `New photos: ${album}`,
        body: `${count} ${count === 1 ? 'photo' : 'photos'} from ${album}. Save the ones you like before ${until}.`,
      };
  }
}

/** One reminder before the photos are removed, to parents who haven't saved them. */
export function reminderText(
  language: Language,
  album: string,
  until: string,
): Text {
  switch (language) {
    case 'kn':
      return {
        title: `${until} ರಂದು ಫೋಟೋಗಳು ತೆಗೆದುಹಾಕಲ್ಪಡುತ್ತವೆ`,
        body: `${album} ನ ಫೋಟೋಗಳನ್ನು ${until} ರಂದು ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ. ಈಗಲೇ ಉಳಿಸಿಕೊಳ್ಳಿ.`,
      };
    case 'hi':
      return {
        title: `फ़ोटो ${until} को हटेंगी`,
        body: `${album} की फ़ोटो ${until} को हटा दी जाएँगी। अभी सेव कर लें।`,
      };
    default:
      return {
        title: `Photos leave on ${until}`,
        body: `Photos from ${album} will be removed on ${until}. Save them now.`,
      };
  }
}
