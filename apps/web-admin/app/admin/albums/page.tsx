'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, ImagePlus, Images, Plus, Send, Trash2, X } from 'lucide-react';
import { api, apiUpload } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { classLabel, compareClasses } from '../../../lib/fee-terms';
import { formatDate, formatDateOnly } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';

type Status = 'draft' | 'live' | 'expired';

interface AlbumRow {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  classIds: string[];
  studentIds: string[];
  status: Status;
  publishedAt: string | null;
  expiresAt: string | null;
  extended: boolean;
  photoCount: number;
  savedCount: number;
  createdBy: string | null;
  /** Staff folder: teachers, admin and accounts only, never parents. */
  forStaff: boolean;
  /** An admin, or the teacher who made it (others only view the staff folder). */
  canManage: boolean;
}

interface Photo {
  id: string;
  url: string;
  thumbUrl: string;
}

interface AlbumDetail extends Omit<AlbumRow, 'photoCount' | 'createdBy'> {
  classes: { id: string; name: string; section: string | null }[];
  students: { id: string; name: string; admissionNo: string }[];
  photos: Photo[];
  /** Parents of the album's children, or the school's staff for the staff folder. */
  recipientCount: number;
  limits: { photosPerAlbum: number; schoolBytes: number; usedBytes: number };
}

interface ClassOption {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
}

const STATUS_VARIANT: Record<Status, 'gray' | 'green' | 'red'> = { draft: 'gray', live: 'green', expired: 'red' };

/** Resizes on this computer before upload: about 1600 px for the photo, 400 px for the thumbnail. */
async function shrink(file: File, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize'))), 'image/jpeg', quality));
  return { blob, width, height };
}

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(bytes < 1024 ** 3 ? 2 : 1);

export default function AlbumsPage() {
  const t = useTranslations('albums');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (!features.photoAlbums) return <EmptyState title={t('offTitle')} description={t('offBody')} />;
  return <Albums />;
}

