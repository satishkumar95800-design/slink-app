'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { feeStatusLabel, paymentMethodLabel } from '../../../lib/i18n/labels';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { formatDateOnly, formatRupees } from '../../../lib/format';

type ReportType =
  | 'fee-pending'
  | 'paid-history'
  | 'defaulters'
  | 'students-in-class'
  | 'class-collection-summary'
  | 'collection-register'
  | 'student-fee-summary';

interface Class {
  id: string;
  name: string;
  academicYear: string;
}

/** Report type → its label key in messages "feeReports". */
const REPORT_OPTIONS = [
  { value: 'fee-pending', labelKey: 'typeFeePending' },
  { value: 'paid-history', labelKey: 'typePaidHistory' },
  { value: 'defaulters', labelKey: 'typeDefaulters' },
  { value: 'students-in-class', labelKey: 'typeStudentsInClass' },
  { value: 'class-collection-summary', labelKey: 'typeClassSummary' },
  { value: 'collection-register', labelKey: 'typeRegister' },
  { value: 'student-fee-summary', labelKey: 'typeStudentSummary' },
] as const satisfies readonly { value: ReportType; labelKey: string }[];

export default function FeeReportsPage() {
  const t = useTranslations('feeReports');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('fee-pending');
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
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
      if (academicYear) params.set('academicYear', academicYear);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<{ data: Record<string, unknown>[] }>(
        `/insights/${reportType}?${params.toString()}`,
      );
      setRows(res.data);
    } catch (e) {
      setError(errorText(e));
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
      if (academicYear) params.set('academicYear', academicYear);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      await apiDownload(`/insights/${reportType}?${params.toString()}`, `${reportType}.csv`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} (${c.academicYear})` }));
  const showDateRange = ['paid-history', 'class-collection-summary', 'collection-register'].includes(reportType);
  const showClassFilter = reportType !== 'collection-register';
  const showAcademicYearFilter = ['class-collection-summary', 'student-fee-summary'].includes(reportType);
  const supportsCsvExport = reportType !== 'students-in-class';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="w-full sm:w-64">
          <Select
            label={t('report')}
            options={REPORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          />
        </div>
        {showClassFilter && (
          <div className="w-full sm:w-56">
            <Select
              label={t('class')}
              options={classOptions}
              placeholder={t('allClasses')}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            />
          </div>
        )}
        {showAcademicYearFilter && (
          <div className="w-full sm:w-40">
            <Input
              label={t('academicYear')}
              placeholder={t('academicYearPlaceholder')}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
        )}
        {showDateRange && (
          <>
            <Input label={t('from')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label={t('to')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </>
        )}
        <Button onClick={runReport}>{t('run')}</Button>
        {supportsCsvExport && (
          <Button variant="secondary" onClick={exportCsv}>
            {t('exportCsv')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <ReportTable reportType={reportType} rows={rows} />
      )}
    </div>
  );
}

function ReportTable({ reportType, rows }: { reportType: ReportType; rows: Record<string, unknown>[] }) {
  const t = useTranslations('feeReports');
  const tStatus = useTranslations('feeStatus');
  const tMethod = useTranslations('paymentMethod');
  if (reportType === 'fee-pending' || reportType === 'defaulters') {
    return (
      <Table
        headers={[t('colStudent'), t('colClass'), t('colFee'), t('colDue'), t('colPaid'), t('colBalance'), t('colStatus'), t('colDueDate')]}
        rows={rows}
        render={(f: any) => [
          f.student?.name ?? '—',
          f.student?.class?.name ?? '—',
          f.feeStructure?.name ?? '—',
          formatRupees(f.amountDue),
          formatRupees(f.amountPaid),
          formatRupees(Math.max(0, parseFloat(f.amountDue) - parseFloat(f.amountPaid))),
          feeStatusLabel(tStatus, f.status),
          formatDateOnly(f.dueDate),
        ]}
      />
    );
  }

  if (reportType === 'paid-history') {
    return (
      <Table
        headers={[t('colReceiptNo'), t('colStudent'), t('colClass'), t('colFee'), t('colAmount'), t('colMethod'), t('colPaidOn')]}
        rows={rows}
        render={(r: any) => [
          r.receiptNumber,
          r.student?.name ?? '—',
          r.class?.name ?? '—',
          r.studentFee?.feeStructure?.name ?? '—',
          formatRupees(r.amount),
          paymentMethodLabel(tMethod, r.method),
          formatDateOnly(r.paidOn),
        ]}
      />
    );
  }

  if (reportType === 'students-in-class') {
    return (
      <Table
        headers={[t('colAdmissionNo'), t('colName'), t('colDob')]}
        rows={rows}
        render={(s: any) => [
          s.admissionNo,
          s.name,
          s.dob ? formatDateOnly(s.dob) : '—',
        ]}
      />
    );
  }

  if (reportType === 'student-fee-summary') {
    return (
      <Table
        headers={[t('colStudent'), t('colClass'), t('colTotalDue'), t('colTotalCollected'), t('colOutstanding')]}
        rows={rows}
        render={(s: any) => [
          `${s.studentName}${s.admissionNo ? ` (${s.admissionNo})` : ''}`,
          s.class ? `${s.class.name}${s.class.section ? ` (${s.class.section})` : ''}` : '—',
          formatRupees(s.totalDue),
          formatRupees(s.totalCollected),
          formatRupees(s.outstanding),
        ]}
      />
    );
  }

  if (reportType === 'class-collection-summary') {
    return (
      <Table
        headers={[t('colClass'), t('colAcademicYear'), t('colExpected'), t('colCollected'), t('colOutstanding')]}
        rows={rows}
        render={(c: any) => [
          `${c.className}${c.section ? ` (${c.section})` : ''}`,
          c.academicYear,
          formatRupees(c.expected),
          formatRupees(c.collected),
          formatRupees(c.outstanding),
        ]}
      />
    );
  }

  // collection-register
  return (
    <Table
      headers={[t('colDate'), t('colMethod'), t('colTotalAmount'), t('colCount')]}
      rows={rows}
      render={(g: any) => [
        formatDateOnly(g.date),
        paymentMethodLabel(tMethod, g.method),
        formatRupees(g.totalAmount),
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
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-cream/60">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
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
