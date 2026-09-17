'use client';

import { useEffect, useRef, useState } from 'react';
import { api, apiUpload, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../components/ui/toast';

interface TenantSelf {
  id: string;
  name: string;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
}

interface UploadResult {
  key: string;
  publicUrl: string | null;
}

type Stage = 'idle' | 'uploading';

export default function SettingsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tenant, setTenant] = useState<TenantSelf | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api.get<TenantSelf>('/tenant').then(setTenant).catch(() => setTenant(null));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage('uploading');
    try {
      const uploaded = await apiUpload<UploadResult>('/files/upload', file, { category: 'background' });
      const updated = await api.patch<TenantSelf>('/tenant', { backgroundImageKey: uploaded.key });
      setTenant(updated);
      toast('Background image updated', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setStage('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Branding</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an image for your school. It's shown as a background across the admin console and the mobile
          app once a parent or teacher logs in.
        </p>

        <div className="mt-5">
          {tenant?.backgroundImageUrl ? (
            <img
              src={tenant.backgroundImageUrl}
              alt="School background"
              className="h-48 w-full rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-md border border-dashed text-sm text-gray-400">
              No background image set yet
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={stage === 'uploading'}
            className="block text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {stage === 'uploading' && <Button loading disabled>Uploading…</Button>}
        </div>
        <p className="mt-2 text-xs text-gray-400">JPEG, PNG, or WebP — up to 8 MB.</p>
      </div>
    </div>
  );
}