function Albums() {
  const t = useTranslations('albums');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);
  const [folder, setFolder] = useState<'parents' | 'staff'>('parents');
  const [creating, setCreating] = useState(false);
  // Accounts only see the staff folder; they don't make albums.
  const canCreate = getSession()?.role !== 'accounts';
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<AlbumRow[]>('/albums')
      .then(setAlbums)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);
  useEffect(load, [load]);

  const open = albums?.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="max-w-2xl text-sm text-gray-500">{t('intro')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {folder === 'staff' ? t('newStaffAlbum') : t('newAlbum')}
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 sm:w-fit">
          {(['parents', 'staff'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={folder === k}
              onClick={() => setFolder(k)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${folder === k ? 'bg-teal text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {k === 'staff' ? t('folderStaff') : t('folderParents')}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{folder === 'staff' ? t('folderStaffHelp') : t('folderParentsHelp')}</p>
      </div>

      {!albums ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : shown(albums, folder).length === 0 ? (
        <EmptyState title={folder === 'staff' ? t('emptyStaffTitle') : t('emptyTitle')} description={folder === 'staff' ? t('emptyStaffBody') : t('emptyBody')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown(albums, folder).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              className="cursor-pointer rounded-3xl border border-black/5 bg-white p-5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-100 text-pink-700">
                  <Images className="h-5 w-5" />
                </span>
                <Badge variant={STATUS_VARIANT[a.status]}>{t(`status.${a.status}`)}</Badge>
              </div>
              <p className="mt-3 font-bold text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-500">
                {[a.eventDate ? formatDateOnly(a.eventDate) : null, t('photoCount', { count: a.photoCount }), a.createdBy].filter(Boolean).join(' · ')}
              </p>
              {a.status === 'live' && a.expiresAt && (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  {t('until', { date: formatDate(a.expiresAt) })} · {t('savedBy', { count: a.savedCount })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <AlbumForm
          forStaff={folder === 'staff'}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            load();
            setOpenId(id);
          }}
        />
      )}
      <Drawer open={!!openId} onClose={() => setOpenId(null)} title={open?.title ?? ''} subtitle={open ? t(`status.${open.status}`) : ''} icon={<Images className="h-5 w-5" />} accent="bg-pink-100 text-pink-700">
        {openId && (
          <AlbumBody
            key={openId}
            id={openId}
            onChanged={load}
            onDeleted={() => {
              setOpenId(null);
              load();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

const shown = (albums: AlbumRow[], folder: 'parents' | 'staff') => albums.filter((a) => a.forStaff === (folder === 'staff'));

/** New album, or edit one (who it is for only while it is a draft). */
function AlbumForm({
  album,
  forStaff: staffFolder = false,
  onClose,
  onSaved,
}: {
  album?: AlbumDetail;
  /** A new album in the staff folder (never shown to parents). */
  forStaff?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const forStaff = album ? album.forStaff : staffFolder;
  const t = useTranslations('albums');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [title, setTitle] = useState(album?.title ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [eventDate, setEventDate] = useState(album?.eventDate ?? '');
  const [classIds, setClassIds] = useState<string[]>(album?.classIds ?? []);
  const [students, setStudents] = useState<{ id: string; name: string; admissionNo: string }[]>(album?.students ?? []);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string; admissionNo: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const locked = !!album && album.status !== 'draft';

  useEffect(() => {
    api
      .get<ClassOption[]>('/classes')
      .then((c) => setClasses([...c].sort(compareClasses)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      api
        .get<{ data: { id: string; name: string; admissionNo: string }[] }>(`/students?search=${encodeURIComponent(q)}&limit=8`)
        .then((r) => setFound(r.data))
        .catch(() => setFound([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function save() {
    setSaving(true);
    const body = {
      title: title.trim(),
      description: description.trim(),
      eventDate: eventDate || undefined,
      forStaff,
      classIds: forStaff ? [] : classIds,
      studentIds: forStaff ? [] : students.map((s) => s.id),
    };
    try {
      const res = album ? await api.patch<AlbumDetail>(`/albums/${album.id}`, body) : await api.post<AlbumDetail>('/albums', body);
      toast(album ? t('saved') : t('created'), 'success');
      onSaved(res.id);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const ok = title.trim().length > 0 && (forStaff || classIds.length > 0 || students.length > 0);
  return (
    <Modal open onClose={onClose} title={album ? t('edit') : forStaff ? t('newStaffAlbum') : t('newAlbum')} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Input label={t('albumTitle')} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('albumTitlePlaceholder')} />
          <Input label={t('eventDate')} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <Input label={t('description')} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />

        {forStaff ? (
          <p className="rounded-xl bg-teal/5 p-3 text-sm text-teal">{t('staffAudience')}</p>
        ) : (
        <>
        <div>
          <p className="text-sm font-semibold text-gray-800">{t('whoSees')}</p>
          <p className="text-xs text-gray-500">{locked ? t('audienceLocked') : t('whoSeesHelp')}</p>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {classes.map((c) => {
              const on = classIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setClassIds(on ? classIds.filter((x) => x !== c.id) : [...classIds, c.id])}
                  className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${on ? 'border-teal bg-teal text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-teal'}`}
                >
                  {classLabel(c)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800">{t('children')}</p>
          {students.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {students.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-1 text-sm font-semibold text-teal">
                  {s.name}
                  {!locked && (
                    <button type="button" aria-label={tCommon('remove')} onClick={() => setStudents(students.filter((x) => x.id !== s.id))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!locked && (
            <div className="relative mt-2">
              <Input aria-label={t('findChild')} placeholder={t('findChild')} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query.trim().length >= 2 && found.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {found
                    .filter((s) => !students.some((x) => x.id === s.id))
                    .map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                          onClick={() => {
                            setStudents([...students, s]);
                            setQuery('');
                            setFound([]);
                          }}
                        >
                          {s.name} <span className="text-gray-400">· {s.admissionNo}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
        </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!ok} onClick={save}>
            {album ? tCommon('save') : t('create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AlbumBody({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const t = useTranslations('albums');
  const errorText = useErrorText();
  const { toast } = useToast();
  const isAdmin = ['admin', 'super_admin'].includes(getSession()?.role ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  const load = useCallback(() => {
    api
      .get<AlbumDetail>(`/albums/${id}`)
      .then(setAlbum)
      .catch((e) => toast(errorText(e), 'error'));
  }, [id, errorText, toast]);
  useEffect(load, [load]);

  async function upload(list: FileList | null) {
    if (!list || !album) return;
    const room = album.limits.photosPerAlbum - album.photos.length;
    const files = [...list].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (list.length > files.length) toast(t('tooMany', { max: album.limits.photosPerAlbum }), 'error');
    let failed = 0;
    setProgress({ done: 0, total: files.length, failed: 0 });
    for (const [i, f] of files.entries()) {
      try {
        const big = await shrink(f, 1600, 0.82);
        const small = await shrink(f, 400, 0.7);
        const base = f.name.replace(/\.[^.]+$/, '') || 'photo';
        await apiUpload(
          `/albums/${id}/photos`,
          new File([big.blob], `${base}.jpg`, { type: 'image/jpeg' }),
          { width: String(big.width), height: String(big.height) },
          undefined,
          { fileField: 'photo', extraFiles: { thumb: new File([small.blob], `${base}-thumb.jpg`, { type: 'image/jpeg' }) } },
        );
      } catch (e) {
        failed++;
        if (failed === 1) toast(errorText(e), 'error');
      }
      setProgress({ done: i + 1, total: files.length, failed });
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
    load();
    onChanged();
  }

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done, 'success');
      load();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeAlbum() {
    if (!album || !confirm(t('confirmDelete', { title: album.title }))) return;
    try {
      await api.delete(`/albums/${id}`);
      toast(t('deleted'), 'success');
      onDeleted();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  if (!album)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const audience = album.forStaff
    ? t('staffAudience')
    : t('sharedWith', { who: [...album.classes.map((c) => classLabel({ ...c, academicYear: '' })), ...album.students.map((s) => s.name)].join(', ') });
  const manage = album.canManage;
  const canAdd = manage && album.status !== 'expired' && album.photos.length < album.limits.photosPerAlbum;
  const people = album.recipientCount;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[album.status]}>{t(`status.${album.status}`)}</Badge>
          {album.eventDate && <span className="text-gray-600">{formatDateOnly(album.eventDate)}</span>}
        </div>
        {album.description && <p className="mt-2 text-gray-700">{album.description}</p>}
        <p className="mt-2 text-gray-600">{audience}</p>
        {album.status === 'live' && album.expiresAt && (
          <p className="mt-2 flex items-center gap-1.5 font-semibold text-amber-700">
            <CalendarClock className="h-4 w-4" /> {t('until', { date: formatDate(album.expiresAt) })} · {album.forStaff ? t('savedOfStaff', { saved: album.savedCount, total: people }) : t('savedOf', { saved: album.savedCount, total: people })}
          </p>
        )}
        {album.status === 'draft' && <p className="mt-2 text-gray-500">{album.forStaff ? t('draftHintStaff', { count: people }) : t('draftHint', { count: people })}</p>}
        {manage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {album.status === 'draft' && (
            <Button size="sm" loading={busy} disabled={album.photos.length === 0} onClick={() => act(() => api.post(`/albums/${id}/publish`, {}), album.forStaff ? t('publishedStaff', { count: people }) : t('published', { count: people }))}>
              <Send className="h-4 w-4" /> {t('publish')}
            </Button>
          )}
          {isAdmin && album.status === 'live' && !album.extended && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => api.post(`/albums/${id}/extend`, {}), t('extended'))}>
              {t('extend')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
          <Button size="sm" variant="ghost" onClick={removeAlbum}>
            <Trash2 className="h-4 w-4" /> {t('delete')}
          </Button>
        </div>
        )}
      </section>

      {album.status === 'expired' ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500">{t('expiredHint')}</p>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">{t('photosOf', { count: album.photos.length, max: album.limits.photosPerAlbum })}</h3>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            {manage && (
              <Button size="sm" disabled={!canAdd || !!progress} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> {t('addPhotos')}
              </Button>
            )}
          </div>
          {progress && (
            <div className="rounded-xl bg-teal/5 p-3 text-sm text-teal">
              {t('uploading', { done: progress.done, total: progress.total })}
              {progress.failed > 0 && <span className="text-red-600"> · {t('uploadFailed', { count: progress.failed })}</span>}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal/10">
                <div className="h-full bg-teal transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
            </div>
          )}
          {album.photos.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{t('noPhotos')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {album.photos.map((p) => (
                <li key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 link */}
                    <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </a>
                  {manage && (
                  <button
                    type="button"
                    aria-label={t('removePhoto')}
                    onClick={() => act(() => api.delete(`/albums/${id}/photos/${p.id}`), t('photoRemoved'))}
                    className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">{t('storage', { used: gb(album.limits.usedBytes), total: gb(album.limits.schoolBytes) })}</p>
        </section>
      )}

      {editing && (
        <AlbumForm
          album={album}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
