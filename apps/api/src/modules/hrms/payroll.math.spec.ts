import {
  DEFAULT_PT_SLABS,
  StatutorySettings,
  StructureInput,
  componentPaise,
  computePayLine,
  esiPaise,
  mulDivRound,
  percentToBp,
  pfPaise,
  prorate,
  ptPaise,
  totalsOf,
} from './payroll.math';

const statutory: StatutorySettings = {
  pfEnabled: true,
  pfEmployeeBp: 1200,
  pfEmployerBp: 1200,
  pfCeilingPaise: 1_500_000,
  esiEnabled: true,
  esiEmployeeBp: 75,
  esiEmployerBp: 325,
  esiCeilingPaise: 2_100_000,
  ptEnabled: true,
  ptSlabs: DEFAULT_PT_SLABS,
};

const structure = (over: Partial<StructureInput> = {}): StructureInput => ({
  basicPaise: 2_000_000, // 20,000
  components: [
    { name: 'HRA', kind: 'EARNING', calc: 'PERCENT_OF_BASIC', percentBp: 4000 },
    { name: 'Transport', kind: 'EARNING', calc: 'FIXED', amountPaise: 160_000 },
    { name: 'TDS', kind: 'DEDUCTION', calc: 'FIXED', amountPaise: 50_000 },
  ],
  pfApplicable: false,
  esiApplicable: false,
  ptApplicable: false,
  ...over,
});

const line = (over: Partial<Parameters<typeof computePayLine>[0]> = {}) =>
  computePayLine({
    structure: structure(),
    statutory,
    month: '2026-03',
    periodDays: 31,
    lopTenths: 0,
    ...over,
  });

describe('rounding helpers', () => {
  it('rounds half-up', () => {
    expect(mulDivRound(1, 1, 2)).toBe(1);
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(5, 1, 2)).toBe(3);
    expect(mulDivRound(7, 0, 5)).toBe(0);
  });
  it('percent to basis points', () => {
    expect(percentToBp('12.00')).toBe(1200);
    expect(percentToBp(0.75)).toBe(75);
  });
  it('percent-of-basic and fixed components', () => {
    expect(
      componentPaise(
        {
          name: 'x',
          kind: 'EARNING',
          calc: 'PERCENT_OF_BASIC',
          percentBp: 4000,
        },
        2_000_000,
      ),
    ).toBe(800_000);
    expect(
      componentPaise(
        { name: 'x', kind: 'EARNING', calc: 'FIXED', amountPaise: 12_345 },
        0,
      ),
    ).toBe(12_345);
  });
});

describe('proration and loss of pay', () => {
  it('pays in full with no LOP', () => {
    const r = line();
    expect(r.grossPaise).toBe(2_000_000 + 800_000 + 160_000);
    expect(r.paidTenths).toBe(310);
  });

  it('prorates each earning by paid days, rounded half-up to the paisa', () => {
    // 3 LOP days of 31: factor 28/31
    const r = line({ lopTenths: 30 });
    const basic = r.items.find((i) => i.code === 'BASIC')!.amountPaise;
    expect(basic).toBe(prorate(2_000_000, 280, 31));
    expect(basic).toBe(1_806_452); // 20000 * 28/31 = 18064.516...
    expect(r.grossPaise).toBe(
      basic + prorate(800_000, 280, 31) + prorate(160_000, 280, 31),
    );
  });

  it('supports half-day LOP', () => {
    const r = line({ lopTenths: 5, periodDays: 30, month: '2026-04' });
    expect(r.paidTenths).toBe(295);
    expect(r.items.find((i) => i.code === 'BASIC')!.amountPaise).toBe(
      prorate(2_000_000, 295, 30),
    );
  });

  it('pays nothing for a fully unpaid month and never goes negative', () => {
    const r = line({ lopTenths: 310 });
    expect(r.grossPaise).toBe(0);
    expect(r.netPaise).toBe(0);
    expect(line({ lopTenths: 9999 }).paidTenths).toBe(0);
  });

  it('does not prorate fixed deductions', () => {
    const r = line({ lopTenths: 100 });
    expect(r.items.find((i) => i.name === 'TDS')!.amountPaise).toBe(50_000);
  });
});

describe('PF', () => {
  it('is rate x earned basic, capped at the wage ceiling', () => {
    // basic 20,000 > ceiling 15,000 -> 12% of 15,000 = 1,800
    expect(pfPaise(2_000_000, 1_500_000, 1200)).toBe(180_000);
    // basic 10,000 -> 1,200
    expect(pfPaise(1_000_000, 1_500_000, 1200)).toBe(120_000);
  });
  it('rounds to the nearest rupee, half up', () => {
    // 12% of 10,004.17 = 1200.5004 -> 1201
    expect(pfPaise(1_000_417, 1_500_000, 1200)).toBe(120_100);
    // 12% of 10,003.33 = 1200.3996 -> 1200
    expect(pfPaise(1_000_333, 1_500_000, 1200)).toBe(120_000);
  });
  it('shows up as a statutory deduction and as employer cost', () => {
    const r = line({ structure: structure({ pfApplicable: true }) });
    const pf = r.items.find((i) => i.code === 'PF')!;
    expect(pf.source).toBe('STATUTORY');
    expect(pf.amountPaise).toBe(180_000);
    expect(r.employerPfPaise).toBe(180_000);
  });
  it('is skipped when the school switches PF off or the structure is exempt', () => {
    expect(
      line({
        structure: structure({ pfApplicable: true }),
        statutory: { ...statutory, pfEnabled: false },
      }).items.some((i) => i.code === 'PF'),
    ).toBe(false);
    expect(line().items.some((i) => i.code === 'PF')).toBe(false);
  });
  it('uses the school rates, not constants', () => {
    const r = line({
      structure: structure({ pfApplicable: true }),
      statutory: { ...statutory, pfEmployeeBp: 800, pfCeilingPaise: 5_000_000 },
    });
    expect(r.items.find((i) => i.code === 'PF')!.amountPaise).toBe(160_000);
  });
});

