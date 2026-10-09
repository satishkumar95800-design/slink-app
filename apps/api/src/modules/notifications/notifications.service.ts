import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  BroadcastKind,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  ReportStatus,
  ReportType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { FilesService } from '../files/files.service';
import {
  BroadcastNotificationDto,
  BroadcastTarget,
} from './dto/broadcast-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

/** Push notifications may sit unread in a device's tray a while — longer-lived than the files module's 15-min default */
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export interface BroadcastAttachment {
  key: string;
  contentType: string;
}

/** Content type from the uploaded key's extension (uploads keep the original extension). */
export function contentTypeForKey(key: string): string {
  const ext = key.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

/**
 * Normalises old (single fileKey, no kind) and new (fileKeys + kind) requests,
 * and enforces "up to 3 photos, or 1 PDF on a notice".
 */
export function planBroadcast(dto: BroadcastNotificationDto): { kind: BroadcastKind; attachments: BroadcastAttachment[] } {
  const keys = dto.fileKeys ?? (dto.fileKey ? [dto.fileKey] : []);
  const attachments = keys.map((key) => ({ key, contentType: contentTypeForKey(key) }));
  // Older clients don't send kind: photos meant homework; a lone PDF can only be a notice.
  const kind =
    dto.kind ?? (attachments.some((a) => a.contentType !== 'application/pdf') ? BroadcastKind.homework : BroadcastKind.notice);
  const pdfs = attachments.filter((a) => a.contentType === 'application/pdf').length;
  if (attachments.length > 3) throw new BadRequestException('Attach at most 3 photos');
  if (pdfs > 0 && (attachments.length > 1 || kind !== BroadcastKind.notice)) {
    throw new BadRequestException('Attach up to 3 photos, or a single PDF on a notice');
  }
  return { kind, attachments };
}

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
    private readonly files: FilesService,
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
    actor: ActiveUser,
  ): Promise<{ queued: number; broadcastId?: string }> {
    const plan = planBroadcast(dto);
    if (actor.role === Role.teacher) {
      await this.assertTeacherCanBroadcast(tenantId, dto, plan.kind, actor);
    }
    const subject =
      plan.kind === BroadcastKind.homework && dto.subjectId
        ? await this.prisma.subject.findFirst({ where: { id: dto.subjectId, tenantId }, select: { id: true, name: true } })
        : null;
    if (dto.subjectId && plan.kind === BroadcastKind.homework && !subject) throw new NotFoundException('Subject not found');

    const users = await this.resolveTargetUsers(tenantId, dto);

    if (users.length === 0) {
      return { queued: 0 };
    }

    // Signing every key up front also proves each file exists and belongs to this school.
    const signedUrls = await Promise.all(
      plan.attachments.map((a) => this.files.getSignedUrl(a.key, tenantId, ATTACHMENT_SIGNED_URL_TTL_SECONDS)),
    );

    const broadcast = await this.prisma.broadcast.create({
      data: {
        tenantId,
        senderId: actor.id,
        classId: dto.targetType === BroadcastTarget.CLASS ? dto.targetId : null,
        subjectId: subject?.id ?? null,
        kind: plan.kind,
        title: dto.title ?? null,
        body: dto.body,
        attachments: plan.attachments as unknown as Prisma.InputJsonValue,
      },
    });

    const data = this.resolveDataPayload(dto, plan, broadcast.id, signedUrls);

    if (dto.channel === NotificationChannel.fcm) {
      await this.broadcastFcm(tenantId, users, dto, data, broadcast.id);
    } else {
      await this.broadcastSms(tenantId, users, dto, broadcast.id);
    }

    // Homework to a class also persists a published Report per student, so it
    // shows up under the child's Homework later — not just as a push a parent
    // might dismiss and lose.
    if (
      actor.role === Role.teacher &&
      plan.kind === BroadcastKind.homework &&
      dto.targetType === BroadcastTarget.CLASS &&
      dto.targetId
    ) {
      await this.createHomeworkReports(tenantId, dto.targetId, actor.id, {
        caption: dto.body,
        fileKeys: plan.attachments.map((a) => a.key),
        attachmentUrl: signedUrls[0],
        broadcastId: broadcast.id,
        subject: subject?.name ?? null,
      });
    }

    return { queued: users.length, broadcastId: broadcast.id };
  }

  /** One published Report(type=homework) per student in the class — mirrors
   * the permission check already done in assertTeacherCanBroadcast (any
   * teacher linked to the class may send homework), so no extra check here. */
  private async createHomeworkReports(
    tenantId: string,
    classId: string,
    teacherId: string,
    item: { caption: string; fileKeys: string[]; attachmentUrl: string | undefined; broadcastId: string; subject: string | null },
  ): Promise<void> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
      select: { academicYear: true, students: { select: { id: true } } },
    });
    if (!cls || cls.students.length === 0) return;

    const term = new Date().toISOString().slice(0, 10);

    await this.prisma.report.createMany({
      data: cls.students.map((student) => ({
        tenantId,
        studentId: student.id,
        classId,
        teacherId,
        type: ReportType.homework,
        term,
        academicYear: cls.academicYear,
        // attachmentUrl is a 24h signed link (kept for older app builds); readers
        // re-sign from fileKey(s) so photos keep loading after it expires.
        content: {
          caption: item.caption,
          fileKey: item.fileKeys[0] ?? null,
          fileKeys: item.fileKeys,
          attachmentUrl: item.attachmentUrl ?? null,
          broadcastId: item.broadcastId,
          subject: item.subject,
        },
        status: ReportStatus.published,
        publishedAt: new Date(),
      })),
    });
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

  /**
   * A user's own notification history (parent/teacher "view later" list) —
   * always scoped to the caller's own id, never a client-supplied userId.
   */
  async findMine(tenantId: string, userId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = { tenantId, userId };
    if (query.channel) where.channel = query.channel;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        select: {
          id: true,
          title: true,
          body: true,
          data: true,
          channel: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Teachers may only broadcast to a class they're linked to (mirrors the check in
   * ReportsService). A notice additionally requires the teacher to be the
   * class's designated class teacher — a co-/subject-teacher who only has class
   * access via a TeacherSubject assignment may send homework but not notices.
   */
  private async assertTeacherCanBroadcast(
    tenantId: string,
    dto: BroadcastNotificationDto,
    kind: BroadcastKind,
    actor: ActiveUser,
  ): Promise<void> {
    if (dto.targetType !== BroadcastTarget.CLASS) {
      throw new ForbiddenException(
        'Teachers can only broadcast to their own class',
      );
    }

    const cls = await this.prisma.class.findUnique({
      where: { id: dto.targetId, tenantId },
      select: { teachers: { select: { teacherId: true, isClassTeacher: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const link = cls.teachers.find((t) => t.teacherId === actor.id);
    if (!link) {
      throw new ForbiddenException(
        'Teachers can only broadcast to their own class',
      );
    }

    if (kind === BroadcastKind.notice && !link.isClassTeacher) {
      throw new ForbiddenException(
        'Only the class teacher can send a text notice to the whole class',
      );
    }
  }

  /** Resolves dto.fileKey (from POST /files/upload) into a long-lived signed URL for the FCM data payload */
  /** FCM data payload (string values only). attachmentUrl = first photo, for older app builds. */
  private resolveDataPayload(
    dto: BroadcastNotificationDto,
    plan: { kind: BroadcastKind; attachments: BroadcastAttachment[] },
    broadcastId: string,
    signedUrls: string[],
  ): Record<string, string> {
    return {
      ...dto.data,
      type: plan.kind,
      broadcastId,
      // Class broadcasts carry their class so a parent's Notices list can be filtered per child.
      ...(dto.targetType === BroadcastTarget.CLASS && dto.targetId ? { classId: dto.targetId } : {}),
      ...(signedUrls[0] ? { attachmentUrl: signedUrls[0] } : {}),
      attachmentCount: String(plan.attachments.length),
    };
  }

  private async resolveTargetUsers(
    tenantId: string,
    dto: BroadcastNotificationDto,
  ) {
    if (dto.targetType === BroadcastTarget.USER) {
      if (!dto.targetId)
        throw new NotFoundException('targetId is required for user target');
      const user = await this.prisma.user.findUnique({
        where: { id: dto.targetId, tenantId },
        select: { id: true, phone: true, fcmTokens: true },
      });
      return user ? [user] : [];
    }

    if (dto.targetType === BroadcastTarget.CLASS) {
      if (!dto.targetId)
        throw new NotFoundException('targetId is required for class target');
      // Collect parents of all students in the class
      const links = await this.prisma.studentParent.findMany({
        where: { student: { classId: dto.targetId, tenantId } },
        select: {
          parent: { select: { id: true, phone: true, fcmTokens: true } },
        },
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
    data: Record<string, string> | undefined,
    broadcastId: string,
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
            data: data ?? Prisma.JsonNull,
            broadcastId,
          },
        }),
      ),
    );

    if (allTokens.length === 0) {
      await this.prisma.notification.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: {
          status: NotificationStatus.failed,
          error: 'No FCM tokens registered',
        },
      });
      return;
    }

    const { failedTokens } = await this.fcm.sendMulticast(
      allTokens,
      dto.title ?? '',
      dto.body,
      data,
    );
    const failedSet = new Set(failedTokens);

    // Mark each notification as sent or failed based on whether their tokens failed
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const record = records[i];
      const allFailed =
        user.fcmTokens.length > 0 &&
        user.fcmTokens.every((t) => failedSet.has(t));

      await this.prisma.notification.update({
        where: { id: record.id },
        data: {
          status: allFailed
            ? NotificationStatus.failed
            : NotificationStatus.sent,
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
    broadcastId: string,
  ) {
    for (const user of users) {
      const record = await this.prisma.notification.create({
        data: {
          tenantId,
          userId: user.id,
          channel: NotificationChannel.sms,
          body: dto.body,
          data: dto.data ?? Prisma.JsonNull,
          broadcastId,
        },
      });

      await this.dispatch(
        record.id,
        { ...user, fcmTokens: [] },
        {
          tenantId,
          userId: user.id,
          channel: NotificationChannel.sms,
          body: dto.body,
        },
      );
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
        await this.fcm.sendMulticast(
          user.fcmTokens,
          opts.title ?? '',
          opts.body,
          opts.data,
        );
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
