/** One thing the admin should look at today, with how many. */
export interface UrgentItem {
  kind:
    | 'payment_claims'
    | 'leave_requests'
    | 'petty_cash'
    | 'classes_not_marked'
    | 'staff_not_marked'
    | 'follow_ups_overdue'
    | 'critical_alerts'
    | 'buses_no_signal'
    | 'appointments_waiting';
  count: number;
}

/** Attendance not marked by this time counts as overdue. */
export const MARK_BY = '10:00';

/**
 * The "needs attention" list for the admin's phone, most pressing first.
 * Empty entries are left out; attendance only counts once it should have
 * been marked (MARK_BY, school time) and never on a holiday.
 */
export function urgentItems(s: {
  now: string;
  holiday: boolean;
  criticalAlerts: number;
  busesNoSignal: number;
  classesNotMarked: number;
  staffNotMarked: number | null;
  paymentClaims: number;
  leaveRequests: number | null;
  pettyCash: number | null;
  followUpsOverdue: number | null;
  appointmentsWaiting: number | null;
}): UrgentItem[] {
  const late = !s.holiday && s.now >= MARK_BY;
  const items: UrgentItem[] = [
    { kind: 'critical_alerts', count: s.criticalAlerts },
    { kind: 'buses_no_signal', count: s.busesNoSignal },
    { kind: 'classes_not_marked', count: late ? s.classesNotMarked : 0 },
    { kind: 'staff_not_marked', count: late ? (s.staffNotMarked ?? 0) : 0 },
    { kind: 'appointments_waiting', count: s.appointmentsWaiting ?? 0 },
    { kind: 'payment_claims', count: s.paymentClaims },
    { kind: 'leave_requests', count: s.leaveRequests ?? 0 },
    { kind: 'petty_cash', count: s.pettyCash ?? 0 },
    { kind: 'follow_ups_overdue', count: s.followUpsOverdue ?? 0 },
  ];
  return items.filter((i) => i.count > 0);
}

/** "HH:mm" now in the school's time zone. */
export function localTime(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
