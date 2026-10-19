import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationChannel, Prisma, Role } from '@prisma/client';
import { effectiveLanguage } from '../../common/i18n/languages';
import { PrismaService } from '../../prisma/prisma.service';
import { fromDbDate, toDbDate, todayIn } from '../attendance/attendance-dates';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, holidayNoticeText, holidayRunStarting } from './holiday-run';

const TICK_MS = 5 * 60_000;
/** School-local window for the morning push. */
const SEND_FROM = '07:00';
const SEND_UNTIL = '11:00';
/** How far ahead a run of holidays is looked up (covers long breaks). */
const LOOKAHEAD_DAYS = 60;

const localTime = (timeZone: string, at: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);

/**
 * Parents' holiday push: on the first school day of a run of school holidays,
 * between 07:00 and 11:00 school time, every parent of the school gets one
 * push (and notification history entry) in their language. The
 * holiday_notices row, keyed by the run's first day, makes it go out once,
 * even after a restart or with two API instances. Teachers get nothing: their
 * next-class reminders already skip holidays. In-process, no Redis needed.
 */
@Injectable()
export class HolidayNoticesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HolidayNoticesService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.HOLIDAY_NOTICES_DISABLED === 'true'
    )
      return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over schools with a holiday around today; never throws. */
  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const near = {
        gte: new Date(now.getTime() - 2 * 86_400_000),
        lte: new Date(now.getTime() + 2 * 86_400_000),
      };
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true, schoolHolidays: { some: { date: near } } },
        select: { id: true, timezone: true, defaultLanguage: true },
      });
      for (const tenant of tenants) {
        try {
          await this.notifyTenant(tenant, now);
        } catch (err) {
          this.logger.error(
            `Holiday notice for school ${tenant.id} failed: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Holiday notices pass failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  async notifyTenant(
    tenant: { id: string; timezone: string; defaultLanguage: string },
    now: Date,
  ): Promise<number> {
    const timeZone = tenant.timezone || 'Asia/Kolkata';
    const time = localTime(timeZone, now);
    if (time < SEND_FROM || time >= SEND_UNTIL) return 0;
    const today = todayIn(timeZone, now);

    const rows = await this.prisma.schoolHoliday.findMany({
      where: {
        tenantId: tenant.id,
        date: {
          gte: toDbDate(addDays(today, -7)),
          lte: toDbDate(addDays(today, LOOKAHEAD_DAYS)),
        },
      },
      select: { date: true, name: true },
    });
    const run = holidayRunStarting(
      new Map(rows.map((r) => [fromDbDate(r.date), r.name])),
      today,
    );
    if (!run) return 0;
    if (!(await this.claim(tenant.id, run.from))) return 0;

    const parents = await this.prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: Role.parent,
        linkedStudents: { some: {} },
      },
      select: { id: true, preferredLanguage: true },
    });
    let sent = 0;
    for (const p of parents) {
      const { title, body } = holidayNoticeText(
        effectiveLanguage(p.preferredLanguage, tenant.defaultLanguage),
        run,
      );
      try {
        await this.notifications.send({
          tenantId: tenant.id,
          userId: p.id,
          channel: NotificationChannel.fcm,
          title,
          body,
          data: { type: 'holiday', from: run.from, to: run.to },
        });
        sent++;
      } catch (err) {
        this.logger.warn(
          `Holiday notice to ${p.id} failed: ${(err as Error).message}`,
        );
      }
    }
    await this.prisma.holidayNotice.update({
      where: {
        tenantId_date: { tenantId: tenant.id, date: toDbDate(run.from) },
      },
      data: { sentCount: sent },
    });
    return sent;
  }

  /** Records the run as announced; false when another pass already did. */
  private async claim(tenantId: string, from: string): Promise<boolean> {
    try {
      await this.prisma.holidayNotice.create({
        data: { tenantId, date: toDbDate(from) },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
        return false;
      throw err;
    }
  }
}
