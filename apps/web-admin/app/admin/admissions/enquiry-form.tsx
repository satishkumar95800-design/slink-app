'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Enquiry, SOURCES, Source } from './types';

export interface FormValues {
  childName: string;
  dob: string;
  classSought: string;
  parentName: string;
  phone: string;
  email: string;
  source: Source | '';
  tourOn: string;
  nextFollowUpOn: string;
  notes: string;
}

export const emptyForm = (e?: Enquiry): FormValues => ({
  childName: e?.childName ?? '',
  dob: e?.dob ?? '',
  classSought: e?.classSought ?? '',
  parentName: e?.parentName ?? '',
  phone: e?.phone ?? '',
  email: e?.email ?? '',
  source: e?.source ?? '',
  tourOn: e?.tourOn ?? '',
  nextFollowUpOn: e?.nextFollowUpOn ?? '',
  notes: e?.notes ?? '',
});

export const formValid = (f: FormValues) =>
  !!f.childName.trim() && !!f.parentName.trim() && /^[0-9+\-\s()]{6,20}$/.test(f.phone.trim()) && !!f.source;

/** The enquiry's fields, shared by "Add enquiry" and the detail drawer. */
export function EnquiryFields({ value, onChange, showTour }: { value: FormValues; onChange: (v: FormValues) => void; showTour?: boolean }) {
  const t = useTranslations('admissions');
  const set = (patch: Partial<FormValues>) => onChange({ ...value, ...patch });
  const [touched, setTouched] = useState(false);
  return (
    <div className="grid gap-3 sm:grid-cols-2" onBlur={() => setTouched(true)}>
      <Input label={t('childName')} required maxLength={100} value={value.childName} onChange={(e) => set({ childName: e.target.value })} />
      <Input label={t('classSought')} maxLength={50} value={value.classSought} onChange={(e) => set({ classSought: e.target.value })} placeholder={t('classSoughtPlaceholder')} />
      <Input label={t('dob')} type="date" value={value.dob} onChange={(e) => set({ dob: e.target.value })} />
      <Select
        label={t('source')}
        required
        value={value.source}
        onChange={(e) => set({ source: e.target.value as Source })}
        placeholder={t('chooseSource')}
        options={SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))}
      />
      <Input label={t('parentName')} required maxLength={100} value={value.parentName} onChange={(e) => set({ parentName: e.target.value })} />
      <Input
        label={t('phone')}
        required
        type="tel"
        maxLength={20}
        value={value.phone}
        onChange={(e) => set({ phone: e.target.value })}
        error={touched && value.phone && !/^[0-9+\-\s()]{6,20}$/.test(value.phone.trim()) ? t('phoneInvalid') : undefined}
      />
      <Input label={t('email')} type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} />
      <Input label={t('nextFollowUp')} type="date" value={value.nextFollowUpOn} onChange={(e) => set({ nextFollowUpOn: e.target.value })} />
      {showTour && <Input label={t('tourOn')} type="date" value={value.tourOn} onChange={(e) => set({ tourOn: e.target.value })} />}
      <div className="sm:col-span-2">
        <Input label={t('notes')} maxLength={1000} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}

/** Body for POST (create) or PATCH (edit): empty optional fields become null on edit. */
export function toBody(f: FormValues, editing: boolean) {
  const opt = (v: string) => (v.trim() ? v.trim() : editing ? null : undefined);
  return {
    childName: f.childName.trim(),
    dob: opt(f.dob),
    classSought: opt(f.classSought),
    parentName: f.parentName.trim(),
    phone: f.phone.trim(),
    email: opt(f.email),
    source: f.source,
    ...(editing ? { tourOn: opt(f.tourOn) } : {}),
    nextFollowUpOn: opt(f.nextFollowUpOn),
    notes: opt(f.notes),
  };
}
