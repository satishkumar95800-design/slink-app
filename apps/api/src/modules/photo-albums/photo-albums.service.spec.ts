/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FileCategory } from '../files/dto/upload-file.dto';
import { isModuleOwnedKey } from '../files/files.service';
import { albumStatus, dueForReminder, KEEP_DAYS } from './album-rules';
import { PhotoAlbumsService } from './photo-albums.service';

const T = 'tenant-1';
const ADMIN: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: T,
  name: 'Admin',
  isVerified: true,
};
const TEACHER: ActiveUser = {
  id: 'teacher-1',
  role: Role.teacher,
  tenantId: T,
  name: 'Divya',
  isVerified: true,
};
const NOW = new Date('2026-10-24T06:00:00Z');
const DAY = 86_400_000;

const album = (extra: object = {}) => ({
  id: 'al-1',
  title: 'Sports Day',
  description: null,
  eventDate: null,
  classIds: ['c-5a'],
  studentIds: [],
  createdBy: 'teacher-1',
  publishedAt: null,
  expiresAt: null,
  extended: false,
  reminderSentAt: null,
  expiredAt: null,
  createdAt: NOW,
  ...extra,
});

function setup() {
  const prisma: any = {
    photoAlbum: {
      findFirst: jest.fn().mockResolvedValue(album()),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'al-1' }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
    },
    albumPhoto: {
      count: jest.fn().mockResolvedValue(3),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(({ data }: any) =>
        Promise.resolve({ id: 'ph-1', ...data }),
      ),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: 1000 } }),
    },
    albumDownload: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    class: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(where.id.in.map((id: string) => ({ id }))),
      ),
    },
    student: {
      // Children of the album's classes (with parents), or the ones asked for by id.
      findMany: jest.fn(({ where }: any) => {
        const all = [
          {
            id: 's1',
            classId: 'c-5a',
            parents: [
              { parent: { id: 'mum', preferredLanguage: 'kn' } },
              { parent: { id: 'dad', preferredLanguage: null } },
            ],
          },
          {
            id: 's2',
            classId: 'c-5a',
            parents: [{ parent: { id: 'mum', preferredLanguage: 'kn' } }],
          },
        ];
        return Promise.resolve(
          where.id?.in
            ? all.filter((s: any) => where.id.in.includes(s.id))
            : all,
        );
      }),
    },
    studentParent: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ student: { id: 's1', classId: 'c-5a' } }),
    },
    classTeacher: {
      findMany: jest.fn().mockResolvedValue([{ classId: 'c-5a' }]),
    },
    teacherSubject: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ defaultLanguage: 'en', timezone: 'Asia/Kolkata' }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  const files: any = {
    upload: jest.fn((_t: string, f: any, category: string) =>
      Promise.resolve({
        key: `private/${T}/albums/al-1/${category === FileCategory.ALBUM_THUMB ? 'thumbs/' : ''}${f.originalname}`,
        size: f.size,
      }),
    ),
    getSignedUrl: jest.fn((key: string) =>
      Promise.resolve(`https://s3/${key}`),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const notifications: any = { send: jest.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    files,
    notifications,
    service: new PhotoAlbumsService(prisma, files, notifications),
  };
}

const file = (name: string, size = 300_000) =>
  ({ originalname: name, size, mimetype: 'image/jpeg' }) as Express.Multer.File;
const flush = () => new Promise((r) => setImmediate(r));

beforeAll(() =>
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(NOW),
);
afterAll(() => jest.useRealTimers());

describe('album rules', () => {
  it('is a draft, then live for 30 days, then expired', () => {
    expect(albumStatus(album())).toBe('draft');
    const live = album({
      publishedAt: NOW,
      expiresAt: new Date(NOW.getTime() + KEEP_DAYS * DAY),
    });
    expect(albumStatus(live, NOW)).toBe('live');
    expect(albumStatus(live, new Date(NOW.getTime() + 31 * DAY))).toBe(
      'expired',
    );
  });

  it('reminds once, in the last 3 days', () => {
    const live = album({
      publishedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 2 * DAY),
    });
    expect(dueForReminder(live, NOW)).toBe(true);
    expect(dueForReminder({ ...live, reminderSentAt: NOW }, NOW)).toBe(false);
    expect(
      dueForReminder(
        { ...live, expiresAt: new Date(NOW.getTime() + 10 * DAY) },
        NOW,
      ),
    ).toBe(false);
  });
});

