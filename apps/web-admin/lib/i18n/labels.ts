import type { useTranslations } from 'next-intl';

/** Translators for the enum-like values the API sends (report types, fee statuses, …). */
type T<NS extends 'reportType' | 'feeStatus' | 'claimStatus' | 'roles' | 'paymentMethod'> = ReturnType<
  typeof useTranslations<NS>
>;

const has = <K extends string>(keys: readonly K[], v: string): v is K => (keys as readonly string[]).includes(v);

const REPORT_TYPES = ['academic', 'attendance', 'behavior', 'homework', 'report_card'] as const;
export function reportTypeLabel(t: T<'reportType'>, type: string): string {
  return has(REPORT_TYPES, type) ? t(type) : type;
}

const ROLES = ['parent', 'teacher', 'admin', 'accounts', 'super_admin'] as const;
export function roleLabel(t: T<'roles'>, role: string): string {
  return has(ROLES, role) ? t(role) : role;
}

const METHODS = ['cash', 'cheque', 'bank_transfer', 'demand_draft', 'gateway', 'upi'] as const;
/** A single payment method's name ("bank_transfer" → "Bank Transfer / UPI"). */
export function paymentMethodLabel(t: T<'paymentMethod'>, method: string): string {
  return has(METHODS, method) ? t(method) : method;
}

const FEE_STATUSES = ['paid', 'pending', 'overdue', 'partial', 'waived'] as const;
export function feeStatusLabel(t: T<'feeStatus'>, status: string): string {
  return has(FEE_STATUSES, status) ? t(status) : status;
}

const CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;
export function claimStatusLabel(t: T<'claimStatus'>, status: string): string {
  return has(CLAIM_STATUSES, status) ? t(status) : status;
}

const PAYMENT_STATUSES = ['created', 'attempted', 'paid', 'failed', 'refunded'] as const;
export function paymentStatusLabel(t: ReturnType<typeof useTranslations<'paymentStatus'>>, status: string): string {
  return has(PAYMENT_STATUSES, status) ? t(status) : status;
}

const REPORT_STATUSES = ['draft', 'published'] as const;
export function reportStatusLabel(t: ReturnType<typeof useTranslations<'reportStatus'>>, status: string): string {
  return has(REPORT_STATUSES, status) ? t(status) : status;
}
