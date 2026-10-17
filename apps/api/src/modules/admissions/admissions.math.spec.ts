import { academicYearStart, funnelOf, furthestStage } from './admissions.math';

describe('admissions funnel', () => {
  it('remembers the furthest stage, even after an enquiry is lost', () => {
    expect(furthestStage('lost', ['campus_tour', 'follow_up', 'lost'])).toBe(
      'follow_up',
    );
    expect(furthestStage('registration', [])).toBe('registration');
    expect(furthestStage('lost', [])).toBe('enquiry');
  });

  it('counts each stage reached and the conversion', () => {
    const f = funnelOf([
      { stage: 'enquiry', furthest: 'enquiry' },
      { stage: 'campus_tour', furthest: 'campus_tour' },
      { stage: 'lost', furthest: 'follow_up' },
      { stage: 'enrolled', furthest: 'enrolled' },
    ]);
    expect(f).toEqual({
      enquiries: 4,
      tours: 3,
      registrations: 1,
      enrolled: 1,
      lost: 1,
      open: 2,
      conversionPct: 25,
    });
    expect(funnelOf([]).conversionPct).toBeNull();
  });

  it('runs the academic year from 1 June', () => {
    expect(academicYearStart('2026-10-17')).toBe('2026-06-01');
    expect(academicYearStart('2027-03-10')).toBe('2026-06-01');
    expect(academicYearStart('2027-06-01')).toBe('2027-06-01');
  });
});
