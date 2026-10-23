'use client';

import { BellRing, CalendarHeart, CalendarOff, Globe, Hash, ImageIcon, ListPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { nativeName } from '../../../lib/i18n/languages';
import { useLanguage } from '../../../lib/i18n/provider';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../components/ui/toast';
import { getSession } from '../../../lib/auth';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { AdmissionNumbering, AdmissionNumberingSection } from './admission-numbering-section';
import { BellSchedulesSection } from './bell-schedules';
import { CustomFieldsSection, FieldDefinition } from './custom-fields-section';
import { EventsSection } from './events-section';
import { Holiday, HolidaysSection } from './holidays-section';
import { SettingsGroup, SettingsSection } from './settings-section';

interface TenantSelf {
  id: string;
  name: string;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
}

interface UploadResult {
  key: string;
  publicUrl: string | null;
}

type SectionId = 'language' | 'branding' | 'admissionNo' | 'fields' | 'holidays' | 'events' | 'bells';
const SECTION_IDS: SectionId[] = ['language', 'branding', 'admissionNo', 'fields', 'holidays', 'events', 'bells'];

/** What the collapsed rows show; filled by small fetches when the page opens. */
interface Summaries {
  fields?: FieldDefinition[];
  holidays?: Holiday[];
  upcomingEvents?: number;
  openConsents?: number;
  periods?: number;
  classGroups?: number;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Opened sections live in the URL hash (#holidays,events) so a link or a reload keeps them open. */
function readHash(): Set<SectionId> {
  if (typeof window === 'undefined') return new Set();
  const ids = window.location.hash.replace(/^#/, '').split(',');
  return new Set(SECTION_IDS.filter((id) => ids.includes(id)));
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tHolidays = useTranslations('holidays');
  const tFields = useTranslations('customFields');
  const tEvents = useTranslations('schoolEvents');
  const tBells = useTranslations('periodTimings');
  const { features, loaded } = useTenantFeaturesState();
  const { calendar, timetable } = features;
  const { language } = useLanguage();
  const isAdmin = getSession()?.role === 'admin';

  const [tenant, setTenant] = useState<TenantSelf | null>(null);
  const [open, setOpen] = useState<Set<SectionId>>(new Set());
  const [summaries, setSummaries] = useState<Summaries>({});
  const [numbering, setNumbering] = useState<AdmissionNumbering | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL hash after hydration
    setOpen(readHash());
    api.get<TenantSelf>('/tenant').then(setTenant).catch(() => setTenant(null));
  }, []);

  const loadFields = useCallback(() => {
    api.get<FieldDefinition[]>('/custom-field-definitions').then((fields) => setSummaries((s) => ({ ...s, fields }))).catch(() => {});
  }, []);
  const loadHolidays = useCallback(() => {
    api.get<Holiday[]>('/attendance/holidays').then((holidays) => setSummaries((s) => ({ ...s, holidays }))).catch(() => {});
  }, []);
  const loadEvents = useCallback(() => {
    const today = todayYmd();
    api
      .get<{ startDate: string; endDate: string | null }[]>('/calendar/events')
      .then((list) =>
        setSummaries((s) => ({ ...s, upcomingEvents: list.filter((e) => (e.endDate ?? e.startDate) >= today).length })),
      )
      .catch(() => {});
    api
      .get<{ open: boolean }[]>('/consent-forms')
      .then((list) => setSummaries((s) => ({ ...s, openConsents: list.filter((c) => c.open).length })))
      .catch(() => {});
  }, []);
  const loadBells = useCallback(() => {
    api
      .get<unknown[]>('/timetable/period-timings')
      .then((list) => setSummaries((s) => ({ ...s, periods: list.length })))
      .catch(() => {});
    api
      .get<{ classId: string; periodNumber: number; startTime: string; endTime: string }[]>('/timetable/class-period-timings')
      .then((list) => {
        // Classes sharing the same times form one group, as the section shows them.
        const byClass = new Map<string, string[]>();
        for (const r of list) byClass.set(r.classId, [...(byClass.get(r.classId) ?? []), `${r.periodNumber}-${r.startTime}-${r.endTime}`]);
        const groups = new Set([...byClass.values()].map((v) => v.sort().join('|')));
        setSummaries((s) => ({ ...s, classGroups: groups.size }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded || !isAdmin) return;
    api.get<AdmissionNumbering>('/students/admission-numbering').then(setNumbering).catch(() => {});
    loadFields();
    loadHolidays();
    if (calendar) loadEvents();
    if (timetable) loadBells();
  }, [loaded, isAdmin, calendar, timetable, loadFields, loadHolidays, loadEvents, loadBells]);

  function toggle(id: SectionId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const hash = SECTION_IDS.filter((x) => next.has(x)).join(',');
      window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
      return next;
    });
  }

  const today = todayYmd();
  const nextHoliday = summaries.holidays?.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

  const fieldsSummary = !summaries.fields
    ? null
    : summaries.fields.length === 0
      ? t('summaryFieldsNone')
      : t('summaryFields', { count: summaries.fields.length, names: summaries.fields.map((f) => f.label).join(', ') });

  const holidaysSummary = !summaries.holidays
    ? null
    : summaries.holidays.length === 0
      ? t('summaryHolidaysNone')
      : nextHoliday
        ? t('summaryHolidaysNext', {
            count: summaries.holidays.length,
            name: nextHoliday.name,
            date: formatDateOnly(nextHoliday.date),
          })
        : t('summaryHolidays', { count: summaries.holidays.length });

  const eventsSummary =
    summaries.upcomingEvents === undefined
      ? null
      : [
          summaries.upcomingEvents === 0 ? t('summaryEventsNone') : t('summaryEvents', { count: summaries.upcomingEvents }),
          ...(summaries.openConsents ? [t('summaryConsentsOpen', { count: summaries.openConsents })] : []),
        ].join(' · ');

  const bellsSummary =
    summaries.periods === undefined
      ? null
      : [
          summaries.periods === 0 ? t('summaryPeriodsNone') : t('summaryPeriods', { count: summaries.periods }),
          ...(summaries.classGroups ? [t('summaryClassTimes', { count: summaries.classGroups })] : []),
        ].join(' · ');

  const section = (id: SectionId) => ({ id, open: open.has(id), onToggle: () => toggle(id) });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('pageHelp')}</p>
      </div>

      <SettingsGroup title={t('groupAccount')}>
        <SettingsSection
          {...section('language')}
          icon={<Globe className="h-5 w-5" />}
          accent="bg-sky-50 text-sky-700"
          title={t('yourLanguage')}
          summary={nativeName(language)}
          help={t('yourLanguageHelp')}
        >
          <LanguageSwitcher signedIn />
        </SettingsSection>
      </SettingsGroup>

      <SettingsGroup title={t('groupSchool')}>
        <SettingsSection
          {...section('branding')}
          icon={<ImageIcon className="h-5 w-5" />}
          accent="bg-coral/10 text-coral-dark"
          title={t('branding')}
          summary={tenant ? (tenant.backgroundImageUrl ? t('summaryBackgroundSet') : t('noBackground')) : null}
          help={t('brandingHelp')}
        >
          <BrandingBody tenant={tenant} onChange={setTenant} canChange={loaded && !!features.customBranding} />
        </SettingsSection>
      </SettingsGroup>

      {isAdmin && (
        <SettingsGroup title={t('groupStudents')}>
          <SettingsSection
            {...section('admissionNo')}
            icon={<Hash className="h-5 w-5" />}
            accent="bg-amber-50 text-amber-700"
            title={t('admissionNumbers')}
            summary={numbering ? (numbering.numbering ? t('summaryAdmissionNext', { next: numbering.upcoming[0] ?? '' }) : t('summaryAdmissionManual')) : null}
            help={t('admissionNumbersHelp')}
          >
            <AdmissionNumberingSection data={numbering} onSaved={setNumbering} />
          </SettingsSection>
          <SettingsSection
            {...section('fields')}
            icon={<ListPlus className="h-5 w-5" />}
            accent="bg-violet-50 text-violet-700"
            title={tFields('sectionTitle')}
            summary={fieldsSummary}
            help={tFields('sectionHelp')}
          >
            <CustomFieldsSection onChanged={loadFields} />
          </SettingsSection>
        </SettingsGroup>
      )}

      {isAdmin && (
        <SettingsGroup title={t('groupCalendar')}>
          <SettingsSection
            {...section('holidays')}
            icon={<CalendarOff className="h-5 w-5" />}
            accent="bg-amber-50 text-amber-700"
            title={tHolidays('sectionTitle')}
            summary={holidaysSummary}
            help={tHolidays('sectionHelp')}
          >
            <HolidaysSection onChanged={loadHolidays} />
          </SettingsSection>
          {calendar && (
            <SettingsSection
              {...section('events')}
              icon={<CalendarHeart className="h-5 w-5" />}
              accent="bg-rose-50 text-rose-700"
              title={tEvents('sectionTitle')}
              summary={eventsSummary}
              help={tEvents('sectionHelp')}
            >
              <EventsSection onChanged={loadEvents} />
            </SettingsSection>
          )}
        </SettingsGroup>
      )}

      {isAdmin && timetable && (
        <SettingsGroup title={t('groupTimetable')}>
          <SettingsSection
            {...section('bells')}
            icon={<BellRing className="h-5 w-5" />}
            accent="bg-emerald-50 text-emerald-700"
            title={tBells('title')}
            summary={bellsSummary}
            help={tBells('help')}
          >
            <BellSchedulesSection onChanged={loadBells} />
          </SettingsSection>
        </SettingsGroup>
      )}
    </div>
  );
}

/** Background image preview and upload (needs the customBranding plan flag). */
function BrandingBody({
  tenant,
  onChange,
  canChange,
}: {
  tenant: TenantSelf | null;
  onChange: (t: TenantSelf) => void;
  canChange: boolean;
}) {
  const t = useTranslations('settings');
  const tPlans = useTranslations('plans');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await apiUpload<UploadResult>('/files/upload', file, { category: 'background' });
      onChange(await api.patch<TenantSelf>('/tenant', { backgroundImageKey: uploaded.key }));
      toast(t('backgroundUpdated'), 'success');
    } catch (err) {
      toast(errorText(err, t('uploadFailed')), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      {tenant?.backgroundImageUrl ? (
        <img src={tenant.backgroundImageUrl} alt={t('backgroundAlt')} className="h-48 w-full rounded-xl border object-cover" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed text-sm text-gray-400">
          {t('noBackground')}
        </div>
      )}
      {!canChange ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{tPlans('brandingOff')}</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="block text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal hover:file:bg-teal/20"
            />
            {uploading && (
              <Button loading disabled>
                {t('uploading')}
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">{t('fileHint')}</p>
        </>
      )}
    </div>
  );
}
