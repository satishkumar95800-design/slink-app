'use client';

import { useEffect, useState } from 'react';
import { api, apiUpload, ApiError } from '../../../lib/api-client';
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
      setError((e as Error).message);
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
      toast('Report published', 'success');
      fetchReports();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not publish report', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{total} report{total !== 1 ? 's' : ''}</p>
        {isTeacher && (
          <Button type="button" onClick={() => setUploadOpen(true)}>
            Upload Report Card
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
          title="No reports"
          description="Progress reports created by teachers will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {['Term', 'Academic Year', 'Student', 'Type', 'Author', 'Status', 'Published', 'Created', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
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
                    <Badge variant={typeVariant(r.type)}>{r.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.teacher?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isTeacher && r.status === 'draft' && r.teacher?.id === session?.id && (
                      <button
                        type="button"
                        onClick={() => onPublish(r.id)}
                        className="text-teal hover:text-coral-dark font-medium"
                      >
                        Publish
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
        toast(e instanceof ApiError ? e.message : 'Could not load students', 'error');
      }
    }
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit() {
    if (!studentId || !term || !academicYear || !file) {
      toast('Fill in all fields and choose a PDF', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(academicYear)) {
      toast('Academic year must be in format YYYY-YY, e.g. 2026-27', 'error');
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
      toast('Report card uploaded', 'success');
      onUploaded();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not upload report card', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Upload Report Card">
      <div className="space-y-4">
        <Select
          label="Student" required
          placeholder="Select a student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          options={students.map((s) => ({ value: s.id, label: `${s.name} (${s.admissionNo})` }))}
        />
        <Input label="Term" required value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Term 1" />
        <Input
          label="Academic Year" required
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="e.g. 2026-27"
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Report Card (PDF)<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          Publish now (parent can see it immediately)
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={onSubmit}>
            Upload
          </Button>
        </div>
      </div>
    </Modal>
  );
}
