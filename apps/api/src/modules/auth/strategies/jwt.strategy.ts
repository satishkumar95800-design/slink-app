import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

/** Header the app sends while a staff member uses parent mode. */
export const ACT_AS_HEADER = 'x-act-as';

/** Staff who may also be parents of students in their school. */
const STAFF_PARENT_ROLES: Role[] = [Role.teacher, Role.admin, Role.accounts];

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * Parent mode: a teacher, admin or accounts user who is linked to students
   * of their school (student_parents) may send `X-Act-As: parent`; the request
   * then runs with the parent role, so it reaches only parent routes and only
   * their own children (invariant 2). Anyone else sending it is refused.
   */
  async validate(req: Request, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        role: true,
        name: true,
        isVerified: true,
      },
    });

    if (!user || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException();
    }

    // The school named by X-Tenant-ID (TenantMiddleware) must be the user's
    // own; only the platform team works inside other schools.
    const requested = (req as Request & { tenantId?: string }).tenantId;
    if (
      requested &&
      requested !== user.tenantId &&
      user.role !== Role.super_admin
    ) {
      throw new ForbiddenException({
        code: 'WRONG_SCHOOL',
        message: 'This login belongs to a different school',
      });
    }

    if (req.headers[ACT_AS_HEADER] === 'parent' && user.role !== Role.parent) {
      const linked =
        STAFF_PARENT_ROLES.includes(user.role) &&
        (await this.prisma.studentParent.count({
          where: { parentId: user.id, student: { tenantId: user.tenantId } },
        })) > 0;
      if (!linked)
        throw new ForbiddenException({
          code: 'NO_CHILDREN',
          message: 'No children are linked to this account',
        });
      return { ...user, role: Role.parent };
    }

    return user;
  }
}
