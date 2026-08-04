import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Role, ReportStatus, ReportType } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const teacherUser: ActiveUser = {
  id: 'teacher-uuid',
  tenantId: 'tenant-uuid',
  role: Role.teacher,
  name: 'Teacher',
  isVerified: true,
};

const parentUser: ActiveUser = {
  id: 'parent-uuid',
  tenantId: 'tenant-uuid',
  role: Role.parent,
  name: 'Parent',
  isVerified: true,
};

const adminUser: ActiveUser = {
  id: 'admin-uuid',
  tenantId: 'tenant-uuid',
  role: Role.admin,
  name: 'Admin',
  isVerified: true,
};

const otherTeacher: ActiveUser = {
  id: 'other-teacher-uuid',
  tenantId: 'tenant-uuid',
  role: Role.teacher,
  name: 'Other Teacher',
  isVerified: true,
};

const makeDraftReport = (overrides: Record<string, unknown> = {}) => ({
  id: 'report-uuid',
  tenantId: 'tenant-uuid',
  studentId: 'student-uuid',
  classId: 'class-uuid',
  teacherId: 'teacher-uuid',
  type: ReportType.academic,
  term: 'Term 1',
  academicYear: '2025-26',
  content: { grades: { math: 'A' } },
  pdfKey: null,
  status: ReportStatus.draft,
  publishedAt: null,
  student: { id: 'student-uuid', name: 'John', admissionNo: 'A001' },
  class: { id: 'class-uuid', name: 'Grade 5', academicYear: '2025-26' },
  teacher: { id: 'teacher-uuid', name: 'Teacher' },
  _count: { readReceipts: 0 },
  ...overrides,
});

