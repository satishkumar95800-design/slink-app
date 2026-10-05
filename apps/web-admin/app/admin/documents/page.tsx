'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, apiUpload, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

interface DocumentCategory {
  id: string;
  name: string;
}

interface AccountantDocument {
  id: string;
  fileKey: string;
  category: DocumentCategory;
  note: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

const uploadSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  note: z.string().optional(),
});

type UploadData = z.infer<typeof uploadSchema>;

function filenameFromKey(key: string) {
  return key.split('/').pop() ?? key;
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AccountantDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadForm = useForm<UploadData>({ resolver: zodResolver(uploadSchema) });

  async function fetchAll() {
    try {
      setLoading(true);
      const [documentsRes, categoriesRes] = await Promise.all([
        api.get<AccountantDocument[]>('/accountant-documents'),
        api.get<DocumentCategory[]>('/document-categories'),
      ]);
      setDocuments(documentsRes);
      setCategories(categoriesRes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function onUpload(data: UploadData) {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast('Choose a file to upload', 'error');
      return;
    }
    try {
      const uploaded = await apiUpload<{ key: string }>('/files/upload', file, {
        category: 'general_document',
      });
      await api.post('/accountant-documents', {
        fileKey: uploaded.key,
        categoryId: data.categoryId,
        note: data.note || undefined,
      });
      toast('Document uploaded', 'success');
      setShowUpload(false);
      uploadForm.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAll();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  async function onView(doc: AccountantDocument) {
    try {
      const { url } = await api.get<{ url: string }>(`/accountant-documents/${doc.id}/signed-url`);
      window.open(url, '_blank');
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onAddCategory() {
    if (!newCategory.trim()) return;
    try {
      await api.post('/document-categories', { name: newCategory.trim() });
      setNewCategory('');
      fetchAll();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">
            General working storage for the accounts team — bank statements, reconciliation sheets, cheque scans.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>+ Upload Document</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload a bank statement, reconciliation sheet, or other supporting file for your own records."
          action={<Button onClick={() => setShowUpload(true)}>+ Upload Document</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {['File', 'Category', 'Note', 'Uploaded', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{filenameFromKey(d.fileKey)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{d.category.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{d.note ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(d.uploadedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onView(d)} className="text-xs text-teal hover:underline">
                      View / Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showUpload}
        onClose={() => { setShowUpload(false); uploadForm.reset(); }}
        title="Upload Document"
      >
        <form onSubmit={uploadForm.handleSubmit(onUpload)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">File<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,image/jpeg,image/png,application/pdf"
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal hover:file:bg-teal/20"
            />
          </div>
          <Select
            label="Category" required
            options={categoryOptions}
            placeholder="Select a category"
            error={uploadForm.formState.errors.categoryId?.message}
            {...uploadForm.register('categoryId')}
          />
          <div className="flex items-end gap-2">
            <Input
              label="New category"
              placeholder="e.g. Bank Statement"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={onAddCategory}>
              Add
            </Button>
          </div>
          <Input label="Note (optional)" placeholder="Any additional note" {...uploadForm.register('note')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowUpload(false); uploadForm.reset(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={uploadForm.formState.isSubmitting}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
