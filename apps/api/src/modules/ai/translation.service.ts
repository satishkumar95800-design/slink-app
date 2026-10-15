import { Injectable, Logger } from '@nestjs/common';
import {
  AiService,
  AiUnavailableError,
  SARVAM_TRANSLATE_MAX_CHARS,
} from './ai.service';
import type { Language } from '../../common/i18n/languages';

export interface NoticeText {
  title?: string | null;
  body: string;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  kn: 'Kannada (ಕನ್ನಡ)',
  hi: 'Hindi (हिन्दी)',
};

/** Sarvam language codes. */
const SARVAM_CODES: Record<Language, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
};

const SYSTEM = `You translate short messages that an Indian school sends to parents (notices and homework).
Rules:
- Translate faithfully and simply, as a school office would write to parents. Do not add, drop or soften anything.
- Keep names of people, classes, subjects and places as written. Keep dates, times, amounts (₹) and numbers exactly, written with digits 0-9.
- If the text is already in a target language, return it unchanged for that language.
- Reply with one JSON object only, no other text: {"<code>": {"title": string|null, "body": string}, ...} with exactly the language codes asked for.`;

/**
 * The language a notice is written in, from its script: Kannada or Devanagari
 * letters outnumbering Latin ones mean Kannada or Hindi; otherwise English.
 */
export function detectLanguage(text: string): Language {
  let kn = 0;
  let hi = 0;
  let latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0c80 && c <= 0x0cff) kn++;
    else if (c >= 0x0900 && c <= 0x097f) hi++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
  }
  if (kn > hi && kn > latin) return 'kn';
  if (hi > kn && hi > latin) return 'hi';
  return 'en';
}

/** Translators add a full stop to titles; drop it when the original had none. */
export function matchEnding(original: string, translated: string): string {
  return /[.।!?]$/.test(original.trim())
    ? translated
    : translated.trim().replace(/[.।]+$/, '');
}

/** Splits at paragraph, then sentence, then word boundaries to fit the limit. */
export function chunkText(
  text: string,
  max = SARVAM_TRANSLATE_MAX_CHARS,
): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(
      window.lastIndexOf('\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('। '),
      window.lastIndexOf(' '),
    );
    const at = cut > max / 2 ? cut + 1 : max;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * Notice/homework translation (docs/SPEC-ai.md 1.1): returns the text in every
 * language the recipients use. With Sarvam, its dedicated translation model
 * (per language); otherwise one chat call for all. Any failure returns null
 * and the caller sends the original text.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(private readonly ai: AiService) {}

  async translateNotice(
    tenantId: string,
    text: NoticeText,
    languages: Language[],
  ): Promise<Map<Language, NoticeText> | null> {
    const wanted = [...new Set(languages)];
    if (wanted.length === 0 || !(await this.ai.isAvailable(tenantId))) {
      return null;
    }
    try {
      return this.ai.provider() === 'sarvam'
        ? await this.viaSarvam(tenantId, text, wanted)
        : await this.viaChat(tenantId, text, wanted);
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      this.logger.warn(`Notice not translated: ${err.message}`);
      return null;
    }
  }

  private async viaSarvam(
    tenantId: string,
    text: NoticeText,
    wanted: Language[],
  ): Promise<Map<Language, NoticeText>> {
    const source = detectLanguage(`${text.title ?? ''} ${text.body}`);
    const title = text.title?.trim() || null;
    const out = new Map<Language, NoticeText>();
    for (const lang of wanted) {
      if (lang === source) {
        out.set(lang, { title, body: text.body });
        continue;
      }
      const translate = (s: string) =>
        this.ai.translateWithSarvam(
          tenantId,
          'translate_notice',
          s,
          SARVAM_CODES[source],
          SARVAM_CODES[lang],
        );
      const parts: string[] = [];
      for (const chunk of chunkText(text.body))
        parts.push(await translate(chunk));
      out.set(lang, {
        title: title ? matchEnding(title, await translate(title)) : null,
        body: parts.join(' ').trim(),
      });
    }
    return out;
  }

  private async viaChat(
    tenantId: string,
    text: NoticeText,
    wanted: Language[],
  ): Promise<Map<Language, NoticeText>> {
    const asked = wanted.map((l) => `${l} = ${LANGUAGE_NAMES[l]}`).join(', ');
    const reply = await this.ai.completeJson<
      Record<string, { title?: string | null; body?: string }>
    >({
      tenantId,
      feature: 'translate_notice',
      tier: 'fast',
      system: SYSTEM,
      maxTokens: 2048,
      content: `Languages: ${asked}\n\nTitle: ${text.title?.trim() || '(none)'}\n\nMessage:\n${text.body}`,
    });

    const out = new Map<Language, NoticeText>();
    for (const lang of wanted) {
      const t = reply[lang];
      if (!t || typeof t.body !== 'string' || !t.body.trim()) {
        // Missing language: that group simply gets the original.
        continue;
      }
      out.set(lang, {
        title: text.title?.trim() ? t.title?.trim() || text.title : null,
        body: t.body.trim(),
      });
    }
    return out;
  }
}