describe('ESI', () => {
  it('rounds up to the next rupee', () => {
    // 0.75% of 10,000.00 = 75 exactly
    expect(esiPaise(1_000_000, 75)).toBe(7_500);
    // 0.75% of 10,001.00 = 75.0075 -> 76
    expect(esiPaise(1_000_100, 75)).toBe(7_600);
  });
  it('applies only while full monthly gross is within the ceiling', () => {
    const small = structure({
      basicPaise: 1_000_000,
      components: [
        { name: 'HRA', kind: 'EARNING', calc: 'FIXED', amountPaise: 500_000 },
      ],
      esiApplicable: true,
    });
    const ok = line({ structure: small });
    expect(ok.items.find((i) => i.code === 'ESI')!.amountPaise).toBe(11_300); // 0.75% of 15,000 = 112.5 -> 113
    expect(ok.employerEsiPaise).toBe(48_800); // 3.25% of 15,000 = 487.5 -> 488
    const big = line({ structure: structure({ esiApplicable: true }) }); // gross 29,600 > 21,000
    expect(big.items.some((i) => i.code === 'ESI')).toBe(false);
    expect(big.flags).toContain('ESI_ABOVE_CEILING');
  });
  it('is judged on the un-prorated gross but charged on earned gross', () => {
    const small = structure({
      basicPaise: 1_000_000,
      components: [
        { name: 'HRA', kind: 'EARNING', calc: 'FIXED', amountPaise: 1_000_000 },
      ],
      esiApplicable: true,
    }); // gross 20,000 <= 21,000
    const r = line({ structure: small, lopTenths: 155 }); // half the month unpaid
    expect(r.items.find((i) => i.code === 'ESI')!.amountPaise).toBe(
      esiPaise(r.grossPaise, 75),
    );
  });
});

describe('Professional Tax', () => {
  it('finds the slab for the monthly gross (karnataka default, editable)', () => {
    expect(ptPaise(2_499_999, DEFAULT_PT_SLABS, '2026-03')).toBe(0);
    expect(ptPaise(2_500_000, DEFAULT_PT_SLABS, '2026-03')).toBe(20_000);
  });
  it('uses the February amount when the slab has one', () => {
    expect(ptPaise(3_000_000, DEFAULT_PT_SLABS, '2026-02')).toBe(30_000);
    expect(ptPaise(3_000_000, DEFAULT_PT_SLABS, '2026-01')).toBe(20_000);
  });
  it('is zero when no slab matches', () => {
    expect(ptPaise(1_000_000, [], '2026-03')).toBe(0);
  });
  it('is deducted only when the structure and the school both enable it', () => {
    const r = line({ structure: structure({ ptApplicable: true }) });
    expect(r.items.find((i) => i.code === 'PT')!.amountPaise).toBe(20_000);
    expect(
      line({
        structure: structure({ ptApplicable: true }),
        statutory: { ...statutory, ptEnabled: false },
      }).items.some((i) => i.code === 'PT'),
    ).toBe(false);
  });
});

describe('adjustments and net pay', () => {
  it('adds one-off allowances and deductions with their reasons', () => {
    const base = line();
    const r = line({
      adjustments: [
        {
          kind: 'EARNING',
          name: 'Diwali bonus',
          amountPaise: 100_000,
          reason: 'festival',
        },
        {
          kind: 'DEDUCTION',
          name: 'Advance recovery',
          amountPaise: 25_000,
          reason: 'advance',
        },
      ],
    });
    expect(r.grossPaise).toBe(base.grossPaise + 100_000);
    expect(r.deductionsPaise).toBe(base.deductionsPaise + 25_000);
    expect(r.netPaise).toBe(base.netPaise + 100_000 - 25_000);
    expect(r.items.filter((i) => i.source === 'ADJUSTMENT')).toHaveLength(2);
  });
  it('never lets deductions take net pay below zero', () => {
    const r = line({
      lopTenths: 300,
      adjustments: [
        {
          kind: 'DEDUCTION',
          name: 'Recovery',
          amountPaise: 99_999_999,
          reason: 'x',
        },
      ],
    });
    expect(r.netPaise).toBe(0);
    expect(r.deductionsPaise).toBe(r.grossPaise);
    expect(r.flags).toContain('DEDUCTION_CAPPED');
  });
  it('totals always reconcile: net = gross - deductions', () => {
    const r = line({
      structure: structure({ pfApplicable: true, ptApplicable: true }),
      lopTenths: 25,
    });
    expect(r.netPaise).toBe(r.grossPaise - r.deductionsPaise);
    expect(totalsOf(r.items)).toEqual({
      grossPaise: r.grossPaise,
      deductionsPaise: r.deductionsPaise,
      netPaise: r.netPaise,
    });
  });
  it('is integer paise end to end', () => {
    const r = line({
      structure: structure({ pfApplicable: true, ptApplicable: true }),
      lopTenths: 70,
    });
    for (const i of r.items) expect(Number.isInteger(i.amountPaise)).toBe(true);
    expect(Number.isInteger(r.netPaise)).toBe(true);
  });
});
