'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  FileX2,
  Sparkles,
  CalendarDays,
  ChartPie,
  ClipboardCheck,
  GraduationCap,
  Hourglass,
  LayoutGrid,
  ListChecks,
  Megaphone,
  ReceiptIndianRupee,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';
import { Drawer } from '../../components/ui/drawer';
import { getSession } from '../../lib/auth';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatDateOnly, formatMonthYear, formatRupees, toAmount, weekdayName } from '../../lib/format';
import { useErrorText } from '../../lib/i18n/errors';
import { reportTypeLabel } from '../../lib/i18n/labels';
import { useTenantFeatures } from '../../lib/tenant-features';
import { NotifyClassesForm } from './notify-classes';
import { TransferCertificateReport } from './transfer-certificates-report';
import { AlertReason, AlertsBanner, AlertsList, useAlerts } from './alerts-panel';
import { AskBox, AssistantThread } from './assistant-panel';
import { AttendanceSplit, ChartCard, FeeDonut, HBarChart, Ring, TrendChart } from './dashboard-charts';
import { SyllabusRoadmap, SyllabusSummary, syllabusCounts } from './syllabus-panel';
import { HeadOfficeCirculars } from './circulars-card';
import type { OverviewRow as SyllabusRow } from './syllabus/types';

interface Stats {
  userCount: number;
  studentCount: number;
  feesCollected: number;
  feesOutstanding: number;
  feesAcademicYear: string | null;
  recentPayments: RecentPayment[];
}

interface RecentPayment {
  id: string;
  studentName: string;
  amount: number | string;
  method: string;
  source?: 'claim' | 'direct';
  paidOn: string;
}

interface SchoolAttendanceSummary {
  date: string;
  holiday: { name: string } | null;
  totalStudents: number;
  daysMarked: number;
  daysPresent: number;
  percentage: number | null;
  notMarked: { classId: string; name: string; section: string | null }[];
}

interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  classCount: number;
  subjectCount: number;
  weeklyPeriods: number;
  reportsSent: number;
  reportsUnread: number;
}

interface CollectionForecast {
  months: { month: string; actual: number }[];
  projectedNextMonth: number;
  label: string;
}

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  periodNumber: number;
  subject: { id: string; name: string };
  class: { id: string; name: string; section: string };
}

interface MyClass {
  class: { id: string; name: string; section: string };
  strength: { male: number; female: number; other: number; unspecified: number; total: number };
  subjects: { id: string; name: string }[];
  recentReports: {
    id: string;
    type: string;
    term: string | null;
    createdAt: string;
    studentName: string;
    readByAnyParent: boolean;
  }[];
}

/** Admin/accounts dashboard layout, remembered in this browser. */
type DashboardView = 'cards' | 'charts';
const VIEW_KEY = 'slink_dashboard_view';

function readView(): DashboardView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'charts' ? 'charts' : 'cards';
  } catch {
    return 'cards';
  }
}

type PanelKey = 'notify' | 'attendance' | 'workload' | 'forecast' | 'payments' | 'routine' | 'classes' | 'tc' | 'insights' | 'ask' | 'syllabus';

/** Colours per section: icon square, and the soft glow in the card's corner. */
const ACCENTS = {
  coral: { chip: 'bg-coral/10 text-coral', glow: 'from-coral/20' },
  emerald: { chip: 'bg-emerald-100 text-emerald-700', glow: 'from-emerald-200/60' },
  violet: { chip: 'bg-violet-100 text-violet-700', glow: 'from-violet-200/60' },
  teal: { chip: 'bg-teal/10 text-teal', glow: 'from-teal/15' },
  amber: { chip: 'bg-amber-100 text-amber-700', glow: 'from-amber-200/60' },
  sky: { chip: 'bg-sky-100 text-sky-700', glow: 'from-sky-200/60' },
  indigo: { chip: 'bg-indigo-100 text-indigo-700', glow: 'from-indigo-200/60' },
  rose: { chip: 'bg-rose-100 text-rose-700', glow: 'from-rose-200/60' },
} as const;
type Accent = keyof typeof ACCENTS;

