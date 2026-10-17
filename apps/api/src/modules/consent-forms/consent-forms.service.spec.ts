import { ConsentDecision, Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ConsentFormsService } from './consent-forms.service';
import { consentRequestText } from './consent-text';

const ADMIN: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: 't1',
  name: 'Admin',
  isVerified: true,
};
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const NOW = new Date('2026-10-16T06:00:00.000Z'); // 16/10/2026 in IST

const event = {
  id: 'e1',
  tenantId: 't1',
  type: 'EVENT',
  title: 'Trip to Mysuru Zoo',
  description: 'Bus leaves at 7 am',
  startDate: day('2026-11-05'),
  endDate: null,
  startTime: '07:00',
  endTime: null,
  venue: 'Mysuru Zoo',
};
const formRow = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  tenantId: 't1',
  eventId: 'e1',
  body: 'I allow my child to go on the trip.',
  deadline: day('2026-10-30'),
  createdBy: 'admin-1',
  createdAt: NOW,
  event,
  classes: [
    { classId: 'c1', class: { id: 'c1', name: 'Class 5', section: 'A' } },
  ],
  ...over,
});
const student = (id: string, name: string) => ({
  id,
  name,
  admissionNo: `A-${id}`,
  rollNo: null,
  class: { name: 'Class 5', section: 'A' },
});

function setup() {
  const prisma = {
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ timezone: 'Asia/Kolkata', defaultLanguage: 'en' }),
    },
    schoolEvent: { findFirst: jest.fn() },
    class: { count: jest.fn().mockResolvedValue(1) },
    consentForm: {
      create: jest.fn().mockResolvedValue(formRow()),
      findFirst: jest.fn().mockResolvedValue(formRow()),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    },
    consentResponse: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockImplementation(
          ({ create }: { create: Record<string, unknown> }) => ({
            ...create,
            signedAt: NOW,
          }),
        ),
      count: jest.fn().mockResolvedValue(0),
    },
    student: {
      findMany: jest
        .fn()
        .mockResolvedValue([student('s1', 'Asha'), student('s2', 'Ravi')]),
    },
    studentParent: {
      findMany: jest.fn().mockResolvedValue([{ parentId: 'p1' }]),
      findFirst: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn() },
  };
  const notifications = { send: jest.fn() };
  const service = new ConsentFormsService(
    prisma as never,
    notifications as never,
  );
  return { prisma, notifications, service };
}

