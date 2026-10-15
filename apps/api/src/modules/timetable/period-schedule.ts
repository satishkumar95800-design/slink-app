import type { PrismaService } from '../../prisma/prisma.service';

export interface PeriodTime {
  startTime: string;
  endTime: string;
}

/**
 * Bell times for these classes: a class with its own schedule uses only that
 * (class_period_timings); every other class uses the school's (period_timings).
 */
export async function loadPeriodSchedule(
  prisma: PrismaService,
  tenantId: string,
  classIds: string[],
) {
  const [school, perClass] = await Promise.all([
    prisma.periodTiming.findMany({
      where: { tenantId },
      select: { periodNumber: true, startTime: true, endTime: true },
    }),
    classIds.length
      ? prisma.classPeriodTiming
          .findMany({
            where: { tenantId, classId: { in: classIds } },
            select: {
              classId: true,
              periodNumber: true,
              startTime: true,
              endTime: true,
            },
          })
          // If the table is missing (migration not applied yet), fall back to
          // the school's schedule rather than breaking the teacher's day view.
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const schoolByPeriod = new Map(school.map((t) => [t.periodNumber, t]));
  const byClass = new Map<string, Map<number, PeriodTime>>();
  for (const t of perClass) {
    let periods = byClass.get(t.classId);
    if (!periods) byClass.set(t.classId, (periods = new Map()));
    periods.set(t.periodNumber, t);
  }

  return {
    /** True when the school or any of these classes has times set. */
    configured: school.length > 0 || perClass.length > 0,
    timeFor(classId: string, periodNumber: number): PeriodTime | null {
      const own = byClass.get(classId);
      const t = own ? own.get(periodNumber) : schoolByPeriod.get(periodNumber);
      return t ? { startTime: t.startTime, endTime: t.endTime } : null;
    },
  };
}
