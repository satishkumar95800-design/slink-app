'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { roleLabel } from '../../../lib/i18n/labels';
import { formatDate } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { getSession } from '../../../lib/auth';
import type { Role } from '@slink/types';
import { nameCaseWarning } from '../../../lib/names';

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isVerified: boolean;
  createdAt: string;
  _count: { linkedStudents: number };
}

type TCommon = ReturnType<typeof useTranslations<'common'>>;

const makeSchemas = (t: TCommon) => ({
  create: z.object({
    name: z.string().min(1, t('nameRequired')),
    email: z.string().email(t('invalidEmail')),
    phone: z.string().optional(),
    password: z.string().min(8, t('passwordTooShort')),
    role: z.enum(['teacher', 'admin', 'accounts']),
  }),
  edit: z.object({
    name: z.string().min(1, t('nameRequired')),
    email: z.string().email(t('invalidEmail')).optional().or(z.literal('')),
    phone: z.string().optional(),
    role: z.enum(['teacher', 'admin', 'accounts']).optional(),
  }),
  resetPassword: z.object({
    newPassword: z.string().min(8, t('passwordTooShort')),
  }),
});

type Schemas = ReturnType<typeof makeSchemas>;
type FormData = z.infer<Schemas['create']>;
type EditFormData = z.infer<Schemas['edit']>;
type ResetPasswordFormData = z.infer<Schemas['resetPassword']>;

const STAFF_ROLES = ['teacher', 'admin', 'accounts'] as const;

// The role field can only ever change between these three — parent (and any
// platform role like developer/super_admin) isn't reassignable from this form.
function isStaffRole(role: string): role is 'teacher' | 'admin' | 'accounts' {
  return role === 'teacher' || role === 'admin' || role === 'accounts';
}

const roleVariant = (role: string): 'blue' | 'green' | 'orange' | 'gray' => {
  const map: Record<string, 'blue' | 'green' | 'orange' | 'gray'> = {
    teacher: 'blue',
    admin: 'green',
    accounts: 'orange',
  };
  return map[role] ?? 'gray';
};

export default function UsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('roles');
  const errorText = useErrorText();
  const schemas = useMemo(() => makeSchemas(tCommon), [tCommon]);
  const roleOptions = STAFF_ROLES.map((value) => ({ value, label: tRoles(value) }));
  const { toast } = useToast();
  // Creating/editing/deleting users is admin-only on the backend (accounts can only
  // view) — hide the actions here instead of letting them fail with "Forbidden resource".
  const isAdmin = getSession()?.role === 'admin';
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schemas.create) });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: editControl,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditFormData>({ resolver: zodResolver(schemas.edit) });
  const nameValue = useWatch({ control, name: 'name' });
  const editNameValue = useWatch({ control: editControl, name: 'name' });

  const {
    register: registerResetPassword,
    handleSubmit: handleResetPasswordSubmit,
    reset: resetResetPasswordForm,
    formState: { errors: resetPasswordErrors, isSubmitting: isResettingPassword },
  } = useForm<ResetPasswordFormData>({ resolver: zodResolver(schemas.resetPassword) });

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get<{ data: User[]; meta: { total: number } }>('/users?limit=50');
      setUsers(res.data);
      setTotal(res.meta.total);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function onSubmit(data: FormData) {
    try {
      await api.post('/users', data);
      toast(t('created'), 'success');
      setShowModal(false);
      reset();
      fetchUsers();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    resetEdit({
      name: user.name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: isStaffRole(user.role) ? user.role : undefined,
    });
  }

  async function onEditSubmit(data: EditFormData) {
    if (!editingUser) return;
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        // Omitted entirely for parent/other non-staff roles — never send a role
        // change the form never actually offered a choice for.
        ...(data.role ? { role: data.role } : {}),
      });
      toast(t('updated'), 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function onResetPasswordSubmit(data: ResetPasswordFormData) {
    if (!resettingUser) return;
    try {
      await api.post(`/users/${resettingUser.id}/reset-password`, data);
      toast(t('passwordReset', { name: resettingUser.name }), 'success');
      setResettingUser(null);
      resetResetPasswordForm();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setDeletingId(id);
    try {
      await api.delete(`/users/${id}`);
      toast(t('deleted'), 'success');
      fetchUsers();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{t('count', { count: total })}</p>
        {isAdmin && <Button onClick={() => setShowModal(true)}>{t('add')}</Button>}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : users.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={isAdmin ? <Button onClick={() => setShowModal(true)}>{t('add')}</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colName'), t('colEmail'), t('colPhone'), t('colRole'), t('colStudents'), t('colJoined'), ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.phone ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={roleVariant(u.role)}>{roleLabel(tRoles, u.role)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u._count.linkedStudents}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-teal hover:underline"
                        >
                          {tCommon('edit')}
                        </button>
                        {u.role !== 'parent' && (
                          <button
                            onClick={() => setResettingUser(u)}
                            className="text-xs text-teal hover:underline"
                          >
                            {t('resetPassword')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === u.id ? tCommon('deleting') : tCommon('delete')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset(); }}
        title={t('addTitle')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label={t('fullName')} required error={errors.name?.message} warning={nameCaseWarning(nameValue, tCommon('nameLowercaseWarning'))} {...register('name')} />
          <Input label={t('email')} required type="email" error={errors.email?.message} {...register('email')} />
          <Input label={t('phone')} placeholder={t('phonePlaceholder')} error={errors.phone?.message} {...register('phone')} />
          <Input
            label={t('password')} required
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Select
            label={t('role')} required
            options={roleOptions}
            placeholder={t('selectRole')}
            error={errors.role?.message}
            {...register('role')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={t('editTitle')}
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <Input label={t('fullName')} required error={editErrors.name?.message} warning={nameCaseWarning(editNameValue, tCommon('nameLowercaseWarning'))} {...registerEdit('name')} />
          <Input label={t('email')} type="email" error={editErrors.email?.message} {...registerEdit('email')} />
          <Input label={t('phone')} placeholder={t('phonePlaceholder')} error={editErrors.phone?.message} {...registerEdit('phone')} />
          {editingUser && isStaffRole(editingUser.role) ? (
            <Select
              label={t('role')}
              options={roleOptions}
              placeholder={t('selectRole')}
              error={editErrors.role?.message}
              {...registerEdit('role')}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">{t('role')}</span>
              <div className="flex items-center gap-2">
                <Badge variant={roleVariant(editingUser?.role ?? '')}>{roleLabel(tRoles, editingUser?.role ?? '')}</Badge>
                <span className="text-xs text-gray-500">{t('roleNotEditable')}</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingUser(null)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isEditSubmitting}>
              {tCommon('saveChanges')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resettingUser}
        onClose={() => { setResettingUser(null); resetResetPasswordForm(); }}
        title={resettingUser ? t('resetTitleNamed', { name: resettingUser.name }) : t('resetTitle')}
      >
        <form onSubmit={handleResetPasswordSubmit(onResetPasswordSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">{t('resetExplainer')}</p>
          <Input
            label={t('newPassword')} required
            type="password"
            error={resetPasswordErrors.newPassword?.message}
            {...registerResetPassword('newPassword')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setResettingUser(null); resetResetPasswordForm(); }}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isResettingPassword}>
              {t('resetPassword')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
