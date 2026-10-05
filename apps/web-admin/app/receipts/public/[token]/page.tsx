'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '../../../../components/ui/spinner';
import { ReceiptCard, type ReceiptDetail } from '../../../../components/receipts/receipt-card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

/**
 * Addendum 4 / A9 — the SMS/push receipt link target. Deliberately outside
 * any authenticated layout: the parent opening this from a text message has
 * no web-admin session. The signed token in the URL is the only credential;
 * this page never attaches a Bearer token or X-Tenant-ID header.
 */
export default function PublicReceiptPage() {
  const params = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/receipts/public/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? 'This receipt link has expired or is invalid');
        }
        return res.json();
      })
      .then(setReceipt)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Receipt not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold shadow-sm text-white hover:bg-coral-dark"
        >
          Print / Save as PDF
        </button>
      </div>
      <ReceiptCard receipt={receipt} />
    </div>
  );
}
