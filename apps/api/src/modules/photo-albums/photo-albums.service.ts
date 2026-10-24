import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationChannel, Prisma, Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { effectiveLanguage } from '../../common/i18n/languages';
import { PrismaService } from '../../prisma/prisma.service';
import { FileCategory } from '../files/dto/upload-file.dto';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publishedText, reminderText } from './album-push';
import {
  addDays,
  albumStatus,
  dueForReminder,
  EXTEND_DAYS,
  KEEP_DAYS,
  MAX_PHOTOS_PER_ALBUM,
  SCHOOL_ALLOWANCE_BYTES,
  SHOW_EXPIRED_DAYS,
} from './album-rules';
import { AlbumDto, PhotoMetaDto } from './dto/photo-albums.dto';

const err = (code: string, message: string) => ({ code, message });

/** Signed photo links last long enough to save a whole album. */
const LINK_SECONDS = 60 * 60;
const TICK_MS = 60 * 60 * 1000;

type Db = PrismaService | Prisma.TransactionClient;

const ALBUM = {
  id: true,
  forStaff: true,
  title: true,
  description: true,
  eventDate: true,
  classIds: true,
  studentIds: true,
  createdBy: true,
  publishedAt: true,
  expiresAt: true,
  extended: true,
  reminderSentAt: true,
  expiredAt: true,
  createdAt: true,
} as const;
type AlbumRow = Prisma.PhotoAlbumGetPayload<{ select: typeof ALBUM }>;

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Activity photo albums (Premium Max, flag photoAlbums). A teacher (for the
 * classes they teach) or an admin makes an album for whole classes and/or
 * chosen children, adds photos resized on the device with a thumbnail, and
 * publishes it: parents of those children get a push and can view and save
 * the whole album for KEEP_DAYS. One reminder goes to parents who haven't
 * saved it; at expiry the files are deleted from S3 and the album stays as a
 * dated entry. Files live under private/{tenant}/albums/, served only here.
 */
