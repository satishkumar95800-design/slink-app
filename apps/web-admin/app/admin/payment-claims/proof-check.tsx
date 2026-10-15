'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { useToast } from '../../../components/ui/toast';

export interface ClaimCheck {
  status: 'done' | 'failed';
  amount: string | null;
  paidOn: string | null;
  reference: string | null;
  payee: string | null;
  flags: string[];
}

const FLAGS = [
  'not_payment_proof',
  'unreadable',
  'payment_not_successful',
  'amount_mismatch',
  'date_mismatch',
  'reference_reused',
] as const;
type Flag = (typeof FLAGS)[number];
const isFlag = (f: string): f is Flag => (FLAGS as readonly string[]).includes(f);

/**
 * Premium (docs/SPEC-ai.md 1.3): what the AI read from the proof, and what
 * doesn't add up. Advisory — the accountant still decides.
 */
export function ProofCheck<C extends { id: string; check?: ClaimCheck | null }>({
  claim,
  canRun,
  onChecked,
}: {
  claim: C;
  /** Show "Check with AI" when there's no result yet. */
  canRun: boolean;
  onChecked: (claim: C) => void;
}) {
  const t = useTranslations('aiProof');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const check = claim.check;

  async function run() {
    setRunning(true);
    try {
      const updated = await api.post<C>(`/payment-claims/${claim.id}/check`, {});
      if (!updated.check) toast(t('notAvailable'), 'error');
      onChecked(updated);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRunning(false);
    }
  }

  if (!check) {
    if (!canRun) return null;
    return (
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {running ? t('checking') : t('run')}
      </button>
    );
  }

  const flags = (check.flags ?? []).filter(isFlag);
  const facts = [
    check.amount ? formatRupees(check.amount) : null,
    check.paidOn ? formatDateOnly(check.paidOn) : null,
    check.reference ? t('reference', { ref: check.reference }) : null,
    check.payee ? t('payee', { payee: check.payee }) : null,
  ].filter(Boolean);

  return (
    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
        <Sparkles className="h-3.5 w-3.5" />
        {check.status === 'failed' ? t('couldNotRead') : t('read')}
      </p>
      {facts.length > 0 && <p className="mt-1 text-xs text-gray-700">{facts.join(' · ')}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {flags.length === 0 && check.status === 'done' ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{t('allGood')}</span>
        ) : (
          flags.map((f) => (
            <span key={f} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
              {t(`flag_${f}`)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
