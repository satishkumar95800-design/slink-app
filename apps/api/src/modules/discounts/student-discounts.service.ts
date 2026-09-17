import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscountKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';

const studentDiscountInclude = {
  discountType: { select: { id: true, name: true, kind: true } },
  feeItem: { select: { id: true, label: true } },
} satisfies Prisma.StudentDiscountInclude;

@Injectable()
export class StudentDiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  findForStudent(tenantId: string, studentId: string) {
    return this.prisma.studentDiscount.findMany({
      where: { tenantId, studentId },
      include: studentDiscountInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async assign(tenantId: string, dto: CreateStudentDiscountDto) {
    const [student, discountType] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId, tenantId } }),
      this.prisma.discountType.findUnique({ where: { id: dto.discountTypeId, tenantId } }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!discountType) throw new NotFoundException('Discount type not found');

    if (dto.feeItemId) {
      const feeItem = await this.prisma.feeItem.findUnique({ where: { id: dto.feeItemId } });
      if (!feeItem) throw new NotFoundException('Fee item not found');
    }

    if (discountType.kind === DiscountKind.percentage && dto.percentage === undefined) {
      throw new BadRequestException('percentage is required for a percentage discount type');
    }
    if (discountType.kind === DiscountKind.fixed_amount && dto.fixedAmount === undefined) {
      throw new BadRequestException('fixedAmount is required for a fixed_amount discount type');
    }

    return this.prisma.studentDiscount.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        discountTypeId: dto.discountTypeId,
        feeItemId: dto.feeItemId ?? null,
        percentage:
          discountType.kind === DiscountKind.percentage
            ? new Prisma.Decimal(dto.percentage!.toFixed(2))
            : null,
        fixedAmount:
          discountType.kind === DiscountKind.fixed_amount
            ? new Prisma.Decimal(dto.fixedAmount!.toFixed(2))
            : null,
        reason: dto.reason ?? null,
      },
      include: studentDiscountInclude,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.studentDiscount.findUnique({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Student discount not found');
    await this.prisma.studentDiscount.delete({ where: { id } });
  }

  /**
   * Read-only suggestion, not an automated discount: groups students sharing a
   * parent's mobile number so staff can decide whether to apply a sibling
   * discount, per Addendum 3 §2.3.
   */
  async getSiblingSuggestions(tenantId: string) {
    const groups = await this.prisma.studentParent.groupBy({
      by: ['parentId'],
      where: { student: { tenantId } },
      _count: { studentId: true },
    });
    const siblingParentIds = groups
      .filter((g) => g._count.studentId > 1)
      .map((g) => g.parentId);

    if (siblingParentIds.length === 0) return [];

    const parents = await this.prisma.user.findMany({
      where: { id: { in: siblingParentIds }, tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        linkedStudents: {
          where: { student: { tenantId } },
          select: {
            student: { select: { id: true, name: true, admissionNo: true } },
          },
        },
      },
    });

    return parents.map((p) => ({
      parent: { id: p.id, name: p.name, phone: p.phone },
      students: p.linkedStudents.map((l) => l.student),
    }));
  }
}