describe('ConsentFormsService', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  const dto = {
    eventId: 'e1',
    classIds: ['c1'],
    body: 'I allow my child to go on the trip.',
    deadline: '2026-10-30',
  };

  describe('create', () => {
    it('saves the form for the chosen classes and counts the parents notified', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue({
        ...event,
        consentForm: null,
      });
      const result = await service.create('t1', dto, ADMIN);
      expect(prisma.consentForm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 'e1',
            deadline: day('2026-10-30'),
            classes: { create: [{ classId: 'c1' }] },
          }) as unknown,
        }),
      );
      expect(result).toMatchObject({
        notified: 1,
        counts: { total: 2, approved: 0, declined: 0, pending: 2 },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it.each([
      ['2026-10-15', 'CONSENT_DEADLINE_PAST'],
      ['2026-11-06', 'CONSENT_DEADLINE_AFTER_EVENT'],
    ])('rejects a last day of %s', async (deadline, code) => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue({
        ...event,
        consentForm: null,
      });
      await expect(
        service.create('t1', { ...dto, deadline }, ADMIN),
      ).rejects.toMatchObject({ response: { code } });
    });

    it('allows one form per event', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue({
        ...event,
        consentForm: { id: 'f0' },
      });
      await expect(service.create('t1', dto, ADMIN)).rejects.toMatchObject({
        response: { code: 'CONSENT_EXISTS' },
      });
    });

    it('rejects a class from another school', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue({
        ...event,
        consentForm: null,
      });
      prisma.class.count.mockResolvedValue(0);
      await expect(service.create('t1', dto, ADMIN)).rejects.toMatchObject({
        response: { code: 'CLASS_NOT_FOUND' },
      });
    });
  });

  describe('detail', () => {
    it('lists every student with their answer or pending', async () => {
      const { prisma, service } = setup();
      prisma.consentResponse.findMany.mockResolvedValue([
        {
          studentId: 's1',
          decision: ConsentDecision.APPROVED,
          signedName: 'Meena Rao',
          signedAt: new Date('2026-10-16T19:00:00.000Z'), // 17/10 in IST
          note: null,
          parent: { name: 'Meena', phone: '+919876543210' },
        },
      ]);
      const form = await service.detail('t1', 'f1');
      expect(
        form.rows.map((r) => [r.studentName, r.status, r.signedOn]),
      ).toEqual([
        ['Asha', 'APPROVED', '2026-10-17'],
        ['Ravi', 'PENDING', null],
      ]);
      expect(form.counts).toEqual({
        total: 2,
        approved: 1,
        declined: 0,
        pending: 1,
      });
    });
  });

  describe('respond', () => {
    const answer = {
      studentId: 's1',
      decision: ConsentDecision.APPROVED,
      signedName: 'Meena Rao',
      confirm: true as const,
    };

    it('records the signed answer for the parent’s own child', async () => {
      const { prisma, service } = setup();
      prisma.studentParent.findFirst.mockResolvedValue({
        student: { classId: 'c1' },
      });
      const r = await service.respond('t1', 'p1', 'f1', answer);
      expect(r).toMatchObject({
        decision: 'APPROVED',
        signedName: 'Meena Rao',
      });
      expect(prisma.consentResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { formId_studentId: { formId: 'f1', studentId: 's1' } },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'consent_form.sign',
          }) as unknown,
        }),
      );
    });

    it('404s for a child who is not the parent’s', async () => {
      const { prisma, service } = setup();
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(
        service.respond('t1', 'p1', 'f1', answer),
      ).rejects.toMatchObject({
        response: { code: 'CONSENT_NOT_FOUND' },
      });
      expect(prisma.consentResponse.upsert).not.toHaveBeenCalled();
    });

    it('refuses answers after the last day', async () => {
      const { prisma, service } = setup();
      prisma.studentParent.findFirst.mockResolvedValue({
        student: { classId: 'c1' },
      });
      prisma.consentForm.findFirst.mockResolvedValue(
        formRow({ deadline: day('2026-10-15') }),
      );
      await expect(
        service.respond('t1', 'p1', 'f1', answer),
      ).rejects.toMatchObject({
        response: { code: 'CONSENT_CLOSED' },
      });
    });
  });

  describe('remind and remove', () => {
    it('reminds only parents of students without an answer', async () => {
      const { prisma, service } = setup();
      prisma.consentResponse.findMany.mockResolvedValue([{ studentId: 's1' }]);
      await service.remind('t1', 'f1', ADMIN);
      expect(prisma.studentParent.findMany).toHaveBeenCalledWith({
        where: { studentId: { in: ['s2'] } },
        select: { parentId: true },
      });
    });

    it('keeps a form that parents have answered', async () => {
      const { prisma, service } = setup();
      prisma.consentResponse.count.mockResolvedValue(3);
      await expect(service.remove('t1', 'f1', ADMIN)).rejects.toMatchObject({
        response: { code: 'CONSENT_HAS_RESPONSES' },
      });
      expect(prisma.consentForm.delete).not.toHaveBeenCalled();
    });
  });

  describe('mine', () => {
    it('gives one item per child in a form class, open and unanswered first', async () => {
      const { prisma, service } = setup();
      prisma.studentParent.findMany.mockResolvedValue([
        {
          student: {
            id: 's1',
            name: 'Asha',
            classId: 'c1',
            class: { name: 'Class 5', section: 'A' },
          },
        },
        {
          student: {
            id: 's9',
            name: 'Kiran',
            classId: 'c9',
            class: { name: 'Class 9', section: null },
          },
        },
      ]);
      prisma.consentForm.findMany.mockResolvedValue([
        { ...formRow(), classes: [{ classId: 'c1' }] },
      ]);
      const items = await service.mine('t1', 'p1');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        formId: 'f1',
        studentId: 's1',
        status: 'PENDING',
        open: true,
        deadline: '2026-10-30',
        event: { title: 'Trip to Mysuru Zoo', startDate: '2026-11-05' },
      });
    });
  });
});

describe('consentRequestText', () => {
  it('writes the push in the parent’s language', () => {
    expect(consentRequestText('en', 'Zoo trip', '30/10/2026', false)).toEqual({
      title: 'Consent needed · Zoo trip',
      body: 'Please sign the consent form in the app by 30/10/2026.',
    });
    expect(
      consentRequestText('hi', 'Zoo trip', '30/10/2026', true).title,
    ).toContain('याद');
  });
});
