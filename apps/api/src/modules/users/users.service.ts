import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserQueryDto } from './dto/user-query.dto';

const BCRYPT_ROUNDS = 12;

const userSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  profession: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { linkedStudents: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: create staff account ─────────────────────────────────────────────

  async create(tenantId: string, dto: CreateUserDto) {
    await this.assertEmailUnique(tenantId, dto.email);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        role: dto.role,
        passwordHash,
        isVerified: true,
      },
      select: userSelect,
    });
  }

  // ─── Admin: list users ────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: UserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { tenantId };

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Admin: get one ───────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, tenantId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Admin: update user ───────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.requireUser(tenantId, id);

    if (dto.email) {
      await this.assertEmailUnique(tenantId, dto.email, id);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        profession: dto.profession,
      },
      select: userSelect,
    });
  }

  // ─── Admin: remove user ───────────────────────────────────────────────────────

  async remove(tenantId: string, id: string) {
    const user = await this.requireUser(tenantId, id);

    if (user.role === Role.teacher) {
      const reportCount = await this.prisma.report.count({ where: { teacherId: id } });
      if (reportCount > 0) {
        throw new ConflictException(
          `Cannot delete teacher — they have ${reportCount} report(s). Reassign the reports first.`,
        );
      }
    }

    await this.prisma.user.delete({ where: { id } });
  }

  // ─── Admin: reset another user's password ────────────────────────────────────

  async resetPassword(tenantId: string, id: string, dto: ResetPasswordDto) {
    const user = await this.requireUser(tenantId, id);

    if (user.role === Role.parent) {
      throw new BadRequestException('Parents authenticate via phone OTP — no password to reset');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    // Revoke all existing refresh tokens to force re-login on all devices
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Self: get own profile ────────────────────────────────────────────────────

  async getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: userSelect,
    });
  }

  // ─── Self: update own profile ─────────────────────────────────────────────────

  async updateMe(userId: string, tenantId: string, dto: UpdateSelfDto) {
    if (dto.email) {
      await this.assertEmailUnique(tenantId, dto.email, userId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email },
      select: userSelect,
    });
  }

  // ─── Self: change own password ────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true, passwordHash: true },
    });

    if (user.role === Role.parent) {
      throw new BadRequestException('Parents authenticate via phone OTP — no password to change');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('No password is set on this account');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async requireUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertEmailUnique(tenantId: string, email: string, excludeId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Email "${email}" is already in use`);
    }
  }
}
