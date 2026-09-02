'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';

interface AuditLogRow {
  id: string;
  actorId: string;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  diff: unknown;
  actor: { id: string; name: string; email: string | null; role: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
}

export default function DevLogsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');

  useEffect(() => {
    const role = getSession()?.role;
    if (role !== 'developer' && role !== 'super_admin') {
      router.replace('/login');
      return;
    }
    setAuthorized(true);
  }, [router]);

  async function fetchLogs() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (entityType) params.set('entityType', entityType);
      if (actorId) params.set('actorId', actorId);
      const res = await api.get<{ data: AuditLogRow[]; meta: { total: number } }>(
        `/dev/audit-logs?${params.toString()}`,
      );
      setLogs(res.data);
      setTotal(res.meta.total);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authorized) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Spinner className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100">
      <h1 className="mb-4 text-lg font-semibold">Audit Log</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <Input
          label="Entity type"
          placeholder="e.g. students"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
        <Input
          label="Actor ID"
          placeholder="user uuid"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
        />
        <Button onClick={fetchLogs}>Filter</Button>
        <span className="ml-auto text-sm text-gray-400">{total} entries</span>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-gray-400" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-950 p-4 text-sm text-red-300">{error}</div>
      ) : logs.length === 0 ? (
        <EmptyState title="No audit entries" description="No activity matches this filter." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900">
              <tr>
                {['When', 'Actor', 'Tenant', 'Action', 'Entity', 'Diff'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-900">
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {log.actor ? `${log.actor.name} (${log.actor.role})` : log.actorId}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{log.tenant?.name ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {log.entityType}
                    {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-gray-500" title={JSON.stringify(log.diff)}>
                    {JSON.stringify(log.diff)}
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
