import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import type { BroadcastAttachment } from '../notifications/notifications.service';

const SENT_LIST_LIMIT = 50;
/** Attachment links handed to the app; re-signed on every read. */
const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;

export interface SignedAttachment {
  url: string;
  contentType: string;
}

/**
 * Notice/homework "seen by" tracking (docs/SPEC-improvements.md §4.3). Each
 * recipient's notification row carries broadcastId; seenAt is set the first
 * time that parent opens the item in the app.
 */
@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /** Parent opened the item. Idempotent: only the first open is recorded. */
  async markSeen(tenantId: string, broadcastId: string, user: ActiveUser) {
    const { count } = await this.prisma.notification.updateMany({
      where: { tenantId, broadcastId, userId: user.id, seenAt: null },
      data: { seenAt: new Date() },
    });
    return { broadcastId, marked: count > 0 };
  }

  /** The caller's sent notices/homework, newest first, with "seen by X/Y". Admins see every sender's. */
  async listSent(tenantId: string, user: ActiveUser) {
    const broadcasts = await this.prisma.broadcast.findMany({
      where: { tenantId, ...(this.isAdmin(user) ? {} : { senderId: user.id }) },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        attachments: true,
        createdAt: true,
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { name: true } },
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: SENT_LIST_LIMIT,
    });
    const counts = await this.seenCounts(
      tenantId,
      broadcasts.map((b) => b.id),
    );

    return broadcasts.map((b) => ({
      id: b.id,
      kind: b.kind,
      title: b.title,
      body: b.body,
      createdAt: b.createdAt,
      class: b.class,
      subject: b.subject?.name ?? null,
      senderName: b.sender.name,
      attachmentCount: this.attachments(b.attachments).length,
      recipients: counts.get(b.id)?.recipients ?? 0,
      seen: counts.get(b.id)?.seen ?? 0,
    }));
  }

  /** Parents who haven't opened the item yet, with their children in the class — sender or admin only. */
  async listUnseen(tenantId: string, broadcastId: string, user: ActiveUser) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, tenantId },
      select: { senderId: true, classId: true },
    });
    if (!broadcast) throw new NotFoundException('Notice or homework not found');
    if (!this.isAdmin(user) && broadcast.senderId !== user.id) {
      throw new ForbiddenException(
        'You can only see who opened items you sent',
      );
    }

    const rows = await this.prisma.notification.findMany({
      where: { tenantId, broadcastId, seenAt: null },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            linkedStudents: {
              where: broadcast.classId
                ? { student: { classId: broadcast.classId } }
                : undefined,
              select: { student: { select: { name: true } } },
            },
          },
        },
      },
    });
    const byParent = new Map(rows.map((r) => [r.user.id, r.user]));
    return [...byParent.values()]
      .map((p) => ({
        parentId: p.id,
        name: p.name,
        phone: p.phone,
        children: p.linkedStudents.map((l) => l.student.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Distinct parents reached and distinct parents who opened, per broadcast. */
  async seenCounts(tenantId: string, broadcastIds: string[]) {
    const result = new Map<string, { recipients: number; seen: number }>();
    if (broadcastIds.length === 0) return result;
    const rows = await this.prisma.notification.findMany({
      where: { tenantId, broadcastId: { in: broadcastIds } },
      select: { broadcastId: true, userId: true, seenAt: true },
    });
    const sets = new Map<string, { all: Set<string>; seen: Set<string> }>();
    for (const r of rows) {
      const s = sets.get(r.broadcastId!) ?? { all: new Set(), seen: new Set() };
      s.all.add(r.userId);
      if (r.seenAt) s.seen.add(r.userId);
      sets.set(r.broadcastId!, s);
    }
    for (const [id, s] of sets)
      result.set(id, { recipients: s.all.size, seen: s.seen.size });
    return result;
  }

  /** Fresh links for a broadcast's stored attachments. */
  async signAttachments(
    tenantId: string,
    raw: Prisma.JsonValue,
  ): Promise<SignedAttachment[]> {
    return Promise.all(
      this.attachments(raw).map(async (a) => ({
        url: await this.files.getSignedUrl(
          a.key,
          tenantId,
          ATTACHMENT_URL_TTL_SECONDS,
          { verifyExists: false },
        ),
        contentType: a.contentType,
      })),
    );
  }

  private attachments(raw: Prisma.JsonValue): BroadcastAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (a): a is { key: string; contentType: string } =>
        !!a &&
        typeof a === 'object' &&
        !Array.isArray(a) &&
        typeof a.key === 'string' &&
        typeof a.contentType === 'string',
    );
  }

  private isAdmin(user: ActiveUser) {
    return user.role === Role.admin || user.role === Role.super_admin;
  }
}
