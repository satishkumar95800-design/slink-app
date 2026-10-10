'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { reportStatusLabel, reportTypeLabel } from '../../../lib/i18n/labels';
import { formatDate } from '../../../lib/format';
import { getSession } from '../../../lib/auth';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

type ReportStatus = 'draft' | 'published';

interface Report {
  id: string;
  type: string;
  status: ReportStatus;
  term: string;
  academicYear: string;
  publishedAt: string | null;
  createdAt: string;
  teacher?: { id: string; name: string };
  student?: { name: string; admissionNo: string };
}

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
}

const statusVariant = (s: ReportStatus): 'green' | 'gray' => {
  return s === 'published' ? 'green' : 'gray';
};

const typeVariant = (t: string): 'blue' | 'orange' | 'yellow' | 'gray' | 'red' => {
  const m: Record<string, 'blue' | 'orange' | 'yellow' | 'gray' | 'red'> = {
    academic: 'blue',
    behavior: 'orange',
    attendance: 'yellow',
    homework: 'gray',
    report_card: 'red',
  };
  return m[t] ?? 'gray';
};

export default function ReportsPage() {
  const t = useTranslations('reports');
  const tType = useTranslations('reportType');
  const tStatus = useTranslations('reportStatus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const session = getSession();
  const isTeacher = session?.role === 'teacher';

  async function fetchReports() {
    try {
      setLoading(true);
      const res = await api.get<{ data: Report[]; total: number }>('/reports?limit=100');
      setReports(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function onPublish(id: string) {
    try {
      await api.post(`/reports/${id}/publish`, {});
      toast(t('published'), 'success');
      fetchReports();
    } catch (e) {
      toast(errorText(e, t('publishFailed')), 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{t('count', { count: total })}</p>
        {isTeacher && (
          <Button type="button" onClick={() => setUploadOpen(true)}>
            {t('upload')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : reports.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colTerm'), t('colYear'), t('colStudent'), t('colType'), t('colAuthor'), t('colStatus'), t('colPublished'), t('colCreated'), ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.term}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.academicYear}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{r.student?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{r.student?.admissionNo ?? ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={typeVariant(r.type)}>{reportTypeLabel(tType, r.type)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.teacher?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(r.status)}>{reportStatusLabel(tStatus, r.status)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {r.publishedAt ? formatDate(r.publishedAt) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isTeacher && r.status === 'draft' && r.teacher?.id === session?.id && (
                      <button
                        type="button"
                        onClick={() => onPublish(r.id)}
                        className="text-teal hover:text-coral-dark font-medium"
                      >
                        {t('publish')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <UploadReportCardModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            fetchReports();
          }}
        />
      )}
    </div>
  );
}

function UploadReportCardModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState('');
  const [term, setTerm] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [publishNow, setPublishNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchStudents() {
      try {
        const res = await api.get<{ data: StudentOption[] }>('/students?limit=200');
        setStudents(res.data);
      } catch (e) {
        toast(errorText(e, t('studentsFailed')), 'error');
      }
    }
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit() {
    if (!studentId || !term || !academicYear || !file) {
      toast(t('fillAll'), 'error');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(academicYear)) {
      toast(t('yearFormat'), 'error');
      return;
    }
    try {
      setSubmitting(true);
      const report = await api.post<{ id: string }>('/reports', {
        studentId,
        type: 'report_card',
        term,
        academicYear,
        content: {},
      });
      const uploaded = await apiUpload<{ key: string }>('/files/upload', file, {
        category: 'report_pdf',
        entityId: report.id,
      });
      await api.patch(`/reports/${report.id}`, { pdfKey: uploaded.key });
      if (publishNow) {
        await api.post(`/reports/${report.id}/publish`, {});
      }
      toast(t('uploaded'), 'success');
      onUploaded();
    } catch (e) {
      toast(errorText(e, t('uploadFailed')), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('uploadTitle')}>
      <div className="space-y-4">
        <Select
          label={t('student')} required
          placeholder={t('selectStudent')}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          options={students.map((s) => ({ value: s.id, label: `${s.name} (${s.admissionNo})` }))}
        />
        <Input label={t('term')} required value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('termPlaceholder')} />
        <Input
          label={t('academicYear')} required
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder={t('academicYearPlaceholder')}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{t('pdf')}<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          {t('publishNow')}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" loading={submitting} onClick={onSubmit}>
            {t('uploadSubmit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
