'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../lib/api-client';
import { isLoggedIn } from '../../../../lib/auth';
import { Spinner } from '../../../../components/ui/spinner';

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  amount: string;
  method: string;
  reference: string | null;
  paidOn: string;
  notes: string | null;
  createdAt: string;
  student: { name: string; admissionNo: string };
  class: { name: string; section: string | null; academicYear: string };
  studentFee: { feeStructure: { name: string; academicYear: string } };
  recordedByUser: { name: string } | null;
  tenant: { name: string; logoUrl: string | null };
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  demand_draft: 'Demand Draft',
  gateway: 'Online Payment',
};

function formatCurrency(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

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
        <Spinner className="h-8 w-8 text-blue-600" />
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
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            {receipt.tenant.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.tenant.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
            )}
            <h1 className="text-lg font-bold text-gray-900">{receipt.tenant.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">Receipt</p>
            <p className="font-mono text-sm text-gray-900">{receipt.receiptNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Student</p>
            <p className="font-medium text-gray-900">{receipt.student.name}</p>
            <p className="text-gray-600">{receipt.student.admissionNo}</p>
          </div>
          <div>
            <p className="text-gray-500">Class</p>
            <p className="font-medium text-gray-900">
              {receipt.class.name}
              {receipt.class.section ? ` (${receipt.class.section})` : ''} · {receipt.class.academicYear}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Fee Structure</p>
            <p className="font-medium text-gray-900">{receipt.studentFee.feeStructure.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Paid On</p>
            <p className="font-medium text-gray-900">
              {new Date(receipt.paidOn).toLocaleDateString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Method</p>
            <p className="font-medium text-gray-900">{METHOD_LABELS[receipt.method] ?? receipt.method}</p>
          </div>
          {receipt.reference && (
            <div>
              <p className="text-gray-500">Reference</p>
              <p className="font-medium text-gray-900">{receipt.reference}</p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Amount Received</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(receipt.amount)}</p>
        </div>

        {receipt.notes && (
          <div className="mt-4 text-sm">
            <p className="text-gray-500">Notes</p>
            <p className="text-gray-700">{receipt.notes}</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-gray-500">
          <span>Recorded by {receipt.recordedByUser?.name ?? 'Online payment'}</span>
          <span>{new Date(receipt.createdAt).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}
