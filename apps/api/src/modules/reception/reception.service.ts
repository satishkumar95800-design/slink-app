import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  fromDbDate,
  isValidYmd,
  todayIn,
  toDbDate,
} from '../attendance/attendance-dates';
import { fromPaise, toPaise } from '../petty-cash/petty-cash.math';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CallDto,
  DeskPaymentDto,
  DocumentDto,
  FollowUpInputDto,
  VisitorDto,
} from './dto/reception.dto';
import {
  ADMISSION_DOCUMENTS,
  AdmissionDocumentKind,
} from './reception.constants';
import { localDayRange } from './reception.math';

type Db = PrismaService | Prisma.TransactionClient;
const err = (code: string, message: string) => ({ code, message });
const OPEN_STAGES = [
  'enquiry',
  'campus_tour',
  'follow_up',
  'registration',
] as const;

/** Only admin and accounts void a desk receipt (the receptionist never does). */
const CAN_VOID: Role[] = [Role.admin, Role.accounts, Role.super_admin];

/**
 * Front desk (part of the `admissions` flag): the receptionist's day. Follow-up
 * to-dos on enquiries (ticked off when done; the enquiry's next follow-up date
 * mirrors the earliest open one), the documents received for an admission,
 * money taken at the desk with numbered receipts (voided with a reason, never
 * deleted), the visitor book and the call log. Every write is audit-logged;
 * enquiry changes also go on the enquiry's activity timeline.
 */
