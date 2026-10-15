'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../../lib/api-client';
import { formatDateTime } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToast } from '../../../../components/ui/toast';

interface GatewayStatus {
  configured: boolean;
  keyId: string | null;
  mode: 'test' | 'live' | null;
  updatedAt: string | null;
}

const WEBHOOK_URL = 'https://api.schoolinkd.in/v1/payments/webhook';

/**
 * A school's Razorpay keys (platform team only). The API checks the keys with
 * Razorpay before saving and stores both secrets encrypted; they are never sent
 * back, so changing them means entering all three again.
 */
export function PaymentGatewayCard({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<GatewayStatus>(`/tenants/${tenantId}/payment-gateway`)
      .then(setStatus)
      .catch(() => setStatus({ configured: false, keyId: null, mode: null, updatedAt: null }));
  }, [tenantId]);

  async function save() {
    if (!keyId.trim() || !keySecret.trim() || !webhookSecret.trim()) {
      toast('Enter the Key ID, Key Secret and Webhook Secret', 'error');
      return;
    }
    setBusy(true);
    try {
      const next = await api.put<GatewayStatus>(`/tenants/${tenantId}/payment-gateway`, {
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret: webhookSecret.trim(),
      });
      setStatus(next);
      setEditing(false);
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      toast(`Razorpay keys saved for ${tenantName}`, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save the keys', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove Razorpay keys for ${tenantName}? Parents will no longer be able to pay online.`)) return;
    setBusy(true);
    try {
      setStatus(await api.delete<GatewayStatus>(`/tenants/${tenantId}/payment-gateway`));
      toast('Razorpay keys removed', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove the keys', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Online payments (Razorpay)</h2>
          <p className="mt-1 text-sm text-gray-500">
            The school&apos;s own Razorpay account. Parents pay fees in the app and money goes straight to the school.
          </p>
        </div>
        {status?.configured ? (
          <Badge variant={status.mode === 'live' ? 'green' : 'yellow'}>
            {status.mode === 'live' ? 'Live' : 'Test mode'}
          </Badge>
        ) : (
          <Badge variant="gray">Not set up</Badge>
        )}
      </div>

      {status?.configured && !editing && (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Key ID</dt>
            <dd className="font-mono text-gray-900">{status.keyId}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Last changed</dt>
            <dd className="text-gray-900">{status.updatedAt ? formatDateTime(status.updatedAt) : '—'}</dd>
          </div>
        </dl>
      )}

      {(editing || (status && !status.configured)) && (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal space-y-1 rounded-xl bg-cream/60 px-8 py-3 text-xs text-gray-600">
            <li>In the school&apos;s Razorpay dashboard: Account &amp; Settings → API Keys → generate a key.</li>
            <li>
              Settings → Webhooks → Add webhook: URL <span className="font-mono">{WEBHOOK_URL}</span>, choose a secret,
              and tick <span className="font-mono">payment.captured</span> and{' '}
              <span className="font-mono">payment.failed</span>.
            </li>
            <li>Settings → Payment capture: automatic.</li>
          </ol>
          <Input label="Key ID" required placeholder="rzp_test_… or rzp_live_…" value={keyId} onChange={(e) => setKeyId(e.target.value)} />
          <Input label="Key Secret" required type="password" autoComplete="off" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} />
          <Input
            label="Webhook Secret"
            required
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            The keys are checked with Razorpay before saving. Secrets are stored encrypted and never shown again.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        {status?.configured && !editing && (
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={remove}>
              Remove
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              Change keys
            </Button>
          </>
        )}
        {(editing || (status && !status.configured)) && (
          <>
            {editing && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button size="sm" loading={busy} onClick={save}>
              Check and save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
