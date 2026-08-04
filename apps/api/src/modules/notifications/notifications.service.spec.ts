import { Test, TestingModule } from '@nestjs/testing';
import { NotificationChannel, NotificationStatus, Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastTarget } from './dto/broadcast-notification.dto';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid',
  phone: '+911234567890',
  fcmTokens: ['token-abc'],
  ...overrides,
});

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  studentParent: { findMany: jest.fn() },
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
  sendMulticast: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0, failedTokens: [] }),
};

const mockSms = {
  send: jest.fn().mockResolvedValue({ sid: 'SM123', error: null }),
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
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockFcm.sendMulticast.mockResolvedValue({ successCount: 1, failureCount: 0, failedTokens: [] });
    mockSms.send.mockResolvedValue({ sid: 'SM123', error: null });
  });

  // ── FCM token management ─────────────────────────────────────────────────────

  describe('registerFcmToken', () => {
    it('pushes the token and deduplicates', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ fcmTokens: ['token-abc', 'token-abc'] });
      // Second update deduplicates
      mockPrisma.user.update.mockResolvedValue({});

      await service.registerFcmToken('user-uuid', 'token-abc');
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2); // push + dedup
      const dedupCall = mockPrisma.user.update.mock.calls[1][0];
      expect(dedupCall.data.fcmTokens).toEqual(['token-abc']); // deduplicated
    });

    it('skips dedup update when no duplicates', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ fcmTokens: ['token-abc', 'token-xyz'] });

      await service.registerFcmToken('user-uuid', 'token-xyz');
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1); // push only
    });
  });

  describe('removeFcmToken', () => {
    it('removes the specified token from the list', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ fcmTokens: ['token-abc', 'token-xyz'] });
      mockPrisma.user.update.mockResolvedValue({});

      await service.removeFcmToken('user-uuid', 'token-abc');
      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.fcmTokens).toEqual(['token-xyz']);
    });

    it('is a no-op when token does not exist in list', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ fcmTokens: ['token-xyz'] });
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
      mockPrisma.$transaction.mockResolvedValue([{ id: 'notif-uuid', userId: user.id }]);
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast('tenant-uuid', {
        channel: NotificationChannel.fcm,
        title: 'Fee due',
        body: 'Your fee is due',
        targetType: BroadcastTarget.USER,
        targetId: 'user-uuid',
      });

      expect(result.queued).toBe(1);
      expect(mockFcm.sendMulticast).toHaveBeenCalledTimes(1);
    });

    it('returns queued: 0 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.broadcast('tenant-uuid', {
        channel: NotificationChannel.fcm,
        title: 'Test',
        body: 'Test',
        targetType: BroadcastTarget.USER,
        targetId: 'missing-uuid',
      });

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
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' }).mockResolvedValueOnce({ id: 'n2' });
      mockPrisma.notification.update.mockResolvedValue({});

      const result = await service.broadcast('tenant-uuid', {
        channel: NotificationChannel.sms,
        body: 'School closed tomorrow',
        targetType: BroadcastTarget.ALL_PARENTS,
      });

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

      const result = await service.broadcast('tenant-uuid', {
        channel: NotificationChannel.fcm,
        title: 'Report ready',
        body: 'A new report has been published',
        targetType: BroadcastTarget.CLASS,
        targetId: 'class-uuid',
      });

      expect(result.queued).toBe(1);
    });
  });

  describe('broadcast — FCM with no tokens registered', () => {
    it('marks notifications as failed when no tokens', async () => {
      const user = makeUser({ fcmTokens: [] });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([{ id: 'n1', userId: user.id }]);
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.broadcast('tenant-uuid', {
        channel: NotificationChannel.fcm,
        title: 'Test',
        body: 'Test',
        targetType: BroadcastTarget.USER,
        targetId: user.id,
      });

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
      const record = { id: 'n1', body: 'Hello', user: { id: 'user-uuid', name: 'Parent', phone: null } };
      mockPrisma.$transaction.mockResolvedValue([[record], 1]);

      const result = await service.findAll('tenant-uuid', {});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll('tenant-uuid', { status: NotificationStatus.failed });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
