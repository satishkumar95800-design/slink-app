import { Injectable, Logger } from '@nestjs/common';
import {
  FeeStatus,
  NotificationChannel,
  PaymentClaimStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatDateOnly, formatRupees } from '../../common/format';
import { toDbDate, todayIn } from '../attendance/attendance-dates';

type ReminderKind = 'in3days' | 'today';

const text = {
  title: (kind: ReminderKind) =>
    kind === 'today' ? 'Fee due today' : 'Fee due in 3 days',
  body: (amount: string, firstName: string, feeName: string, dueDate: string) =>
    `${amount} for ${firstName} (${feeName}) is due on ${dueDate}.`,
};

function addDays(ymd: string, days: number): string {
  const d = toDbDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily fee-due pushes to parents: 3 days before the due date and on the day
 * (docs/SPEC-improvements.md §3.7). Fees with a payment claim under review are
 * skipped. Each push records a reminderKey so a re-run on the same day
 * (e.g. after a restart) never sends twice.
 */
@Injectable()
export class FeeRemindersService {
  private readonly logger = new Logger(FeeRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendDueReminders(now: Date = new Date()): Promise<{ sent: number }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true },
    });
    let sent = 0;
    for (const tenant of tenants) {
      try {
        sent += await this.remindTenant(
          tenant.id,
          tenant.timezone || 'Asia/Kolkata',
          now,
        );
      } catch (err) {
        this.logger.error(
          `Fee reminders failed for tenant ${tenant.id}: ${(err as Error).message}`,
        );
      }
    }
    return { sent };
  }

  private async remindTenant(
    tenantId: string,
    timeZone: string,
    now: Date,
  ): Promise<number> {
    const today = todayIn(timeZone, now);
    const targets: Record<string, ReminderKind> = {
      [today]: 'today',
      [addDays(today, 3)]: 'in3days',
    };

    const fees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        status: { notIn: [FeeStatus.paid, FeeStatus.waived] },
        dueDate: { in: Object.keys(targets).map(toDbDate) },
        paymentClaims: { none: { status: PaymentClaimStatus.pending } },
      },
      select: {
        id: true,
        amountDue: true,
        amountPaid: true,
        dueDate: true,
        feeStructure: { select: { name: true } },
        student: {
          select: {
            id: true,
            name: true,
            parents: { select: { parentId: true } },
          },
        },
      },
    });

    let sent = 0;
    for (const fee of fees) {
      const outstanding = Number(fee.amountDue) - Number(fee.amountPaid);
      if (outstanding <= 0) continue;
      const dueYmd = fee.dueDate.toISOString().slice(0, 10);
      const kind = targets[dueYmd];
      const reminderKey = `fee_due:${fee.id}:${kind}:${today}`;
      const firstName = fee.student.name.trim().split(/\s+/)[0];

      for (const { parentId } of fee.student.parents) {
        const already = await this.prisma.notification.findFirst({
          where: {
            tenantId,
            userId: parentId,
            data: { path: ['reminderKey'], equals: reminderKey },
          },
          select: { id: true },
        });
        if (already) continue;

        await this.notifications
          .send({
            tenantId,
            userId: parentId,
            channel: NotificationChannel.fcm,
            title: text.title(kind),
            body: text.body(
              formatRupees(outstanding),
              firstName,
              fee.feeStructure.name,
              formatDateOnly(fee.dueDate),
            ),
            data: {
              type: 'fee_due',
              studentFeeId: fee.id,
              studentId: fee.student.id,
              reminderKey,
            },
          })
          .then(() => sent++)
          .catch((err) =>
            this.logger.warn(
              `Fee reminder to ${parentId} failed: ${(err as Error).message}`,
            ),
          );
      }
    }
    return sent;
  }
}