/** 1 = Monday … 7 = Sunday, matching timetable dayOfWeek. */
function todayWeekday(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function StatCard({
  label,
  value,
  icon,
  accent,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent: Accent;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${ACCENTS[accent].chip}`}>{icon}</div>
      </div>
      <p className="mt-2 text-lg font-extrabold tracking-tight text-gray-900 sm:text-2xl">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

/** A section of the dashboard: a headline number and a line of context. Opens the full view. */
function FeatureCard({
  icon,
  title,
  value,
  caption,
  accent,
  featured,
  loading,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  value?: string;
  caption?: string;
  accent: Accent;
  /** The main action: filled coral card. */
  featured?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[168px] cursor-pointer flex-col overflow-hidden rounded-3xl p-5 text-left transition duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 ${
        featured
          ? 'bg-gradient-to-br from-coral to-coral-dark text-white shadow-lg shadow-coral/25 hover:shadow-xl hover:shadow-coral/30'
          : 'border border-black/5 bg-white shadow-sm hover:shadow-xl hover:shadow-teal/5'
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-125 ${
          featured ? 'bg-white/20' : `bg-gradient-to-br ${ACCENTS[accent].glow} to-transparent`
        }`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${featured ? 'bg-white/20 text-white' : ACCENTS[accent].chip}`}
        >
          {icon}
        </div>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            featured
              ? 'bg-white/20 text-white group-hover:bg-white group-hover:text-coral'
              : 'bg-black/[0.03] text-gray-400 group-hover:bg-teal group-hover:text-white'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <p className={`relative mt-4 text-sm font-semibold ${featured ? 'text-white/90' : 'text-gray-600'}`}>{title}</p>
      {loading ? (
        <div className="relative mt-2 h-7 w-24 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        value && (
          <p className={`relative mt-1 text-2xl font-extrabold tracking-tight ${featured ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        )
      )}
      {caption && !loading && (
        <p className={`relative mt-auto pt-2 text-xs leading-relaxed ${featured ? 'text-white/80' : 'text-gray-500'}`}>{caption}</p>
      )}
    </button>
  );
}

type BadgeVariant = 'green' | 'blue' | 'orange' | 'purple' | 'gray';

