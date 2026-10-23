/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import {
  academicYear,
  currentNumber,
  formatAdmissionNo,
  patternProblem,
  takeAdmissionNo,
  yearKey,
} from './admission-number';

const cfg = (extra: object = {}) => ({
  pattern: 'GV-{YYYY}-{N}',
  digits: 4,
  next: 187,
  resetEachYear: false,
  year: '2026',
  ...extra,
});

describe('admission number rules', () => {
  it('fills the year tokens and pads the number', () => {
    expect(formatAdmissionNo(cfg(), 187, '2026-10-24')).toBe('GV-2026-0187');
    expect(
      formatAdmissionNo({ pattern: '{AY}/{N}', digits: 1 }, 5, '2027-03-01'),
    ).toBe('2026-27/5');
    expect(
      formatAdmissionNo({ pattern: 'ADM{YY}{N}', digits: 3 }, 12, '2026-06-01'),
    ).toBe('ADM26012');
  });

  it('starts the academic year on 1 June', () => {
    expect(academicYear('2026-05-31')).toBe('2025-26');
    expect(academicYear('2026-06-01')).toBe('2026-27');
    expect(yearKey('{AY}-{N}', '2027-01-10')).toBe('2026-27');
    expect(yearKey('ADM{N}', '2027-01-10')).toBeNull();
  });

  it('refuses patterns without exactly one {N} or with unknown tokens', () => {
    expect(patternProblem('GV-{YYYY}-{N}')).toBeNull();
    expect(patternProblem('GV-{YYYY}')).toBe('PATTERN_NEEDS_N');
    expect(patternProblem('{N}-{N}')).toBe('PATTERN_NEEDS_N');
    expect(patternProblem('GV-{MM}-{N}')).toBe('PATTERN_UNKNOWN_TOKEN');
    expect(patternProblem('GV#{N}')).toBe('PATTERN_CHARACTERS');
    expect(patternProblem('')).toBe('PATTERN_LENGTH');
  });

  it('restarts at 1 only when the yearly rule sees a new year', () => {
    expect(currentNumber(cfg(), '2027-01-02')).toBe(187);
    expect(currentNumber(cfg({ resetEachYear: true }), '2026-12-31')).toBe(187);
    expect(currentNumber(cfg({ resetEachYear: true }), '2027-01-02')).toBe(1);
  });
});

describe('takeAdmissionNo', () => {
  function tx(numbering: unknown, taken: string[] = []) {
    return {
      $executeRaw: jest.fn(),
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          admissionNumbering: numbering,
          timezone: 'Asia/Kolkata',
        }),
        update: jest.fn(),
      },
      student: {
        findMany: jest.fn(({ where }: any) =>
          Promise.resolve(
            (where.admissionNo.in as string[])
              .filter((a) => taken.includes(a))
              .map((admissionNo) => ({ admissionNo })),
          ),
        ),
      },
    } as any;
  }

  beforeAll(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T06:00:00Z')),
  );
  afterAll(() => jest.useRealTimers());

  it('takes the next free number and moves the counter on, under a lock', async () => {
    const db = tx(cfg(), ['GV-2026-0187', 'GV-2026-0188']);
    expect(await takeAdmissionNo(db, 't1')).toBe('GV-2026-0189');
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        admissionNumbering: expect.objectContaining({
          next: 190,
          year: '2026',
        }),
      },
    });
  });

  it('gives nothing when the school has no rule', async () => {
    expect(await takeAdmissionNo(tx(null), 't1')).toBeNull();
  });
});
