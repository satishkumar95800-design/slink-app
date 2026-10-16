import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApplyLeaveDto, CreateEmployeeDto } from './dto/hrms.dto';
import { HrmsFeatureGuard } from './hrms-feature.guard';
import { HrmsMeController } from './hrms-me.controller';
import { HrmsController } from './hrms.controller';

const handlersOf = (cls: { prototype: object }) => {
  const proto = cls.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).filter(
    (k) => k !== 'constructor' && typeof proto[k] === 'function',
  );
};

function ctx(
  cls: { prototype: object },
  handlerName: string,
  role: Role | undefined,
): ExecutionContext {
  const proto = cls.prototype as Record<string, unknown>;
  return {
    getHandler: () => proto[handlerName],
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined, tenantId: 't1' }),
    }),
  } as unknown as ExecutionContext;
}

const rolesGuard = new RolesGuard(new Reflector());
const allowed = (
  cls: { prototype: object },
  h: string,
  role: Role | undefined,
) => rolesGuard.canActivate(ctx(cls, h, role));

describe('HrmsController access (console)', () => {
  const handlers = handlersOf(HrmsController);
  const adminOnly = ['updateSettings', 'approve', 'lock'];

  it('exposes every route (sanity)', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(45);
    for (const h of adminOnly) expect(handlers).toContain(h);
  });

  it.each(handlers)(
    '%s: parents, teachers, developers and anonymous callers are refused',
    (h) => {
      for (const r of [Role.parent, Role.teacher, Role.developer, undefined]) {
        expect(allowed(HrmsController, h, r)).toBe(false);
      }
    },
  );

  it.each(handlers)('%s: admin and super_admin are allowed', (h) => {
    expect(allowed(HrmsController, h, Role.admin)).toBe(true);
    expect(allowed(HrmsController, h, Role.super_admin)).toBe(true);
  });

  it.each(handlers)(
    '%s: accounts allowed except approvals, locks and statutory settings',
    (h) => {
      expect(allowed(HrmsController, h, Role.accounts)).toBe(
        !adminOnly.includes(h),
      );
    },
  );

  it('is behind the feature guard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      HrmsController,
    ) as unknown[];
    expect(guards).toContain(HrmsFeatureGuard);
  });
});

describe('HrmsMeController access (mobile self-service)', () => {
  const handlers = handlersOf(HrmsMeController);

  it('exposes the self-service routes', () => {
    expect(handlers.sort()).toEqual(
      [
        'apply',
        'balances',
        'cancel',
        'leaveTypes',
        'payslipPdf',
        'payslips',
        'profile',
        'requests',
      ].sort(),
    );
  });

  it.each(handlers)(
    '%s: staff roles allowed; parents, developers, super_admin and anonymous refused',
    (h) => {
      for (const r of [Role.teacher, Role.admin, Role.accounts]) {
        expect(allowed(HrmsMeController, h, r)).toBe(true);
      }
      for (const r of [
        Role.parent,
        Role.developer,
        Role.super_admin,
        undefined,
      ]) {
        expect(allowed(HrmsMeController, h, r)).toBe(false);
      }
    },
  );

  it('is behind the feature guard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      HrmsMeController,
    ) as unknown[];
    expect(guards).toContain(HrmsFeatureGuard);
  });

  it('no self-service route takes an employee id from the caller', () => {
    // Routes: none declares :employeeId; the leave DTO whitelists only its own fields.
    const paths = handlers.map(
      (h) =>
        Reflect.getMetadata(
          'path',
          (HrmsMeController.prototype as unknown as Record<string, object>)[h],
        ) as string,
    );
    expect(paths.join(' ')).not.toMatch(/employee/i);
  });

  it('the apply DTO rejects an employeeId in the body (forbidNonWhitelisted)', async () => {
    const body = {
      leaveTypeId: '00000000-0000-4000-8000-000000000001',
      fromDate: '2026-06-01',
      toDate: '2026-06-01',
      reason: 'x',
    };
    const ok = await validate(plainToInstance(ApplyLeaveDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(ok).toHaveLength(0);
    const bad = await validate(
      plainToInstance(ApplyLeaveDto, {
        ...body,
        employeeId: '00000000-0000-4000-8000-000000000002',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(bad.length).toBeGreaterThan(0);
  });
});

describe('HrmsFeatureGuard', () => {
  const guardFor = (features: unknown) =>
    new HrmsFeatureGuard({
      tenant: { findUnique: jest.fn().mockResolvedValue({ features }) },
    } as never);
  const context = ctx(HrmsController, 'listEmployees', Role.admin);

  it('answers 403 FEATURE_DISABLED unless hrms is on', async () => {
    await expect(guardFor({}).canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      guardFor({ hrms: false }).canActivate(context),
    ).rejects.toMatchObject({
      response: { code: 'FEATURE_DISABLED' },
    });
    await expect(
      guardFor({ pettyCash: true }).canActivate(context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guardFor({ hrms: 'true' }).canActivate(context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes when hrms is on', async () => {
    await expect(guardFor({ hrms: true }).canActivate(context)).resolves.toBe(
      true,
    );
  });
});

describe('DTO validation', () => {
  const opts = { whitelist: true, forbidNonWhitelisted: true };
  it('create employee requires name, designation and a real joinDate', async () => {
    expect(
      await validate(
        plainToInstance(CreateEmployeeDto, {
          name: 'A',
          designation: 'B',
          joinDate: '2026-04-01',
        }),
        opts,
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(CreateEmployeeDto, {
            name: 'A',
            designation: 'B',
            joinDate: '01/04/2026',
          }),
          opts,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(CreateEmployeeDto, {
            designation: 'B',
            joinDate: '2026-04-01',
          }),
          opts,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects unknown fields such as a tenantId in the body', async () => {
    const errs = await validate(
      plainToInstance(CreateEmployeeDto, {
        name: 'A',
        designation: 'B',
        joinDate: '2026-04-01',
        tenantId: 'other',
      }),
      opts,
    );
    expect(errs.length).toBeGreaterThan(0);
  });
});
