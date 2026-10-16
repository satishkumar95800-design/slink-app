import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, WorkingDaysRule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { UpdateHrSettingsDto } from './dto/hrms.dto';
import { hrmsStrings as t } from './hrms.strings';
import { audit, fail } from './hrms.shared';
import {
  DEFAULT_PT_SLABS,
  PtSlab,
  StatutorySettings,
  fromPaise,
  percentToBp,
  toPaise,
} from './payroll.math';

export interface HrSettings {
  weeklyOffDays: number[];
  workingDaysRule: WorkingDaysRule;
  treatUnmarkedAsAbsent: boolean;
  leaveYearStartMonth: number;
  statutory: StatutorySettings;
}

const parseSlabs = (json: unknown): PtSlab[] =>
  Array.isArray(json) ? (json as PtSlab[]) : [];

/** Slabs must start at 0, be in order, not overlap, and only the last may be open-ended. */
export function validateSlabs(slabs: PtSlab[]): boolean {
  if (slabs.length === 0) return true;
  let expectedFrom = 0;
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i];
    if (s.fromPaise !== expectedFrom) return false;
    if (s.toPaise === null) return i === slabs.length - 1;
    if (s.toPaise < s.fromPaise) return false;
    expectedFrom = s.toPaise + 1;
  }
  return true;
}

@Injectable()
export class HrSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Row created with defaults on first use; PT slabs seeded once as an editable default. */
  async get(tenantId: string): Promise<HrSettings> {
    let row = await this.prisma.hrSetting.findUnique({ where: { tenantId } });
    if (!row) {
      row = await this.prisma.hrSetting.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
    }
    if (!row.slabsSeeded) {
      row = await this.prisma.hrSetting.update({
        where: { tenantId },
        data: {
          ptSlabs: DEFAULT_PT_SLABS as unknown as Prisma.InputJsonValue,
          slabsSeeded: true,
        },
      });
    }
    return {
      weeklyOffDays: row.weeklyOffDays,
      workingDaysRule: row.workingDaysRule,
      treatUnmarkedAsAbsent: row.treatUnmarkedAsAbsent,
      leaveYearStartMonth: row.leaveYearStartMonth,
      statutory: {
        pfEnabled: row.pfEnabled,
        pfEmployeeBp: percentToBp(row.pfEmployeeRate),
        pfEmployerBp: percentToBp(row.pfEmployerRate),
        pfCeilingPaise: toPaise(row.pfWageCeiling),
        esiEnabled: row.esiEnabled,
        esiEmployeeBp: percentToBp(row.esiEmployeeRate),
        esiEmployerBp: percentToBp(row.esiEmployerRate),
        esiCeilingPaise: toPaise(row.esiWageCeiling),
        ptEnabled: row.ptEnabled,
        ptSlabs: parseSlabs(row.ptSlabs),
      },
    };
  }

  /** API shape: money as "200.00" strings, rates as numbers. */
  view(s: HrSettings) {
    const st = s.statutory;
    return {
      weeklyOffDays: s.weeklyOffDays,
      workingDaysRule: s.workingDaysRule,
      treatUnmarkedAsAbsent: s.treatUnmarkedAsAbsent,
      leaveYearStartMonth: s.leaveYearStartMonth,
      pfEnabled: st.pfEnabled,
      pfEmployeeRate: st.pfEmployeeBp / 100,
      pfEmployerRate: st.pfEmployerBp / 100,
      pfWageCeiling: fromPaise(st.pfCeilingPaise),
      esiEnabled: st.esiEnabled,
      esiEmployeeRate: st.esiEmployeeBp / 100,
      esiEmployerRate: st.esiEmployerBp / 100,
      esiWageCeiling: fromPaise(st.esiCeilingPaise),
      ptEnabled: st.ptEnabled,
      ptSlabs: st.ptSlabs.map((p) => ({
        from: fromPaise(p.fromPaise),
        to: p.toPaise === null ? null : fromPaise(p.toPaise),
        monthly: fromPaise(p.monthlyPaise),
        february:
          p.februaryPaise === undefined ? null : fromPaise(p.februaryPaise),
      })),
      statutoryNoticeKey: 'verifyStatutory',
    };
  }

  async getView(tenantId: string) {
    return this.view(await this.get(tenantId));
  }

  async update(tenantId: string, dto: UpdateHrSettingsDto, user: ActiveUser) {
    const before = await this.getView(tenantId);
    let ptSlabs: PtSlab[] | undefined;
    if (dto.ptSlabs) {
      ptSlabs = dto.ptSlabs.map((s) => ({
        fromPaise: toPaise(s.from),
        toPaise: s.to === null ? null : toPaise(s.to),
        monthlyPaise: toPaise(s.monthly),
        ...(s.february !== undefined && { februaryPaise: toPaise(s.february) }),
      }));
      if (!validateSlabs(ptSlabs))
        fail(BadRequestException, 'SLABS_INVALID', t.slabsInvalid);
    }
    const pct = (n: number) => Number(n.toFixed(2));
    const data: Prisma.HrSettingUpdateInput = {
      ...(dto.weeklyOffDays !== undefined && {
        weeklyOffDays: [...new Set(dto.weeklyOffDays)].sort(),
      }),
      ...(dto.workingDaysRule !== undefined && {
        workingDaysRule: dto.workingDaysRule,
      }),
      ...(dto.treatUnmarkedAsAbsent !== undefined && {
        treatUnmarkedAsAbsent: dto.treatUnmarkedAsAbsent,
      }),
      ...(dto.leaveYearStartMonth !== undefined && {
        leaveYearStartMonth: dto.leaveYearStartMonth,
      }),
      ...(dto.pfEnabled !== undefined && { pfEnabled: dto.pfEnabled }),
      ...(dto.pfEmployeeRate !== undefined && {
        pfEmployeeRate: pct(dto.pfEmployeeRate),
      }),
      ...(dto.pfEmployerRate !== undefined && {
        pfEmployerRate: pct(dto.pfEmployerRate),
      }),
      ...(dto.pfWageCeiling !== undefined && {
        pfWageCeiling: fromPaise(toPaise(dto.pfWageCeiling)),
      }),
      ...(dto.esiEnabled !== undefined && { esiEnabled: dto.esiEnabled }),
      ...(dto.esiEmployeeRate !== undefined && {
        esiEmployeeRate: pct(dto.esiEmployeeRate),
      }),
      ...(dto.esiEmployerRate !== undefined && {
        esiEmployerRate: pct(dto.esiEmployerRate),
      }),
      ...(dto.esiWageCeiling !== undefined && {
        esiWageCeiling: fromPaise(toPaise(dto.esiWageCeiling)),
      }),
      ...(dto.ptEnabled !== undefined && { ptEnabled: dto.ptEnabled }),
      ...(ptSlabs && {
        ptSlabs: ptSlabs as unknown as Prisma.InputJsonValue,
        slabsSeeded: true,
      }),
    };
    await this.get(tenantId); // make sure the row exists
    await this.prisma.hrSetting.update({ where: { tenantId }, data });
    const after = await this.getView(tenantId);
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.settings.update',
      'hr_setting',
      tenantId,
      { before, after },
    );
    return after;
  }
}
