import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BroadcastsService } from './broadcasts.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const user = (id: string, role: Role): ActiveUser => ({
  id,
  role,
  tenantId: 'tenant-a',
  name: id,
  isVerified: true,
});
const TEACHER = user('teacher-1', Role.teacher);
const OTHER_TEACHER = user('teacher-2', Role.teacher);
const PARENT = user('parent-1', Role.parent);

describe('BroadcastsService', () => {
  let prisma: {
    notification: { updateMany: jest.Mock; findMany: jest.Mock };
    broadcast: { findMany: jest.Mock; findFirst: jest.Mock };
  };
  let service: BroadcastsService;

  beforeEach(() => {
    prisma = {
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      broadcast: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };
    service = new BroadcastsService(
      prisma as never,
      { getSignedUrl: jest.fn() } as never,
    );
  });

  it("marks only the calling parent's unseen rows for that broadcast, in their school", async () => {
    await service.markSeen('tenant-a', 'b1', PARENT);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        broadcastId: 'b1',
        userId: PARENT.id,
        seenAt: null,
      },
      data: { seenAt: expect.any(Date) },
    });
  });

  it('counts distinct parents reached and distinct parents who opened', async () => {
    prisma.broadcast.findMany.mockResolvedValue([
      {
        id: 'b1',
        kind: 'notice',
        title: 'PTM',
        body: 'Sat',
        attachments: [],
        createdAt: new Date(),
        class: null,
        subject: null,
        sender: { name: 'T' },
      },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { broadcastId: 'b1', userId: 'p1', seenAt: new Date() },
      { broadcastId: 'b1', userId: 'p1', seenAt: null }, // same parent, second child — counted once
      { broadcastId: 'b1', userId: 'p2', seenAt: null },
      { broadcastId: 'b1', userId: 'p3', seenAt: new Date() },
    ]);

    const [item] = await service.listSent('tenant-a', TEACHER);

    expect(item).toMatchObject({ id: 'b1', recipients: 3, seen: 2 });
    expect(prisma.broadcast.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', senderId: TEACHER.id },
      }),
    );
  });

  it('lists who has not seen an item, only for its sender', async () => {
    prisma.broadcast.findFirst.mockResolvedValue({
      senderId: TEACHER.id,
      classId: 'class-1',
    });
    prisma.notification.findMany.mockResolvedValue([
      {
        user: {
          id: 'p2',
          name: 'Ravi',
          phone: '+91',
          linkedStudents: [{ student: { name: 'Om' } }],
        },
      },
    ]);

    expect(await service.listUnseen('tenant-a', 'b1', TEACHER)).toEqual([
      { parentId: 'p2', name: 'Ravi', phone: '+91', children: ['Om'] },
    ]);
    await expect(
      service.listUnseen('tenant-a', 'b1', OTHER_TEACHER),
    ).rejects.toThrow(ForbiddenException);

    prisma.broadcast.findFirst.mockResolvedValue(null);
    await expect(service.listUnseen('tenant-b', 'b1', TEACHER)).rejects.toThrow(
      NotFoundException,
    );
  });
});
