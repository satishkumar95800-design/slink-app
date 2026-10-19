import { holidayNoticeText, holidayRunStarting } from './holiday-run';

// October 2026: Mon 19, Tue 20, Wed 21, Thu 22, Fri 23, Sat 24, Sun 25, Mon 26.
const list = (...days: [string, string][]) => new Map(days);

describe('holidayRunStarting', () => {
  it('announces a single holiday on the day', () => {
    expect(
      holidayRunStarting(list(['2026-10-20', 'Dussehra']), '2026-10-20'),
    ).toEqual({
      from: '2026-10-20',
      to: '2026-10-20',
      name: 'Dussehra',
    });
  });

  it('is silent on a normal day', () => {
    expect(
      holidayRunStarting(list(['2026-10-20', 'Dussehra']), '2026-10-19'),
    ).toBeNull();
  });

  it('announces a run of days once, on its first day', () => {
    const h = list(
      ['2026-10-20', 'Dasara'],
      ['2026-10-21', 'Dasara'],
      ['2026-10-22', 'Dasara'],
    );
    expect(holidayRunStarting(h, '2026-10-20')).toEqual({
      from: '2026-10-20',
      to: '2026-10-22',
      name: 'Dasara',
    });
    expect(holidayRunStarting(h, '2026-10-21')).toBeNull();
    expect(holidayRunStarting(h, '2026-10-22')).toBeNull();
  });

  it('carries a run over a Sunday', () => {
    const h = list(['2026-10-24', 'Deepavali'], ['2026-10-26', 'Deepavali']);
    expect(holidayRunStarting(h, '2026-10-24')).toEqual({
      from: '2026-10-24',
      to: '2026-10-26',
      name: 'Deepavali',
    });
    expect(holidayRunStarting(h, '2026-10-26')).toBeNull();
  });

  it('never sends on a Sunday; a run listed from Sunday is announced on Monday', () => {
    const h = list(
      ['2026-10-25', 'Break'],
      ['2026-10-26', 'Break'],
      ['2026-10-27', 'Break'],
    );
    expect(holidayRunStarting(h, '2026-10-25')).toBeNull();
    expect(holidayRunStarting(h, '2026-10-26')).toEqual({
      from: '2026-10-26',
      to: '2026-10-27',
      name: 'Break',
    });
  });

  it('does not stretch a run over a Sunday with a school day after it', () => {
    const h = list(['2026-10-24', 'Function']);
    expect(holidayRunStarting(h, '2026-10-24')).toEqual({
      from: '2026-10-24',
      to: '2026-10-24',
      name: 'Function',
    });
  });
});

describe('holidayNoticeText', () => {
  it('writes DD/MM/YYYY dates in each language', () => {
    const one = { from: '2026-10-20', to: '2026-10-20', name: 'Dussehra' };
    const many = { from: '2026-10-20', to: '2026-10-22', name: 'Dasara' };
    expect(holidayNoticeText('en', one).body).toBe(
      'School is closed today (20/10/2026) for Dussehra.',
    );
    expect(holidayNoticeText('en', many).body).toBe(
      'School is closed for Dasara from 20/10/2026 to 22/10/2026.',
    );
    expect(holidayNoticeText('kn', many).body).toContain('20/10/2026');
    expect(holidayNoticeText('hi', one).body).toContain('20/10/2026');
  });
});
