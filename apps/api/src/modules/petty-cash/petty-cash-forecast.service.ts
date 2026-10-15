import { Injectable } from '@nestjs/common';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { PettyCashService } from './petty-cash.service';
import { Finding, ForecastResult, buildForecast } from './petty-cash.forecast';

export type AdviceResult =
  | { ready: false; monthsOfData: number; needed: number }
  | {
      ready: true;
      source: 'ai' | 'template';
      /** Why the template was used instead of the model, when it was. */
      fallbackReason?: string;
      text: string;
    };

const LANGUAGES: Record<string, string> = {
  en: 'English',
  kn: 'Kannada',
  hi: 'Hindi',
};

const SYSTEM = (language: string) =>
  [
    'You write short, plain-language savings advice for a school accountant from petty cash findings that have already been computed.',
    'Use ONLY the facts and numbers in the JSON you are given. Never calculate a new number, never round, never invent names or reasons.',
    'Write 3 to 6 short bullet points starting with "- ". No numbered lists, no headings.',
    `Write in ${language}, but keep all numbers exactly as given, using the digits 0-9.`,
  ].join(' ');

/** Numbers appearing in a text, normalised (no thousands separators). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) =>
    n.replace(/,/g, '').replace(/\.0+$/, ''),
  );
}

/** True when every number in the model's reply was in what we gave it. */
export function onlyRestatesGivenNumbers(
  reply: string,
  given: string,
): boolean {
  const allowed = new Set(numbersIn(given));
  return numbersIn(reply).every((n) => allowed.has(n));
}

@Injectable()
export class PettyCashForecastService {
  constructor(
    private readonly petty: PettyCashService,
    private readonly ai: AiService,
  ) {}

  async forecast(tenantId: string): Promise<ForecastResult> {
    const snap = await this.petty.forecastSnapshot(tenantId);
    return buildForecast({
      today: snap.today,
      balancePaise: snap.balancePaise,
      categories: snap.categories,
      monthlyBudgetPaise: snap.settings.monthlyBudgetPaise,
      expenses: snap.expenses,
      advances: snap.advances,
      overdueDays: snap.settings.overdueDays,
    });
  }

  /**
   * Plain-language advice. Rules computed the findings; the model (only when
   * aiInsights is on, under the school's monthly cap) just rephrases them, and
   * its reply is discarded unless every number in it came from the findings.
   */
  async advice(tenantId: string): Promise<AdviceResult> {
    const result = await this.forecast(tenantId);
    if (!result.ready)
      return {
        ready: false,
        monthsOfData: result.monthsOfData,
        needed: result.needed,
      };

    const template = this.templateText(result.findings);
    if (result.findings.length === 0 || !(await this.ai.isAvailable(tenantId)))
      return { ready: true, source: 'template', text: template };

    const facts = JSON.stringify({
      forecastMonth: result.forecastMonth,
      expectedSpend: result.total.expected,
      lowSpend: result.total.low,
      highSpend: result.total.high,
      suggestedTopUp: result.suggestedTopUp.expected,
      findings: result.findings.map((f) => f.text),
    });
    try {
      const language =
        LANGUAGES[(await this.petty.tenantLanguage(tenantId)) ?? 'en'] ??
        'English';
      const reply = (
        await this.ai.complete({
          tenantId,
          feature: 'petty_cash_advice',
          tier: 'fast',
          system: SYSTEM(language),
          content: facts,
          maxTokens: 500,
        })
      ).trim();
      if (!reply)
        return {
          ready: true,
          source: 'template',
          fallbackReason: 'empty',
          text: template,
        };
      if (!onlyRestatesGivenNumbers(reply, facts))
        return {
          ready: true,
          source: 'template',
          fallbackReason: 'unverified_numbers',
          text: template,
        };
      return { ready: true, source: 'ai', text: reply };
    } catch (e) {
      if (e instanceof AiUnavailableError)
        return {
          ready: true,
          source: 'template',
          fallbackReason: e.reason,
          text: template,
        };
      throw e;
    }
  }

  private templateText(findings: Finding[]): string {
    return findings.map((f) => `- ${f.text}`).join('\n');
  }
}
