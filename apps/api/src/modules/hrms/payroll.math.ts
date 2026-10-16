/**
 * Payroll arithmetic, integer paise throughout. Statutory figures (PF, ESI,
 * Professional Tax) use per-school configurable rates, ceilings and slabs; the
 * seeded values are defaults the school's accountant must verify. TDS is a
 * manual deduction line. Nothing here files or reports anything.
 *
 * Rounding: every prorated amount is rounded half-up to the paisa; PF is
 * rounded half-up to the rupee and ESI up to the next rupee (the usual
 * practice for those schemes).
 */

export interface PtSlab {
  fromPaise: number;
  /** Inclusive upper bound; null = no upper bound. */
  toPaise: number | null;
  monthlyPaise: number;
  /** Some states charge a different amount in February. */
  februaryPaise?: number;
}

export interface StatutorySettings {
  pfEnabled: boolean;
  /** Percent in basis points: 12% = 1200. */
  pfEmployeeBp: number;
  pfEmployerBp: number;
  pfCeilingPaise: number;
  esiEnabled: boolean;
  esiEmployeeBp: number;
  esiEmployerBp: number;
  esiCeilingPaise: number;
  ptEnabled: boolean;
  ptSlabs: PtSlab[];
}

export type ComponentKind = 'EARNING' | 'DEDUCTION';

export interface StructureComponent {
  name: string;
  kind: ComponentKind;
  calc: 'FIXED' | 'PERCENT_OF_BASIC';
  amountPaise?: number;
  /** Percent of basic in basis points: 40% = 4000. */
  percentBp?: number;
}

export interface StructureInput {
  basicPaise: number;
  components: StructureComponent[];
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
}

export interface Adjustment {
  kind: ComponentKind;
  name: string;
  amountPaise: number;
  reason: string;
}

export type ItemSource = 'STRUCTURE' | 'STATUTORY' | 'ADJUSTMENT';

export interface LineItem {
  kind: ComponentKind;
  source: ItemSource;
  code: string | null;
  name: string;
  amountPaise: number;
  reason?: string | null;
}

export interface PayLineResult {
  items: LineItem[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  employerPfPaise: number;
  employerEsiPaise: number;
  paidTenths: number;
  flags: string[];
}

/** round(a * b / c) half-up for non-negative integers (inputs stay far below 2^53). */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c === 0) return 0;
  return Math.floor((a * b * 2 + c) / (2 * c));
}

/** Percent (e.g. "12.00" or 12) -> basis points. */
export function percentToBp(
  percent: number | string | { toString(): string },
): number {
  return Math.round(Number(percent.toString()) * 100);
}

/** Full-month amount of a structure component. */
export function componentPaise(
  c: StructureComponent,
  basicPaise: number,
): number {
  if (c.calc === 'PERCENT_OF_BASIC')
    return mulDivRound(basicPaise, c.percentBp ?? 0, 10_000);
  return c.amountPaise ?? 0;
}

/** Scales a full-month amount by paid days: tenths payable out of period*10. */
export function prorate(
  fullPaise: number,
  paidTenths: number,
  periodDays: number,
): number {
  return mulDivRound(fullPaise, paidTenths, periodDays * 10);
}

/** PF: rate on min(earned basic, ceiling), whole rupees, half-up. */
export function pfPaise(
  earnedBasicPaise: number,
  ceilingPaise: number,
  bp: number,
): number {
  const wage = Math.min(earnedBasicPaise, ceilingPaise);
  return Math.floor((wage * bp + 500_000) / 1_000_000) * 100;
}

/** ESI: rate on earned gross, rounded up to the next whole rupee. */
export function esiPaise(earnedGrossPaise: number, bp: number): number {
  return Math.ceil((earnedGrossPaise * bp) / 1_000_000) * 100;
}

/** Professional Tax for a monthly gross; [month] is "YYYY-MM". */
export function ptPaise(
  grossPaise: number,
  slabs: PtSlab[],
  month: string,
): number {
  const slab = slabs.find(
    (s) =>
      grossPaise >= s.fromPaise &&
      (s.toPaise === null || grossPaise <= s.toPaise),
  );
  if (!slab) return 0;
  return month.endsWith('-02') && slab.februaryPaise !== undefined
    ? slab.februaryPaise
    : slab.monthlyPaise;
}

/**
 * One employee's pay line. [lopTenths] comes from attendance (computePeriod);
 * earnings are prorated, fixed deductions and adjustments are not.
 * Statutory bases: PF on earned basic, ESI on earned gross (and only when the
 * un-prorated gross is within the ESI ceiling), PT on earned gross. Adjustment
 * allowances are paid as-is and attract no statutory deduction.
 * Deductions can never push net pay below zero: later deductions are capped
 * and the line is flagged.
 */
