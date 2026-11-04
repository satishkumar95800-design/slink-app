import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { effectiveLanguage } from '../../common/i18n/languages';
import type { Language } from '../../common/i18n/languages';

const BCRYPT_ROUNDS = 12;

/** Name left on an account its owner deleted (receipts and records still show it). */
export const DELETED_USER_NAME = 'Deleted user';

const userSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  profession: true,
  isVerified: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { linkedStudents: true } },
  // A parent's children (wards), for the console's Users list and parent page.
  linkedStudents: {
    select: {
      relation: true,
      isPrimary: true,
      student: {
        select: {
          id: true,
          name: true,
          admissionNo: true,
          class: { select: { name: true, section: true, academicYear: true } },
        },
      },
    },
    orderBy: { student: { name: 'asc' } },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: create staff account ─────────────────────────────────────────────

  async create(
    tenantId: string,
    dto: {
      name: string;
      email: string;
      password: string;
      role: Role;
      phone?: string;
    },
  ) {
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

    const where: Prisma.UserWhereInput = { tenantId, deletedAt: null };

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
      const reportCount = await this.prisma.report.count({
        where: { teacherId: id },
      });
      if (reportCount > 0) {
        throw new ConflictException(
          `Cannot delete teacher — they have ${reportCount} report(s). Reassign the reports first.`,
        );
      }
    }

    // Attendance records keep who marked them (FK RESTRICT), so a marker can't be hard-deleted.
    const attendanceCount = await this.prisma.attendanceRecord.count({
      where: { tenantId, markedBy: id },
    });
    if (attendanceCount > 0) {
      throw new ConflictException(
        'Cannot delete this user — they have marked attendance, which must be kept for the school record.',
      );
    }

    await this.prisma.user.delete({ where: { id } });
  }

  // ─── Admin: reset another user's password ────────────────────────────────────

  async resetPassword(tenantId: string, id: string, dto: ResetPasswordDto) {
    const user = await this.requireUser(tenantId, id);

    if (user.role === Role.parent) {
      throw new BadRequestException(
        'Parents authenticate via phone OTP — no password to reset',
      );
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

  /** Own profile plus `language` — the one the apps should show (user's pick, else school default). */
  async getMe(userId: string) {
    const { tenant, ...user } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...userSelect, tenant: { select: { defaultLanguage: true } } },
    });
    return {
      ...user,
      language: effectiveLanguage(
        user.preferredLanguage,
        tenant.defaultLanguage,
      ),
    };
  }

  // ─── Self: interface language ─────────────────────────────────────────────────

  async updateMyLanguage(userId: string, language: Language) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
      select: { preferredLanguage: true },
    });
    return { preferredLanguage: user.preferredLanguage, language };
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
      throw new BadRequestException(
        'Parents authenticate via phone OTP — no password to change',
      );
    }

    if (!user.passwordHash) {
      throw new BadRequestException('No password is set on this account');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  // ─── Self: delete own account ─────────────────────────────────────────────────

  /**
   * The person deletes their own account (App Store 5.1.1(v), schoolinkd.in/data-deletion).
   * The row stays because receipts, attendance and reports point at it, but
   * everything that identifies the person goes at once: name, phone, email,
   * password, push tokens, notification history and the link to their children.
   * Every token is revoked, the phone or email can't sign in any more (the
   * school can add the number again as a new account), and JwtStrategy refuses
   * the row. Records the school keeps (fees, receipts, attendance marked,
   * reports, the HR employee record) are not touched.
   */
  async deleteMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true },
    });

    if (user.role === Role.super_admin) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DELETE_NOT_ALLOWED',
        message: 'Platform accounts are removed by the platform team',
      });
    }
    if (user.role === Role.admin) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          tenantId: user.tenantId,
          role: Role.admin,
          deletedAt: null,
          id: { not: userId },
        },
      });
      if (otherAdmins === 0) {
        throw new ConflictException({
          code: 'LAST_ADMIN',
          message:
            'You are the only admin of this school. Make someone else an admin first.',
        });
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const children = await tx.studentParent.deleteMany({
        where: { parentId: userId },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.loginChallenge.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.employee.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.pettyCashPayee.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: DELETED_USER_NAME,
          phone: null,
          email: null,
          passwordHash: null,
          fcmTokens: [],
          profession: null,
          preferredLanguage: null,
          isVerified: false,
          deletedAt: now,
        },
      });
      // No personal data in the log: only what was removed.
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: userId,
          action: 'user.self_delete',
          entityType: 'user',
          entityId: userId,
          diff: { role: user.role, childrenUnlinked: children.count },
        },
      });
    });
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

  private async assertEmailUnique(
    tenantId: string,
    email: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Email "${email}" is already in use`);
    }
  }
}
