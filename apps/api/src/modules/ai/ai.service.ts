import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isFeatureEnabled } from '../../common/tenant-features';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';
const SARVAM_TRANSLATE_MODEL = 'sarvam-translate:v1';
/** sarvam-translate:v1 takes at most 2000 characters per call. */
export const SARVAM_TRANSLATE_MAX_CHARS = 2000;
const TIMEOUT_MS = 30_000;
const DEFAULT_MONTHLY_TOKEN_LIMIT = 2_000_000;

/** fast = volume work (translation, summaries, screenshots); smart = drafting, analysis. */
export type AiTier = 'fast' | 'smart';

/**
 * Sarvam (Indian languages, default when SARVAM_API_KEY is set) or Anthropic.
 * Reading images (payment proofs) needs Anthropic: Sarvam's chat API is text-only.
 */
export type AiProvider = 'sarvam' | 'anthropic';

export type AiContent =
  | { type: 'text'; text: string }
  | {
      type: 'image' | 'document';
      source: { type: 'base64'; media_type: string; data: string };
    };

export interface AiRequest {
  tenantId: string;
  /** Logged with usage, e.g. "translate_notice". */
  feature: string;
  tier: AiTier;
  system: string;
  content: string | AiContent[];
  maxTokens?: number;
}

/** Why a call didn't happen; callers fall back to the non-AI behaviour. */
export class AiUnavailableError extends Error {
  constructor(
    readonly reason: 'disabled' | 'not_configured' | 'over_budget' | 'failed',
    detail?: string,
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
  }
}

interface AnthropicResponse {
  content: { type: string; text?: string }[];
  usage?: { input_tokens: number; output_tokens: number };
}

