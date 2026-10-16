import { fromDbDate, toDbDate } from '../attendance/attendance-dates';
import { Db } from './hrms.shared';

/** School holidays in [from, to] as date -> name (the existing SchoolHoliday table). */
export async function loadHolidays(
  db: Db,
  tenantId: string,
  from: string,
  to: string,
): Promise<Map<string, string>> {
  const rows = await db.schoolHoliday.findMany({
    where: { tenantId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    select: { date: true, name: true },
  });
  return new Map(rows.map((h) => [fromDbDate(h.date), h.name]));
}
