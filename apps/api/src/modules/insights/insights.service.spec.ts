import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { InsightsService } from './insights.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentFeesService } from '../fees/student-fees.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { InsightsQueryDto } from './dto/insights-query.dto';

const TENANT_ID = 'tenant-uuid';

const mockPrisma = {
  studentFee: { groupBy: jest.fn() },
  student: { findMany: jest.fn() },
  feeStructure: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
};

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StudentFeesService, useValue: {} },
        { provide: ReceiptsService, useValue: {} },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  describe('getStudentFeeSummary', () => {
    it('sums amountDue/amountPaid across every fee structure into one row per student', async () => {
      mockPrisma.studentFee.groupBy.mockResolvedValue([
        {
          studentId: 'student-1',
          _sum: {
            amountDue: new Prisma.Decimal('8000.00'),
            amountPaid: new Prisma.Decimal('5000.00'),
          },
        },
      ]);
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: 'student-1',
          name: 'Aadhya Nair',
          admissionNo: 'ADM-0001',
          class: { id: 'class-1', name: '5', section: 'A' },
        },
      ]);

      const result = await service.getStudentFeeSummary(
        TENANT_ID,
        new InsightsQueryDto(),
      );

      expect(result.data).toEqual([
        expect.objectContaining({
          studentId: 'student-1',
          studentName: 'Aadhya Nair',
          totalDue: expect.objectContaining({ toFixed: expect.any(Function) }),
          totalCollected: expect.objectContaining({
            toFixed: expect.any(Function),
          }),
        }),
      ]);
      expect(result.data[0].totalDue.toFixed(2)).toBe('8000.00');
      expect(result.data[0].totalCollected.toFixed(2)).toBe('5000.00');
      expect(result.data[0].outstanding.toFixed(2)).toBe('3000.00');
    });

    it('clamps outstanding at zero rather than going negative when overpaid', async () => {
      mockPrisma.studentFee.groupBy.mockResolvedValue([
        {
          studentId: 'student-1',
          _sum: {
            amountDue: new Prisma.Decimal('1000.00'),
            amountPaid: new Prisma.Decimal('1200.00'),
          },
        },
      ]);
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: 'student-1',
          name: 'Aadhya Nair',
          admissionNo: 'ADM-0001',
          class: null,
        },
      ]);

      const result = await service.getStudentFeeSummary(
        TENANT_ID,
        new InsightsQueryDto(),
      );

      expect(result.data[0].outstanding.toFixed(2)).toBe('0.00');
    });

    it('returns no rows for a student with zero fee assignments', async () => {
      mockPrisma.studentFee.groupBy.mockResolvedValue([]);

      const result = await service.getStudentFeeSummary(
        TENANT_ID,
        new InsightsQueryDto(),
      );

      expect(result.data).toEqual([]);
      expect(mockPrisma.student.findMany).not.toHaveBeenCalled();
    });

    it('filters by classId and academicYear via the groupBy where clause', async () => {
      mockPrisma.studentFee.groupBy.mockResolvedValue([]);
      const query = new InsightsQueryDto();
      query.classId = 'class-1';
      query.academicYear = '2025-26';

      await service.getStudentFeeSummary(TENANT_ID, query);

      expect(mockPrisma.studentFee.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            student: { classId: 'class-1' },
            feeStructure: { academicYear: '2025-26' },
          }),
        }),
      );
    });
  });

  describe('getFeeTotals', () => {
    it('totals the newest academic year that has fee structures, scoped to the tenant', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue({
        academicYear: '2025-26',
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          collected: new Prisma.Decimal('105200.00'),
          outstanding: new Prisma.Decimal('82200.00'),
        },
      ]);

      const result = await service.getFeeTotals(TENANT_ID);

      expect(mockPrisma.feeStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
          orderBy: { academicYear: 'desc' },
        }),
      );
      const [, ...params] = mockPrisma.$queryRaw.mock.calls[0];
      expect(params).toEqual([TENANT_ID, TENANT_ID, '2025-26']);
      expect(result).toEqual({
        academicYear: '2025-26',
        collected: 105200,
        outstanding: 82200,
      });
    });

    it('returns zeros (not nulls) when the school has no fee structures yet', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      const result = await service.getFeeTotals(TENANT_ID);

      expect(result).toEqual({
        academicYear: null,
        collected: 0,
        outstanding: 0,
      });
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns zeros when the year has no assignments (SUM over no rows is NULL)', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue({
        academicYear: '2026-27',
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        { collected: null, outstanding: null },
      ]);

      expect(await service.getFeeTotals(TENANT_ID)).toEqual({
        academicYear: '2026-27',
        collected: 0,
        outstanding: 0,
      });
    });
  });
});
