'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, FileText, Image as ImageIcon, Pencil, Printer, Trash2, Upload } from 'lucide-react';
import { api, apiBlob, apiUpload } from '../../../lib/api-client';
import { formatDate } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';

interface Form {
  id: string;
  title: string;
  note: string | null;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
}

const ACCEPT = 'application/pdf,image/jpeg,image/png';
const MAX_BYTES = 15 * 1024 * 1024;

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Prints a file from a same-page blob URL in a hidden frame, so the browser's
 * print dialog opens straight away: a PDF prints as is, a photo of a form is
 * fitted to one A4 page.
 */
function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  const cleanUp = () =>
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  const print = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some browsers won't print a PDF from a frame: open it to print from there.
      window.open(url, '_blank');
    }
    cleanUp();
  };
  if (blob.type === 'application/pdf') {
    frame.onload = () => window.setTimeout(print, 300);
    frame.src = url;
  } else {
    frame.srcdoc = `<!doctype html><html><head><style>@page{size:A4;margin:10mm}html,body{margin:0;height:100%}body{display:flex;align-items:flex-start;justify-content:center}img{max-width:100%;max-height:277mm;object-fit:contain}</style></head><body><img src="${url}"></body></html>`;
    frame.onload = () => {
      const img = frame.contentDocument?.querySelector('img');
      if (img && !img.complete) img.onload = print;
      else print();
    };
  }
  document.body.appendChild(frame);
}

/** Blank forms the desk prints for visitors and parents to sign. */
export function FormsTab() {
  const t = useTranslations('reception.forms');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [forms, setForms] = useState<Form[] | null>(null);
  const [editing, setEditing] = useState<Form | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Form[]>('/reception/forms')
      .then(setForms)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);

  useEffect(load, [load]);

  async function view(f: Form) {
    // Opened before the download so the browser doesn't block it as a popup.
    const tab = window.open('', '_blank');
    try {
      const blob = await apiBlob(`/reception/forms/${f.id}/file`);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) {
      tab?.close();
      toast(errorText(e), 'error');
    }
  }

  async function print(f: Form) {
    setBusy(f.id);
    try {
      printBlob(await apiBlob(`/reception/forms/${f.id}/file`));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(f: Form) {
    if (!confirm(t('confirmRemove', { title: f.title }))) return;
    try {
      await api.delete(`/reception/forms/${f.id}`);
      toast(t('removed'), 'success');
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Upload className="h-4 w-4" /> {t('upload')}
        </Button>
      </div>

      {!forms ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : forms.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((f) => {
            const Icon = f.contentType === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li key={f.id} className="flex flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-coral/10 text-coral-dark">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{f.title}</p>
                    {f.note && <p className="text-sm text-gray-600">{f.note}</p>}
                    <p className="mt-1 truncate text-xs text-gray-500" title={f.fileName}>
                      {f.fileName} · {sizeText(f.size)}
                    </p>
                    <p className="text-xs text-gray-400">{t('addedBy', { name: f.uploadedBy ?? '—', date: formatDate(f.createdAt) })}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" loading={busy === f.id} onClick={() => print(f)}>
                    <Printer className="h-4 w-4" /> {t('print')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => view(f)}>
                    <Eye className="h-4 w-4" /> {t('view')}
                  </Button>
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(f)} aria-label={t('rename')} title={t('rename')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(f)} aria-label={t('remove')} title={t('remove')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <FormModal
          form={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

/** Upload a new form, or rename one. */
function FormModal({ form, onClose, onDone }: { form: Form | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('reception.forms');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(form?.title ?? '');
  const [note, setNote] = useState(form?.note ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) return setFileError(t('fileType'));
    if (f.size > MAX_BYTES) return setFileError(t('fileTooBig'));
    setFileError(null);
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120));
  }

  async function save() {
    setSaving(true);
    try {
      if (form) await api.patch(`/reception/forms/${form.id}`, { title: title.trim(), note: note.trim() });
      else await apiUpload('/reception/forms', file!, { title: title.trim(), note: note.trim() });
      toast(form ? t('saved') : t('uploaded'), 'success');
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const ok = title.trim().length > 0 && (!!form || !!file);
  return (
    <Modal open onClose={onClose} title={form ? t('rename') : t('upload')} size="md">
      <div className="space-y-4">
        {!form && (
          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-gray-300 bg-cream/40 px-4 py-6 text-center hover:border-teal"
            >
              <Upload className="h-6 w-6 text-teal" />
              <span className="text-sm font-semibold text-gray-800">{file ? file.name : t('chooseFile')}</span>
              <span className="text-xs text-gray-500">{t('fileHint')}</span>
            </button>
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
          </div>
        )}
        <Input label={t('formTitle')} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('formTitlePlaceholder')} />
        <Input label={t('note')} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!ok} onClick={save}>
            {form ? tCommon('save') : t('upload')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