describe('PhotoAlbumsService', () => {
  it('lets a teacher share only with classes they teach', async () => {
    const { service } = setup();
    await expect(
      service.create(T, TEACHER, {
        title: 'Trip',
        classIds: ['c-6b'],
        studentIds: [],
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_YOUR_CLASS' } });
    await expect(
      service.create(T, TEACHER, {
        title: 'Trip',
        classIds: [],
        studentIds: [],
      }),
    ).rejects.toMatchObject({
      response: { code: 'ALBUM_NO_AUDIENCE' },
    });
    await expect(
      service.create(T, ADMIN, {
        title: 'Trip',
        classIds: ['c-6b'],
        studentIds: [],
      }),
    ).resolves.toBeDefined();
  });

  it('stores the screened photo and its thumbnail under the album, module-owned', async () => {
    const { service, files, prisma } = setup();
    const p = await service.addPhoto(
      T,
      TEACHER,
      'al-1',
      file('a.jpg'),
      file('a-thumb.jpg', 30_000),
      { width: 1600, height: 1200 },
    );
    expect(files.upload).toHaveBeenCalledWith(
      T,
      expect.anything(),
      FileCategory.ALBUM_PHOTO,
      'al-1',
    );
    expect(files.upload).toHaveBeenCalledWith(
      T,
      expect.anything(),
      FileCategory.ALBUM_THUMB,
      'al-1',
    );
    expect(prisma.albumPhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ size: 330_000, width: 1600 }),
      }),
    );
    expect(p.thumbUrl).toContain('/thumbs/');
    expect(isModuleOwnedKey(`private/${T}/albums/al-1/a.jpg`)).toBe(true);
  });

  it('stops at 100 photos and at the school allowance, and cleans up a half upload', async () => {
    const { service, prisma, files } = setup();
    prisma.albumPhoto.count.mockResolvedValueOnce(100);
    await expect(
      service.addPhoto(T, TEACHER, 'al-1', file('a.jpg'), file('t.jpg'), {}),
    ).rejects.toMatchObject({
      response: { code: 'ALBUM_FULL' },
    });
    prisma.albumPhoto.aggregate.mockResolvedValueOnce({
      _sum: { size: 10 * 1024 ** 3 },
    });
    await expect(
      service.addPhoto(T, TEACHER, 'al-1', file('a.jpg'), file('t.jpg'), {}),
    ).rejects.toMatchObject({
      response: { code: 'ALBUM_STORAGE_FULL' },
    });
    files.upload
      .mockResolvedValueOnce({ key: 'private/t/albums/al-1/a.jpg', size: 1 })
      .mockRejectedValueOnce(new Error('S3 down'));
    await expect(
      service.addPhoto(T, TEACHER, 'al-1', file('a.jpg'), file('t.jpg'), {}),
    ).rejects.toThrow('S3 down');
    expect(files.delete).toHaveBeenCalledWith('private/t/albums/al-1/a.jpg', T);
  });

  it("only the album's maker or an admin can change it", async () => {
    const { service } = setup();
    const other = { ...TEACHER, id: 'teacher-2' };
    await expect(service.publish(T, other, 'al-1')).rejects.toMatchObject({
      response: { code: 'ALBUM_NOT_FOUND' },
    });
  });

  it('publishes for 30 days and tells each parent once, in their language', async () => {
    const { service, prisma, notifications } = setup();
    await service.publish(T, TEACHER, 'al-1');
    expect(prisma.photoAlbum.update).toHaveBeenCalledWith({
      where: { id: 'al-1' },
      data: { publishedAt: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY) },
    });
    await flush();
    expect(notifications.send).toHaveBeenCalledTimes(2);
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mum',
        title: 'ಹೊಸ ಫೋಟೋಗಳು: Sports Day',
        data: { type: 'album', albumId: 'al-1', studentId: 's1' },
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'dad',
        body: '3 photos from Sports Day. Save the ones you like before 23/11/2026.',
      }),
    );
  });

  it('will not publish an empty album', async () => {
    const { service, prisma } = setup();
    prisma.albumPhoto.count.mockResolvedValue(0);
    await expect(service.publish(T, TEACHER, 'al-1')).rejects.toMatchObject({
      response: { code: 'ALBUM_EMPTY' },
    });
  });

  it('an admin extends a live album once', async () => {
    const { service, prisma } = setup();
    const live = album({
      publishedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 5 * DAY),
    });
    prisma.photoAlbum.findFirst.mockResolvedValue(live);
    await expect(service.extend(T, TEACHER, 'al-1')).rejects.toMatchObject({
      response: { code: 'ADMIN_ONLY' },
    });
    await service.extend(T, ADMIN, 'al-1');
    expect(prisma.photoAlbum.update).toHaveBeenCalledWith({
      where: { id: 'al-1' },
      data: {
        expiresAt: new Date(NOW.getTime() + 35 * DAY),
        extended: true,
        reminderSentAt: null,
      },
    });
    prisma.photoAlbum.findFirst.mockResolvedValue({ ...live, extended: true });
    await expect(service.extend(T, ADMIN, 'al-1')).rejects.toMatchObject({
      response: { code: 'ALBUM_EXTENDED' },
    });
  });

  describe('parents', () => {
    it("open only an album sent to their own child's class, while it is live", async () => {
      const { service, prisma } = setup();
      prisma.studentParent.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.viewForChild(T, 'mum', 's9', 'al-1'),
      ).rejects.toMatchObject({
        response: { code: 'STUDENT_NOT_FOUND' },
      });

      prisma.photoAlbum.findFirst.mockResolvedValueOnce(
        album({ publishedAt: NOW, expiresAt: new Date(NOW.getTime() + DAY) }),
      );
      await service.viewForChild(T, 'mum', 's1', 'al-1');
      expect(prisma.photoAlbum.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            id: 'al-1',
            tenantId: T,
            OR: [{ classIds: { has: 'c-5a' } }, { studentIds: { has: 's1' } }],
          },
        }),
      );

      prisma.photoAlbum.findFirst.mockResolvedValueOnce(album());
      await expect(
        service.viewForChild(T, 'mum', 's1', 'al-1'),
      ).rejects.toMatchObject({
        response: { code: 'ALBUM_NOT_FOUND' },
      });
      prisma.photoAlbum.findFirst.mockResolvedValueOnce(
        album({ publishedAt: NOW, expiresAt: NOW, expiredAt: NOW }),
      );
      await expect(
        service.viewForChild(T, 'mum', 's1', 'al-1'),
      ).rejects.toMatchObject({
        response: { code: 'ALBUM_EXPIRED' },
      });
    });

    it('records a save once per parent', async () => {
      const { service, prisma } = setup();
      prisma.photoAlbum.findFirst.mockResolvedValue(
        album({ publishedAt: NOW, expiresAt: new Date(NOW.getTime() + DAY) }),
      );
      await service.markSaved(T, 'mum', 's1', 'al-1');
      expect(prisma.albumDownload.upsert).toHaveBeenCalledWith({
        where: { albumId_userId: { albumId: 'al-1', userId: 'mum' } },
        create: { albumId: 'al-1', userId: 'mum' },
        update: {},
      });
    });
  });

  describe('hourly pass', () => {
    it('deletes the files of an expired album and keeps the entry', async () => {
      const { service, prisma, files } = setup();
      prisma.photoAlbum.findMany.mockResolvedValue([
        {
          ...album({
            publishedAt: new Date(NOW.getTime() - 31 * DAY),
            expiresAt: new Date(NOW.getTime() - DAY),
          }),
          tenantId: T,
        },
      ]);
      prisma.albumPhoto.findMany.mockResolvedValue([
        { key: 'k1', thumbKey: 'k1t' },
      ]);
      await service.tick(NOW);
      expect(files.delete).toHaveBeenCalledWith('k1', T);
      expect(files.delete).toHaveBeenCalledWith('k1t', T);
      expect(prisma.albumPhoto.deleteMany).toHaveBeenCalledWith({
        where: { albumId: 'al-1' },
      });
      expect(prisma.photoAlbum.update).toHaveBeenCalledWith({
        where: { id: 'al-1' },
        data: { expiredAt: NOW },
      });
    });

    it('reminds only parents who have not saved, once', async () => {
      const { service, prisma, notifications } = setup();
      prisma.photoAlbum.findMany.mockResolvedValue([
        {
          ...album({
            publishedAt: NOW,
            expiresAt: new Date(NOW.getTime() + 2 * DAY),
          }),
          tenantId: T,
        },
      ]);
      prisma.albumDownload.findMany.mockResolvedValue([{ userId: 'mum' }]);
      await service.tick(NOW);
      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'dad',
          title: 'Photos leave on 26/10/2026',
        }),
      );
      prisma.photoAlbum.updateMany.mockResolvedValue({ count: 0 });
      await service.tick(NOW);
      expect(notifications.send).toHaveBeenCalledTimes(1);
    });
  });
});
