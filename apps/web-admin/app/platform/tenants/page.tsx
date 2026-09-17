'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; students: number };
}

const schema = z.object({
  slug: z
    .string()
    .min(3, 'At least 3 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits, and hyphens only'),
  name: z.string().min(2, 'Name is required'),
});

type FormData = z.infer<typeof schema>;

export default function TenantsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function fetchTenants(q: string) {
    try {
      setLoading(true);
      const query = q ? `?search=${encodeURIComponent(q)}&limit=50` : '?limit=50';
      const res = await api.get<{ data: Tenant[]; total: number }>(`/tenants${query}`);
      setTenants(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load tenants', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => fetchTenants(search), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function onCreate(data: FormData) {
    try {
      const tenant = await api.post<Tenant>('/tenants', data);
      toast(`"${tenant.name}" created`, 'success');
      setShowModal(false);
      reset();
      router.push(`/platform/tenants/${tenant.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create tenant', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500">{total} school{total === 1 ? '' : 's'} on this platform</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ New tenant</Button>
      </div>

      <Input
        placeholder="Search by name or slug…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="flex justify-center p-10">
            <Spinner className="h-6 w-6 text-blue-600" />
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState
            title="No tenants found"
            description={search ? 'Try a different search.' : 'Create the first school tenant to get started.'}
            action={!search && <Button onClick={() => setShowModal(true)}>+ New tenant</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/platform/tenants/${t.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.slug}</td>
                  <td className="px-4 py-3 text-gray-600">{t._count.users}</td>
                  <td className="px-4 py-3 text-gray-600">{t._count.students}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New tenant">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <Input
            label="School name"
            placeholder="Greenfield Academy"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Slug"
            placeholder="greenfield-academy"
            helpText="Used in the login screen and, later, as the subdomain."
            error={errors.slug?.message}
            {...register('slug')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
