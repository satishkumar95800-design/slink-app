import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateSubjectDto) {
    try {
      return await this.prisma.subject.create({
        data: { tenantId, name: dto.name },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A subject with this name already exists');
      }
      throw err;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateSubjectDto) {
    await this.requireSubject(tenantId, id);

    try {
      return await this.prisma.subject.update({
        where: { id },
        data: { ...(dto.name !== undefined && { name: dto.name }) },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A subject with this name already exists');
      }
      throw err;
    }
  }

  async remove(tenantId: string, id: string) {
    await this.requireSubject(tenantId, id);
    await this.prisma.subject.delete({ where: { id } });
  }

  /** Upserts a subject by name — used by the bulk import Teachers tab. */
  async findOrCreateByName(tenantId: string, name: string) {
    const existing = await this.prisma.subject.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (existing) return existing;
    return this.prisma.subject.create({ data: { tenantId, name } });
  }

  private async requireSubject(tenantId: string, id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id, tenantId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }
}
