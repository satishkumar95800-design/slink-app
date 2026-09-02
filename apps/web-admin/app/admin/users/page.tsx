'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import type { Role } from '@slink/types';

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

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['teacher', 'admin', 'accounts']),
});

type FormData = z.infer<typeof schema>;

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['teacher', 'admin', 'accounts']),
});

type EditFormData = z.infer<typeof editSchema>;

const roleOptions = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'accounts', label: 'Accounts' },
];

const roleVariant = (role: string): 'blue' | 'green' | 'orange' | 'gray' => {
  const map: Record<string, 'blue' | 'green' | 'orange' | 'gray'> = {
    teacher: 'blue',
    admin: 'green',
    accounts: 'orange',
  };
  return map[role] ?? 'gray';
};

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditFormData>({ resolver: zodResolver(editSchema) });

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get<{ data: User[]; meta: { total: number } }>('/users?limit=50');
      setUsers(res.data);
      setTotal(res.meta.total);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
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
      toast('User created successfully', 'success');
      setShowModal(false);
      reset();
      fetchUsers();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    resetEdit({
      name: user.name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role === 'teacher' || user.role === 'admin' || user.role === 'accounts' ? user.role : 'admin',
    });
  }

  async function onEditSubmit(data: EditFormData) {
    if (!editingUser) return;
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        role: data.role,
      });
      toast('User updated successfully', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/users/${id}`);
      toast('User deleted', 'success');
      fetchUsers();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} user{total !== 1 ? 's' : ''}</p>
        <Button onClick={() => setShowModal(true)}>+ Add User</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Add teachers, admins, and accounts staff."
          action={<Button onClick={() => setShowModal(true)}>+ Add User</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Students', 'Joined', ''].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
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
                    <Badge variant={roleVariant(u.role)}>{u.role}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u._count.linkedStudents}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === u.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
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
        title="Add User"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Full Name" error={errors.name?.message} {...register('name')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" placeholder="+91..." error={errors.phone?.message} {...register('phone')} />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Select
            label="Role"
            options={roleOptions}
            placeholder="Select a role"
            error={errors.role?.message}
            {...register('role')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <Input label="Full Name" error={editErrors.name?.message} {...registerEdit('name')} />
          <Input label="Email" type="email" error={editErrors.email?.message} {...registerEdit('email')} />
          <Input label="Phone" placeholder="+91..." error={editErrors.phone?.message} {...registerEdit('phone')} />
          <Select
            label="Role"
            options={roleOptions}
            placeholder="Select a role"
            error={editErrors.role?.message}
            {...registerEdit('role')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={isEditSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
