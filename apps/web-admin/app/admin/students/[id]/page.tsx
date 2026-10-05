'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../lib/api-client';
import { getSession } from '../../../../lib/auth';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { Spinner } from '../../../../components/ui/spinner';
import { useToast } from '../../../../components/ui/toast';

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  dob: string | null;
  photoUrl?: string | null;
  class?: { name: string; academicYear: string };
  parents?: Array<{
    relation: string;
    isPrimary: boolean;
    parent: { id: string; name: string; phone: string | null };
  }>;
}

type StudentNoteType = 'note' | 'mom' | 'complaint' | 'parent_discussion';

interface StudentNote {
  id: string;
  type: StudentNoteType;
  content: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
}

interface StudentFeeComponent {
  id: string;
  periodLabel: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  feeItem: { label: string };
}

interface StudentFee {
  id: string;
  feeStructure?: { name: string; academicYear: string };
  components: StudentFeeComponent[];
}

const NOTE_TYPE_LABELS: Record<StudentNoteType, string> = {
  note: 'Note',
  mom: 'Minutes of Meeting',
  complaint: 'Complaint',
  parent_discussion: 'Discussion with Parent',
};

function formatRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const feeStatusVariant = (s: string): 'green' | 'red' | 'yellow' | 'blue' | 'gray' => {
  const map: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
    paid: 'green', overdue: 'red', pending: 'yellow', partial: 'blue', waived: 'gray',
  };
  return map[s] ?? 'gray';
};

type Tab = 'overview' | 'notes' | 'fees';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  const role = getSession()?.role;
  const canSeeNotes = role === 'teacher' || role === 'admin' || role === 'super_admin';
  const canSeeFees = role === 'admin' || role === 'accounts' || role === 'super_admin';

  useEffect(() => {
    if (!id) return;
    async function fetchStudent() {
      try {
        setLoading(true);
        setStudent(await api.get<Student>(`/students/${id}`));
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not load student', 'error');
        router.push('/admin/students');
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !student) {
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  }

  const tabs: Tab[] = ['overview', ...(canSeeNotes ? (['notes'] as Tab[]) : []), ...(canSeeFees ? (['fees'] as Tab[]) : [])];
  const tabLabel: Record<Tab, string> = { overview: 'Overview', notes: 'Notes', fees: 'Fee Summary' };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          onClick={() => router.push('/admin/students')}
          className="mb-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          ← All students
        </button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500">
                {student.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{student.name}</h1>
            <p className="text-xs text-gray-500">
              {student.admissionNo}
              {student.class ? ` · ${student.class.name} · ${student.class.academicYear}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === t ? 'border-coral text-teal' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab student={student} />}
      {tab === 'notes' && canSeeNotes && <NotesTab studentId={student.id} />}
      {tab === 'fees' && canSeeFees && <FeeSummaryTab studentId={student.id} />}
    </div>
  );
}

function OverviewTab({ student }: { student: Student }) {
  const primaryParent = student.parents?.find((p) => p.isPrimary) ?? student.parents?.[0];
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-sm text-gray-500">Admission Number</p>
        <p className="text-base font-medium text-gray-900">{student.admissionNo}</p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-sm text-gray-500">Class</p>
        <p className="text-base font-medium text-gray-900">
          {student.class ? `${student.class.name} · ${student.class.academicYear}` : '—'}
        </p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-sm text-gray-500">Date of Birth</p>
        <p className="text-base font-medium text-gray-900">
          {student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : '—'}
        </p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-sm text-gray-500">Primary Parent</p>
        <p className="text-base font-medium text-gray-900">
          {primaryParent ? `${primaryParent.parent.name} (${primaryParent.relation})` : '—'}
        </p>
        <p className="text-xs text-gray-500">{primaryParent?.parent.phone ?? ''}</p>
      </div>
    </div>
  );
}

function NotesTab({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<StudentNoteType>('note');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchNotes() {
    try {
      setLoading(true);
      setNotes(await api.get<StudentNote[]>(`/student-notes?studentId=${studentId}`));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load notes', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function onSubmit() {
    if (!content.trim()) {
      toast('Enter some content first', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.post('/student-notes', { studentId, type, content: content.trim() });
      setContent('');
      toast('Entry added', 'success');
      fetchNotes();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add entry', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <div className="max-w-xs">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as StudentNoteType)}
            options={Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <label htmlFor="student-note" className="block text-sm font-medium text-gray-700">
          Note<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="student-note"
          aria-required="true"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here…"
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-coral focus:ring-1 focus:ring-coral"
        />
        <Button type="button" loading={saving} onClick={onSubmit}>
          Add Entry
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : notes.length === 0 ? (
        <p className="p-4 text-center text-sm text-gray-500">No entries yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
              <div className="flex items-center justify-between">
                <Badge variant="blue">{NOTE_TYPE_LABELS[n.type]}</Badge>
                <span className="text-xs text-gray-500">
                  {n.author.name} · {new Date(n.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeeSummaryTab({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFees() {
      try {
        setLoading(true);
        const res = await api.get<{ data: StudentFee[] }>(`/student-fees?studentId=${studentId}&limit=100`);
        setFees(res.data);
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not load fee summary', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  }

  if (fees.length === 0) {
    return <p className="p-4 text-center text-sm text-gray-500">No fee structures assigned yet.</p>;
  }

  const grandTotalDue = fees.reduce((s, f) => s + f.components.reduce((cs, c) => cs + c.amountDue, 0), 0);
  const grandTotalPaid = fees.reduce((s, f) => s + f.components.reduce((cs, c) => cs + c.amountPaid, 0), 0);

  return (
    <div className="space-y-4">
      {fees.map((f) => (
        <div key={f.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {f.feeStructure?.name ?? 'Fee Structure'} · {f.feeStructure?.academicYear}
            </h3>
          </div>
          <div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-cream/60">
              <tr>
                {['Component', 'Period', 'Due Date', 'Due', 'Paid', 'Pending', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {f.components.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{c.feeItem.label}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{c.periodLabel}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{new Date(c.dueDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatRupees(c.amountDue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatRupees(c.amountPaid)}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    {formatRupees(Math.max(0, c.amountDue - c.amountPaid))}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={feeStatusVariant(c.status)}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between rounded-lg border border-teal/30 bg-teal/5 px-5 py-4">
        <span className="text-sm font-semibold text-teal">Yearly Total</span>
        <div className="flex gap-6 text-sm">
          <span className="text-teal">Due: <strong>{formatRupees(grandTotalDue)}</strong></span>
          <span className="text-teal">Paid: <strong>{formatRupees(grandTotalPaid)}</strong></span>
          <span className="text-teal">Pending: <strong>{formatRupees(Math.max(0, grandTotalDue - grandTotalPaid))}</strong></span>
        </div>
      </div>
    </div>
  );
}
