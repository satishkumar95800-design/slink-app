'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { Modal } from '../../../../components/ui/modal';
import { useToast } from '../../../../components/ui/toast';
import { ImportWorkflow } from '../../../../components/import/import-workflow';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; students: number };
}

type Tab = 'overview' | 'import' | 'settings';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  async function fetchTenant() {
    try {
      setLoading(true);
      const res = await api.get<Tenant>(`/tenants/${id}`);
      setTenant(res);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load tenant', 'error');
      router.push('/platform/tenants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) fetchTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !tenant) {
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          onClick={() => router.push('/platform/tenants')}
          className="mb-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          ← All tenants
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{tenant.name}</h1>
          <Badge variant={tenant.isActive ? 'green' : 'gray'}>{tenant.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
        <p className="font-mono text-xs text-gray-500">{tenant.slug}</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['overview', 'import', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'import' ? 'Import Data' : t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab tenant={tenant} />}
      {tab === 'import' && <ImportWorkflow tenantOverride={tenant.slug} />}
      {tab === 'settings' && <SettingsTab tenant={tenant} onSaved={fetchTenant} />}
    </div>
  );
}

function OverviewTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border bg-white p-5">
        <p className="text-sm text-gray-500">Users</p>
        <p className="text-2xl font-semibold text-gray-900">{tenant._count.users}</p>
      </div>
      <div className="rounded-lg border bg-white p-5">
        <p className="text-sm text-gray-500">Students</p>
        <p className="text-2xl font-semibold text-gray-900">{tenant._count.students}</p>
      </div>
      <div className="col-span-2 rounded-lg border bg-white p-5 text-sm text-gray-600">
        <p>
          Created{' '}
          {new Date(tenant.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="mt-1">Timezone: {tenant.timezone}</p>
      </div>
      {tenant._count.users === 0 && (
        <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          This tenant has no users yet — use the <strong>Import Data</strong> tab to bulk-create its first admin,
          teachers, and students from the onboarding template.
        </div>
      )}
    </div>
  );
}

const settingsSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z
    .string()
    .min(3, 'At least 3 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits, and hyphens only'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

function SettingsTab({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [togglingActive, setTogglingActive] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: tenant.name, slug: tenant.slug, timezone: tenant.timezone },
  });

  async function onSave(data: SettingsFormData) {
    try {
      await api.patch(`/tenants/${tenant.id}`, data);
      toast('Settings saved', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save settings', 'error');
    }
  }

  async function toggleActive() {
    setTogglingActive(true);
    try {
      if (tenant.isActive) {
        await api.delete(`/tenants/${tenant.id}`);
        toast('Tenant deactivated', 'success');
      } else {
        await api.patch(`/tenants/${tenant.id}`, { isActive: true });
        toast('Tenant reactivated', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update status', 'error');
    } finally {
      setTogglingActive(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSave)} className="space-y-4 rounded-lg border bg-white p-5">
        <Input label="School name" error={errors.name?.message} {...register('name')} />
        <Input
          label="Slug"
          helpText="Changing this changes the login URL/tenant ID for every user."
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Timezone" error={errors.timezone?.message} {...register('timezone')} />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>

      <AddTenantUserCard tenant={tenant} onCreated={onSaved} />

      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-5">
        <div>
          <p className="text-sm font-medium text-red-900">
            {tenant.isActive ? 'Deactivate this tenant' : 'Reactivate this tenant'}
          </p>
          <p className="text-xs text-red-700">
            {tenant.isActive
              ? 'Blocks all logins for this school until reactivated. Data is kept.'
              : 'Restores login access for this school.'}
          </p>
        </div>
        <Button variant="danger" onClick={toggleActive} loading={togglingActive}>
          {tenant.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-100 p-5">
        <div>
          <p className="text-sm font-medium text-red-900">Permanently delete this tenant</p>
          <p className="text-xs text-red-800">
            Erases every user, student, fee, payment, and report for this school. This cannot be undone.
            {tenant.isActive && ' Deactivate the tenant first.'}
          </p>
        </div>
        <Button
          variant="danger"
          disabled={tenant.isActive}
          title={tenant.isActive ? 'Deactivate the tenant before permanently deleting it' : undefined}
          onClick={() => setShowPurgeModal(true)}
        >
          Delete permanently
        </Button>
      </div>

      <PurgeTenantModal
        tenant={tenant}
        open={showPurgeModal}
        onClose={() => setShowPurgeModal(false)}
        onDeleted={() => {
          toast(`"${tenant.name}" was permanently deleted`, 'success');
          router.push('/platform/tenants');
        }}
      />
    </div>
  );
}

const addUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'accounts', 'teacher', 'developer']),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

const TENANT_USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'developer', label: 'Developer (platform support access)' },
];

function AddTenantUserCard({ tenant, onCreated }: { tenant: Tenant; onCreated: () => void }) {
  const { toast } = useToast();
  const [createdCred, setCreatedCred] = useState<{ email: string; password: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { role: 'admin' },
  });

  async function onSubmit(data: AddUserFormData) {
    try {
      await api.post(`/tenants/${tenant.id}/users`, { ...data, phone: data.phone || undefined });
      setCreatedCred({ email: data.email, password: data.password });
      toast(`${data.role} account created for ${tenant.name}`, 'success');
      reset({ role: data.role, name: '', email: '', phone: '', password: '' });
      onCreated();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create user', 'error');
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">Add a user to this tenant</p>
      <p className="mt-1 text-xs text-gray-500">
        For a single account — bootstrapping the first admin, or adding a developer support login. Use the
        Import Data tab instead for bulk onboarding of staff and students.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-4">
        <Input label="Full name" error={errors.name?.message} {...register('name')} />
        <Select
          label="Role"
          options={TENANT_USER_ROLE_OPTIONS}
          error={errors.role?.message}
          {...register('role')}
        />
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />
        <Input
          label="Password"
          type="password"
          helpText="At least 8 characters — share this with the account holder."
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="col-span-2 flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Create user
          </Button>
        </div>
      </form>

      {createdCred && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">Created — share these credentials now</p>
          <p className="mt-1 font-mono text-amber-900">
            {createdCred.email} / {createdCred.password}
          </p>
        </div>
      )}
    </div>
  );
}

function PurgeTenantModal({
  tenant,
  open,
  onClose,
  onDeleted,
}: {
  tenant: Tenant;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [confirmSlug, setConfirmSlug] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/tenants/${tenant.id}/purge`, { confirmSlug });
      onDeleted();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete tenant', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Permanently delete "${tenant.name}"?`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This immediately and irreversibly deletes all users, students, fees, payments, and reports for this
          tenant. Type <span className="font-mono font-semibold text-gray-900">{tenant.slug}</span> to confirm.
        </p>
        <Input
          placeholder={tenant.slug}
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={confirmSlug !== tenant.slug}
            loading={deleting}
            onClick={handleDelete}
          >
            Delete permanently
          </Button>
        </div>
      </div>
    </Modal>
  );
}
