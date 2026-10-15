import { AiService, AiUnavailableError } from './ai.service';
import {
  TranslationService,
  chunkText,
  detectLanguage,
} from './translation.service';

function setup(env: Record<string, string | undefined> = {}, aiOn = true) {
  const prisma = {
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ features: aiOn ? { aiInsights: true } : {} }),
    },
    aiUsage: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { inputTokens: 100, outputTokens: 50 },
      }),
      create: jest.fn(),
    },
  };
  const values: Record<string, string | undefined> = {
    ANTHROPIC_API_KEY: 'sk-test',
    ...env,
  };
  const config = { get: jest.fn((k: string) => values[k]) };
  const ai = new AiService(prisma as never, config as never);
  return { prisma, ai, translation: new TranslationService(ai) };
}

function reply(text: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(text),
    json: () =>
      Promise.resolve({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 120, output_tokens: 80 },
      }),
  };
}

describe('AiService', () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as never;
  });
  beforeEach(() => fetchMock.mockReset());

  it('calls Claude with the tier model and logs token usage', async () => {
    const { ai, prisma } = setup();
    fetchMock.mockResolvedValue(reply('hello'));

    const text = await ai.complete({
      tenantId: 't1',
      feature: 'test',
      tier: 'fast',
      system: 'sys',
      content: 'hi',
    });

    expect(text).toBe('hello');
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-haiku-5-5',
      system: 'sys',
    });
    expect(init.headers['x-api-key']).toBe('sk-test');
    expect(prisma.aiUsage.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        feature: 'test',
        model: 'claude-haiku-5-5',
        inputTokens: 120,
        outputTokens: 80,
      },
    });
  });

  it('does not call Claude for a school without the premium module', async () => {
    const { ai } = setup({}, false);
    await expect(
      ai.complete({
        tenantId: 't1',
        feature: 'x',
        tier: 'fast',
        system: '',
        content: '',
      }),
    ).rejects.toMatchObject({ reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops at the monthly token cap', async () => {
    const { ai } = setup({ AI_MONTHLY_TOKEN_LIMIT: '150' });
    await expect(
      ai.complete({
        tenantId: 't1',
        feature: 'x',
        tier: 'fast',
        system: '',
        content: '',
      }),
    ).rejects.toMatchObject({ reason: 'over_budget' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns HTTP and network errors into AiUnavailableError', async () => {
    const { ai } = setup();
    fetchMock.mockResolvedValueOnce(reply('overloaded', false, 529));
    await expect(
      ai.complete({
        tenantId: 't1',
        feature: 'x',
        tier: 'smart',
        system: '',
        content: '',
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(
      ai.complete({
        tenantId: 't1',
        feature: 'x',
        tier: 'smart',
        system: '',
        content: '',
      }),
    ).rejects.toMatchObject({ reason: 'failed' });
  });

  it('is unavailable without an API key', async () => {
    const { ai } = setup({ ANTHROPIC_API_KEY: undefined });
    expect(await ai.isAvailable('t1')).toBe(false);
  });
});

describe('TranslationService', () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as never;
  });
  beforeEach(() => fetchMock.mockReset());

  it('returns each requested language from one call', async () => {
    const { translation } = setup();
    fetchMock.mockResolvedValue(
      reply(
        'Here you go: {"kn": {"title": "ರಜೆ", "body": "ನಾಳೆ ರಜೆ."}, "hi": {"title": "छुट्टी", "body": "कल छुट्टी है।"}}',
      ),
    );

    const out = await translation.translateNotice(
      't1',
      { title: 'Holiday', body: 'Tomorrow is a holiday.' },
      ['kn', 'hi', 'kn'],
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out?.get('kn')).toEqual({ title: 'ರಜೆ', body: 'ನಾಳೆ ರಜೆ.' });
    expect(out?.get('hi')).toEqual({ title: 'छुट्टी', body: 'कल छुट्टी है।' });
  });

  it('leaves out a language the model skipped, and keeps "no title" as no title', async () => {
    const { translation } = setup();
    fetchMock.mockResolvedValue(
      reply('{"kn": {"title": "x", "body": "ನಮಸ್ಕಾರ"}}'),
    );
    const out = await translation.translateNotice('t1', { body: 'Hello' }, [
      'kn',
      'hi',
    ]);
    expect(out?.get('kn')).toEqual({ title: null, body: 'ನಮಸ್ಕಾರ' });
    expect(out?.has('hi')).toBe(false);
  });

  it('returns null (send the original) when the model fails or replies with junk', async () => {
    const { translation } = setup();
    fetchMock.mockResolvedValueOnce(reply('sorry, I cannot'));
    expect(
      await translation.translateNotice('t1', { body: 'Hi' }, ['kn']),
    ).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(
      await translation.translateNotice('t1', { body: 'Hi' }, ['kn']),
    ).toBeNull();
  });

  it('does nothing for a school without the premium module', async () => {
    const { translation } = setup({}, false);
    expect(
      await translation.translateNotice('t1', { body: 'Hi' }, ['kn']),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** The data of the first usage row logged. */
const usageLogged = (prisma: ReturnType<typeof setup>['prisma']) =>
  (
    prisma.aiUsage.create.mock.calls[0] as [{ data: Record<string, unknown> }]
  )[0].data;

describe('Sarvam provider', () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as never;
  });
  beforeEach(() => fetchMock.mockReset());

  const sarvamReply = (content: string) => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(content),
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 40, completion_tokens: 60 },
      }),
  });

  it('prefers Sarvam when its key is set, but uses Anthropic for images', () => {
    const { ai } = setup({ SARVAM_API_KEY: 'sk_s', ANTHROPIC_API_KEY: 'sk-a' });
    expect(ai.provider()).toBe('sarvam');
    expect(ai.provider({ vision: true })).toBe('anthropic');
    const sarvamOnly = setup({
      SARVAM_API_KEY: 'sk_s',
      ANTHROPIC_API_KEY: undefined,
    });
    expect(sarvamOnly.ai.provider({ vision: true })).toBeNull();
    const forced = setup({ SARVAM_API_KEY: 'sk_s', AI_PROVIDER: 'anthropic' });
    expect(forced.ai.provider()).toBe('anthropic');
  });

  it('calls Sarvam chat with its key, model, JSON mode and reasoning off', async () => {
    const { ai, prisma } = setup({
      SARVAM_API_KEY: 'sk_s',
      ANTHROPIC_API_KEY: undefined,
    });
    fetchMock.mockResolvedValue(sarvamReply('{"a": 1}'));

    const out = await ai.completeJson<{ a: number }>({
      tenantId: 't1',
      feature: 'x',
      tier: 'fast',
      system: 'sys',
      content: 'hi',
      maxTokens: 300,
    });

    expect(out).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.sarvam.ai/v1/chat/completions');
    expect(init.headers['api-subscription-key']).toBe('sk_s');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'sarvam-105b',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      max_tokens: 300,
      reasoning_effort: null,
      response_format: { type: 'json_object' },
    });
    expect(usageLogged(prisma)).toMatchObject({
      model: 'sarvam-105b',
      inputTokens: 40,
      outputTokens: 60,
    });
  });

  it('uses the dedicated translate endpoint and logs characters', async () => {
    const { ai, prisma } = setup({ SARVAM_API_KEY: 'sk_s' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translated_text: 'ನಾಳೆ ರಜೆ' }),
    });
    const out = await ai.translateWithSarvam(
      't1',
      'translate_notice',
      'Holiday tomorrow',
      'en-IN',
      'kn-IN',
    );
    expect(out).toBe('ನಾಳೆ ರಜೆ');
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.sarvam.ai/translate');
    expect(JSON.parse(init.body)).toMatchObject({
      source_language_code: 'en-IN',
      target_language_code: 'kn-IN',
      model: 'sarvam-translate:v1',
      numerals_format: 'international',
    });
    expect(usageLogged(prisma)).toMatchObject({
      inputTokens: 16,
      outputTokens: 8,
    });
  });

  it('translates a notice per language with Sarvam, leaving the source language as written', async () => {
    const { translation } = setup({ SARVAM_API_KEY: 'sk_s' });
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const { input, target_language_code } = JSON.parse(init.body) as {
        input: string;
        target_language_code: string;
      };
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            translated_text: `[${target_language_code}] ${input}`,
          }),
      });
    });

    const out = await translation.translateNotice(
      't1',
      { title: 'Holiday', body: 'School is closed tomorrow.' },
      ['en', 'kn'],
    );

    expect(out?.get('en')).toEqual({
      title: 'Holiday',
      body: 'School is closed tomorrow.',
    });
    expect(out?.get('kn')).toEqual({
      title: '[kn-IN] Holiday',
      body: '[kn-IN] School is closed tomorrow.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('language detection and chunking', () => {
  it('detects the notice language from its script', () => {
    expect(detectLanguage('ನಾಳೆ ಶಾಲೆಗೆ ರಜೆ (Class 5)')).toBe('kn');
    expect(detectLanguage('कल स्कूल बंद रहेगा')).toBe('hi');
    expect(detectLanguage('School closed on 12/10')).toBe('en');
  });

  it('splits long text at boundaries under the limit', () => {
    const text = 'One sentence here. '.repeat(200);
    const parts = chunkText(text, 2000);
    expect(parts.every((p) => p.length <= 2000)).toBe(true);
    expect(parts.join('')).toBe(text);
  });
});