/** Recent Payments badge: approved claims first (they're stored under their underlying method), then by method. */
function paymentBadge(
  t: ReturnType<typeof useTranslations<'paymentMethod'>>,
  p: RecentPayment,
): { label: string; variant: BadgeVariant } {
  if (p.source === 'claim') return { label: t('claim'), variant: 'purple' };
  switch (p.method) {
    case 'cash':
      return { label: t('cash'), variant: 'green' };
    case 'cheque':
    case 'demand_draft':
      return { label: t('chequeOrDd'), variant: 'orange' };
    case 'gateway':
    case 'bank_transfer':
      return { label: t('online'), variant: 'blue' };
    default:
      return { label: p.method, variant: 'gray' };
  }
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tNotify = useTranslations('notifyClasses');
  const tConcession = useTranslations('concession');
  const tTc = useTranslations('transferCertificate');
  const tAlerts = useTranslations('alerts');
  const tAssistant = useTranslations('assistant');
  const locale = useLocale();
  const errorText = useErrorText();
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = still loading, null = failed (the card is hidden).
  const [workload, setWorkload] = useState<TeacherWorkload[] | null | undefined>(undefined);
  const [forecast, setForecast] = useState<CollectionForecast | null | undefined>(undefined);
  const [attendance, setAttendance] = useState<SchoolAttendanceSummary | null | undefined>(undefined);
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [view, setView] = useState<DashboardView>(readView);
  const session = getSession();
  const isTeacher = session?.role === 'teacher';
  const isAdmin = session?.role === 'admin';
  const isAccounts = session?.role === 'accounts';
  const tSyllabus = useTranslations('syllabus');
  const { feeConcession, transferCertificate, aiInsights, syllabus } = useTenantFeatures();
  // Syllabus roadmap: admin only (on time / late is for the school, not parents).
  const [syllabusRows, setSyllabusRows] = useState<SyllabusRow[] | null | undefined>(undefined);
  // Premium pattern warnings (docs/SPEC-ai.md phase 2) and the Monday summary.
  const { alerts, setAlerts } = useAlerts(!!aiInsights);
  // Premium: plain-language questions (docs/SPEC-ai.md 3.1); the first one comes from the header box.
  const [question, setQuestion] = useState<string | null>(null);
  const canAsk = !!aiInsights && (isAdmin || isAccounts);
  const [summary, setSummary] = useState<{ reasons: AlertReason[]; createdAt: string } | null>(null);
  // Students without a TC on file — schools with features.transferCertificate only.
  const [tc, setTc] = useState<{ missing: number; attached: number } | null | undefined>(undefined);
  const [concessionToday, setConcessionToday] = useState<{ total: number; count: number } | null>(null);

  useEffect(() => {
    // Addendum 4 / A10 — fee data (collected/outstanding/recent payments) must
    // never appear on the Teacher Dashboard, even incidentally through this
    // shared component, so teachers skip this fetch entirely (their own fetch
    // below ends the loading state).
    if (isTeacher) return;
    async function fetchStats() {
      try {
        const [usersRes, studentsRes, paymentsRes, feesRes] = await Promise.allSettled([
          api.get<{ data: unknown[]; meta: { total: number } }>('/users?limit=1'),
          api.get<{ data: unknown[]; meta: { total: number } }>('/students?limit=1'),
          api.get<RecentPayment[]>('/receipts/recent?limit=5'),
          api.get<{ academicYear: string | null; collected: number; outstanding: number }>('/insights/fee-totals'),
        ]);

        const partialStats: Partial<Stats> = {};

        if (usersRes.status === 'fulfilled') partialStats.userCount = usersRes.value.meta.total;
        if (studentsRes.status === 'fulfilled') partialStats.studentCount = studentsRes.value.meta.total;
        if (paymentsRes.status === 'fulfilled') {
          partialStats.recentPayments = paymentsRes.value;
        }
        if (feesRes.status === 'fulfilled') {
          partialStats.feesCollected = feesRes.value.collected;
          partialStats.feesOutstanding = feesRes.value.outstanding;
          partialStats.feesAcademicYear = feesRes.value.academicYear;
        }

        setStats(partialStats);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isTeacher, errorText]);

  useEffect(() => {
    if (!isTeacher) return;
    async function fetchMyDashboard() {
      try {
        const [slotsRes, classesRes] = await Promise.allSettled([
          api.get<TimetableSlot[]>('/timetable/mine'),
          api.get<MyClass[]>('/teacher-dashboard/my-classes'),
        ]);
        if (slotsRes.status === 'fulfilled') setMySlots(slotsRes.value);
        if (classesRes.status === 'fulfilled') setMyClasses(classesRes.value);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    }
    fetchMyDashboard();
  }, [isTeacher, errorText]);

  useEffect(() => {
    // Addendum 4 / A14 — Teacher Workload is Admin Dashboard only, not accounts/super_admin.
    if (!isAdmin) return;
    api
      .get<TeacherWorkload[]>('/teacher-dashboard/workload')
      .then((data) => setWorkload([...data].sort((a, b) => b.weeklyPeriods - a.weeklyPeriods)))
      // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      .catch(() => setWorkload(null));
  }, [isAdmin]);

  useEffect(() => {
    // Attendance isn't fee data: admin only, not accounts.
    if (!isAdmin) return;
    api
      .get<SchoolAttendanceSummary>('/attendance/school-summary')
      .then(setAttendance)
      .catch(() => setAttendance(null));
  }, [isAdmin]);

  useEffect(() => {
    if (!syllabus || !isAdmin) return;
    api
      .get<SyllabusRow[]>('/syllabus/overview')
      .then(setSyllabusRows)
      .catch(() => setSyllabusRows(null));
  }, [syllabus, isAdmin]);

  useEffect(() => {
    if (!feeConcession || !(isAdmin || isAccounts)) return;
    api
      .get<{ total: number; count: number }>('/fee-concessions/today')
      .then(setConcessionToday)
      .catch(() => {
        // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      });
  }, [feeConcession, isAdmin, isAccounts]);

  useEffect(() => {
    if (!aiInsights || !isAdmin) return;
    api
      .get<{ summary: { reasons: AlertReason[]; createdAt: string } | null }>('/alerts/summary')
      .then((r) => setSummary(r.summary))
      .catch(() => setSummary(null));
  }, [aiInsights, isAdmin]);

  useEffect(() => {
    if (!transferCertificate || !(isAdmin || isAccounts)) return;
    api
      .get<{ counts: { missing: number; attached: number } }>('/transfer-certificates?status=missing&limit=1')
      .then((r) => setTc(r.counts))
      .catch(() => setTc(null));
  }, [transferCertificate, isAdmin, isAccounts]);

  useEffect(() => {
    if (isTeacher) return;
    api
      .get<CollectionForecast>('/insights/collection-forecast')
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [isTeacher]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-teal" /></div>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{tCommon('failedToLoad', { error })}</div>;

  const yearLabel = stats.feesAcademicYear ? t('thisAcademicYearNamed', { year: stats.feesAcademicYear }) : t('thisAcademicYear');
  const today = todayWeekday();
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'greetingMorning' : hour < 17 ? 'greetingAfternoon' : 'greetingEvening';
  const firstName = session?.name?.split(' ')[0] ?? '';

  const close = () => setPanel(null);
  const changeView = (next: DashboardView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  };
  const showCharts = !isTeacher && view === 'charts';
  const recent = stats.recentPayments ?? [];

  const attendanceValue = (a: SchoolAttendanceSummary) =>
    a.holiday ? t('holidayShort') : a.daysMarked === 0 || a.percentage == null ? '—' : t('attendancePct', { pct: a.percentage });
  const attendanceCaption = (a: SchoolAttendanceSummary) =>
    a.holiday
      ? t('holidayToday', { name: a.holiday.name })
      : a.daysMarked === 0
        ? t('noneMarkedYet')
        : a.notMarked.length === 0
          ? t('allMarked')
          : t('classesNotMarked', { count: a.notMarked.length });

  const todaysSlots = mySlots.filter((s) => s.dayOfWeek === today);
  const myStudents = myClasses.reduce((n, c) => n + c.strength.total, 0);
  const myUnread = myClasses.reduce((n, c) => n + c.recentReports.filter((r) => !r.readByAnyParent).length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Hero
        greeting={t(greetingKey, { name: firstName })}
        subtitle={t('heroSubtitle')}
        date={`${weekdayName(today, locale)} · ${formatDate(new Date())}`}
        ask={
          canAsk ? (
            <AskBox
              onAsk={(q) => {
                setQuestion(q);
                setPanel('ask');
              }}
            />
          ) : undefined
        }
        action={
          // In card view the notification card is the action; charts view has no card for it.
          isAdmin && showCharts ? (
            <button
              type="button"
              onClick={() => setPanel('notify')}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/10 transition-colors hover:bg-coral-dark"
            >
              <Megaphone className="h-4 w-4" />
              {tNotify('title')}
            </button>
          ) : undefined
        }
      />

      {alerts && (alerts.length > 0 || summary) && (
        <AlertsBanner alerts={alerts} hasSummary={!!summary} onOpen={() => setPanel('insights')} />
      )}

      <HeadOfficeCirculars />

      {/* Addendum 4 / A10 — no fee-related widget may ever appear on the Teacher
          Dashboard, so the stat cards and payments below are admin/accounts only. */}
      {!isTeacher && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle className="mb-0">{t('sectionOverview')}</SectionTitle>
            <ViewToggle view={view} onChange={changeView} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label={t('totalUsers')} value={stats.userCount ?? '—'} icon={<Users className="h-5 w-5" />} accent="teal" />
            <StatCard
              label={t('totalStudents')}
              value={stats.studentCount ?? '—'}
              icon={<GraduationCap className="h-5 w-5" />}
              accent="violet"
            />
            <StatCard
              label={t('feesCollected')}
              value={stats.feesCollected != null ? formatRupees(stats.feesCollected) : '—'}
              subtitle={yearLabel}
              icon={<BadgeCheck className="h-5 w-5" />}
              accent="emerald"
            />
            <StatCard
              label={t('outstandingFees')}
              value={stats.feesOutstanding != null ? formatRupees(stats.feesOutstanding) : '—'}
              subtitle={yearLabel}
              icon={<Hourglass className="h-5 w-5" />}
              accent="amber"
            />
            {concessionToday && (
              <StatCard
                label={tConcession('todayTitle')}
                value={formatRupees(concessionToday.total)}
                subtitle={tConcession('todayCount', { count: concessionToday.count })}
                icon={<BadgePercent className="h-5 w-5" />}
                accent="coral"
              />
            )}
          </div>
        </section>
      )}

      {showCharts && (
        <section>
          <SectionTitle>{t('sectionCharts')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {stats.feesCollected != null && stats.feesOutstanding != null && (
              <ChartCard
                title={t('feeProgress')}
                subtitle={yearLabel}
                icon={<BadgeCheck className="h-5 w-5" />}
                accent={ACCENTS.emerald.chip}
              >
                <FeeDonut collected={stats.feesCollected} outstanding={stats.feesOutstanding} />
              </ChartCard>
            )}
            {forecast && (
              <ChartCard
                title={t('collectionForecast')}
                subtitle={forecast.label}
                icon={<TrendingUp className="h-5 w-5" />}
                accent={ACCENTS.teal.chip}
                onOpen={() => setPanel('forecast')}
              >
                <TrendChart bars={forecastBars(forecast, locale, t('nextMonth'))} height="h-48" />
              </ChartCard>
            )}
            {isAdmin && attendance && (
              <ChartCard
                title={t('todayAttendance')}
                subtitle={attendanceCaption(attendance)}
                icon={<ClipboardCheck className="h-5 w-5" />}
                accent={ACCENTS.emerald.chip}
                onOpen={() => setPanel('attendance')}
              >
                {attendance.holiday ? (
                  <p className="py-6 text-center text-sm text-gray-600">{t('holidayToday', { name: attendance.holiday.name })}</p>
                ) : (
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <Ring
                      pct={attendance.percentage ?? 0}
                      trackClass="stroke-emerald-100"
                      barClass="stroke-emerald-500"
                      size="h-32 w-32"
                      center={<span className="text-2xl font-extrabold text-gray-900">{attendanceValue(attendance)}</span>}
                    />
                    <div className="w-full">
                      <AttendanceSplit
                        present={attendance.daysPresent}
                        marked={attendance.daysMarked}
                        total={attendance.totalStudents}
                      />
                    </div>
                  </div>
                )}
              </ChartCard>
            )}
            {isAdmin && workload && workload.length > 0 && (
              <ChartCard
                title={t('teacherWorkload')}
                subtitle={t('colWeeklyPeriods')}
                icon={<UsersRound className="h-5 w-5" />}
                accent={ACCENTS.violet.chip}
                onOpen={() => setPanel('workload')}
              >
                <HBarChart
                  rows={workload.map((w) => ({ key: w.teacherId, label: w.teacherName, value: w.weeklyPeriods }))}
                  barClass="bg-violet-500"
                  trackClass="bg-violet-100"
                />
              </ChartCard>
            )}
            {isAdmin && syllabus && syllabusRows && syllabusRows.length > 0 && (
              <ChartCard
                title={tSyllabus('dashboardTitle')}
                subtitle={tSyllabus('dashboardSubtitle')}
                icon={<ListChecks className="h-5 w-5" />}
                accent={ACCENTS.indigo.chip}
                onOpen={() => setPanel('syllabus')}
              >
                <SyllabusSummary rows={syllabusRows} />
              </ChartCard>
            )}
            {recent.length > 0 && (
              <ChartCard
                title={t('recentPayments')}
                icon={<ReceiptIndianRupee className="h-5 w-5" />}
                accent={ACCENTS.amber.chip}
                onOpen={() => setPanel('payments')}
              >
                <HBarChart
                  rows={recent.map((p) => ({ key: p.id, label: p.studentName, value: toAmount(p.amount) }))}
                  barClass="bg-amber-400"
                  trackClass="bg-amber-50"
                  formatValue={formatRupees}
                />
              </ChartCard>
            )}
            {transferCertificate && tc && (
              <ChartCard
                title={tTc('reportTitle')}
                subtitle={tTc('reportHelp')}
                icon={<FileX2 className="h-5 w-5" />}
                accent={ACCENTS.rose.chip}
                onOpen={() => setPanel('tc')}
              >
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <Ring
                    pct={tc.attached + tc.missing > 0 ? Math.round((tc.attached / (tc.attached + tc.missing)) * 100) : 0}
                    trackClass="stroke-rose-100"
                    barClass="stroke-emerald-500"
                    size="h-32 w-32"
                    center={
                      <span className="text-2xl font-extrabold text-gray-900">
                        {t('attendancePct', {
                          pct: tc.attached + tc.missing > 0 ? Math.round((tc.attached / (tc.attached + tc.missing)) * 100) : 0,
                        })}
                      </span>
                    }
                  />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-rose-700">{tTc('missingCount', { count: tc.missing })}</p>
                    <p className="text-gray-600">{tTc('attachedCount', { count: tc.attached })}</p>
                  </div>
                </div>
              </ChartCard>
            )}
          </div>
        </section>
      )}

      {!showCharts && (
      <section>
        <SectionTitle>{t('sectionQuickAccess')}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isAdmin && (
            <FeatureCard
              icon={<Megaphone className="h-5 w-5" />}
              title={tNotify('title')}
              value={t('notifyValue')}
              caption={t('notifyCaption')}
              accent="coral"
              featured
              onClick={() => setPanel('notify')}
            />
          )}
          {isAdmin && attendance !== null && (
            <FeatureCard
              icon={<ClipboardCheck className="h-5 w-5" />}
              title={t('todayAttendance')}
              value={attendance ? attendanceValue(attendance) : undefined}
              caption={attendance ? attendanceCaption(attendance) : undefined}
              accent="emerald"
              loading={attendance === undefined}
              onClick={() => setPanel('attendance')}
            />
          )}
          {isAdmin && workload !== null && (
            <FeatureCard
              icon={<UsersRound className="h-5 w-5" />}
              title={t('teacherWorkload')}
              value={workload ? t('teacherCount', { count: workload.length }) : undefined}
              caption={
                workload?.[0]
                  ? t('busiest', { name: workload[0].teacherName, count: workload[0].weeklyPeriods })
                  : workload
                    ? t('noWorkload')
                    : undefined
              }
              accent="violet"
              loading={workload === undefined}
              onClick={() => setPanel('workload')}
            />
          )}
          {isAdmin && syllabus && syllabusRows !== null && (
            <FeatureCard
              icon={<ListChecks className="h-5 w-5" />}
              title={tSyllabus('dashboardTitle')}
              value={
                syllabusRows
                  ? syllabusCounts(syllabusRows).late > 0
                    ? tSyllabus('lateValue', { count: syllabusCounts(syllabusRows).late })
                    : tSyllabus('allOnTimeShort')
                  : undefined
              }
              caption={
                syllabusRows
                  ? tSyllabus('cardCaption', {
                      onTime: syllabusCounts(syllabusRows).on_time,
                      notPlanned: syllabusCounts(syllabusRows).not_planned,
                    })
                  : undefined
              }
              accent="indigo"
              loading={syllabusRows === undefined}
              onClick={() => setPanel('syllabus')}
            />
          )}
          {!isTeacher && forecast !== null && (
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5" />}
              title={t('collectionForecast')}
              value={forecast ? formatRupees(forecast.projectedNextMonth) : undefined}
              caption={forecast ? t('projectedNextMonth') : undefined}
              accent="teal"
              loading={forecast === undefined}
              onClick={() => setPanel('forecast')}
            />
          )}
          {!isTeacher && (
            <FeatureCard
              icon={<ReceiptIndianRupee className="h-5 w-5" />}
              title={t('recentPayments')}
              value={recent[0] ? formatRupees(recent[0].amount) : undefined}
              caption={recent[0] ? t('latestPayment', { student: recent[0].studentName, date: formatDateOnly(recent[0].paidOn) }) : t('noPayments')}
              accent="amber"
              onClick={() => setPanel('payments')}
            />
          )}
          {transferCertificate && !isTeacher && tc !== null && (
            <FeatureCard
              icon={<FileX2 className="h-5 w-5" />}
              title={tTc('reportTitle')}
              value={tc ? tTc('missingCount', { count: tc.missing }) : undefined}
              caption={tc ? tTc('attachedCount', { count: tc.attached }) : undefined}
              accent="rose"
              loading={tc === undefined}
              onClick={() => setPanel('tc')}
            />
          )}
          {isTeacher && (
            <FeatureCard
              icon={<CalendarDays className="h-5 w-5" />}
              title={t('weeklyRoutine')}
              value={t('periodsToday', { count: todaysSlots.length })}
              caption={t('periodsThisWeek', { count: mySlots.length })}
              accent="sky"
              onClick={() => setPanel('routine')}
            />
          )}
          {isTeacher && (
            <FeatureCard
              icon={<UsersRound className="h-5 w-5" />}
              title={t('aboutMyClasses')}
              value={t('classCount', { count: myClasses.length })}
              caption={t('classesCaption', { students: myStudents, unread: myUnread })}
              accent="indigo"
              onClick={() => setPanel('classes')}
            />
          )}
        </div>
      </section>
      )}

      {isAdmin && (
        <Drawer
          open={panel === 'notify'}
          onClose={close}
          title={tNotify('title')}
          subtitle={tNotify('help')}
          icon={<Megaphone className="h-5 w-5" />}
          accent={ACCENTS.coral.chip}
        >
          <NotifyClassesForm />
        </Drawer>
      )}

      {isAdmin && attendance && (
        <Drawer
          open={panel === 'attendance'}
          onClose={close}
          title={t('todayAttendance')}
          subtitle={formatDateOnly(attendance.date)}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent={ACCENTS.emerald.chip}
        >
          <AttendancePanel attendance={attendance} />
        </Drawer>
      )}

      {isAdmin && workload && (
        <Drawer
          open={panel === 'workload'}
          onClose={close}
          title={t('teacherWorkload')}
          subtitle={t('workloadNote')}
          icon={<UsersRound className="h-5 w-5" />}
          accent={ACCENTS.violet.chip}
        >
          <WorkloadPanel workload={workload} />
        </Drawer>
      )}

      {!isTeacher && forecast && (
        <Drawer
          open={panel === 'forecast'}
          onClose={close}
          title={t('collectionForecast')}
          subtitle={forecast.label}
          icon={<TrendingUp className="h-5 w-5" />}
          accent={ACCENTS.teal.chip}
        >
          <ForecastPanel forecast={forecast} />
        </Drawer>
      )}

      {canAsk && panel === 'ask' && (
        <Drawer
          open
          onClose={() => {
            close();
            setQuestion(null);
          }}
          title={tAssistant('title')}
          subtitle={tAssistant('subtitle')}
          icon={<Sparkles className="h-5 w-5" />}
          accent="bg-violet-100 text-violet-700"
        >
          <AssistantThread
            key={question ?? 'blank'}
            first={question}
            examples={(isAdmin ? ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const : ['ex4', 'ex5', 'ex6'] as const).map((k) =>
              tAssistant(k),
            )}
          />
        </Drawer>
      )}

      {alerts && (
        <Drawer
          open={panel === 'insights'}
          onClose={close}
          title={tAlerts('title')}
          subtitle={tAlerts('subtitle')}
          icon={<Sparkles className="h-5 w-5" />}
          accent="bg-violet-100 text-violet-700"
        >
          <AlertsList alerts={alerts} onChange={setAlerts} canRun={isAdmin} summary={isAdmin ? summary : null} />
        </Drawer>
      )}

      {transferCertificate && !isTeacher && (
        <Drawer
          open={panel === 'tc'}
          onClose={close}
          title={tTc('reportTitle')}
          subtitle={tTc('reportHelp')}
          icon={<FileX2 className="h-5 w-5" />}
          accent={ACCENTS.rose.chip}
        >
          <TransferCertificateReport />
        </Drawer>
      )}

      {!isTeacher && (
        <Drawer
          open={panel === 'payments'}
          onClose={close}
          title={t('recentPayments')}
          icon={<ReceiptIndianRupee className="h-5 w-5" />}
          accent={ACCENTS.amber.chip}
        >
          <PaymentsPanel payments={recent} />
        </Drawer>
      )}

      {isAdmin && syllabusRows && (
        <Drawer
          open={panel === 'syllabus'}
          onClose={close}
          title={tSyllabus('dashboardTitle')}
          subtitle={tSyllabus('dashboardSubtitle')}
          icon={<ListChecks className="h-5 w-5" />}
          accent={ACCENTS.indigo.chip}
        >
          <SyllabusRoadmap rows={syllabusRows} />
        </Drawer>
      )}

      {isTeacher && (
        <Drawer
          open={panel === 'routine'}
          onClose={close}
          title={t('weeklyRoutine')}
          icon={<CalendarDays className="h-5 w-5" />}
          accent={ACCENTS.sky.chip}
        >
          <RoutinePanel slots={mySlots} today={today} />
        </Drawer>
      )}

      {isTeacher && (
        <Drawer
          open={panel === 'classes'}
          onClose={close}
          title={t('aboutMyClasses')}
          icon={<UsersRound className="h-5 w-5" />}
          accent={ACCENTS.indigo.chip}
        >
          <MyClassesPanel classes={myClasses} />
        </Drawer>
      )}
    </div>
  );
}

function Hero({
  greeting,
  subtitle,
  date,
  action,
  ask,
}: {
  greeting: string;
  subtitle: string;
  date: string;
  action?: ReactNode;
  ask?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal via-teal-light to-[#21605b] px-6 py-7 text-white shadow-lg shadow-teal/10 sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-coral/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <p className="relative text-xs font-semibold uppercase tracking-widest text-white/60">{date}</p>
      <h2 className="relative mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting}</h2>
      <p className="relative mt-1 text-sm text-white/75">{subtitle}</p>
      {ask && <div className="relative mt-5">{ask}</div>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

function SectionTitle({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return <h3 className={`px-1 text-xs font-bold uppercase tracking-widest text-gray-500 ${className}`}>{children}</h3>;
}

/** Cards ↔ charts switch for the admin/accounts dashboard. */
function ViewToggle({ view, onChange }: { view: DashboardView; onChange: (v: DashboardView) => void }) {
  const t = useTranslations('dashboard');
  const options = [
    { key: 'cards' as const, label: t('viewCards'), icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'charts' as const, label: t('viewCharts'), icon: <ChartPie className="h-4 w-4" /> },
  ];
  return (
    <div role="group" aria-label={t('viewLabel')} className="inline-flex rounded-full border border-black/5 bg-white p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={view === o.key}
          onClick={() => onChange(o.key)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            view === o.key ? 'bg-teal text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function forecastBars(forecast: CollectionForecast, locale: string, nextLabel: string) {
  return [
    ...forecast.months.map((m) => ({ key: m.month, label: formatMonthYear(m.month, locale), amount: m.actual })),
    { key: 'next', label: nextLabel, amount: forecast.projectedNextMonth, projected: true },
  ];
}

function PanelCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-black/5 bg-white shadow-sm ${className}`}>{children}</div>;
}

function AttendancePanel({ attendance }: { attendance: SchoolAttendanceSummary }) {
  const t = useTranslations('dashboard');
  return (
    <div className="space-y-4">
      <PanelCard className="p-6">
        {attendance.holiday ? (
          <p className="text-sm text-gray-600">{t('holidayToday', { name: attendance.holiday.name })}</p>
        ) : attendance.daysMarked === 0 ? (
          <p className="text-sm text-gray-600">{t('noneMarkedYet')}</p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Ring
              pct={attendance.percentage ?? 0}
              trackClass="stroke-emerald-100"
              barClass="stroke-emerald-500"
              center={
                <span className="text-3xl font-extrabold text-gray-900">
                  {attendance.percentage != null ? t('attendancePct', { pct: attendance.percentage }) : '—'}
                </span>
              }
            />
            <div className="text-center sm:text-left">
              <p className="text-2xl font-extrabold text-gray-900">
                {t('todaySummary', { present: attendance.daysPresent, total: attendance.daysMarked })}
              </p>
              <p className="mt-1 text-sm text-gray-500">{t('studentCount', { count: attendance.totalStudents })}</p>
            </div>
          </div>
        )}
        {!attendance.holiday && (
          <div className="mt-6">
            <AttendanceSplit present={attendance.daysPresent} marked={attendance.daysMarked} total={attendance.totalStudents} />
          </div>
        )}
      </PanelCard>

      {!attendance.holiday && (
        <PanelCard className="p-5">
          <p className="text-sm font-semibold text-gray-900">
            {attendance.notMarked.length === 0 ? t('allMarked') : t('classesNotMarked', { count: attendance.notMarked.length })}
          </p>
          {attendance.notMarked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attendance.notMarked.map((c) => (
                <Badge key={c.classId} variant="orange">
                  {[c.name, c.section].filter(Boolean).join(' ')}
                </Badge>
              ))}
            </div>
          )}
        </PanelCard>
      )}

      <Link
        href="/admin/attendance"
        className="inline-flex items-center gap-1.5 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-light"
      >
        {t('attendanceLink')}
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function WorkloadPanel({ workload }: { workload: TeacherWorkload[] }) {
  const t = useTranslations('dashboard');
  const max = Math.max(1, ...workload.map((w) => w.weeklyPeriods));
  if (workload.length === 0) return <p className="py-8 text-center text-sm text-gray-500">{t('noWorkload')}</p>;

  return (
    <PanelCard className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-3">{t('colTeacher')}</th>
            <th className="px-4 py-3">{t('colWeeklyPeriods')}</th>
            <th className="px-4 py-3 text-right">{t('colClasses')}</th>
            <th className="px-4 py-3 text-right">{t('colSubjects')}</th>
            <th className="px-4 py-3 text-right">{t('colReportsSent')}</th>
            <th className="px-4 py-3 text-right">{t('colUnread')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {workload.map((w) => (
            <tr key={w.teacherId} className="hover:bg-cream/60">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{w.teacherName}</td>
              <td className="px-4 py-3">
                <div className="flex min-w-[120px] items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-violet-100">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${(w.weeklyPeriods / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold text-gray-900">{w.weeklyPeriods}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-gray-500">{w.classCount}</td>
              <td className="px-4 py-3 text-right text-gray-500">{w.subjectCount}</td>
              <td className="px-4 py-3 text-right text-gray-500">{w.reportsSent}</td>
              <td className="px-4 py-3 text-right text-gray-500">{w.reportsUnread}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelCard>
  );
}

function ForecastPanel({ forecast }: { forecast: CollectionForecast }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <PanelCard className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">{t('projectedNextMonth')}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{formatRupees(forecast.projectedNextMonth)}</p>
      </PanelCard>
      <PanelCard className="p-5">
        <TrendChart bars={forecastBars(forecast, locale, t('nextMonth'))} />
      </PanelCard>
    </div>
  );
}

function PaymentsPanel({ payments }: { payments: RecentPayment[] }) {
  const t = useTranslations('dashboard');
  const tMethod = useTranslations('paymentMethod');
  if (payments.length === 0) return <p className="py-8 text-center text-sm text-gray-500">{t('noPayments')}</p>;

  return (
    <PanelCard className="divide-y divide-gray-50">
      {payments.map((p) => {
        const badge = paymentBadge(tMethod, p);
        return (
          <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{p.studentName}</p>
              <p className="text-xs text-gray-500">{formatDateOnly(p.paidOn)}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-sm font-bold text-gray-900">{formatRupees(p.amount)}</span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </div>
        );
      })}
      <div className="px-5 py-3">
        <Link href="/admin/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
          {t('allPayments')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </PanelCard>
  );
}

function RoutinePanel({ slots, today }: { slots: TimetableSlot[]; today: number }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  if (slots.length === 0) return <p className="py-8 text-center text-sm text-gray-500">{t('noSlots')}</p>;

  const byDay = slots.reduce<Record<number, TimetableSlot[]>>((acc, slot) => {
    (acc[slot.dayOfWeek] ??= []).push(slot);
    return acc;
  }, {});
  const days = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const isToday = day === today;
        return (
          <PanelCard key={day} className={`p-4 ${isToday ? 'ring-2 ring-sky-400' : ''}`}>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900">{weekdayName(day, locale)}</p>
              {isToday && <Badge variant="blue">{t('today')}</Badge>}
            </div>
            <ul className="space-y-2">
              {byDay[day]
                .sort((a, b) => a.periodNumber - b.periodNumber)
                .map((slot) => (
                  <li key={slot.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-xs font-bold text-sky-700">
                      {slot.periodNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{slot.subject.name}</p>
                      <p className="text-xs text-gray-500">
                        {t('period', { n: slot.periodNumber })} · {slot.class.name} {slot.class.section}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </PanelCard>
        );
      })}
    </div>
  );
}

function MyClassesPanel({ classes }: { classes: MyClass[] }) {
  const t = useTranslations('dashboard');
  const tReport = useTranslations('reportType');
  if (classes.length === 0) return <p className="py-8 text-center text-sm text-gray-500">{t('noClasses')}</p>;

  return (
    <div className="space-y-3">
      {classes.map((mc) => (
        <PanelCard key={mc.class.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-extrabold text-gray-900">
              {mc.class.name} {mc.class.section}
            </p>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              {t('studentCount', { count: mc.strength.total })}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('strength', { total: mc.strength.total, boys: mc.strength.male, girls: mc.strength.female })}
            {mc.strength.other + mc.strength.unspecified > 0
              ? t('strengthOther', { count: mc.strength.other + mc.strength.unspecified })
              : ''}
          </p>
          {mc.subjects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {mc.subjects.map((s) => (
                <Badge key={s.id} variant="gray">
                  {s.name}
                </Badge>
              ))}
            </div>
          )}
          {mc.recentReports.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
              {mc.recentReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                  <span className="truncate">{t('reportLine', { student: r.studentName, type: reportTypeLabel(tReport, r.type) })}</span>
                  <Badge variant={r.readByAnyParent ? 'green' : 'yellow'}>{r.readByAnyParent ? t('read') : t('unread')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      ))}
    </div>
  );
}
