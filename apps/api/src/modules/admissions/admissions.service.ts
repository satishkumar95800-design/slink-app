import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStage, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  fromDbDate,
  isValidYmd,
  toDbDate,
  todayIn,
} from '../attendance/attendance-dates';
import {
  CreateEnquiryDto,
  EnquiryQueryDto,
  MoveStageDto,
  UpdateEnquiryDto,
} from './dto/admissions.dto';
import { localDayRange } from '../reception/reception.math';
import { academicYearStart, funnelOf, furthestStage } from './admissions.math';

const err = (code: string, message: string) => ({ code, message });
const STAFF: Role[] = [
  Role.admin,
  Role.accounts,
  Role.teacher,
  Role.receptionist,
];

type Db = PrismaService | Prisma.TransactionClient;

const ymd = (d: Date | null) => (d ? fromDbDate(d) : null);
const dateOrNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : toDbDate(v);

/**
 * Admissions pipeline for one school (flag `admissions`; docs/SPEC-franchise.md
 * §4): enquiries move Enquiry → Campus tour → Follow-up → Registration →
 * Enrolled, or Lost (with a reason). Every change is kept as an activity.
 */
@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const today = await this.today(tenantId);
    const from = academicYearStart(today);
    const [funnel, dueToday, overdue, bySource] = await Promise.all([
      funnelFor(this.prisma, [tenantId], from).then((m) => m.get(tenantId)!),
      this.prisma.admissionEnquiry.count({
        where: {
          tenantId,
          stage: { notIn: ['enrolled', 'lost'] },
          nextFollowUpOn: toDbDate(today),
        },
      }),
      this.prisma.admissionEnquiry.count({
        where: {
          tenantId,
          stage: { notIn: ['enrolled', 'lost'] },
          nextFollowUpOn: { lt: toDbDate(today) },
        },
      }),
      this.prisma.admissionEnquiry.groupBy({
        by: ['source'],
        where: { tenantId, createdAt: { gte: toDbDate(from) } },
        _count: { _all: true },
      }),
    ]);
    const byStage = await this.prisma.admissionEnquiry.groupBy({
      by: ['stage'],
      where: { tenantId },
      _count: { _all: true },
    });
    return {
      today,
      academicYearFrom: from,
      funnel,
      stages: Object.fromEntries(byStage.map((s) => [s.stage, s._count._all])),
      followUps: { today: dueToday, overdue },
      bySource: Object.fromEntries(
        bySource.map((s) => [s.source, s._count._all]),
      ),
    };
  }

  async list(tenantId: string, q: EnquiryQueryDto) {
    const tz = await this.timeZone(tenantId);
    const today = todayIn(tz);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const search = q.q?.trim();
    const where: Prisma.AdmissionEnquiryWhereInput = {
      tenantId,
      ...(q.stage && { stage: q.stage }),
      ...(q.due && {
        stage: { notIn: ['enrolled', 'lost'] },
        nextFollowUpOn:
          q.due === 'today' ? toDbDate(today) : { lt: toDbDate(today) },
      }),
      ...(q.created === 'today' && { createdAt: localDayRange(today, tz) }),
      ...(search && {
        OR: [
          { childName: { contains: search, mode: 'insensitive' } },
          { parentName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.admissionEnquiry.count({ where }),
      this.prisma.admissionEnquiry.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const names = await this.userNames(rows.map((r) => r.assignedTo));
    return {
      total,
      page,
      limit,
      data: rows.map((r) => this.view(r, names, today)),
    };
  }

  async detail(tenantId: string, id: string) {
    const row = await this.require(this.prisma, tenantId, id);
    const activities = await this.prisma.admissionActivity.findMany({
      where: { tenantId, enquiryId: id },
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.userNames([
      row.assignedTo,
      ...activities.map((a) => a.byUserId),
    ]);
    return {
      ...this.view(row, names, await this.today(tenantId)),
      activities: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        fromStage: a.fromStage,
        toStage: a.toStage,
        note: a.note,
        by: names.get(a.byUserId) ?? '',
        createdAt: a.createdAt,
      })),
    };
  }

  async create(tenantId: string, dto: CreateEnquiryDto, user: ActiveUser) {
    this.assertDates(dto.dob, dto.nextFollowUpOn);
    if (dto.assignedTo) await this.assertStaff(tenantId, dto.assignedTo);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.admissionEnquiry.create({
        data: {
          tenantId,
          childName: dto.childName,
          dob: dateOrNull(dto.dob),
          classSought: dto.classSought || null,
          parentName: dto.parentName,
          phone: dto.phone.trim(),
          email: dto.email || null,
          source: dto.source,
          nextFollowUpOn: dateOrNull(dto.nextFollowUpOn),
          notes: dto.notes || null,
          assignedTo: dto.assignedTo ?? null,
          createdBy: user.id,
        },
      });
      await this.activity(
        tx,
        tenantId,
        created.id,
        user.id,
        'created',
        null,
        'enquiry',
        null,
      );
      return created;
    });
    return this.detail(tenantId, row.id);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEnquiryDto,
    user: ActiveUser,
  ) {
    await this.require(this.prisma, tenantId, id);
    this.assertDates(
      dto.dob ?? undefined,
      dto.nextFollowUpOn ?? undefined,
      dto.tourOn ?? undefined,
    );
    if (dto.assignedTo) await this.assertStaff(tenantId, dto.assignedTo);
    await this.prisma.$transaction(async (tx) => {
      await tx.admissionEnquiry.update({
        where: { id },
        data: {
          ...(dto.childName !== undefined && { childName: dto.childName }),
          ...(dto.dob !== undefined && { dob: dateOrNull(dto.dob) }),
          ...(dto.classSought !== undefined && {
            classSought: dto.classSought || null,
          }),
          ...(dto.parentName !== undefined && { parentName: dto.parentName }),
          ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
          ...(dto.email !== undefined && { email: dto.email || null }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.tourOn !== undefined && { tourOn: dateOrNull(dto.tourOn) }),
          ...(dto.nextFollowUpOn !== undefined && {
            nextFollowUpOn: dateOrNull(dto.nextFollowUpOn),
          }),
          ...(dto.notes !== undefined && { notes: dto.notes || null }),
          ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        },
      });
      await this.activity(
        tx,
        tenantId,
        id,
        user.id,
        'edited',
        null,
        null,
        null,
      );
    });
    return this.detail(tenantId, id);
  }

  async moveStage(
    tenantId: string,
    id: string,
    dto: MoveStageDto,
    user: ActiveUser,
  ) {
    const row = await this.require(this.prisma, tenantId, id);
    if (row.stage === dto.stage)
      throw new BadRequestException(
        err('STAGE_UNCHANGED', 'The enquiry is already at this stage'),
      );
    if (dto.stage === 'lost' && !dto.lostReason)
      throw new BadRequestException(
        err('LOST_REASON_REQUIRED', 'Say why the enquiry was lost'),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.admissionEnquiry.update({
        where: { id },
        data: {
          stage: dto.stage,
          stageChangedAt: new Date(),
          lostReason: dto.stage === 'lost' ? dto.lostReason : null,
          // A closed enquiry has nothing left to follow up.
          ...((dto.stage === 'enrolled' || dto.stage === 'lost') && {
            nextFollowUpOn: null,
          }),
        },
      });
      await this.activity(
        tx,
        tenantId,
        id,
        user.id,
        'stage',
        row.stage,
        dto.stage,
        dto.stage === 'lost'
          ? [dto.lostReason, dto.note].filter(Boolean).join(' · ')
          : dto.note || null,
      );
    });
    return this.detail(tenantId, id);
  }

  async addNote(tenantId: string, id: string, note: string, user: ActiveUser) {
    await this.require(this.prisma, tenantId, id);
    await this.activity(
      this.prisma,
      tenantId,
      id,
      user.id,
      'note',
      null,
      null,
      note,
    );
    return this.detail(tenantId, id);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private view(
    r: Prisma.AdmissionEnquiryGetPayload<object>,
    names: Map<string, string>,
    today: string,
  ) {
    const next = ymd(r.nextFollowUpOn);
    const open = r.stage !== 'enrolled' && r.stage !== 'lost';
    return {
      id: r.id,
      childName: r.childName,
      dob: ymd(r.dob),
      classSought: r.classSought,
      parentName: r.parentName,
      phone: r.phone,
      email: r.email,
      source: r.source,
      stage: r.stage,
      tourOn: ymd(r.tourOn),
      nextFollowUpOn: next,
      followUpDue: open && !!next && next <= today,
      lostReason: r.lostReason,
      notes: r.notes,
      assignedTo: r.assignedTo
        ? { id: r.assignedTo, name: names.get(r.assignedTo) ?? '' }
        : null,
      stageChangedAt: r.stageChangedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async require(db: Db, tenantId: string, id: string) {
    const row = await db.admissionEnquiry.findFirst({
      where: { id, tenantId },
    });
    if (!row)
      throw new NotFoundException(
        err('ENQUIRY_NOT_FOUND', 'Enquiry not found'),
      );
    return row;
  }

  private assertDates(...dates: (string | undefined)[]) {
    for (const d of dates)
      if (d !== undefined && !isValidYmd(d))
        throw new BadRequestException(err('DATE_INVALID', 'Not a valid date'));
  }

  private async assertStaff(tenantId: string, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, role: { in: STAFF } },
      select: { id: true },
    });
    if (!u)
      throw new NotFoundException(
        err('STAFF_NOT_FOUND', 'Staff member not found'),
      );
  }

  private activity(
    db: Db,
    tenantId: string,
    enquiryId: string,
    byUserId: string,
    kind: string,
    fromStage: AdmissionStage | null,
    toStage: AdmissionStage | null,
    note: string | null,
  ) {
    return db.admissionActivity.create({
      data: { tenantId, enquiryId, byUserId, kind, fromStage, toStage, note },
    });
  }

  private async userNames(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const users = unique.length
      ? await this.prisma.user.findMany({
          where: { id: { in: unique } },
          select: { id: true, name: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private async today(tenantId: string) {
    return todayIn(await this.timeZone(tenantId));
  }

  private async timeZone(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return t?.timezone || 'Asia/Kolkata';
  }
}

/**
 * Admissions funnel per school for enquiries created since `from`
 * (YYYY-MM-DD). Shared with the head office view.
 */
export async function funnelFor(db: Db, tenantIds: string[], from: string) {
  const rows = await db.admissionEnquiry.findMany({
    where: { tenantId: { in: tenantIds }, createdAt: { gte: toDbDate(from) } },
    select: {
      id: true,
      tenantId: true,
      stage: true,
      activities: { where: { kind: 'stage' }, select: { toStage: true } },
    },
  });
  const by = new Map<
    string,
    { stage: AdmissionStage; furthest: AdmissionStage }[]
  >();
  for (const id of tenantIds) by.set(id, []);
  for (const r of rows)
    by.get(r.tenantId)!.push({
      stage: r.stage,
      furthest: furthestStage(
        r.stage,
        r.activities.map((a) => a.toStage),
      ),
    });
  return new Map([...by.entries()].map(([id, list]) => [id, funnelOf(list)]));
}
