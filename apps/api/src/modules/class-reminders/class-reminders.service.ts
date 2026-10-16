import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../notifications/fcm.service';
import { effectiveLanguage } from '../../common/i18n/languages';
import { toDbDate, todayIn } from '../attendance/attendance-dates';
import { loadPeriodSchedule } from '../timetable/period-schedule';
import { classReminderText } from './class-reminder-text';

/** Used when a teacher has never changed the setting. */
export const DEFAULT_MINUTES_BEFORE = 5;
/** The longest a teacher can choose; also how far ahead each check looks. */
const MAX_MINUTES_BEFORE = 5;
const TICK_MS = 60_000;
/** Sent-log rows older than this are deleted. */
const KEEP_SENT_DAYS = 7;

const WEEKDAY_NUMBER: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function localClock(timeZone: string, at: Date) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  const weekday =
    WEEKDAY_NUMBER[
      new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(
        at,
      )
    ];
  return { date: todayIn(timeZone, at), weekday, time };
}

/** "HH:MM" -> minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Teachers' "next class" push: once a minute, each period starting within the
 * next few minutes sends its teacher a reminder, at the lead time they chose
 * (default 5 minutes). Runs in-process (no Redis needed); the sent log makes
 * every reminder go out once, even after a restart or with two API instances.
 */
@Injectable()
export class ClassRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassRemindersService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CLASS_REMINDERS_DISABLED === 'true'
    ) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getSetting(userId: string) {
    const row = await this.prisma.classReminderSetting.findUnique({
      where: { userId },
      select: { minutesBefore: true },
    });
    return { minutesBefore: row ? row.minutesBefore : DEFAULT_MINUTES_BEFORE };
  }

  async updateSetting(
    tenantId: string,
    userId: string,
    minutesBefore: number | null,
  ) {
    await this.prisma.classReminderSetting.upsert({
      where: { userId },
      create: { userId, tenantId, minutesBefore },
      update: { minutesBefore },
    });
    return { minutesBefore };
  }

  /** One pass over every school; never throws (a failure only skips this minute). */
  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: {
          isActive: true,
          features: { path: ['timetable'], equals: true },
          OR: [
            { periodTimings: { some: {} } },
            { classPeriodTimings: { some: {} } },
          ],
        },
        select: { id: true, timezone: true, defaultLanguage: true },
      });
      for (const tenant of tenants) {
        try {
          await this.remindTenant(tenant, now);
        } catch (err) {
          this.logger.error(
            `Class reminders failed for tenant ${tenant.id}: ${(err as Error).message}`,
          );
        }
      }
      if (now.getUTCMinutes() === 0) await this.pruneSentLog(now);
    } catch (err) {
      this.logger.error(`Class reminders failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async remindTenant(
    tenant: { id: string; timezone: string; defaultLanguage: string },
    now: Date,
  ) {
    const timeZone = tenant.timezone || 'Asia/Kolkata';
    const clock = localClock(timeZone, now);
    if (clock.weekday === 7) return;

    const nowMin = toMinutes(clock.time);
    const windowEnd = nowMin + MAX_MINUTES_BEFORE;
    if (windowEnd >= 24 * 60) return; // no school periods around midnight
    const from = clock.time;
    const to = `${String(Math.floor(windowEnd / 60)).padStart(2, '0')}:${String(windowEnd % 60).padStart(2, '0')}`;

    // Which period numbers start in the next few minutes, by either schedule?
    const startsSoon = { startTime: { gt: from, lte: to } };
    const [schoolSoon, classSoon] = await Promise.all([
      this.prisma.periodTiming.findMany({
        where: { tenantId: tenant.id, ...startsSoon },
        select: { periodNumber: true },
      }),
      this.prisma.classPeriodTiming.findMany({
        where: { tenantId: tenant.id, ...startsSoon },
        select: { periodNumber: true },
      }),
    ]);
    const periodNumbers = [
      ...new Set([...schoolSoon, ...classSoon].map((t) => t.periodNumber)),
    ];
    if (periodNumbers.length === 0) return;

    const date = toDbDate(clock.date);
    const holiday = await this.prisma.schoolHoliday.findUnique({
      where: { tenantId_date: { tenantId: tenant.id, date } },
      select: { id: true },
    });
    if (holiday) return;

    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: tenant.id,
        dayOfWeek: clock.weekday,
        periodNumber: { in: periodNumbers },
      },
      select: {
        id: true,
        periodNumber: true,
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { name: true } },
        teacher: {
          select: {
            fcmTokens: true,
            preferredLanguage: true,
            classReminderSetting: { select: { minutesBefore: true } },
          },
        },
      },
    });
    if (slots.length === 0) return;

    const schedule = await loadPeriodSchedule(this.prisma, tenant.id, [
      ...new Set(slots.map((s) => s.class.id)),
    ]);

    for (const slot of slots) {
      const time = schedule.timeFor(slot.class.id, slot.periodNumber);
      if (!time) continue;
      const setting = slot.teacher.classReminderSetting;
      const lead = setting ? setting.minutesBefore : DEFAULT_MINUTES_BEFORE;
      if (lead == null) continue;
      const minutesUntil = toMinutes(time.startTime) - nowMin;
      if (minutesUntil <= 0 || minutesUntil > lead) continue;
      if (slot.teacher.fcmTokens.length === 0) continue;
      if (!(await this.claim(slot.id, date))) continue;

      const { title, body } = classReminderText(
        effectiveLanguage(
          slot.teacher.preferredLanguage,
          tenant.defaultLanguage,
        ),
        {
          minutes: minutesUntil,
          periodNumber: slot.periodNumber,
          subject: slot.subject.name,
          className: [slot.class.name, slot.class.section]
            .filter(Boolean)
            .join(' '),
          startTime: time.startTime,
        },
      );
      await this.fcm.sendMulticast(slot.teacher.fcmTokens, title, body, {
        type: 'class_reminder',
      });
    }
  }

  /** Records the reminder as sent; false when another pass already sent it. */
  private async claim(slotId: string, date: Date): Promise<boolean> {
    try {
      await this.prisma.classReminderSent.create({ data: { slotId, date } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }
  }

  private async pruneSentLog(now: Date) {
    const cutoff = new Date(now.getTime() - KEEP_SENT_DAYS * 86_400_000);
    await this.prisma.classReminderSent.deleteMany({
      where: { date: { lt: cutoff } },
    });
  }
}
