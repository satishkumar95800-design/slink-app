'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

/** Self-service password change — available to every logged-in role (any role that
 * authenticates with a password; parents authenticate via phone OTP on mobile only). */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(data: FormData) {
    try {
      await api.post('/users/me/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast('Password changed successfully', 'success');
      close();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  return (
    <Modal open={open} onClose={close} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Current Password"
          type="password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="New Password"
          type="password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm New Password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Change Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