const mockPrisma = {
  report: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  student: { findUnique: jest.fn() },
  class: { findUnique: jest.fn(), findMany: jest.fn() },
  studentParent: { findUnique: jest.fn() },
  reportReadReceipt: { upsert: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      studentId: 'student-uuid',
      type: ReportType.academic,
      term: 'Term 1',
      academicYear: '2025-26',
      content: { grades: { math: 'A' } },
    };

    it('creates a draft report when teacher owns the class', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid', classId: 'class-uuid' });
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-uuid', teacherId: 'teacher-uuid' });
      mockPrisma.report.create.mockResolvedValue(makeDraftReport());

      const result = await service.create('tenant-uuid', dto, teacherUser);
      expect(result.id).toBe('report-uuid');
      expect(mockPrisma.report.create).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when student not found', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);
      await expect(service.create('tenant-uuid', dto, teacherUser)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when teacher does not own the class', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid', classId: 'class-uuid' });
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-uuid', teacherId: 'other-teacher-uuid' });
      await expect(service.create('tenant-uuid', dto, teacherUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated results for admin', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeDraftReport()], 1]);
      const result = await service.findAll('tenant-uuid', adminUser, {});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('scopes parent to published reports for their children', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll('tenant-uuid', parentUser, {});
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('scopes teacher to their class', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      mockPrisma.$transaction.mockResolvedValue([[makeDraftReport()], 1]);
      const result = await service.findAll('tenant-uuid', teacherUser, {});
      expect(result.data).toHaveLength(1);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns report for admin', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport());
      const result = await service.findOne('tenant-uuid', 'report-uuid', adminUser);
      expect(result.id).toBe('report-uuid');
    });

    it('throws NotFoundException when report not found', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);
      await expect(service.findOne('tenant-uuid', 'bad-id', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for parent reading a draft report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.draft }));
      await expect(service.findOne('tenant-uuid', 'report-uuid', parentUser)).rejects.toThrow(NotFoundException);
    });

    it('returns published report for parent with linked child', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.studentParent.findUnique.mockResolvedValue({ studentId: 'student-uuid', parentId: 'parent-uuid' });
      const result = await service.findOne('tenant-uuid', 'report-uuid', parentUser);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException for parent with no link to student', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.studentParent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('tenant-uuid', 'report-uuid', parentUser)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for teacher accessing another class report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ classId: 'other-class' }));
      mockPrisma.class.findUnique.mockResolvedValue({ teacherId: 'other-teacher-uuid' });
      await expect(service.findOne('tenant-uuid', 'report-uuid', teacherUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft report owned by the teacher', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport());
      mockPrisma.report.update.mockResolvedValue(makeDraftReport({ term: 'Term 2' }));
      const result = await service.update('tenant-uuid', 'report-uuid', { term: 'Term 2' }, teacherUser);
      expect(mockPrisma.report.update).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when teacher does not own report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ teacherId: 'other-teacher-uuid' }));
      await expect(
        service.update('tenant-uuid', 'report-uuid', { term: 'Term 2' }, teacherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when editing a published report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      await expect(
        service.update('tenant-uuid', 'report-uuid', { term: 'Term 2' }, teacherUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('publishes a draft report and sets publishedAt', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport());
      mockPrisma.report.update.mockResolvedValue(
        makeDraftReport({ status: ReportStatus.published, publishedAt: new Date() }),
      );
      await service.publish('tenant-uuid', 'report-uuid', teacherUser);
      const call = mockPrisma.report.update.mock.calls[0][0];
      expect(call.data.status).toBe(ReportStatus.published);
      expect(call.data.publishedAt).toBeInstanceOf(Date);
    });

    it('throws ConflictException when already published', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      await expect(service.publish('tenant-uuid', 'report-uuid', teacherUser)).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when teacher does not own report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ teacherId: 'other-uuid' }));
      await expect(service.publish('tenant-uuid', 'report-uuid', teacherUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('allows teacher to delete their own draft', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport());
      mockPrisma.report.delete.mockResolvedValue({});
      await service.remove('tenant-uuid', 'report-uuid', teacherUser);
      expect(mockPrisma.report.delete).toHaveBeenCalledTimes(1);
    });

    it('allows admin to delete any draft', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ teacherId: 'other-teacher-uuid' }));
      mockPrisma.report.delete.mockResolvedValue({});
      await service.remove('tenant-uuid', 'report-uuid', adminUser);
      expect(mockPrisma.report.delete).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when teacher tries to delete another teacher\'s report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ teacherId: 'other-teacher-uuid' }));
      await expect(service.remove('tenant-uuid', 'report-uuid', teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when deleting a published report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      await expect(service.remove('tenant-uuid', 'report-uuid', teacherUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ── markRead ─────────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('creates a read receipt for a parent viewing their child\'s published report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.studentParent.findUnique.mockResolvedValue({ studentId: 'student-uuid', parentId: 'parent-uuid' });
      mockPrisma.reportReadReceipt.upsert.mockResolvedValue({ reportId: 'report-uuid', userId: 'parent-uuid', readAt: new Date() });

      const result = await service.markRead('tenant-uuid', 'report-uuid', parentUser);
      expect(result.reportId).toBe('report-uuid');
      expect(mockPrisma.reportReadReceipt.upsert).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when report is not published', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.draft }));
      await expect(service.markRead('tenant-uuid', 'report-uuid', parentUser)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when parent has no link to student', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.studentParent.findUnique.mockResolvedValue(null);
      await expect(service.markRead('tenant-uuid', 'report-uuid', parentUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getReadReceipts ──────────────────────────────────────────────────────────

  describe('getReadReceipts', () => {
    it('returns read receipts for admin', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.reportReadReceipt.findMany.mockResolvedValue([
        { reportId: 'report-uuid', userId: 'parent-uuid', readAt: new Date() },
      ]);
      const result = await service.getReadReceipts('tenant-uuid', 'report-uuid', adminUser);
      expect(result).toHaveLength(1);
    });

    it('returns read receipts for teacher who owns the report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ status: ReportStatus.published }));
      mockPrisma.reportReadReceipt.findMany.mockResolvedValue([]);
      await service.getReadReceipts('tenant-uuid', 'report-uuid', teacherUser);
      expect(mockPrisma.reportReadReceipt.findMany).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for teacher accessing another teacher\'s report receipts', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(makeDraftReport({ teacherId: 'other-teacher-uuid' }));
      await expect(
        service.getReadReceipts('tenant-uuid', 'report-uuid', teacherUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
