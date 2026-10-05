'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../lib/api-client';
import { isLoggedIn } from '../../../../lib/auth';
import { Spinner } from '../../../../components/ui/spinner';
import { ReceiptCard, type ReceiptDetail } from '../../../../components/receipts/receipt-card';

export default function ReceiptPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    api
      .get<ReceiptDetail>(`/receipts/${params.id}`)
      .then(setReceipt)
      .catch((e) => setError((e as ApiError).message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

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
    <div className="mx-auto max-w-2xl p-8">
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
        >
          Print / Save as PDF
        </button>
      </div>

      <ReceiptCard receipt={receipt} />
    </div>
  );
}
