import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastTarget } from './dto/broadcast-notification.dto';
import { planBroadcast } from './notifications.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid',
  phone: '+911234567890',
  fcmTokens: ['token-abc'],
  ...overrides,
});

const adminActor: ActiveUser = {
  id: 'admin-uuid',
  tenantId: 'tenant-uuid',
  role: Role.admin,
  name: 'Admin',
  isVerified: true,
};

const teacherActor: ActiveUser = {
  id: 'teacher-uuid',
  tenantId: 'tenant-uuid',
  role: Role.teacher,
  name: 'Teacher',
  isVerified: true,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  class: { findUnique: jest.fn() },
  studentParent: { findMany: jest.fn() },
  report: { createMany: jest.fn() },
  subject: { findFirst: jest.fn() },
  broadcast: { create: jest.fn().mockResolvedValue({ id: 'broadcast-uuid' }) },
  notification: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockFcm = {
  sendMulticast: jest
    .fn()
    .mockResolvedValue({ successCount: 1, failureCount: 0, failedTokens: [] }),
};

const mockSms = {
  send: jest.fn().mockResolvedValue({ sid: 'SM123', error: null }),
};

const mockFiles = {
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://signed.example.com/attachment.pdf'),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FcmService, useValue: mockFcm },
        { provide: SmsService, useValue: mockSms },
        { provide: FilesService, useValue: mockFiles },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockPrisma.broadcast.create.mockResolvedValue({ id: 'broadcast-uuid' });
    mockFcm.sendMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      failedTokens: [],
    });
    mockSms.send.mockResolvedValue({ sid: 'SM123', error: null });
    mockFiles.getSignedUrl.mockResolvedValue(
      'https://signed.example.com/attachment.pdf',
    );
  });

  // ── FCM token management ─────────────────────────────────────────────────────

  describe('registerFcmToken', () => {
    it('pushes the token and deduplicates', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        fcmTokens: ['token-abc', 'token-abc'],
      });
      // Second update deduplicates
      mockPrisma.user.update.mockResolvedValue({});

      await service.registerFcmToken('user-uuid', 'token-abc');
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2); // push + dedup
      const dedupCall = mockPrisma.user.update.mock.calls[1][0];
      expect(dedupCall.data.fcmTokens).toEqual(['token-abc']); // deduplicated
    });

    it('skips dedup update when no duplicates', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        fcmTokens: ['token-abc', 'token-xyz'],
      });

      await service.registerFcmToken('user-uuid', 'token-xyz');
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1); // push only
    });
  });

  describe('removeFcmToken', () => {
    it('removes the specified token from the list', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        fcmTokens: ['token-abc', 'token-xyz'],
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.removeFcmToken('user-uuid', 'token-abc');
      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.fcmTokens).toEqual(['token-xyz']);
    });

    it('is a no-op when token does not exist in list', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        fcmTokens: ['token-xyz'],
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.removeFcmToken('user-uuid', 'missing-token');
      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.fcmTokens).toEqual(['token-xyz']);
    });
  });

  // ── broadcast ────────────────────────────────────────────────────────────────

  describe('broadcast — FCM to a specific user', () => {
    it('sends FCM and returns queued count', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'notif-uuid', userId: user.id },
      ]);
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Fee due',
          body: 'Your fee is due',
          targetType: BroadcastTarget.USER,
          targetId: 'user-uuid',
        },
        adminActor,
      );

      expect(result.queued).toBe(1);
      expect(mockFcm.sendMulticast).toHaveBeenCalledTimes(1);
    });

    it('returns queued: 0 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Test',
          body: 'Test',
          targetType: BroadcastTarget.USER,
          targetId: 'missing-uuid',
        },
        adminActor,
      );

      expect(result.queued).toBe(0);
      expect(mockFcm.sendMulticast).not.toHaveBeenCalled();
    });
  });

  describe('broadcast — SMS to all parents', () => {
    it('sends SMS to each parent in the tenant', async () => {
      const parents = [
        makeUser({ id: 'p1', phone: '+911111111111', fcmTokens: [] }),
        makeUser({ id: 'p2', phone: '+912222222222', fcmTokens: [] }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(parents);
      mockPrisma.notification.create
        .mockResolvedValueOnce({ id: 'n1' })
        .mockResolvedValueOnce({ id: 'n2' });
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.sms,
          body: 'School closed tomorrow',
          targetType: BroadcastTarget.ALL_PARENTS,
        },
        adminActor,
      );

      expect(result.queued).toBe(2);
      expect(mockSms.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('broadcast — FCM to a class', () => {
    it('resolves parent users from student links', async () => {
      const parent = makeUser({ id: 'p1', fcmTokens: ['tok1'] });
      mockPrisma.studentParent.findMany.mockResolvedValue([{ parent }]);
      mockPrisma.$transaction.mockResolvedValue([{ id: 'n1', userId: 'p1' }]);
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Report ready',
          body: 'A new report has been published',
          targetType: BroadcastTarget.CLASS,
          targetId: 'class-uuid',
        },
        adminActor,
      );

      expect(result.queued).toBe(1);
    });
  });

  describe('broadcast — teacher authorization', () => {
    it('allows a teacher to broadcast to a class they own', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        teachers: [{ teacherId: teacherActor.id, isClassTeacher: true }],
      });
      const parent = makeUser({ id: 'p1', fcmTokens: ['tok1'] });
      mockPrisma.studentParent.findMany.mockResolvedValue([{ parent }]);
      mockPrisma.$transaction.mockResolvedValue([{ id: 'n1', userId: 'p1' }]);
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Homework',
          body: 'Complete chapter 4 by tomorrow',
          targetType: BroadcastTarget.CLASS,
          targetId: 'class-uuid',
        },
        teacherActor,
      );

      expect(result.queued).toBe(1);
    });

    it('allows a co-teacher (not the class teacher) to send homework with a fileKey', async () => {
      // Two separate class.findUnique calls happen here: the permission check
      // (assertTeacherCanBroadcast, selects teachers) and the homework-report
      // creation this triggers (createHomeworkReports, selects academicYear +
      // students) — each needs its own mocked shape.
      mockPrisma.class.findUnique
        .mockResolvedValueOnce({
          teachers: [{ teacherId: teacherActor.id, isClassTeacher: false }],
        })
        .mockResolvedValueOnce({
          academicYear: '2025-26',
          students: [{ id: 'student-1' }],
        });
      const parent = makeUser({ id: 'p1', fcmTokens: ['tok1'] });
      mockPrisma.studentParent.findMany.mockResolvedValue([{ parent }]);
      mockPrisma.$transaction.mockResolvedValue([{ id: 'n1', userId: 'p1' }]);
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Homework',
          body: 'Complete chapter 4 by tomorrow',
          targetType: BroadcastTarget.CLASS,
          targetId: 'class-uuid',
          fileKey: 'private/tenant/attachments/homework.jpg',
        },
        teacherActor,
      );

      expect(result.queued).toBe(1);
    });

    it('rejects a co-teacher (not the class teacher) sending a plain text notice', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        teachers: [{ teacherId: teacherActor.id, isClassTeacher: false }],
      });

      await expect(
        service.broadcast(
          'tenant-uuid',
          {
            channel: NotificationChannel.fcm,
            body: 'No homework today',
            targetType: BroadcastTarget.CLASS,
            targetId: 'class-uuid',
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a teacher broadcasting to a class they do not own', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        teachers: [{ teacherId: 'other-teacher-uuid' }],
      });

      await expect(
        service.broadcast(
          'tenant-uuid',
          {
            channel: NotificationChannel.fcm,
            body: 'Homework',
            targetType: BroadcastTarget.CLASS,
            targetId: 'class-uuid',
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a teacher broadcasting to a nonexistent class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.broadcast(
          'tenant-uuid',
          {
            channel: NotificationChannel.fcm,
            body: 'Homework',
            targetType: BroadcastTarget.CLASS,
            targetId: 'class-uuid',
          },
          teacherActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a teacher broadcasting to targetType other than class', async () => {
      await expect(
        service.broadcast(
          'tenant-uuid',
          {
            channel: NotificationChannel.sms,
            body: 'Homework',
            targetType: BroadcastTarget.ALL_PARENTS,
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.class.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('broadcast — file attachment', () => {
    it('resolves fileKey into a signed URL and includes it in the FCM data payload', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'notif-uuid', userId: user.id },
      ]);
      mockPrisma.notification.update.mockResolvedValue({});

      await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Homework',
          body: 'See attached worksheet',
          targetType: BroadcastTarget.USER,
          targetId: 'user-uuid',
          fileKey: 'private/tenant-uuid/attachments/worksheet.pdf',
        },
        adminActor,
      );

      expect(mockFiles.getSignedUrl).toHaveBeenCalledWith(
        'private/tenant-uuid/attachments/worksheet.pdf',
        'tenant-uuid',
        24 * 60 * 60,
      );
      expect(mockFcm.sendMulticast).toHaveBeenCalledWith(
        ['token-abc'],
        'Homework',
        'See attached worksheet',
        expect.objectContaining({
          attachmentUrl: 'https://signed.example.com/attachment.pdf',
          broadcastId: 'broadcast-uuid',
          // A lone PDF from an older client is treated as a notice.
          type: 'notice',
          attachmentCount: '1',
        }),
      );
    });

    it('does not call getSignedUrl when no fileKey is provided', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'notif-uuid', userId: user.id },
      ]);
      mockPrisma.notification.update.mockResolvedValue({});

      await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Test',
          body: 'Test',
          targetType: BroadcastTarget.USER,
          targetId: 'user-uuid',
        },
        adminActor,
      );

      expect(mockFiles.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('broadcast — FCM with no tokens registered', () => {
    it('marks notifications as failed when no tokens', async () => {
      const user = makeUser({ fcmTokens: [] });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'n1', userId: user.id },
      ]);
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.broadcast(
        'tenant-uuid',
        {
          channel: NotificationChannel.fcm,
          title: 'Test',
          body: 'Test',
          targetType: BroadcastTarget.USER,
          targetId: user.id,
        },
        adminActor,
      );

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: NotificationStatus.failed }),
        }),
      );
      expect(mockFcm.sendMulticast).not.toHaveBeenCalled();
    });
  });

  // ── send ─────────────────────────────────────────────────────────────────────

  describe('send (single user)', () => {
    it('creates a notification record and calls FCM', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
      mockPrisma.notification.update.mockResolvedValue({});

      await service.send({
        tenantId: 'tenant-uuid',
        userId: 'user-uuid',
        channel: NotificationChannel.fcm,
        title: 'Test',
        body: 'Hello',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
      expect(mockFcm.sendMulticast).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.notification.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(NotificationStatus.sent);
    });

    it('marks notification as failed when FCM throws', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
      mockFcm.sendMulticast.mockRejectedValueOnce(new Error('FCM error'));
      mockPrisma.notification.update.mockResolvedValue({});

      await service.send({
        tenantId: 'tenant-uuid',
        userId: 'user-uuid',
        channel: NotificationChannel.fcm,
        title: 'Test',
        body: 'Hello',
      });

      const updateCall = mockPrisma.notification.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(NotificationStatus.failed);
      expect(updateCall.data.error).toBe('FCM error');
    });

    it('sends SMS when channel is sms', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
      mockPrisma.notification.update.mockResolvedValue({});

      await service.send({
        tenantId: 'tenant-uuid',
        userId: 'user-uuid',
        channel: NotificationChannel.sms,
        body: 'Fee due',
      });

      expect(mockSms.send).toHaveBeenCalledWith('+911234567890', 'Fee due');
      const updateCall = mockPrisma.notification.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(NotificationStatus.sent);
    });

    it('skips silently when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.send({
        tenantId: 'tenant-uuid',
        userId: 'missing-uuid',
        channel: NotificationChannel.sms,
        body: 'Hello',
      });

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated notification log', async () => {
      const record = {
        id: 'n1',
        body: 'Hello',
        user: { id: 'user-uuid', name: 'Parent', phone: null },
      };
      mockPrisma.$transaction.mockResolvedValue([[record], 1]);

      const result = await service.findAll('tenant-uuid', {});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll('tenant-uuid', {
        status: NotificationStatus.failed,
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcast — Phase 4 attachments, kinds and seen tracking', () => {
    const classBroadcast = (extra: Record<string, unknown>) => ({
      channel: NotificationChannel.fcm,
      title: 'Homework',
      body: 'Chapter 4',
      targetType: BroadcastTarget.CLASS,
      targetId: 'class-uuid',
      ...extra,
    });

    it('allows up to 3 photos, or 1 PDF on a notice only', () => {
      expect(
        planBroadcast(
          classBroadcast({ fileKeys: ['a.jpg', 'b.png', 'c.jpg'] }) as never,
        ),
      ).toMatchObject({ kind: 'homework' });
      expect(
        planBroadcast(
          classBroadcast({
            kind: 'notice',
            fileKeys: ['circular.pdf'],
          }) as never,
        ).attachments,
      ).toEqual([{ key: 'circular.pdf', contentType: 'application/pdf' }]);
      expect(() =>
        planBroadcast(
          classBroadcast({
            kind: 'notice',
            fileKeys: ['a.pdf', 'b.jpg'],
          }) as never,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        planBroadcast(
          classBroadcast({ kind: 'homework', fileKeys: ['a.pdf'] }) as never,
        ),
      ).toThrow(BadRequestException);
    });

    it('records one broadcast, links every parent notification to it, and stores photos + subject on the homework', async () => {
      mockPrisma.class.findUnique
        .mockResolvedValueOnce({
          teachers: [{ teacherId: teacherActor.id, isClassTeacher: false }],
        })
        .mockResolvedValueOnce({
          academicYear: '2026-27',
          students: [{ id: 'student-1' }],
        });
      mockPrisma.subject.findFirst.mockResolvedValue({
        id: 'subject-uuid',
        name: 'Maths',
      });
      const parent = makeUser({ id: 'p1', fcmTokens: ['tok1'] });
      mockPrisma.studentParent.findMany.mockResolvedValue([{ parent }]);
      mockPrisma.$transaction.mockImplementation((ops: unknown[]) =>
        Promise.all(ops),
      );
      mockPrisma.notification.create.mockResolvedValue({
        id: 'n1',
        userId: 'p1',
      });
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast(
        'tenant-uuid',
        classBroadcast({
          kind: 'homework',
          subjectId: 'subject-uuid',
          fileKeys: ['t/a.jpg', 't/b.jpg'],
        }) as never,
        teacherActor,
      );

      expect(result).toEqual({ queued: 1, broadcastId: 'broadcast-uuid' });
      expect(mockPrisma.broadcast.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-uuid',
          senderId: teacherActor.id,
          classId: 'class-uuid',
          subjectId: 'subject-uuid',
          kind: 'homework',
          attachments: [
            { key: 't/a.jpg', contentType: 'image/jpeg' },
            { key: 't/b.jpg', contentType: 'image/jpeg' },
          ],
        }),
      });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'p1',
          broadcastId: 'broadcast-uuid',
        }),
      });
      const reports = mockPrisma.report.createMany.mock.calls[0][0].data;
      expect(reports[0].content).toMatchObject({
        fileKeys: ['t/a.jpg', 't/b.jpg'],
        broadcastId: 'broadcast-uuid',
        subject: 'Maths',
      });
    });

    it('still blocks a subject teacher from sending a notice, even with photos', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        teachers: [{ teacherId: teacherActor.id, isClassTeacher: false }],
      });
      await expect(
        service.broadcast(
          'tenant-uuid',
          classBroadcast({ kind: 'notice', fileKeys: ['t/a.jpg'] }) as never,
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
    });
  });
});
