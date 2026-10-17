import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { PLAN_LABEL, groupQuote } from '../../common/subscription';
import {
  GroupNameDto,
  GroupSchoolsDto,
  GroupSettingsDto,
  HeadOfficeUserDto,
} from './dto/groups.dto';

const BCRYPT_ROUNDS = 12;
const err = (code: string, message: string) => ({ code, message });

const groupInclude = {
  tenants: {
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptionPlan: true,
      features: true,
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  },
  users: {
    where: { role: Role.head_office },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.SchoolGroupInclude;

type GroupRow = Prisma.SchoolGroupGetPayload<{ include: typeof groupInclude }>;

const view = (g: GroupRow) => ({
  id: g.id,
  name: g.name,
  attendanceCutoff: g.attendanceCutoff,
  createdAt: g.createdAt,
  schools: g.tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.subscriptionPlan,
    planName: PLAN_LABEL[t.subscriptionPlan],
    students: t._count.students,
  })),
  headOfficeUsers: g.users,
  /** Yearly price of the whole group (docs/SPEC-franchise.md §5). */
  quote: groupQuote(
    g.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      plan: t.subscriptionPlan,
      students: t._count.students,
      features: (t.features ?? {}) as Record<string, unknown>,
    })),
  ),
});

/** Franchise groups and their head office logins (super_admin, platform console). */
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.schoolGroup.findMany({
      include: groupInclude,
      orderBy: { name: 'asc' },
    });
    return groups.map(view);
  }

  async create(dto: GroupNameDto, actor: ActiveUser) {
    try {
      const g = await this.prisma.schoolGroup.create({
        data: { name: dto.name },
        include: groupInclude,
      });
      await this.audit(actor, null, 'group.create', {
        groupId: g.id,
        name: g.name,
      });
      return view(g);
    } catch (e) {
      this.rethrowName(e);
    }
  }

  /** Name and attendance cutoff. */
  async update(id: string, dto: GroupSettingsDto, actor: ActiveUser) {
    await this.require(id);
    try {
      const g = await this.prisma.schoolGroup.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.attendanceCutoff !== undefined && {
            attendanceCutoff: dto.attendanceCutoff,
          }),
        },
        include: groupInclude,
      });
      await this.audit(actor, null, 'group.update', {
        groupId: id,
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.attendanceCutoff !== undefined && {
          attendanceCutoff: dto.attendanceCutoff,
        }),
      });
      return view(g);
    } catch (e) {
      this.rethrowName(e);
    }
  }

  /** Only an empty group (no schools, no head office logins) can be deleted. */
  async remove(id: string, actor: ActiveUser) {
    const g = await this.require(id);
    if (g.tenants.length || g.users.length)
      throw new ConflictException(
        err(
          'GROUP_NOT_EMPTY',
          'Remove the schools and head office logins first',
        ),
      );
    await this.prisma.schoolGroup.delete({ where: { id } });
    await this.audit(actor, null, 'group.delete', {
      groupId: id,
      name: g.name,
    });
  }

  /** Sets the complete school list; a school already in another group is refused. */
  async setSchools(id: string, dto: GroupSchoolsDto, actor: ActiveUser) {
    const g = await this.require(id);
    const ids = [...new Set(dto.tenantIds)];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, groupId: true },
    });
    if (tenants.length !== ids.length)
      throw new NotFoundException(
        err('SCHOOL_NOT_FOUND', 'A school was not found'),
      );
    const elsewhere = tenants.filter((t) => t.groupId && t.groupId !== id);
    if (elsewhere.length)
      throw new ConflictException({
        ...err(
          'TENANT_IN_OTHER_GROUP',
          'Some schools already belong to another group',
        ),
        schools: elsewhere.map((t) => t.name),
      });
    // A head office login lives on one of the group's schools; keep that school.
    const homes = new Set(
      (
        await this.prisma.user.findMany({
          where: { groupId: id, role: Role.head_office },
          select: { tenantId: true },
        })
      ).map((u) => u.tenantId),
    );
    const dropped = g.tenants.filter((t) => !ids.includes(t.id));
    if (dropped.some((t) => homes.has(t.id)))
      throw new ConflictException(
        err(
          'SCHOOL_HOSTS_LOGIN',
          'A head office login is attached to a school you are removing; remove that login first',
        ),
      );
    await this.prisma.$transaction([
      this.prisma.tenant.updateMany({
        where: { groupId: id, id: { notIn: ids } },
        data: { groupId: null },
      }),
      this.prisma.tenant.updateMany({
        where: { id: { in: ids } },
        data: { groupId: id },
      }),
    ]);
    await this.audit(actor, null, 'group.schools', {
      groupId: id,
      added: ids.filter((x) => !g.tenants.some((t) => t.id === x)),
      removed: dropped.map((t) => t.id),
    });
    return view(await this.require(id));
  }

  /** A head office login (email + password, no school code); it sees the group read-only. */
  async createUser(id: string, dto: HeadOfficeUserDto, actor: ActiveUser) {
    const g = await this.require(id);
    if (g.tenants.length === 0)
      throw new BadRequestException(
        err('GROUP_EMPTY', 'Add at least one school to the group first'),
      );
    const taken = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        role: { in: [Role.super_admin, Role.head_office] },
      },
      select: { id: true },
    });
    if (taken)
      throw new ConflictException(
        err(
          'EMAIL_TAKEN',
          'That email is already used by a platform or head office login',
        ),
      );
    const user = await this.prisma.user.create({
      data: {
        tenantId: g.tenants[0].id,
        groupId: id,
        role: Role.head_office,
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        isVerified: true,
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    await this.audit(actor, g.tenants[0].id, 'group.user.create', {
      groupId: id,
      userId: user.id,
      email: user.email,
    });
    return user;
  }

  async resetPassword(
    id: string,
    userId: string,
    password: string,
    actor: ActiveUser,
  ) {
    const u = await this.requireUser(id, userId);
    await this.prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: u.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(actor, u.tenantId, 'group.user.password', {
      groupId: id,
      userId,
    });
  }

  /** Removes the login and signs it out everywhere. */
  async removeUser(id: string, userId: string, actor: ActiveUser) {
    const u = await this.requireUser(id, userId);
    await this.prisma.user.delete({ where: { id: u.id } });
    await this.audit(actor, u.tenantId, 'group.user.delete', {
      groupId: id,
      userId,
      email: u.email,
    });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async require(id: string) {
    const g = await this.prisma.schoolGroup.findUnique({
      where: { id },
      include: groupInclude,
    });
    if (!g)
      throw new NotFoundException(err('GROUP_NOT_FOUND', 'Group not found'));
    return g;
  }

  private async requireUser(groupId: string, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, groupId, role: Role.head_office },
      select: { id: true, tenantId: true, email: true },
    });
    if (!u)
      throw new NotFoundException(err('USER_NOT_FOUND', 'Login not found'));
    return u;
  }

  private rethrowName(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw new ConflictException(
        err('GROUP_NAME_TAKEN', 'A group with this name already exists'),
      );
    throw e;
  }

  private audit(
    actor: ActiveUser,
    tenantId: string | null,
    action: string,
    diff: Prisma.InputJsonObject,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: actor.id,
        action,
        entityType: 'school_group',
        entityId: (diff.groupId as string | undefined) ?? null,
        diff,
      },
    });
  }
}