export function computePayLine(args: {
  structure: StructureInput;
  statutory: StatutorySettings;
  month: string;
  periodDays: number;
  lopTenths: number;
  adjustments?: Adjustment[];
}): PayLineResult {
  const { structure, statutory, month, periodDays } = args;
  const flags: string[] = [];
  const paidTenths = Math.max(0, periodDays * 10 - args.lopTenths);
  const items: LineItem[] = [];

  const earnings = [
    {
      code: 'BASIC' as string | null,
      name: 'Basic',
      full: structure.basicPaise,
    },
    ...structure.components
      .filter((c) => c.kind === 'EARNING')
      .map((c) => ({
        code: null,
        name: c.name,
        full: componentPaise(c, structure.basicPaise),
      })),
  ];
  const fullGross = earnings.reduce((s, e) => s + e.full, 0);
  let earnedGross = 0;
  let earnedBasic = 0;
  for (const e of earnings) {
    const amt = prorate(e.full, paidTenths, periodDays);
    earnedGross += amt;
    if (e.code === 'BASIC') earnedBasic = amt;
    items.push({
      kind: 'EARNING',
      source: 'STRUCTURE',
      code: e.code,
      name: e.name,
      amountPaise: amt,
    });
  }

  let employerPf = 0;
  let employerEsi = 0;
  const wanted: LineItem[] = [];
  if (structure.pfApplicable && statutory.pfEnabled) {
    const amt = pfPaise(
      earnedBasic,
      statutory.pfCeilingPaise,
      statutory.pfEmployeeBp,
    );
    employerPf = pfPaise(
      earnedBasic,
      statutory.pfCeilingPaise,
      statutory.pfEmployerBp,
    );
    if (amt > 0)
      wanted.push({
        kind: 'DEDUCTION',
        source: 'STATUTORY',
        code: 'PF',
        name: 'Provident Fund',
        amountPaise: amt,
      });
  }
  if (structure.esiApplicable && statutory.esiEnabled) {
    if (fullGross <= statutory.esiCeilingPaise) {
      const amt = esiPaise(earnedGross, statutory.esiEmployeeBp);
      employerEsi = esiPaise(earnedGross, statutory.esiEmployerBp);
      if (amt > 0)
        wanted.push({
          kind: 'DEDUCTION',
          source: 'STATUTORY',
          code: 'ESI',
          name: 'ESI',
          amountPaise: amt,
        });
    } else {
      flags.push('ESI_ABOVE_CEILING');
    }
  }
  if (structure.ptApplicable && statutory.ptEnabled) {
    const amt = ptPaise(earnedGross, statutory.ptSlabs, month);
    if (amt > 0)
      wanted.push({
        kind: 'DEDUCTION',
        source: 'STATUTORY',
        code: 'PT',
        name: 'Professional Tax',
        amountPaise: amt,
      });
  }
  for (const c of structure.components.filter((x) => x.kind === 'DEDUCTION')) {
    wanted.push({
      kind: 'DEDUCTION',
      source: 'STRUCTURE',
      code: null,
      name: c.name,
      amountPaise: componentPaise(c, structure.basicPaise),
    });
  }

  let gross = earnedGross;
  for (const a of args.adjustments ?? []) {
    if (a.kind === 'EARNING') {
      gross += a.amountPaise;
      items.push({
        kind: 'EARNING',
        source: 'ADJUSTMENT',
        code: null,
        name: a.name,
        amountPaise: a.amountPaise,
        reason: a.reason,
      });
    } else {
      wanted.push({
        kind: 'DEDUCTION',
        source: 'ADJUSTMENT',
        code: null,
        name: a.name,
        amountPaise: a.amountPaise,
        reason: a.reason,
      });
    }
  }

  let remaining = gross;
  let deductions = 0;
  for (const d of wanted) {
    const applied = Math.min(d.amountPaise, remaining);
    if (applied < d.amountPaise) flags.push('DEDUCTION_CAPPED');
    remaining -= applied;
    deductions += applied;
    items.push({ ...d, amountPaise: applied });
  }

  return {
    items,
    grossPaise: gross,
    deductionsPaise: deductions,
    netPaise: gross - deductions,
    employerPfPaise: employerPf,
    employerEsiPaise: employerEsi,
    paidTenths,
    flags: [...new Set(flags)],
  };
}

/** Totals from stored items (used after adjustments are added or removed). */
export function totalsOf(
  items: { kind: ComponentKind; amountPaise: number }[],
) {
  const gross = items
    .filter((i) => i.kind === 'EARNING')
    .reduce((s, i) => s + i.amountPaise, 0);
  const ded = items
    .filter((i) => i.kind === 'DEDUCTION')
    .reduce((s, i) => s + i.amountPaise, 0);
  return { grossPaise: gross, deductionsPaise: ded, netPaise: gross - ded };
}

/** Karnataka monthly PT slabs as an EDITABLE DEFAULT. The school's accountant must verify before use. */
export const DEFAULT_PT_SLABS: PtSlab[] = [
  { fromPaise: 0, toPaise: 2_499_999, monthlyPaise: 0 },
  {
    fromPaise: 2_500_000,
    toPaise: null,
    monthlyPaise: 20_000,
    februaryPaise: 30_000,
  },
];

/** Rounded integer rupee/paise helpers shared with the petty-cash module's conversions. */
export { fromPaise, toPaise } from '../petty-cash/petty-cash.math';
