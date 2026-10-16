'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { EmployeeDetailModal } from './employee-detail-modal';
import { EmployeeFormModal } from './employee-form-modal';
import { FromUserModal } from './from-user-modal';
import { ImportModal } from './import-modal';
import { EMPLOYMENT_TYPES, Employee, Page } from './types';

const PAGE_SIZE = 25;

export function EmployeesTab() {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [type, setType] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Employee> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState<{ employee: Employee | null } | null>(null);
  const [fromUser, setFromUser] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    api.get<string[]>('/hrms/employees/departments').then(setDepartments).catch(() => undefined);
  }, [version]);

  useEffect(() => {
    const mine = ++requestId.current;
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search.trim()) q.set('search', search.trim());
    if (status) q.set('status', status);
    if (type) q.set('employmentType', type);
    if (department) q.set('department', department);
    const timer = setTimeout(() => {
      api
        .get<Page<Employee>>(`/hrms/employees?${q.toString()}`)
        .then((res) => {
          if (mine !== requestId.current) return;
          setData(res);
          setError(null);
        })
        .catch((e) => mine === requestId.current && setError(errorText(e)))
        .finally(() => mine === requestId.current && setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, type, department, page, version]);

  const refresh = () => setVersion((v) => v + 1);
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setForm({ employee: null })}>
          {t('addEmployee')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setFromUser(true)}>
          {t('fromStaffUser')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
          {t('importEmployees')}
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Input label={tCommon('search')} value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder={t('searchPlaceholder')} />
        <Select
          label={t('colStatus')}
          value={status}
          onChange={(e) => reset(setStatus)(e.target.value)}
          placeholder={tCommon('all')}
          options={[
            { value: 'ACTIVE', label: t('status.ACTIVE') },
            { value: 'EXITED', label: t('status.EXITED') },
          ]}
        />
        <Select
          label={t('colType')}
          value={type}
          onChange={(e) => reset(setType)(e.target.value)}
          placeholder={tCommon('all')}
          options={EMPLOYMENT_TYPES.map((x) => ({ value: x, label: t(`employmentType.${x}`) }))}
        />
        <Select
          label={t('colDepartment')}
          value={department}
          onChange={(e) => reset(setDepartment)(e.target.value)}
          placeholder={tCommon('all')}
          options={departments.map((d) => ({ value: d, label: d }))}
        />
      </div>

      {error && <p className="text-sm text-red-600">{tCommon('failedToLoad', { error })}</p>}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState title={t('noEmployees')} description={t('noEmployeesHelp')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('colCode')}</th>
                <th className="px-4 py-2">{t('colName')}</th>
                <th className="px-4 py-2">{t('colDesignation')}</th>
                <th className="px-4 py-2">{t('colDepartment')}</th>
                <th className="px-4 py-2">{t('colType')}</th>
                <th className="px-4 py-2">{t('colJoined')}</th>
                <th className="px-4 py-2">{t('colLogin')}</th>
                <th className="px-4 py-2">{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((e) => (
                <tr key={e.id} className="cursor-pointer hover:bg-teal/5" onClick={() => setDetailId(e.id)}>
                  <td className="px-4 py-2 font-mono text-xs">{e.employeeCode}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-2">{e.designation}</td>
                  <td className="px-4 py-2">{e.department ?? '—'}</td>
                  <td className="px-4 py-2">{t(`employmentType.${e.employmentType}`)}</td>
                  <td className="px-4 py-2">{formatDateOnly(e.joinDate)}</td>
                  <td className="px-4 py-2">{e.user ? e.user.name : t('noLogin')}</td>
                  <td className="px-4 py-2">
                    <Badge variant={e.status === 'ACTIVE' ? 'green' : 'gray'}>{t(`status.${e.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {tCommon('previous')}
          </Button>
          <span className="text-sm text-gray-500">{tCommon('pageOf', { page, total: totalPages })}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {tCommon('next')}
          </Button>
        </div>
      )}

      {form && (
        <EmployeeFormModal
          employee={form.employee}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
      {fromUser && (
        <FromUserModal
          onClose={() => setFromUser(false)}
          onSaved={() => {
            setFromUser(false);
            refresh();
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
      {detailId && (
        <EmployeeDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
          onEdit={(e) => {
            setDetailId(null);
            setForm({ employee: e });
          }}
        />
      )}
    </div>
  );
}
