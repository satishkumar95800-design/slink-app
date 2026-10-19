import type { Language } from '../../common/i18n/languages';
import { displayDate } from '../attendance/attendance-dates';

/** YYYY-MM-DD plus [days] (UTC calendar arithmetic). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isSunday = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).getUTCDay() === 0;

export interface HolidayRun {
  from: string;
  to: string;
  name: string;
}

/**
 * The run of holidays that starts today, or null. Sundays don't count either
 * way: today must be a listed holiday that is not a Sunday, and the last
 * non-Sunday day before it must not be a holiday, so a run is announced once,
 * on its first school day. The run continues over holidays and Sundays and
 * ends on its last listed holiday. [holidays] maps YYYY-MM-DD to the name.
 */
export function holidayRunStarting(
  holidays: Map<string, string>,
  today: string,
): HolidayRun | null {
  const name = holidays.get(today);
  if (!name || isSunday(today)) return null;
  let prev = addDays(today, -1);
  while (isSunday(prev)) prev = addDays(prev, -1);
  if (holidays.has(prev)) return null;
  let to = today;
  for (
    let d = addDays(today, 1);
    holidays.has(d) || isSunday(d);
    d = addDays(d, 1)
  ) {
    if (holidays.has(d)) to = d;
  }
  return { from: today, to, name };
}

/** The morning push to parents, in their language. */
export function holidayNoticeText(
  language: Language,
  run: HolidayRun,
): { title: string; body: string } {
  const from = displayDate(run.from);
  const to = displayDate(run.to);
  const oneDay = run.from === run.to;
  switch (language) {
    case 'kn':
      return oneDay
        ? {
            title: 'ಇಂದು ಶಾಲೆಗೆ ರಜೆ',
            body: `ಇಂದು (${from}) ${run.name} ಪ್ರಯುಕ್ತ ಶಾಲೆಗೆ ರಜೆ.`,
          }
        : {
            title: 'ಶಾಲೆಗೆ ರಜೆ ಆರಂಭ',
            body: `${run.name} ಪ್ರಯುಕ್ತ ${from} ರಿಂದ ${to} ರವರೆಗೆ ಶಾಲೆಗೆ ರಜೆ.`,
          };
    case 'hi':
      return oneDay
        ? {
            title: 'आज स्कूल की छुट्टी है',
            body: `आज (${from}) ${run.name} के कारण स्कूल बंद है।`,
          }
        : {
            title: 'स्कूल की छुट्टियाँ शुरू',
            body: `${run.name} के कारण स्कूल ${from} से ${to} तक बंद है।`,
          };
    default:
      return oneDay
        ? {
            title: 'School holiday today',
            body: `School is closed today (${from}) for ${run.name}.`,
          }
        : {
            title: 'School holidays begin',
            body: `School is closed for ${run.name} from ${from} to ${to}.`,
          };
  }
}
