import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { BroadcastNotificationDto, BroadcastTarget } from './dto/broadcast-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

export interface SendOptions {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  title?: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly sms: SmsService,
  ) {}

  // ── FCM token management ────────────────────────────────────────────────────

  async registerFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      // addToSet via Prisma: push + deduplicate in one operation
      data: { fcmTokens: { push: token } },
    });

    // Deduplicate tokens (Prisma array push doesn't prevent duplicates)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fcmTokens: true },
    });
    const unique = [...new Set(user.fcmTokens)];
    if (unique.length !== user.fcmTokens.length) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: unique },
      });
    }
  }

  async removeFcmToken(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fcmTokens: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: user.fcmTokens.filter((t) => t !== token) },
    });
  }

  // ── Broadcast ────────────────────────────────────────────────────────────────

  async broadcast(
    tenantId: string,
    dto: BroadcastNotificationDto,
  ): Promise<{ queued: number }> {
    const users = await this.resolveTargetUsers(tenantId, dto);

    if (users.length === 0) {
      return { queued: 0 };
    }

    if (dto.channel === NotificationChannel.fcm) {
      await this.broadcastFcm(tenantId, users, dto);
    } else {
      await this.broadcastSms(tenantId, users, dto);
    }

    return { queued: users.length };
  }

  // ── Send to a single user (used internally by other modules) ────────────────

  async send(opts: SendOptions): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: opts.userId },
      select: { id: true, phone: true, fcmTokens: true },
    });
    if (!user) return;

    const record = await this.prisma.notification.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        channel: opts.channel,
        title: opts.title,
        body: opts.body,
        data: opts.data ?? Prisma.JsonNull,
      },
    });

    await this.dispatch(record.id, user, opts);
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = { tenantId };
    if (query.userId) where.userId = query.userId;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: { user: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private async resolveTargetUsers(
    tenantId: string,
    dto: BroadcastNotificationDto,
  ) {
    if (dto.targetType === BroadcastTarget.USER) {
      if (!dto.targetId) throw new NotFoundException('targetId is required for user target');
      const user = await this.prisma.user.findUnique({
        where: { id: dto.targetId, tenantId },
        select: { id: true, phone: true, fcmTokens: true },
      });
      return user ? [user] : [];
    }

    if (dto.targetType === BroadcastTarget.CLASS) {
      if (!dto.targetId) throw new NotFoundException('targetId is required for class target');
      // Collect parents of all students in the class
      const links = await this.prisma.studentParent.findMany({
        where: { student: { classId: dto.targetId, tenantId } },
        select: { parent: { select: { id: true, phone: true, fcmTokens: true } } },
      });
      return deduplicateById(links.map((l) => l.parent));
    }

    // all_parents in tenant
    return this.prisma.user.findMany({
      where: { tenantId, role: Role.parent },
      select: { id: true, phone: true, fcmTokens: true },
    });
  }

  private async broadcastFcm(
    tenantId: string,
    users: Array<{ id: string; fcmTokens: string[] }>,
    dto: BroadcastNotificationDto,
  ) {
    const allTokens = users.flatMap((u) => u.fcmTokens);

    // Create pending notification records for each user
    const records = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.notification.create({
          data: {
            tenantId,
            userId: u.id,
            channel: NotificationChannel.fcm,
            title: dto.title,
            body: dto.body,
            data: dto.data ?? Prisma.JsonNull,
          },
        }),
      ),
    );

    if (allTokens.length === 0) {
      await this.prisma.notification.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: { status: NotificationStatus.failed, error: 'No FCM tokens registered' },
      });
      return;
    }

    const { failedTokens } = await this.fcm.sendMulticast(
      allTokens,
      dto.title ?? '',
      dto.body,
      dto.data,
    );
    const failedSet = new Set(failedTokens);

    // Mark each notification as sent or failed based on whether their tokens failed
    for (let i = 0; i < users.length; i++) {
      const user = users[i]!;
      const record = records[i]!;
      const allFailed = user.fcmTokens.length > 0 && user.fcmTokens.every((t) => failedSet.has(t));

      await this.prisma.notification.update({
        where: { id: record.id },
        data: {
          status: allFailed ? NotificationStatus.failed : NotificationStatus.sent,
          sentAt: allFailed ? undefined : new Date(),
          error: allFailed ? 'All FCM tokens failed' : undefined,
        },
      });
    }
  }

  private async broadcastSms(
    tenantId: string,
    users: Array<{ id: string; phone: string | null }>,
    dto: BroadcastNotificationDto,
  ) {
    for (const user of users) {
      const record = await this.prisma.notification.create({
        data: {
          tenantId,
          userId: user.id,
          channel: NotificationChannel.sms,
          body: dto.body,
          data: dto.data ?? Prisma.JsonNull,
        },
      });

      await this.dispatch(record.id, { ...user, fcmTokens: [] }, {
        tenantId,
        userId: user.id,
        channel: NotificationChannel.sms,
        body: dto.body,
      });
    }
  }

  private async dispatch(
    recordId: string,
    user: { phone: string | null; fcmTokens: string[] },
    opts: SendOptions,
  ) {
    try {
      if (opts.channel === NotificationChannel.fcm) {
        if (user.fcmTokens.length === 0) {
          throw new Error('No FCM tokens registered for user');
        }
        await this.fcm.sendMulticast(user.fcmTokens, opts.title ?? '', opts.body, opts.data);
      } else {
        if (!user.phone) throw new Error('User has no phone number');
        const { error } = await this.sms.send(user.phone, opts.body);
        if (error) throw new Error(error);
      }

      await this.prisma.notification.update({
        where: { id: recordId },
        data: { status: NotificationStatus.sent, sentAt: new Date() },
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Notification ${recordId} failed: ${error}`);
      await this.prisma.notification.update({
        where: { id: recordId },
        data: { status: NotificationStatus.failed, error },
      });
    }
  }
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
