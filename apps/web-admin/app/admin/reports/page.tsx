'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';

type ReportStatus = 'draft' | 'published';

interface Report {
  id: string;
  type: string;
  status: ReportStatus;
  title: string;
  publishedAt: string | null;
  createdAt: string;
  author?: { name: string };
  student?: { name: string; admissionNo: string };
}

const statusVariant = (s: ReportStatus): 'green' | 'gray' => {
  return s === 'published' ? 'green' : 'gray';
};

const typeVariant = (t: string): 'blue' | 'orange' | 'yellow' | 'gray' => {
  const m: Record<string, 'blue' | 'orange' | 'yellow' | 'gray'> = {
    academic: 'blue',
    behavior: 'orange',
    attendance: 'yellow',
    homework: 'gray',
  };
  return m[t] ?? 'gray';
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await api.get<{ data: Report[]; total: number }>('/reports?limit=100');
        setReports(res.data);
        setTotal(res.total);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} report{total !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports"
          description="Progress reports created by teachers will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Title', 'Student', 'Type', 'Author', 'Status', 'Published', 'Created'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">
                    {r.title}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{r.student?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{r.student?.admissionNo ?? ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={typeVariant(r.type)}>{r.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.author?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
