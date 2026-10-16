'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Download, Folder, Pencil, Trash2, Upload } from 'lucide-react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDate } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { PlanGate } from '../../../components/plan-gate';

interface StaffFolder {
  id: string;
  name: string;
  fileCount: number;
  createdBy: string | null;
  createdAt: string;
  canManage: boolean;
}

interface StaffFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
  canManage: boolean;
}

interface FolderContents {
  folder: { id: string; name: string; canManage: boolean };
  files: StaffFile[];
}

/** What the folder-name modal is doing: creating a new folder, or renaming one. */
type NameModal = { mode: 'create' } | { mode: 'rename'; id: string; name: string } | null;

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const MAX_BYTES = 20 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Folders and files shared by all staff of the school: anyone can add, the owner or an admin can remove. */
export default function SharedDocumentsPage() {
  return (
    <PlanGate feature="staffDocuments">
      <SharedDocumentsPageContent />
    </PlanGate>
  );
}

function SharedDocumentsPageContent() {
  const t = useTranslations('sharedDocs');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [folders, setFolders] = useState<StaffFolder[]>([]);
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameModal, setNameModal] = useState<NameModal>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFolders = useCallback(
    () =>
      api.get<StaffFolder[]>('/staff-documents/folders').then(
        (rows) => {
          setFolders(rows);
          setError(null);
        },
        (e: unknown) => setError(errorText(e)),
      ),
    [errorText],
  );

  const loadFolder = useCallback(
    (id: string) =>
      api.get<FolderContents>(`/staff-documents/folders/${id}/files`).then(
        (c) => {
          setContents(c);
          setError(null);
        },
        (e: unknown) => setError(errorText(e)),
      ),
    [errorText],
  );

  useEffect(() => {
    const load = openId ? loadFolder(openId) : loadFolders();
    void load.finally(() => setLoading(false));
  }, [openId, loadFolder, loadFolders]);

  function open(id: string | null) {
    setLoading(true);
    setContents(null);
    setOpenId(id);
  }

  function startName(m: NameModal) {
    setName(m?.mode === 'rename' ? m.name : '');
    setNameModal(m);
  }

  async function saveName() {
    if (!nameModal || !name.trim()) return;
    setSaving(true);
    try {
      if (nameModal.mode === 'create') {
        await api.post('/staff-documents/folders', { name: name.trim() });
        toast(t('folderCreated'), 'success');
        await loadFolders();
      } else {
        await api.patch(`/staff-documents/folders/${nameModal.id}`, { name: name.trim() });
        toast(t('folderRenamed'), 'success');
        await (openId ? loadFolder(openId) : loadFolders());
      }
      setNameModal(null);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder(f: { id: string; name: string }) {
    if (!confirm(t('confirmDeleteFolder', { name: f.name }))) return;
    setBusyId(f.id);
    try {
      await api.delete(`/staff-documents/folders/${f.id}`);
      toast(t('folderDeleted'), 'success');
      if (openId) open(null);
      else await loadFolders();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function upload(list: FileList | null) {
    if (!openId || !list || list.length === 0) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast(t('tooBig', { name: tooBig.name }), 'error');
      return;
    }
    setUploading(true);
    let done = 0;
    try {
      for (const f of files) {
        await apiUpload(`/staff-documents/folders/${openId}/files`, f);
        done++;
      }
      toast(t('uploaded', { count: done }), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (done > 0) await loadFolder(openId);
    }
  }

  async function download(f: StaffFile) {
    if (!openId) return;
    setBusyId(f.id);
    try {
      const { url } = await api.get<{ url: string }>(`/staff-documents/folders/${openId}/files/${f.id}/url`);
      window.open(url, '_blank');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFile(f: StaffFile) {
    if (!openId || !confirm(t('confirmDeleteFile', { name: f.fileName }))) return;
    setBusyId(f.id);
    try {
      await api.delete(`/staff-documents/folders/${openId}/files/${f.id}`);
      toast(t('fileDeleted'), 'success');
      await loadFolder(openId);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const folder = contents?.folder;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {openId ? (
            <>
              <button
                type="button"
                onClick={() => open(null)}
                className="mb-1 inline-flex items-center gap-1 text-sm text-teal hover:underline"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('allFolders')}
              </button>
              <h1 className="truncate text-xl font-extrabold tracking-tight text-gray-900">{folder?.name ?? ''}</h1>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
              <p className="text-sm text-gray-500">{t('intro')}</p>
            </>
          )}
        </div>
        {openId ? (
          <div className="flex flex-wrap gap-2">
            {folder?.canManage && (
              <>
                <Button variant="ghost" size="sm" onClick={() => startName({ mode: 'rename', id: folder.id, name: folder.name })}>
                  <Pencil className="h-4 w-4" />
                  {t('rename')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyId === folder.id}
                  onClick={() => deleteFolder(folder)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('deleteFolder')}
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <Button loading={uploading} disabled={!folder} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {t('upload')}
            </Button>
          </div>
        ) : (
          <Button onClick={() => startName({ mode: 'create' })}>{t('newFolder')}</Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !openId ? (
        folders.length === 0 ? (
          <EmptyState
            title={t('noFoldersTitle')}
            description={t('noFoldersBody')}
            action={<Button onClick={() => startName({ mode: 'create' })}>{t('newFolder')}</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => open(f.id)}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal/40 hover:bg-cream/40"
              >
                <Folder className="mt-0.5 h-8 w-8 shrink-0 text-coral" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-gray-900">{f.name}</span>
                  <span className="block text-xs text-gray-500">{t('fileCount', { count: f.fileCount })}</span>
                  {f.createdBy && (
                    <span className="block truncate text-xs text-gray-400">{t('createdBy', { name: f.createdBy })}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )
      ) : contents && contents.files.length === 0 ? (
        <EmptyState
          title={t('noFilesTitle')}
          description={t('noFilesBody')}
          action={
            <Button loading={uploading} onClick={() => fileInputRef.current?.click()}>
              {t('upload')}
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-cream/60">
                <tr>
                  {[t('colFile'), t('colSize'), t('colUploadedBy'), t('colUploaded'), ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contents?.files.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="max-w-xs truncate px-4 py-3 text-sm font-medium text-gray-900" title={f.fileName}>
                      {f.fileName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatSize(f.size)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{f.uploadedBy ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatDate(f.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={busyId === f.id} onClick={() => download(f)}>
                          <Download className="h-4 w-4" />
                          {t('download')}
                        </Button>
                        {f.canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === f.id}
                            onClick={() => deleteFile(f)}
                            className="text-red-600"
                            aria-label={t('deleteFile')}
                            title={t('deleteFile')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={nameModal !== null}
        onClose={() => setNameModal(null)}
        title={nameModal?.mode === 'rename' ? t('renameTitle') : t('newFolderTitle')}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
          className="space-y-4"
        >
          <Input
            label={t('folderName')}
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder={t('folderNamePlaceholder')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNameModal(null)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={saving} disabled={!name.trim()}>
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