interface SarvamChatResponse {
  choices: { message: { content: string | null } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

const needsVision = (content: AiRequest['content']) =>
  Array.isArray(content) && content.some((c) => c.type !== 'text');

/**
 * The one place that calls an AI model (docs/SPEC-ai.md). Applies the school's
 * premium flag and monthly token cap, logs usage, and times out — so every
 * feature can treat the model as optional and fall back.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Which provider serves a request: AI_PROVIDER if set and configured, else
   * Sarvam when its key is set, else Anthropic. Image/PDF requests need
   * Anthropic. Null when nothing configured can serve it.
   */
  provider(opts: { vision?: boolean } = {}): AiProvider | null {
    const has = {
      sarvam: !!this.config.get<string>('SARVAM_API_KEY'),
      anthropic: !!this.config.get<string>('ANTHROPIC_API_KEY'),
    };
    if (opts.vision) return has.anthropic ? 'anthropic' : null;
    const preferred = this.config.get<string>('AI_PROVIDER');
    if (preferred === 'sarvam' && has.sarvam) return 'sarvam';
    if (preferred === 'anthropic' && has.anthropic) return 'anthropic';
    if (has.sarvam) return 'sarvam';
    if (has.anthropic) return 'anthropic';
    return null;
  }

  /** Premium switched on for this school and a provider that can do the job. */
  async isAvailable(
    tenantId: string,
    opts: { vision?: boolean } = {},
  ): Promise<boolean> {
    return (
      this.provider(opts) !== null &&
      (await isFeatureEnabled(this.prisma, tenantId, 'aiInsights'))
    );
  }

  model(tier: AiTier, provider: AiProvider = 'anthropic'): string {
    if (provider === 'sarvam') {
      return this.config.get<string>('SARVAM_MODEL') ?? 'sarvam-105b';
    }
    return tier === 'fast'
      ? (this.config.get<string>('AI_MODEL_FAST') ?? 'claude-haiku-5-5')
      : (this.config.get<string>('AI_MODEL_SMART') ?? 'claude-sonnet-5-5');
  }

  /** Returns the model's text. Throws AiUnavailableError (never anything else). */
  async complete(
    req: AiRequest,
    opts: { json?: boolean } = {},
  ): Promise<string> {
    const provider = this.provider({ vision: needsVision(req.content) });
    if (!provider) throw new AiUnavailableError('not_configured');
    await this.assertAllowed(req.tenantId);

    const model = this.model(req.tier, provider);
    try {
      const { text, usage } =
        provider === 'sarvam'
          ? await this.callSarvam(req, model, opts.json)
          : await this.callAnthropic(req, model);
      await this.logUsage(req.tenantId, req.feature, model, usage);
      return text;
    } catch (err) {
      const e =
        err instanceof AiUnavailableError
          ? err
          : new AiUnavailableError('failed', (err as Error).message);
      this.logger.warn(`${req.feature} (${provider}) failed: ${e.message}`);
      throw e;
    }
  }

  /** complete() for a reply that must be one JSON object. */
  async completeJson<T>(req: AiRequest): Promise<T> {
    const text = await this.complete(req, { json: true });
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new AiUnavailableError('failed', 'reply was not JSON');
    }
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      throw new AiUnavailableError('failed', 'reply was not valid JSON');
    }
  }

  /**
   * Sarvam's dedicated translation model (sarvam-translate:v1), for text up to
   * SARVAM_TRANSLATE_MAX_CHARS. Usage is logged in characters (in/out), which
   * the monthly cap counts like tokens.
   */
  async translateWithSarvam(
    tenantId: string,
    feature: string,
    input: string,
    source: string,
    target: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('SARVAM_API_KEY');
    if (!apiKey) throw new AiUnavailableError('not_configured');
    await this.assertAllowed(tenantId);
    try {
      const res = await fetch(SARVAM_TRANSLATE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          input,
          source_language_code: source,
          target_language_code: target,
          model: SARVAM_TRANSLATE_MODEL,
          mode: 'formal',
          numerals_format: 'international',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new AiUnavailableError('failed', `HTTP ${res.status} ${detail}`);
      }
      const body = (await res.json()) as { translated_text?: string };
      const out = body.translated_text?.trim();
      if (!out) throw new AiUnavailableError('failed', 'empty translation');
      await this.logUsage(tenantId, feature, SARVAM_TRANSLATE_MODEL, {
        input: input.length,
        output: out.length,
      });
      return out;
    } catch (err) {
      const e =
        err instanceof AiUnavailableError
          ? err
          : new AiUnavailableError('failed', (err as Error).message);
      this.logger.warn(`${feature} (sarvam translate) failed: ${e.message}`);
      throw e;
    }
  }

  private async callAnthropic(req: AiRequest, model: string) {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: 'user', content: req.content }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new AiUnavailableError('failed', `HTTP ${res.status} ${detail}`);
    }
    const body = (await res.json()) as AnthropicResponse;
    return {
      text: body.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join(''),
      usage: {
        input: body.usage?.input_tokens ?? 0,
        output: body.usage?.output_tokens ?? 0,
      },
    };
  }

  private async callSarvam(req: AiRequest, model: string, json?: boolean) {
    const text =
      typeof req.content === 'string'
        ? req.content
        : req.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
    const res = await fetch(SARVAM_CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-subscription-key': this.config.get<string>('SARVAM_API_KEY') ?? '',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: text },
        ],
        max_tokens: req.maxTokens ?? 1024,
        // Reasoning off. Measured on sarvam-105b for a 2-sentence remark: off =
        // ~1 s and ~50 tokens; "low" = ~6 s and ~1,300 reasoning tokens; the
        // default used the whole token budget thinking and returned nothing.
        reasoning_effort: null,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new AiUnavailableError('failed', `HTTP ${res.status} ${detail}`);
    }
    const body = (await res.json()) as SarvamChatResponse;
    const out = body.choices?.[0]?.message?.content ?? '';
    if (!out.trim()) throw new AiUnavailableError('failed', 'empty reply');
    return {
      text: out,
      usage: {
        input: body.usage?.prompt_tokens ?? 0,
        output: body.usage?.completion_tokens ?? 0,
      },
    };
  }

  private async assertAllowed(tenantId: string) {
    if (!(await isFeatureEnabled(this.prisma, tenantId, 'aiInsights'))) {
      throw new AiUnavailableError('disabled');
    }
    await this.assertWithinBudget(tenantId);
  }

  /** Tokens this school used this calendar month (UTC). */
  async monthlyTokens(tenantId: string): Promise<number> {
    const now = new Date();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const sum = await this.prisma.aiUsage.aggregate({
      where: { tenantId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return (sum._sum.inputTokens ?? 0) + (sum._sum.outputTokens ?? 0);
  }

  private async assertWithinBudget(tenantId: string) {
    const limit = Number(
      this.config.get<string>('AI_MONTHLY_TOKEN_LIMIT') ??
        DEFAULT_MONTHLY_TOKEN_LIMIT,
    );
    let used: number;
    try {
      used = await this.monthlyTokens(tenantId);
    } catch (err) {
      // Usage table missing (migration not applied) — don't run unmetered.
      throw new AiUnavailableError('failed', (err as Error).message);
    }
    if (used >= limit) throw new AiUnavailableError('over_budget');
  }

  private async logUsage(
    tenantId: string,
    feature: string,
    model: string,
    usage: { input: number; output: number },
  ) {
    try {
      await this.prisma.aiUsage.create({
        data: {
          tenantId,
          feature,
          model,
          inputTokens: usage.input,
          outputTokens: usage.output,
        },
      });
    } catch (err) {
      this.logger.error(`Could not log AI usage: ${(err as Error).message}`);
    }
  }
}
