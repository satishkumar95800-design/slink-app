'use client';

import { useEffect, useState } from 'react';
import { api, apiDownload, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

type ReportType =
  | 'fee-pending'
  | 'paid-history'
  | 'defaulters'
  | 'students-in-class'
  | 'class-collection-summary'
  | 'collection-register';

interface Class {
  id: string;
  name: string;
  academicYear: string;
}

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'fee-pending', label: 'Students with Fee Pending' },
  { value: 'paid-history', label: 'Paid Fee History' },
  { value: 'defaulters', label: 'Defaulters (Overdue)' },
  { value: 'students-in-class', label: 'Students in a Class' },
  { value: 'class-collection-summary', label: 'Class-wise Collection Summary' },
  { value: 'collection-register', label: 'Daily Collection Register' },
];

function formatCurrency(amount: number | string | null | undefined) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (n == null || Number.isNaN(n)) {
    return '₹0.00';
  }
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function FeeReportsPage() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('fee-pending');
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Class[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  async function runReport() {
    try {
      setLoading(true);
      setError(null);
      if (reportType === 'students-in-class') {
        if (!classId) {
          setRows([]);
          return;
        }
        const res = await api.get<{ data: Record<string, unknown>[] }>(
          `/students?classId=${classId}&limit=200`,
        );
        setRows(res.data);
        return;
      }

      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{ data: Record<string, unknown>[] }>(
        `/insights/${reportType}?${params.toString()}`,
      );
      setRows(res.data);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  async function exportCsv() {
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (classId) params.set('classId', classId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      await apiDownload(`/insights/${reportType}?${params.toString()}`, `${reportType}.csv`);
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear})` }));
  const showDateRange = ['paid-history', 'class-collection-summary', 'collection-register'].includes(reportType);
  const showClassFilter = reportType !== 'collection-register';
  const supportsCsvExport = reportType !== 'students-in-class';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="w-64">
          <Select
            label="Report"
            options={REPORT_OPTIONS}
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          />
        </div>
        {showClassFilter && (
          <div className="w-56">
            <Select
              label="Class (optional)"
              options={classOptions}
              placeholder="All classes"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            />
          </div>
        )}
        {showDateRange && (
          <>
            <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </>
        )}
        <Button onClick={runReport}>Run Report</Button>
        {supportsCsvExport && (
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No data" description="No records match this report's filters." />
      ) : (
        <ReportTable reportType={reportType} rows={rows} />
      )}
    </div>
  );
}

function ReportTable({ reportType, rows }: { reportType: ReportType; rows: Record<string, unknown>[] }) {
  if (reportType === 'fee-pending' || reportType === 'defaulters') {
    return (
      <Table
        headers={['Student', 'Class', 'Fee', 'Due', 'Paid', 'Balance', 'Status', 'Due Date']}
        rows={rows}
        render={(f: any) => [
          f.student?.name ?? '—',
          f.student?.class?.name ?? '—',
          f.feeStructure?.name ?? '—',
          formatCurrency(f.amountDue),
          formatCurrency(f.amountPaid),
          formatCurrency(Math.max(0, parseFloat(f.amountDue) - parseFloat(f.amountPaid))),
          f.status,
          new Date(f.dueDate).toLocaleDateString('en-IN'),
        ]}
      />
    );
  }

  if (reportType === 'paid-history') {
    return (
      <Table
        headers={['Receipt No.', 'Student', 'Class', 'Fee', 'Amount', 'Method', 'Paid On']}
        rows={rows}
        render={(r: any) => [
          r.receiptNumber,
          r.student?.name ?? '—',
          r.class?.name ?? '—',
          r.studentFee?.feeStructure?.name ?? '—',
          formatCurrency(r.amount),
          r.method,
          new Date(r.paidOn).toLocaleDateString('en-IN'),
        ]}
      />
    );
  }

  if (reportType === 'students-in-class') {
    return (
      <Table
        headers={['Admission No', 'Name', 'Date of Birth']}
        rows={rows}
        render={(s: any) => [
          s.admissionNo,
          s.name,
          s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—',
        ]}
      />
    );
  }

  if (reportType === 'class-collection-summary') {
    return (
      <Table
        headers={['Class', 'Academic Year', 'Expected', 'Collected', 'Outstanding']}
        rows={rows}
        render={(c: any) => [
          `${c.className}${c.section ? ` (${c.section})` : ''}`,
          c.academicYear,
          formatCurrency(c.expected),
          formatCurrency(c.collected),
          formatCurrency(c.outstanding),
        ]}
      />
    );
  }

  // collection-register
  return (
    <Table
      headers={['Date', 'Method', 'Total Amount', 'Count']}
      rows={rows}
      render={(g: any) => [
        new Date(g.date).toLocaleDateString('en-IN'),
        g.method,
        formatCurrency(g.totalAmount),
        g.count,
      ]}
    />
  );
}

function Table({
  headers,
  rows,
  render,
}: {
  headers: string[];
  rows: Record<string, unknown>[];
  render: (row: any) => (string | number)[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50 transition-colors">
              {render(row).map((cell, cellIdx) => (
                <td key={cellIdx} className="px-6 py-4 text-sm text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