@Injectable()
export class ReceptionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Today ─────────────────────────────────────────────────────────────────

  async today(tenantId: string) {
    const { today, tz } = await this.clock(tenantId);
    const day = localDayRange(today, tz);
    const [
      followUps,
      inside,
      visitorsToday,
      callsToday,
      newToday,
      stages,
      unpaidDocs,
    ] = await Promise.all([
      this.prisma.admissionFollowUp.findMany({
        where: {
          tenantId,
          doneAt: null,
          dueOn: { lte: toDbDate(today) },
          enquiry: { stage: { in: [...OPEN_STAGES] } },
        },
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }],
        take: 100,
        select: FOLLOW_UP_SELECT,
      }),
      this.prisma.visitor.findMany({
        where: { tenantId, outAt: null, inAt: { gte: day.gte, lt: day.lt } },
        orderBy: { inAt: 'asc' },
      }),
      this.prisma.visitor.count({
        where: { tenantId, inAt: { gte: day.gte, lt: day.lt } },
      }),
      this.prisma.callLog.count({
        where: { tenantId, at: { gte: day.gte, lt: day.lt } },
      }),
      this.prisma.admissionEnquiry.count({
        where: { tenantId, createdAt: { gte: day.gte, lt: day.lt } },
      }),
      this.prisma.admissionEnquiry.groupBy({
        by: ['stage'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.admissionEnquiry.count({
        where: {
          tenantId,
          stage: 'registration',
          payments: { none: { voidedAt: null } },
        },
      }),
    ]);
    return {
      date: today,
      followUps: followUps.map((f) => followUpView(f, today)),
      visitorsInside: inside.map(visitorView),
      counts: {
        visitorsToday,
        callsToday,
        newEnquiriesToday: newToday,
        registrationsWithoutFee: unpaidDocs,
        byStage: Object.fromEntries(
          stages.map((s) => [s.stage, s._count._all]),
        ),
      },
    };
  }

  // ── One enquiry: follow-ups, documents, payments, calls ────────────────────

  async enquiryDesk(tenantId: string, enquiryId: string) {
    await this.requireEnquiry(this.prisma, tenantId, enquiryId);
    const { today } = await this.clock(tenantId);
    const [followUps, docs, payments, calls] = await Promise.all([
      this.prisma.admissionFollowUp.findMany({
        where: { tenantId, enquiryId },
        orderBy: [
          { doneAt: { sort: 'asc', nulls: 'first' } },
          { dueOn: 'asc' },
        ],
        select: FOLLOW_UP_SELECT,
      }),
      this.prisma.admissionDocument.findMany({
        where: { tenantId, enquiryId },
      }),
      this.prisma.admissionPayment.findMany({
        where: { tenantId, enquiryId },
        orderBy: { receiptNo: 'desc' },
      }),
      this.prisma.callLog.findMany({
        where: { tenantId, enquiryId },
        orderBy: { at: 'desc' },
        take: 20,
      }),
    ]);
    const names = await this.names([
      ...followUps.flatMap((f) => [f.doneBy, f.createdBy]),
      ...docs.map((d) => d.receivedBy),
      ...payments.flatMap((p) => [p.receivedBy, p.voidedBy]),
    ]);
    const byKind = new Map(docs.map((d) => [d.kind, d]));
    return {
      followUps: followUps.map((f) => ({
        ...followUpView(f, today),
        doneBy: f.doneBy ? (names.get(f.doneBy) ?? '') : null,
        createdBy: names.get(f.createdBy) ?? '',
      })),
      documents: ADMISSION_DOCUMENTS.map((kind) => {
        const d = byKind.get(kind);
        return {
          kind,
          received: !!d,
          receivedAt: d?.receivedAt ?? null,
          receivedBy: d ? (names.get(d.receivedBy) ?? '') : null,
          note: d?.note ?? null,
        };
      }),
      payments: payments.map((p) => paymentView(p, names)),
      calls: calls.map(callView),
    };
  }

  async addFollowUp(
    tenantId: string,
    user: ActiveUser,
    enquiryId: string,
    dto: FollowUpInputDto,
  ) {
    if (!isValidYmd(dto.dueOn))
      throw new BadRequestException(err('DATE_INVALID', 'Not a valid date'));
    const { today } = await this.clock(tenantId);
    if (dto.dueOn < today)
      throw new BadRequestException(
        err('DATE_IN_PAST', 'Pick today or a later date'),
      );
    await this.prisma.$transaction(async (tx) => {
      await this.requireEnquiry(tx, tenantId, enquiryId);
      const row = await tx.admissionFollowUp.create({
        data: {
          tenantId,
          enquiryId,
          dueOn: toDbDate(dto.dueOn),
          kind: dto.kind,
          note: dto.note ?? null,
          createdBy: user.id,
        },
      });
      await this.syncNextFollowUp(tx, tenantId, enquiryId);
      await this.activity(
        tx,
        tenantId,
        enquiryId,
        user.id,
        'follow_up',
        `${dto.kind} ${dto.dueOn}${dto.note ? ` — ${dto.note}` : ''}`,
      );
      await audit(tx, tenantId, user.id, 'reception.follow_up_added', row.id, {
        enquiryId,
        ...dto,
      });
    });
    return this.enquiryDesk(tenantId, enquiryId);
  }

  /** Tick a follow-up off (with what came of it), or untick it. */
  async setFollowUpDone(
    tenantId: string,
    user: ActiveUser,
    id: string,
    done: boolean,
    outcome?: string,
  ) {
    const f = await this.prisma.admissionFollowUp.findFirst({
      where: { id, tenantId },
      select: { id: true, enquiryId: true, kind: true, doneAt: true },
    });
    if (!f)
      throw new NotFoundException(
        err('FOLLOW_UP_NOT_FOUND', 'Follow-up not found'),
      );
    if (!!f.doneAt === done) return this.enquiryDesk(tenantId, f.enquiryId);
    await this.prisma.$transaction(async (tx) => {
      await tx.admissionFollowUp.update({
        where: { id },
        data: done
          ? { doneAt: new Date(), doneBy: user.id, outcome: outcome ?? null }
          : { doneAt: null, doneBy: null, outcome: null },
      });
      await this.syncNextFollowUp(tx, tenantId, f.enquiryId);
      await this.activity(
        tx,
        tenantId,
        f.enquiryId,
        user.id,
        done ? 'follow_up_done' : 'follow_up_reopened',
        done ? (outcome ?? f.kind) : f.kind,
      );
      await audit(
        tx,
        tenantId,
        user.id,
        done ? 'reception.follow_up_done' : 'reception.follow_up_reopened',
        id,
        {
          outcome: outcome ?? null,
        },
      );
    });
    return this.enquiryDesk(tenantId, f.enquiryId);
  }

  async setDocument(
    tenantId: string,
    user: ActiveUser,
    enquiryId: string,
    kind: string,
    dto: DocumentDto,
  ) {
    if (!ADMISSION_DOCUMENTS.includes(kind as AdmissionDocumentKind))
      throw new BadRequestException(
        err('DOCUMENT_UNKNOWN', 'Unknown document'),
      );
    await this.prisma.$transaction(async (tx) => {
      await this.requireEnquiry(tx, tenantId, enquiryId);
      if (dto.received)
        await tx.admissionDocument.upsert({
          where: { enquiryId_kind: { enquiryId, kind } },
          create: {
            tenantId,
            enquiryId,
            kind,
            receivedBy: user.id,
            note: dto.note ?? null,
          },
          update: { note: dto.note ?? null },
        });
      else
        await tx.admissionDocument.deleteMany({
          where: { tenantId, enquiryId, kind },
        });
      await audit(tx, tenantId, user.id, 'reception.document', enquiryId, {
        kind,
        received: dto.received,
      });
    });
    return this.enquiryDesk(tenantId, enquiryId);
  }

  // ── Desk payments ─────────────────────────────────────────────────────────

  async addPayment(
    tenantId: string,
    user: ActiveUser,
    enquiryId: string,
    dto: DeskPaymentDto,
  ) {
    const { today } = await this.clock(tenantId);
    const receivedOn = dto.receivedOn ?? today;
    if (!isValidYmd(receivedOn) || receivedOn > today)
      throw new BadRequestException(
        err('DATE_IN_FUTURE', 'The date cannot be in the future'),
      );
    const paise = toPaise(dto.amount);
    if (paise <= 0)
      throw new BadRequestException(
        err('AMOUNT_INVALID', 'Enter an amount above zero'),
      );
    const id = await this.prisma.$transaction(async (tx) => {
      await this.requireEnquiry(tx, tenantId, enquiryId);
      // Receipt numbers run per school without gaps from concurrent desks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'desk-receipt:' + tenantId}))`;
      const last = await tx.admissionPayment.aggregate({
        where: { tenantId },
        _max: { receiptNo: true },
      });
      const row = await tx.admissionPayment.create({
        data: {
          tenantId,
          enquiryId,
          receiptNo: (last._max.receiptNo ?? 0) + 1,
          purpose: dto.purpose,
          amount: fromPaise(paise),
          mode: dto.mode,
          reference: dto.reference ?? null,
          receivedOn: toDbDate(receivedOn),
          receivedBy: user.id,
        },
      });
      await this.activity(
        tx,
        tenantId,
        enquiryId,
        user.id,
        'payment',
        `${dto.purpose} ₹${fromPaise(paise)} (${dto.mode})`,
      );
      await audit(tx, tenantId, user.id, 'reception.payment_received', row.id, {
        enquiryId,
        receiptNo: row.receiptNo,
        amount: fromPaise(paise),
        mode: dto.mode,
        purpose: dto.purpose,
      });
      return row.id;
    });
    return this.receipt(tenantId, id);
  }

  async voidPayment(
    tenantId: string,
    user: ActiveUser,
    id: string,
    reason: string,
  ) {
    if (!CAN_VOID.includes(user.role))
      throw new ForbiddenException(
        err('VOID_NOT_ALLOWED', 'Only admin or accounts can void a receipt'),
      );
    const p = await this.prisma.admissionPayment.findFirst({
      where: { id, tenantId },
    });
    if (!p)
      throw new NotFoundException(
        err('PAYMENT_NOT_FOUND', 'Receipt not found'),
      );
    if (p.voidedAt)
      throw new ConflictException(
        err('ALREADY_VOID', 'This receipt is already void'),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.admissionPayment.update({
        where: { id },
        data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason },
      });
      await this.activity(
        tx,
        tenantId,
        p.enquiryId,
        user.id,
        'payment_void',
        `#${p.receiptNo}: ${reason}`,
      );
      await audit(tx, tenantId, user.id, 'reception.payment_voided', id, {
        receiptNo: p.receiptNo,
        reason,
      });
    });
    return this.receipt(tenantId, id);
  }

  /** One receipt with what a printed copy needs. */
  async receipt(tenantId: string, id: string) {
    const p = await this.prisma.admissionPayment.findFirst({
      where: { id, tenantId },
      include: {
        enquiry: {
          select: {
            childName: true,
            parentName: true,
            phone: true,
            classSought: true,
          },
        },
        tenant: { select: { name: true, branding: true } },
      },
    });
    if (!p)
      throw new NotFoundException(
        err('PAYMENT_NOT_FOUND', 'Receipt not found'),
      );
    const names = await this.names([p.receivedBy, p.voidedBy]);
    const branding = (p.tenant.branding ?? {}) as Record<string, unknown>;
    return {
      ...paymentView(p, names),
      enquiry: p.enquiry,
      school: {
        name: p.tenant.name,
        address: typeof branding.address === 'string' ? branding.address : null,
        phone:
          typeof branding.contactPhone === 'string'
            ? branding.contactPhone
            : null,
      },
    };
  }

  /** Desk receipts in a date range with totals per mode (for accounts). */
  async payments(tenantId: string, from?: string, to?: string) {
    const { today } = await this.clock(tenantId);
    const range = {
      gte: toDbDate(from ?? today),
      lte: toDbDate(to ?? from ?? today),
    };
    const rows = await this.prisma.admissionPayment.findMany({
      where: { tenantId, receivedOn: range },
      orderBy: { receiptNo: 'desc' },
      include: { enquiry: { select: { childName: true, parentName: true } } },
    });
    const names = await this.names(
      rows.flatMap((r) => [r.receivedBy, r.voidedBy]),
    );
    const totals = new Map<string, number>();
    for (const r of rows)
      if (!r.voidedAt)
        totals.set(r.mode, (totals.get(r.mode) ?? 0) + toPaise(r.amount));
    const all = [...totals.values()].reduce((a, b) => a + b, 0);
    return {
      data: rows.map((r) => ({ ...paymentView(r, names), enquiry: r.enquiry })),
      totals: {
        all: fromPaise(all),
        byMode: Object.fromEntries(
          [...totals].map(([m, v]) => [m, fromPaise(v)]),
        ),
      },
    };
  }

  // ── Visitor book ──────────────────────────────────────────────────────────

  async visitors(tenantId: string, date?: string) {
    const { today, tz } = await this.clock(tenantId);
    const day = localDayRange(date ?? today, tz);
    const rows = await this.prisma.visitor.findMany({
      where: { tenantId, inAt: { gte: day.gte, lt: day.lt } },
      orderBy: { inAt: 'desc' },
    });
    return rows.map(visitorView);
  }

  async signIn(tenantId: string, user: ActiveUser, dto: VisitorDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          tenantId,
          name: dto.name,
          phone: dto.phone ?? null,
          purpose: dto.purpose,
          whomToMeet: dto.whomToMeet ?? null,
          people: dto.people ?? 1,
          note: dto.note ?? null,
          createdBy: user.id,
        },
      });
      await audit(tx, tenantId, user.id, 'reception.visitor_in', v.id, {
        name: dto.name,
        purpose: dto.purpose,
      });
      return v;
    });
    return visitorView(row);
  }

  async signOut(tenantId: string, user: ActiveUser, id: string) {
    const v = await this.prisma.visitor.findFirst({ where: { id, tenantId } });
    if (!v)
      throw new NotFoundException(
        err('VISITOR_NOT_FOUND', 'Visitor not found'),
      );
    if (v.outAt) return visitorView(v);
    const row = await this.prisma.$transaction(async (tx) => {
      const out = await tx.visitor.update({
        where: { id },
        data: { outAt: new Date() },
      });
      await audit(tx, tenantId, user.id, 'reception.visitor_out', id, {
        name: v.name,
      });
      return out;
    });
    return visitorView(row);
  }

  // ── Call log ──────────────────────────────────────────────────────────────

  async calls(tenantId: string, date?: string) {
    const { today, tz } = await this.clock(tenantId);
    const day = localDayRange(date ?? today, tz);
    const rows = await this.prisma.callLog.findMany({
      where: { tenantId, at: { gte: day.gte, lt: day.lt } },
      orderBy: { at: 'desc' },
      include: { enquiry: { select: { id: true, childName: true } } },
    });
    return rows.map((c) => ({ ...callView(c), enquiry: c.enquiry }));
  }

  async logCall(tenantId: string, user: ActiveUser, dto: CallDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.enquiryId) await this.requireEnquiry(tx, tenantId, dto.enquiryId);
      const c = await tx.callLog.create({
        data: {
          tenantId,
          direction: dto.direction,
          name: dto.name ?? null,
          phone: dto.phone,
          enquiryId: dto.enquiryId ?? null,
          purpose: dto.purpose ?? null,
          note: dto.note ?? null,
          createdBy: user.id,
        },
      });
      if (dto.enquiryId)
        await this.activity(
          tx,
          tenantId,
          dto.enquiryId,
          user.id,
          'call',
          `${dto.direction}${dto.note ? ` — ${dto.note}` : ''}`,
        );
      await audit(tx, tenantId, user.id, 'reception.call_logged', c.id, {
        direction: dto.direction,
        enquiryId: dto.enquiryId ?? null,
      });
      return c;
    });
    return callView(row);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** next_follow_up_on = the earliest open follow-up (null when none is open). */
  private async syncNextFollowUp(
    tx: Prisma.TransactionClient,
    tenantId: string,
    enquiryId: string,
  ) {
    const next = await tx.admissionFollowUp.findFirst({
      where: { tenantId, enquiryId, doneAt: null },
      orderBy: { dueOn: 'asc' },
      select: { dueOn: true },
    });
    await tx.admissionEnquiry.update({
      where: { id: enquiryId },
      data: { nextFollowUpOn: next?.dueOn ?? null },
    });
  }

  private async requireEnquiry(db: Db, tenantId: string, id: string) {
    const e = await db.admissionEnquiry.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!e)
      throw new NotFoundException(
        err('ENQUIRY_NOT_FOUND', 'Enquiry not found'),
      );
  }

  private activity(
    db: Db,
    tenantId: string,
    enquiryId: string,
    byUserId: string,
    kind: string,
    note: string,
  ) {
    return db.admissionActivity.create({
      data: { tenantId, enquiryId, byUserId, kind, note: note.slice(0, 500) },
    });
  }

  private async names(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const users = unique.length
      ? await this.prisma.user.findMany({
          where: { id: { in: unique } },
          select: { id: true, name: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private async clock(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const tz = t?.timezone || 'Asia/Kolkata';
    return { tz, today: todayIn(tz) };
  }
}

const FOLLOW_UP_SELECT = {
  id: true,
  dueOn: true,
  kind: true,
  note: true,
  doneAt: true,
  doneBy: true,
  outcome: true,
  createdBy: true,
  enquiry: {
    select: {
      id: true,
      childName: true,
      parentName: true,
      phone: true,
      stage: true,
      classSought: true,
    },
  },
} as const;

type FollowUpRow = Prisma.AdmissionFollowUpGetPayload<{
  select: typeof FOLLOW_UP_SELECT;
}>;

function followUpView(f: FollowUpRow, today: string) {
  const due = fromDbDate(f.dueOn);
  return {
    id: f.id,
    dueOn: due,
    kind: f.kind,
    note: f.note,
    done: !!f.doneAt,
    doneAt: f.doneAt,
    outcome: f.outcome,
    overdue: !f.doneAt && due < today,
    enquiry: f.enquiry,
  };
}

function visitorView(v: Prisma.VisitorGetPayload<object>) {
  return {
    id: v.id,
    name: v.name,
    phone: v.phone,
    purpose: v.purpose,
    whomToMeet: v.whomToMeet,
    people: v.people,
    note: v.note,
    inAt: v.inAt,
    outAt: v.outAt,
  };
}

function callView(c: Prisma.CallLogGetPayload<object>) {
  return {
    id: c.id,
    direction: c.direction,
    name: c.name,
    phone: c.phone,
    enquiryId: c.enquiryId,
    purpose: c.purpose,
    note: c.note,
    at: c.at,
  };
}

function paymentView(
  p: Prisma.AdmissionPaymentGetPayload<object>,
  names: Map<string, string>,
) {
  return {
    id: p.id,
    receiptNo: p.receiptNo,
    purpose: p.purpose,
    amount: p.amount.toFixed(2),
    mode: p.mode,
    reference: p.reference,
    receivedOn: fromDbDate(p.receivedOn),
    receivedBy: names.get(p.receivedBy) ?? '',
    void: p.voidedAt
      ? {
          at: p.voidedAt,
          by: p.voidedBy ? (names.get(p.voidedBy) ?? '') : '',
          reason: p.voidReason,
        }
      : null,
    createdAt: p.createdAt,
  };
}

function audit(
  db: Db,
  tenantId: string,
  actorId: string,
  action: string,
  entityId: string | null,
  diff: Prisma.InputJsonValue,
) {
  return db.auditLog.create({
    data: {
      tenantId,
      actorId,
      action,
      entityType: 'reception',
      entityId,
      diff,
    },
  });
}
