'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

const makeSchema = (t: ReturnType<typeof useTranslations<'changePassword'>>) =>
  z
    .object({
      currentPassword: z.string().min(1, t('currentRequired')),
      newPassword: z.string().min(8, t('tooShort')),
      confirmPassword: z.string().min(1, t('confirmRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('mismatch'),
      path: ['confirmPassword'],
    });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

/** Self-service password change — available to every logged-in role (any role that
 * authenticates with a password; parents authenticate via phone OTP on mobile only). */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('changePassword');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const schema = useMemo(() => makeSchema(t), [t]);
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
      toast(t('success'), 'success');
      close();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('title')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('current')} required
          type="password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label={t('new')} required
          type="password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label={t('confirm')} required
          type="password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={close}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
