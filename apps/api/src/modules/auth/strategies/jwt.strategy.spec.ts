import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

const T = 'tenant-1';
const payload = { sub: 'u1', tenantId: T, role: 'teacher' };
const req = (actAs?: string) =>
  ({ headers: actAs ? { 'x-act-as': actAs } : {} }) as never;

function setup(role: Role, children: number) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        tenantId: T,
        role,
        name: 'Saleem',
        isVerified: true,
      }),
    },
    studentParent: { count: jest.fn().mockResolvedValue(children) },
  };
  const config = { getOrThrow: () => 'secret' };
  return {
    prisma,
    strategy: new JwtStrategy(config as never, prisma as never),
  };
}

describe('JwtStrategy parent mode', () => {
  it('keeps the real role without the header', async () => {
    const { strategy } = setup(Role.teacher, 2);
    expect((await strategy.validate(req(), payload)).role).toBe(Role.teacher);
  });

  it.each([Role.teacher, Role.admin, Role.accounts])(
    'lets a %s with children in the school act as parent',
    async (role) => {
      const { strategy, prisma } = setup(role, 1);
      expect((await strategy.validate(req('parent'), payload)).role).toBe(
        Role.parent,
      );
      expect(prisma.studentParent.count).toHaveBeenCalledWith({
        where: { parentId: 'u1', student: { tenantId: T } },
      });
    },
  );

  it('refuses staff with no linked children', async () => {
    const { strategy } = setup(Role.teacher, 0);
    await expect(strategy.validate(req('parent'), payload)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuses roles that cannot be parents (super admin, head office)', async () => {
    for (const role of [Role.super_admin, Role.head_office]) {
      const { strategy } = setup(role, 3);
      await expect(strategy.validate(req('parent'), payload)).rejects.toThrow(
        ForbiddenException,
      );
    }
  });
});