@Injectable()
export class PhotoAlbumsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PhotoAlbumsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  /**
   * An admin sees every album; a teacher the ones they made plus the shared
   * staff folder; accounts the staff folder.
   */
  async list(tenantId: string, user: ActiveUser) {
    const staffFolder = { forStaff: true, publishedAt: { not: null } };
    const rows = await this.prisma.photoAlbum.findMany({
      where: isAdmin(user)
        ? { tenantId }
        : {
            tenantId,
            OR: [
              ...(user.role === Role.teacher ? [{ createdBy: user.id }] : []),
              staffFolder,
            ],
          },
      orderBy: { createdAt: 'desc' },
      select: {
        ...ALBUM,
        _count: { select: { photos: true, downloads: true } },
      },
    });
    const names = await this.names(rows.map((r) => r.createdBy));
    const now = new Date();
    return rows.map(({ _count, ...a }) => ({
      ...this.summary(a, now),
      photoCount: _count.photos,
      savedCount: _count.downloads,
      createdBy: names.get(a.createdBy) ?? null,
      canManage: canManage(user, a),
    }));
  }

  async create(tenantId: string, user: ActiveUser, dto: AlbumDto) {
    // A staff folder album is for every teacher, admin and accountant.
    const forStaff = dto.forStaff === true;
    if (!forStaff) await this.assertAudience(tenantId, user, dto);
    const album = await this.prisma.$transaction(async (tx) => {
      const created = await tx.photoAlbum.create({
        data: {
          tenantId,
          title: dto.title,
          description: dto.description || null,
          eventDate: dto.eventDate
            ? new Date(`${dto.eventDate}T00:00:00Z`)
            : null,
          forStaff,
          classIds: forStaff ? [] : [...new Set(dto.classIds)],
          studentIds: forStaff ? [] : [...new Set(dto.studentIds)],
          createdBy: user.id,
        },
        select: { id: true },
      });
      await audit(tx, tenantId, user.id, 'albums.created', created.id, {
        title: dto.title,
        forStaff,
        classes: dto.classIds.length,
        students: dto.studentIds.length,
      });
      return created;
    });
    return this.detail(tenantId, user, album.id);
  }

  /** Title and note any time; who sees it only before it is published. */
  async update(tenantId: string, user: ActiveUser, id: string, dto: AlbumDto) {
    const album = await this.managed(tenantId, user, id);
    // Who sees it changes only on a parents' album that is still a draft.
    const draft = !album.publishedAt && !album.forStaff;
    if (draft) await this.assertAudience(tenantId, user, dto);
    await this.prisma.$transaction([
      this.prisma.photoAlbum.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description || null,
          eventDate: dto.eventDate
            ? new Date(`${dto.eventDate}T00:00:00Z`)
            : null,
          ...(draft && {
            classIds: [...new Set(dto.classIds)],
            studentIds: [...new Set(dto.studentIds)],
          }),
        },
      }),
      auditOp(this.prisma, tenantId, user.id, 'albums.updated', id, {
        title: dto.title,
      }),
    ]);
    return this.detail(tenantId, user, id);
  }

  /**
   * Photos with short-lived links, who it is for, and how many saved it. A
   * shared staff folder album is open to every staff login (read-only).
   */
  async detail(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.visible(tenantId, user, id);
    const [photos, recipients, saved, classes, students, used, mine] =
      await Promise.all([
        this.prisma.albumPhoto.findMany({
          where: { albumId: id },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            key: true,
            thumbKey: true,
            width: true,
            height: true,
            size: true,
          },
        }),
        this.recipientsOf(tenantId, album),
        this.prisma.albumDownload.count({ where: { albumId: id } }),
        this.prisma.class.findMany({
          where: { tenantId, id: { in: album.classIds } },
          select: { id: true, name: true, section: true },
        }),
        this.prisma.student.findMany({
          where: { tenantId, id: { in: album.studentIds } },
          select: { id: true, name: true, admissionNo: true },
        }),
        this.usedBytes(tenantId),
        this.prisma.albumDownload.count({
          where: { albumId: id, userId: user.id },
        }),
      ]);
    return {
      ...this.summary(album, new Date()),
      classes,
      students,
      photos: await Promise.all(photos.map((p) => this.photoView(tenantId, p))),
      /** Parents of the album's children, or the school's staff for the staff folder. */
      recipientCount: recipients.size,
      savedCount: saved,
      savedByMe: mine > 0,
      canManage: canManage(user, album),
      limits: {
        photosPerAlbum: MAX_PHOTOS_PER_ALBUM,
        schoolBytes: SCHOOL_ALLOWANCE_BYTES,
        usedBytes: used,
      },
    };
  }

  async addPhoto(
    tenantId: string,
    user: ActiveUser,
    id: string,
    photo: Express.Multer.File,
    thumb: Express.Multer.File,
    meta: PhotoMetaDto,
  ) {
    const album = await this.managed(tenantId, user, id);
    if (albumStatus(album) === 'expired')
      throw new BadRequestException(
        err('ALBUM_EXPIRED', 'This album has expired'),
      );
    const count = await this.prisma.albumPhoto.count({
      where: { albumId: id },
    });
    if (count >= MAX_PHOTOS_PER_ALBUM)
      throw new BadRequestException(
        err(
          'ALBUM_FULL',
          `An album holds up to ${MAX_PHOTOS_PER_ALBUM} photos`,
        ),
      );
    const size = photo.size + thumb.size;
    if ((await this.usedBytes(tenantId)) + size > SCHOOL_ALLOWANCE_BYTES)
      throw new BadRequestException(
        err(
          'ALBUM_STORAGE_FULL',
          "The school's photo storage is full until older albums expire",
        ),
      );

    // The photo goes through the image check; the thumbnail is made from it on the device.
    const stored = await this.files.upload(
      tenantId,
      photo,
      FileCategory.ALBUM_PHOTO,
      id,
    );
    let thumbKey: string;
    try {
      thumbKey = (
        await this.files.upload(tenantId, thumb, FileCategory.ALBUM_THUMB, id)
      ).key;
    } catch (e) {
      await this.files.delete(stored.key, tenantId).catch(() => undefined);
      throw e;
    }
    const row = await this.prisma.albumPhoto.create({
      data: {
        tenantId,
        albumId: id,
        key: stored.key,
        thumbKey,
        size,
        width: meta.width ?? null,
        height: meta.height ?? null,
      },
      select: {
        id: true,
        key: true,
        thumbKey: true,
        width: true,
        height: true,
        size: true,
      },
    });
    return this.photoView(tenantId, row);
  }

  async removePhoto(
    tenantId: string,
    user: ActiveUser,
    id: string,
    photoId: string,
  ) {
    await this.managed(tenantId, user, id);
    const photo = await this.prisma.albumPhoto.findFirst({
      where: { id: photoId, albumId: id, tenantId },
    });
    if (!photo)
      throw new NotFoundException(err('PHOTO_NOT_FOUND', 'Photo not found'));
    await this.prisma.albumPhoto.delete({ where: { id: photoId } });
    await this.deleteFiles(tenantId, [photo.key, photo.thumbKey]);
    return { removed: true };
  }

  /** Parents of the chosen classes and children get a push; the 30 days start. */
  async publish(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.managed(tenantId, user, id);
    if (album.publishedAt)
      throw new ConflictException(
        err('ALBUM_PUBLISHED', 'This album is already published'),
      );
    const photos = await this.prisma.albumPhoto.count({
      where: { albumId: id },
    });
    if (photos === 0)
      throw new BadRequestException(
        err('ALBUM_EMPTY', 'Add photos before publishing'),
      );
    const now = new Date();
    const expiresAt = addDays(now, KEEP_DAYS);
    await this.prisma.$transaction([
      this.prisma.photoAlbum.update({
        where: { id },
        data: { publishedAt: now, expiresAt },
      }),
      auditOp(this.prisma, tenantId, user.id, 'albums.published', id, {
        title: album.title,
        photos,
      }),
    ]);
    const published = { ...album, publishedAt: now, expiresAt };
    void this.notifyRecipients(
      tenantId,
      published,
      (lang, until) => publishedText(lang, album.title, photos, until),
      new Set([user.id]),
    ).catch((e: Error) => this.logger.error(`Album push failed: ${e.message}`));
    return this.detail(tenantId, user, id);
  }

  /** Once, by an admin: EXTEND_DAYS more, and the reminder can go again. */
  async extend(tenantId: string, user: ActiveUser, id: string) {
    if (!isAdmin(user))
      throw new ForbiddenException(
        err('ADMIN_ONLY', 'Only an admin can extend an album'),
      );
    const album = await this.managed(tenantId, user, id);
    if (albumStatus(album) !== 'live' || !album.expiresAt)
      throw new BadRequestException(
        err(
          'ALBUM_NOT_LIVE',
          'Only a published album that has not expired can be extended',
        ),
      );
    if (album.extended)
      throw new ConflictException(
        err('ALBUM_EXTENDED', 'This album has already been extended once'),
      );
    const expiresAt = addDays(album.expiresAt, EXTEND_DAYS);
    await this.prisma.$transaction([
      this.prisma.photoAlbum.update({
        where: { id },
        data: { expiresAt, extended: true, reminderSentAt: null },
      }),
      auditOp(this.prisma, tenantId, user.id, 'albums.extended', id, {
        expiresAt: expiresAt.toISOString(),
      }),
    ]);
    return this.detail(tenantId, user, id);
  }

  async remove(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.managed(tenantId, user, id);
    const photos = await this.prisma.albumPhoto.findMany({
      where: { albumId: id },
      select: { key: true, thumbKey: true },
    });
    await this.prisma.$transaction([
      this.prisma.photoAlbum.delete({ where: { id } }),
      auditOp(this.prisma, tenantId, user.id, 'albums.deleted', id, {
        title: album.title,
        photos: photos.length,
      }),
    ]);
    await this.deleteFiles(
      tenantId,
      photos.flatMap((p) => [p.key, p.thumbKey]),
    );
    return { removed: true };
  }

  // ── Parent ─────────────────────────────────────────────────────────────────

  /** The child's albums: live ones, and recently expired ones without photos. */
  async forChild(tenantId: string, parentId: string, studentId: string) {
    const child = await this.ownChild(tenantId, parentId, studentId);
    const now = new Date();
    const rows = await this.prisma.photoAlbum.findMany({
      where: {
        tenantId,
        publishedAt: { not: null },
        // The staff folder never reaches parents.
        forStaff: false,
        OR: [
          { classIds: { has: child.classId } },
          { studentIds: { has: child.id } },
        ],
        AND: [
          {
            OR: [
              { expiredAt: null },
              { expiredAt: { gt: addDays(now, -SHOW_EXPIRED_DAYS) } },
            ],
          },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        ...ALBUM,
        _count: { select: { photos: true } },
        photos: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { thumbKey: true },
        },
        downloads: { where: { userId: parentId }, select: { at: true } },
      },
    });
    return Promise.all(
      rows.map(async ({ _count, photos, downloads, ...a }) => {
        const status = albumStatus(a, now);
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          eventDate: ymd(a.eventDate),
          publishedAt: a.publishedAt,
          expiresAt: a.expiresAt,
          expired: status === 'expired',
          photoCount: status === 'expired' ? 0 : _count.photos,
          saved: downloads.length > 0,
          coverUrl:
            status === 'live' && photos[0]
              ? await this.files.getSignedUrl(
                  photos[0].thumbKey,
                  tenantId,
                  LINK_SECONDS,
                  { verifyExists: false },
                )
              : null,
        };
      }),
    );
  }

  /** The album's photos for a parent of a child it was sent to. */
  async viewForChild(
    tenantId: string,
    parentId: string,
    studentId: string,
    id: string,
  ) {
    const album = await this.childAlbum(tenantId, parentId, studentId, id);
    const photos = await this.prisma.albumPhoto.findMany({
      where: { albumId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        key: true,
        thumbKey: true,
        width: true,
        height: true,
        size: true,
      },
    });
    return {
      id: album.id,
      title: album.title,
      description: album.description,
      eventDate: ymd(album.eventDate),
      expiresAt: album.expiresAt,
      photos: await Promise.all(photos.map((p) => this.photoView(tenantId, p))),
    };
  }

  /** The parent saved photos (counts once per parent). */
  async markSaved(
    tenantId: string,
    parentId: string,
    studentId: string,
    id: string,
  ) {
    await this.childAlbum(tenantId, parentId, studentId, id);
    await this.prisma.albumDownload.upsert({
      where: { albumId_userId: { albumId: id, userId: parentId } },
      create: { albumId: id, userId: parentId },
      update: {},
    });
    return { saved: true };
  }

  // ── Reminders and expiry (hourly) ──────────────────────────────────────────

  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const albums = await this.prisma.photoAlbum.findMany({
        where: {
          publishedAt: { not: null },
          expiredAt: null,
          expiresAt: { lte: addDays(now, 3) },
        },
        select: { ...ALBUM, tenantId: true },
      });
      for (const a of albums) {
        try {
          if (albumStatus(a, now) === 'expired')
            await this.expire(a.tenantId, a.id, now);
          else if (dueForReminder(a, now))
            await this.remind(a.tenantId, a, now);
        } catch (e) {
          this.logger.error(`Album ${a.id}: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Deletes the files; the album stays as a dated, empty entry. */
  async expire(tenantId: string, id: string, now: Date = new Date()) {
    const photos = await this.prisma.albumPhoto.findMany({
      where: { albumId: id },
      select: { key: true, thumbKey: true },
    });
    await this.deleteFiles(
      tenantId,
      photos.flatMap((p) => [p.key, p.thumbKey]),
    );
    await this.prisma.$transaction([
      this.prisma.albumPhoto.deleteMany({ where: { albumId: id } }),
      this.prisma.photoAlbum.update({
        where: { id },
        data: { expiredAt: now },
      }),
    ]);
  }

  private async remind(tenantId: string, album: AlbumRow, now: Date) {
    // Claim first so a second pass never sends it twice.
    const claimed = await this.prisma.photoAlbum.updateMany({
      where: { id: album.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) return;
    const saved = new Set(
      (
        await this.prisma.albumDownload.findMany({
          where: { albumId: album.id },
          select: { userId: true },
        })
      ).map((d) => d.userId),
    );
    await this.notifyRecipients(
      tenantId,
      album,
      (lang, until) => reminderText(lang, album.title, until),
      saved,
    );
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private summary(a: AlbumRow, now: Date) {
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      eventDate: ymd(a.eventDate),
      forStaff: a.forStaff,
      classIds: a.classIds,
      studentIds: a.studentIds,
      status: albumStatus(a, now),
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
      extended: a.extended,
      createdAt: a.createdAt,
    };
  }

  private async photoView(
    tenantId: string,
    p: {
      id: string;
      key: string;
      thumbKey: string;
      width: number | null;
      height: number | null;
      size: number;
    },
  ) {
    const opts = { verifyExists: false };
    const [url, thumbUrl] = await Promise.all([
      this.files.getSignedUrl(p.key, tenantId, LINK_SECONDS, opts),
      this.files.getSignedUrl(p.thumbKey, tenantId, LINK_SECONDS, opts),
    ]);
    return {
      id: p.id,
      url,
      thumbUrl,
      width: p.width,
      height: p.height,
      size: p.size,
    };
  }

  /** A staff login saved photos from a live album it can see. */
  async markSavedByStaff(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.visible(tenantId, user, id);
    if (albumStatus(album) !== 'live')
      throw new BadRequestException(
        err('ALBUM_EXPIRED', 'These photos have been removed'),
      );
    await this.prisma.albumDownload.upsert({
      where: { albumId_userId: { albumId: id, userId: user.id } },
      create: { albumId: id, userId: user.id },
      update: {},
    });
    return { saved: true };
  }

  /** The album, if this login may see it: one it manages, or a shared staff folder album. */
  private async visible(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.prisma.photoAlbum.findFirst({
      where: { id, tenantId },
      select: ALBUM,
    });
    if (
      !album ||
      !(canManage(user, album) || (album.forStaff && album.publishedAt))
    )
      throw new NotFoundException(err('ALBUM_NOT_FOUND', 'Album not found'));
    return album;
  }

  /** The album, if this login may change it (an admin, or the teacher who made it). */
  private async managed(tenantId: string, user: ActiveUser, id: string) {
    const album = await this.prisma.photoAlbum.findFirst({
      where: { id, tenantId },
      select: ALBUM,
    });
    if (!album || !canManage(user, album))
      throw new NotFoundException(err('ALBUM_NOT_FOUND', 'Album not found'));
    return album;
  }

  /** Classes and children of this school; a teacher only within the classes they teach. */
  private async assertAudience(
    tenantId: string,
    user: ActiveUser,
    dto: AlbumDto,
  ) {
    const classIds = [...new Set(dto.classIds)];
    const studentIds = [...new Set(dto.studentIds)];
    if (classIds.length + studentIds.length === 0)
      throw new BadRequestException(
        err('ALBUM_NO_AUDIENCE', 'Choose at least one class or child'),
      );
    const [classes, students] = await Promise.all([
      this.prisma.class.findMany({
        where: { tenantId, id: { in: classIds } },
        select: { id: true },
      }),
      this.prisma.student.findMany({
        where: { tenantId, id: { in: studentIds } },
        select: { id: true, classId: true },
      }),
    ]);
    if (
      classes.length !== classIds.length ||
      students.length !== studentIds.length
    )
      throw new BadRequestException(
        err('ALBUM_AUDIENCE_INVALID', 'A class or child is not in this school'),
      );
    if (isAdmin(user)) return;
    const mine = await this.teacherClassIds(tenantId, user.id);
    const outside =
      classIds.some((c) => !mine.has(c)) ||
      students.some((s) => !mine.has(s.classId));
    if (outside)
      throw new ForbiddenException(
        err(
          'NOT_YOUR_CLASS',
          'Teachers can share albums only with the classes they teach',
        ),
      );
  }

  private async teacherClassIds(tenantId: string, teacherId: string) {
    const [classTeacher, subjects] = await Promise.all([
      this.prisma.classTeacher.findMany({
        where: { teacherId, class: { tenantId } },
        select: { classId: true },
      }),
      this.prisma.teacherSubject.findMany({
        where: { tenantId, teacherId },
        select: { classId: true },
      }),
    ]);
    return new Set([...classTeacher, ...subjects].map((r) => r.classId));
  }

  private async ownChild(
    tenantId: string,
    parentId: string,
    studentId: string,
  ) {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId, student: { tenantId } },
      select: { student: { select: { id: true, classId: true } } },
    });
    if (!link)
      throw new NotFoundException(
        err('STUDENT_NOT_FOUND', 'Student not found'),
      );
    return link.student;
  }

  /** A live album sent to the parent's own child. */
  private async childAlbum(
    tenantId: string,
    parentId: string,
    studentId: string,
    id: string,
  ) {
    const child = await this.ownChild(tenantId, parentId, studentId);
    const album = await this.prisma.photoAlbum.findFirst({
      where: {
        id,
        tenantId,
        forStaff: false,
        OR: [
          { classIds: { has: child.classId } },
          { studentIds: { has: child.id } },
        ],
      },
      select: ALBUM,
    });
    if (!album || !album.publishedAt)
      throw new NotFoundException(err('ALBUM_NOT_FOUND', 'Album not found'));
    if (albumStatus(album) === 'expired')
      throw new BadRequestException(
        err('ALBUM_EXPIRED', 'These photos have been removed'),
      );
    return album;
  }

  /**
   * Who an album is for: each parent once (with a child, for the push tap),
   * or every teacher, admin and accountant for the staff folder.
   */
  private async recipientsOf(
    tenantId: string,
    album: Pick<AlbumRow, 'forStaff' | 'classIds' | 'studentIds'>,
  ): Promise<
    Map<string, { language: string | null; studentId: string | null }>
  > {
    if (album.forStaff) {
      const staff = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: [Role.teacher, Role.admin, Role.accounts] },
        },
        select: { id: true, preferredLanguage: true },
      });
      return new Map(
        staff.map((u) => [
          u.id,
          { language: u.preferredLanguage, studentId: null },
        ]),
      );
    }
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        OR: [
          { classId: { in: album.classIds } },
          { id: { in: album.studentIds } },
        ],
      },
      select: {
        id: true,
        parents: {
          select: { parent: { select: { id: true, preferredLanguage: true } } },
        },
      },
    });
    const out = new Map<
      string,
      { language: string | null; studentId: string | null }
    >();
    for (const s of students)
      for (const { parent } of s.parents)
        if (!out.has(parent.id))
          out.set(parent.id, {
            language: parent.preferredLanguage,
            studentId: s.id,
          });
    return out;
  }

  private async notifyRecipients(
    tenantId: string,
    album: AlbumRow,
    text: (
      lang: ReturnType<typeof effectiveLanguage>,
      until: string,
    ) => { title: string; body: string },
    skip: Set<string> = new Set(),
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultLanguage: true, timezone: true },
    });
    const until = album.expiresAt
      ? new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: tenant?.timezone || 'Asia/Kolkata',
        }).format(album.expiresAt)
      : '';
    let sent = 0;
    for (const [userId, p] of await this.recipientsOf(tenantId, album)) {
      if (skip.has(userId)) continue;
      try {
        await this.notifications.send({
          tenantId,
          userId,
          channel: NotificationChannel.fcm,
          ...text(
            effectiveLanguage(p.language, tenant?.defaultLanguage),
            until,
          ),
          data: p.studentId
            ? { type: 'album', albumId: album.id, studentId: p.studentId }
            : { type: 'staff_album', albumId: album.id },
        });
        sent++;
      } catch (e) {
        this.logger.warn(
          `Album push to ${userId} failed: ${(e as Error).message}`,
        );
      }
    }
    return sent;
  }

  /** Bytes of photos in this school's albums that have not expired. */
  private async usedBytes(tenantId: string) {
    const r = await this.prisma.albumPhoto.aggregate({
      where: { tenantId, album: { expiredAt: null } },
      _sum: { size: true },
    });
    return r._sum.size ?? 0;
  }

  private async deleteFiles(tenantId: string, keys: string[]) {
    for (const key of keys)
      await this.files
        .delete(key, tenantId)
        .catch((e: Error) =>
          this.logger.warn(`Could not delete ${key}: ${e.message}`),
        );
  }

  private async names(ids: string[]) {
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: [...new Set(ids)] } },
          select: { id: true, name: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u.name]));
  }
}

const isAdmin = (user: ActiveUser) =>
  user.role === Role.admin || user.role === Role.super_admin;

/** An admin, or the teacher who made the album. */
const canManage = (user: ActiveUser, album: { createdBy: string }) =>
  isAdmin(user) || album.createdBy === user.id;

function audit(
  db: Db,
  tenantId: string,
  actorId: string,
  action: string,
  entityId: string,
  diff: Prisma.InputJsonValue,
) {
  return db.auditLog.create({
    data: { tenantId, actorId, action, entityType: 'album', entityId, diff },
  });
}

const auditOp = (
  db: PrismaService,
  tenantId: string,
  actorId: string,
  action: string,
  entityId: string,
  diff: Prisma.InputJsonValue,
) =>
  db.auditLog.create({
    data: { tenantId, actorId, action, entityType: 'album', entityId, diff },
  });
