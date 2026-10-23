'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../components/ui/toast';

export interface AdmissionNumbering {
  numbering: { pattern: string; digits: number; next: number; resetEachYear: boolean; year: string | null } | null;
  /** The next three numbers the saved rule gives. */
  upcoming: string[];
  /** The latest admission numbers in use, newest first. */
  latest: string[];
  /** School-local YYYY-MM-DD. */
  today: string;
}

/** Same rules as the API (students/admission-number.ts), for the live preview. */
const TOKENS = ['{N}', '{YYYY}', '{YY}', '{AY}'] as const;
const PRESETS = ['ADM{N}', '{YYYY}/{N}', 'GV-{AY}-{N}', '{YY}{N}'];

function academicYear(today: string) {
  const year = Number(today.slice(0, 4));
  const start = today >= `${year}-06-01` ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function format(pattern: string, digits: number, n: number, today: string) {
  return pattern
    .split('{N}')
    .join(String(n).padStart(digits, '0'))
    .split('{YYYY}')
    .join(today.slice(0, 4))
    .split('{YY}')
    .join(today.slice(2, 4))
    .split('{AY}')
    .join(academicYear(today));
}

/** An error code (as the API's), or null when the pattern can be used. */
function problem(pattern: string): string | null {
  if (!pattern.trim() || pattern.length > 30) return 'PATTERN_LENGTH';
  if (pattern.split('{N}').length !== 2) return 'PATTERN_NEEDS_N';
  const rest = TOKENS.reduce((s, tok) => s.split(tok).join(''), pattern);
  if (/[{}]/.test(rest)) return 'PATTERN_UNKNOWN_TOKEN';
  if (!/^[A-Za-z0-9/._ -]*$/.test(rest)) return 'PATTERN_CHARACTERS';
  return null;
}

const hasYear = (pattern: string) => /\{(YYYY|YY|AY)\}/.test(pattern);

/**
 * How new admission numbers are made: a pattern with the running number and
 * optional year, its width, the next number (after the school's existing
 * ones) and whether it restarts each year.
 */
export function AdmissionNumberingSection({ data, onSaved }: { data: AdmissionNumbering | null; onSaved: (d: AdmissionNumbering) => void }) {
  const t = useTranslations('admissionNumbering');
  const errorText = useErrorText();
  const { toast } = useToast();
  const patternRef = useRef<HTMLInputElement>(null);
  const saved = data?.numbering;
  const [enabled, setEnabled] = useState(!!saved);
  const [pattern, setPattern] = useState(saved?.pattern ?? 'ADM{N}');
  const [digits, setDigits] = useState(saved?.digits ?? 4);
  const [next, setNext] = useState(String(saved?.next ?? 1));
  const [reset, setReset] = useState(saved?.resetEachYear ?? false);
  const [busy, setBusy] = useState(false);

  // When the saved rule arrives after the first render.
  useEffect(() => {
    if (!data) return;
    const s = data.numbering;
    /* eslint-disable react-hooks/set-state-in-effect -- copy the loaded rule into the form once */
    setEnabled(!!s);
    if (s) {
      setPattern(s.pattern);
      setDigits(s.digits);
      setNext(String(s.next));
      setReset(s.resetEachYear);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data]);

  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const n = Number(next);
  const nextOk = Number.isInteger(n) && n >= 1 && n <= 99_999_999;
  const patternError = problem(pattern);
  const preview = !patternError && nextOk ? [0, 1, 2].map((i) => format(pattern, digits, n + i, today)) : [];
  const canSave = !enabled || (!patternError && nextOk);

  function insert(token: string) {
    const el = patternRef.current;
    const at = el?.selectionStart ?? pattern.length;
    const end = el?.selectionEnd ?? at;
    setPattern((p) => (p.slice(0, at) + token + p.slice(end)).slice(0, 30));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  }

  async function save() {
    setBusy(true);
    try {
      const res = await api.put<AdmissionNumbering>(
        '/students/admission-numbering',
        enabled ? { enabled, pattern: pattern.trim(), digits, next: n, resetEachYear: reset && hasYear(pattern) } : { enabled: false },
      );
      onSaved(res);
      toast(t('saved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-coral" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <span className="block text-sm font-semibold text-gray-900">{t('enable')}</span>
          <span className="block text-xs text-gray-500">{t('enableHelp')}</span>
        </span>
      </label>

      {enabled && (
        <>
          <div>
            <Input
              ref={patternRef}
              label={t('pattern')}
              maxLength={30}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              error={patternError ? t(`errors.${patternError as 'PATTERN_LENGTH'}`) : undefined}
              className="font-mono"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {TOKENS.map((tok) => (
                <button
                  key={tok}
                  type="button"
                  onClick={() => insert(tok)}
                  className="cursor-pointer rounded-full border border-teal/30 bg-teal/5 px-3 py-1 text-xs font-semibold text-teal hover:bg-teal/10"
                >
                  <span className="font-mono">{tok}</span> · {t(`token.${tok.slice(1, -1) as 'N'}`, { year: today.slice(0, 4), short: today.slice(2, 4), ay: academicYear(today) })}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t('presets')}{' '}
              {PRESETS.map((p, i) => (
                <button key={p} type="button" onClick={() => setPattern(p)} className="cursor-pointer font-mono font-semibold text-teal hover:underline">
                  {p}
                  {i < PRESETS.length - 1 ? ',' : ''}{' '}
                </button>
              ))}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-gray-800">{t('digits')}</span>
              <select
                value={digits}
                onChange={(e) => setDigits(Number(e.target.value))}
                className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? t('digitsNone') : t('digitsOption', { count: d, example: '7'.padStart(d, '0') })}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={t('next')}
              type="number"
              min={1}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              error={nextOk ? undefined : t('nextInvalid')}
              helpText={data?.latest.length ? t('latest', { numbers: data.latest.slice(0, 3).join(', ') }) : t('nextHelp')}
            />
          </div>

          <label className={`flex items-start gap-3 ${hasYear(pattern) ? 'cursor-pointer' : 'opacity-50'}`}>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-coral"
              disabled={!hasYear(pattern)}
              checked={reset && hasYear(pattern)}
              onChange={(e) => setReset(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">{t('reset')}</span>
              <span className="block text-xs text-gray-500">{hasYear(pattern) ? t('resetHelp') : t('resetNeedsYear')}</span>
            </span>
          </label>

          <div className="rounded-xl bg-cream/60 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('preview')}</p>
            {preview.length ? (
              <p className="mt-1 font-mono text-base font-bold text-gray-900">{preview.join('   ')}</p>
            ) : (
              <p className="mt-1 text-gray-500">—</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{t('previewHelp')}</p>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button loading={busy} disabled={!canSave} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
