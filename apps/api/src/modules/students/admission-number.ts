import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { todayIn } from '../attendance/attendance-dates';
import { academicYearStart } from '../admissions/admissions.math';

/**
 * A school's rule for new admission numbers (tenants.admission_numbering):
 * a pattern with {N} for the running number and optional year tokens, the
 * number's width, the next number, and whether it restarts each year.
 * Schools that already have numbers set `next` after their last one.
 */
export interface AdmissionNumbering {
  /** e.g. "GV-{YYYY}-{N}", "ADM{N}", "{AY}/{N}". */
  pattern: string;
  /** Zero-padded width of {N} (1 = no padding). */
  digits: number;
  /** The number the next student gets. */
  next: number;
  /** Start again at 1 when the year in the pattern changes. */
  resetEachYear: boolean;
  /** The year `next` belongs to (for resetEachYear). */
  year: string | null;
}

export const TOKENS = ['{N}', '{YYYY}', '{YY}', '{AY}'] as const;
export const MAX_PATTERN = 30;

const err = (code: string, message: string) => ({ code, message });

/** Problems with a pattern, as an error code; null when it can be used. */
export function patternProblem(pattern: string): string | null {
  if (!pattern.trim() || pattern.length > MAX_PATTERN) return 'PATTERN_LENGTH';
  if (pattern.split('{N}').length !== 2) return 'PATTERN_NEEDS_N';
  const rest = TOKENS.reduce((s, t) => s.split(t).join(''), pattern);
  if (/[{}]/.test(rest)) return 'PATTERN_UNKNOWN_TOKEN';
  if (!/^[A-Za-z0-9/._ -]*$/.test(rest)) return 'PATTERN_CHARACTERS';
  return null;
}

/** "2026-27" for a day in the academic year starting 1 June 2026. */
export function academicYear(today: string): string {
  const start = Number(academicYearStart(today).slice(0, 4));
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The year a pattern's numbers belong to, or null when it shows no year. */
export function yearKey(pattern: string, today: string): string | null {
  if (pattern.includes('{AY}')) return academicYear(today);
  if (pattern.includes('{YYYY}') || pattern.includes('{YY}'))
    return today.slice(0, 4);
  return null;
}

/** The admission number for [n] on [today] ("YYYY-MM-DD", school-local). */
export function formatAdmissionNo(
  cfg: Pick<AdmissionNumbering, 'pattern' | 'digits'>,
  n: number,
  today: string,
): string {
  return cfg.pattern
    .split('{N}')
    .join(String(n).padStart(cfg.digits, '0'))
    .split('{YYYY}')
    .join(today.slice(0, 4))
    .split('{YY}')
    .join(today.slice(2, 4))
    .split('{AY}')
    .join(academicYear(today));
}

/** The number to use now: `next`, or 1 when a yearly rule's year has turned. */
export function currentNumber(cfg: AdmissionNumbering, today: string): number {
  const key = yearKey(cfg.pattern, today);
  return cfg.resetEachYear && key && cfg.year && key !== cfg.year
    ? 1
    : cfg.next;
}

export function readNumbering(value: unknown): AdmissionNumbering | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AdmissionNumbering>;
  if (typeof v.pattern !== 'string' || typeof v.next !== 'number') return null;
  return {
    pattern: v.pattern,
    digits: typeof v.digits === 'number' ? v.digits : 1,
    next: v.next,
    resetEachYear: v.resetEachYear === true,
    year: typeof v.year === 'string' ? v.year : null,
  };
}

/**
 * Takes the school's next admission number inside [tx], skipping any number
 * already in use, and moves the counter on. Serialised per school, so two
 * desks adding students at once never get the same number. Null when the
 * school has no numbering rule.
 */
export async function takeAdmissionNo(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'admission-no:' + tenantId}))`;
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { admissionNumbering: true, timezone: true },
  });
  const cfg = readNumbering(tenant?.admissionNumbering);
  if (!cfg) return null;
  const today = todayIn(tenant?.timezone || 'Asia/Kolkata');
  let n = currentNumber(cfg, today);

  // Numbers typed by hand may already use some: take the first free one.
  for (let tries = 0; tries < 20; tries++) {
    const candidates = Array.from({ length: 50 }, (_, i) =>
      formatAdmissionNo(cfg, n + i, today),
    );
    const taken = new Set(
      (
        await tx.student.findMany({
          where: {
            tenantId,
            admissionNo: { in: candidates, mode: 'insensitive' },
          },
          select: { admissionNo: true },
        })
      ).map((s) => s.admissionNo.toLowerCase()),
    );
    const free = candidates.findIndex((c) => !taken.has(c.toLowerCase()));
    if (free >= 0) {
      const number = n + free;
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          admissionNumbering: {
            ...cfg,
            next: number + 1,
            year: yearKey(cfg.pattern, today),
          },
        },
      });
      return candidates[free];
    }
    n += candidates.length;
  }
  throw new BadRequestException(
    err(
      'ADMISSION_NUMBERS_USED_UP',
      'No free admission number found after the next 1,000. Check the numbering in Settings.',
    ),
  );
}
