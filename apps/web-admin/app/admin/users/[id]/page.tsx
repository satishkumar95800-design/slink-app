'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useErrorText } from '../../../../lib/i18n/errors';
import { roleLabel } from '../../../../lib/i18n/labels';
import { formatDate } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';

interface UserDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  profession: string | null;
  createdAt: string;
  linkedStudents: Array<{
    relation: string;
    isPrimary: boolean;
    student: {
      id: string;
      name: string;
      admissionNo: string;
      class: { name: string; section: string | null; academicYear: string } | null;
    };
  }>;
}

const RELATIONS = ['father', 'mother', 'guardian'] as const;

/** A parent (or staff member): contact details and, for parents, their children. */
export default function UserDetailPage() {
  const t = useTranslations('userDetail');
  const tRoles = useTranslations('roles');
  const tRelation = useTranslations('relation');
  const errorText = useErrorText();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserDetail>(`/users/${id}`)
      .then(setUser)
      .catch((e) => setError(errorText(e, t('couldNotLoad'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const back = (
    <button onClick={() => router.back()} className="mb-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700">
      {t('back')}
    </button>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        {back}
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  }

  const fields: Array<[string, string | null]> = [
    [t('phone'), user.phone],
    [t('email'), user.email],
    [t('profession'), user.profession],
    [t('joined'), formatDate(user.createdAt)],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-sm font-semibold text-gray-500">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{user.name}</h1>
          <Badge variant="gray">{roleLabel(tRoles, user.role)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="break-words text-base font-medium text-gray-900">{value || '—'}</p>
          </div>
        ))}
      </div>

      {(user.role === 'parent' || user.linkedStudents.length > 0) && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-teal">
            {t('wards', { count: user.linkedStudents.length })}
          </h2>
          {user.linkedStudents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">{t('noWards')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {user.linkedStudents.map(({ student, relation }) => (
                <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                  <div>
                    <Link href={`/admin/students/${student.id}`} className="font-medium text-teal hover:underline">
                      {student.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {student.admissionNo}
                      {student.class
                        ? ` · ${student.class.name}${student.class.section ? ` ${student.class.section}` : ''} · ${student.class.academicYear}`
                        : ''}
                    </p>
                  </div>
                  {RELATIONS.some((r) => r === relation) && (
                    <Badge variant="gray">{tRelation(relation as (typeof RELATIONS)[number])}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
