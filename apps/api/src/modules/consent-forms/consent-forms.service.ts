import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConsentDecision, NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { effectiveLanguage } from '../../common/i18n/languages';
import {
  displayDate,
  fromDbDate,
  isValidYmd,
  toDbDate,
  todayIn,
} from '../attendance/attendance-dates';
import { NotificationsService } from '../notifications/notifications.service';
import { consentRequestText } from './consent-text';
import {
  CreateConsentFormDto,
  RespondConsentDto,
} from './dto/consent-forms.dto';

export type ConsentStatus = 'APPROVED' | 'DECLINED' | 'PENDING';

const statusOf = (r?: { decision: ConsentDecision } | null): ConsentStatus =>
  r?.decision ?? 'PENDING';

const err = (code: string, message: string) => ({ code, message });

const FORM_INCLUDE = {
  event: true,
  classes: {
    include: {
      class: { select: { id: true, name: true, section: true } },
    },
  },
} satisfies Prisma.ConsentFormInclude;

type FormRow = Prisma.ConsentFormGetPayload<{ include: typeof FORM_INCLUDE }>;

const className = (c: { name: string; section: string | null }) =>
  [c.name, c.section].filter(Boolean).join(' ');

const eventView = (e: FormRow['event']) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  startDate: fromDbDate(e.startDate),
  endDate: fromDbDate(e.endDate ?? e.startDate),
  startTime: e.startTime,
  endTime: e.endTime,
  venue: e.venue,
});

/**
 * Parent consent forms for school events (docs: CLAUDE.md "consent-forms").
 * Admins send one per event to the parents of the chosen classes; any linked
 * parent signs for a child by typing their full name, and can change the
 * answer until the deadline (school-local, inclusive).
 */
@Injectable()
export class ConsentFormsService {
  private readonly logger = new Logger(ConsentFormsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Admin ──────────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateConsentFormDto, user: ActiveUser) {
    const event = await this.prisma.schoolEvent.findFirst({
      where: { id: dto.eventId, tenantId },
      include: { consentForm: { select: { id: true } } },
    });
    if (!event)
      throw new NotFoundException(err('EVENT_NOT_FOUND', 'Event not found'));
    if (event.consentForm)
      throw new ConflictException(
        err('CONSENT_EXISTS', 'This event already has a consent form'),
      );

    const today = todayIn(await this.timeZone(tenantId));
    if (!isValidYmd(dto.deadline))
      throw new BadRequestException(
        err('INVALID_DATE', 'Not a valid calendar date'),
      );
    if (dto.deadline < today)
      throw new BadRequestException(
        err(
          'CONSENT_DEADLINE_PAST',
          'The last day to sign cannot be in the past',
        ),
      );
    if (dto.deadline > fromDbDate(event.startDate))
      throw new BadRequestException(
        err(
          'CONSENT_DEADLINE_AFTER_EVENT',
          'The last day to sign must be on or before the event date',
        ),
      );

    const classes = await this.prisma.class.count({
      where: { tenantId, id: { in: dto.classIds } },
    });
    if (classes !== dto.classIds.length)
      throw new BadRequestException(err('CLASS_NOT_FOUND', 'Class not found'));

    const form = await this.prisma.consentForm.create({
      data: {
        tenantId,
        eventId: event.id,
        body: dto.body.trim(),
        deadline: toDbDate(dto.deadline),
        createdBy: user.id,
        classes: { create: dto.classIds.map((classId) => ({ classId })) },
      },
      include: FORM_INCLUDE,
    });
    await this.audit(tenantId, user.id, 'consent_form.create', form.id, {
      eventId: event.id,
      classIds: dto.classIds,
      deadline: dto.deadline,
    });

    const parentIds = await this.parentsOf(tenantId, dto.classIds);
    this.notifyInBackground(tenantId, form, parentIds, false);
    return {
      ...(await this.summarise(tenantId, form)),
      notified: parentIds.length,
    };
  }

  /** Forms with their event, classes and answer counts, newest event first. */
  async list(tenantId: string, eventId?: string) {
    const forms = await this.prisma.consentForm.findMany({
      where: { tenantId, ...(eventId ? { eventId } : {}) },
      include: FORM_INCLUDE,
      orderBy: { event: { startDate: 'desc' } },
    });
    return Promise.all(forms.map((f) => this.summarise(tenantId, f)));
  }

  /** One row per student in the form's classes, with their answer if any. */
  async detail(tenantId: string, id: string) {
    const form = await this.findForm(tenantId, id);
    const [students, responses, timeZone] = await Promise.all([
      this.studentsOf(tenantId, form),
      this.prisma.consentResponse.findMany({
        where: { formId: form.id },
        include: { parent: { select: { name: true, phone: true } } },
      }),
      this.timeZone(tenantId),
    ]);
    const byStudent = new Map(responses.map((r) => [r.studentId, r]));
    const rows = students.map((s) => {
      const r = byStudent.get(s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        admissionNo: s.admissionNo,
        rollNo: s.rollNo,
        className: className(s.class),
        status: statusOf(r),
        signedName: r?.signedName ?? null,
        parentName: r?.parent?.name ?? null,
        parentPhone: r?.parent?.phone ?? null,
        signedAt: r?.signedAt.toISOString() ?? null,
        /** School-local YYYY-MM-DD of signedAt. */
        signedOn: r ? todayIn(timeZone, r.signedAt) : null,
        note: r?.note ?? null,
      };
    });
    return { ...(await this.summarise(tenantId, form, rows)), rows };
  }

  /** Pushes a reminder to the parents of students with no answer yet. */
  async remind(tenantId: string, id: string, user: ActiveUser) {
    const form = await this.findForm(tenantId, id);
    if (fromDbDate(form.deadline) < todayIn(await this.timeZone(tenantId)))
      throw new BadRequestException(
        err('CONSENT_CLOSED', 'The last day to sign has passed'),
      );
    const students = await this.studentsOf(tenantId, form);
    const answered = new Set(
      (
        await this.prisma.consentResponse.findMany({
          where: { formId: form.id },
          select: { studentId: true },
        })
      ).map((r) => r.studentId),
    );
    const pending = students
      .filter((s) => !answered.has(s.id))
      .map((s) => s.id);
    const links = await this.prisma.studentParent.findMany({
      where: { studentId: { in: pending } },
      select: { parentId: true },
    });
    const parentIds = [...new Set(links.map((l) => l.parentId))];
    await this.audit(tenantId, user.id, 'consent_form.remind', form.id, {
      parents: parentIds.length,
    });
    this.notifyInBackground(tenantId, form, parentIds, true);
    return { notified: parentIds.length };
  }

  /** Only a form nobody has answered can be withdrawn; signed answers are kept. */
  async remove(tenantId: string, id: string, user: ActiveUser) {
    const form = await this.findForm(tenantId, id);
    const answers = await this.prisma.consentResponse.count({
      where: { formId: form.id },
    });
    if (answers > 0)
      throw new ConflictException(
        err(
          'CONSENT_HAS_RESPONSES',
          'Parents have already answered this consent form, so it cannot be removed',
        ),
      );
    await this.prisma.consentForm.delete({ where: { id: form.id } });
    await this.audit(tenantId, user.id, 'consent_form.delete', form.id, {
      eventId: form.eventId,
    });
  }

  // ── Parent ─────────────────────────────────────────────────────────────────

  /** Every form for the parent's children: one item per (form, child), open and unanswered first. */
  async mine(tenantId: string, parentId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { parentId, student: { tenantId } },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            classId: true,
            class: { select: { name: true, section: true } },
          },
        },
      },
    });
    const children = links.map((l) => l.student);
    if (children.length === 0) return [];
    const classIds = [...new Set(children.map((c) => c.classId))];
    const [forms, responses, timeZone] = await Promise.all([
      this.prisma.consentForm.findMany({
        where: { tenantId, classes: { some: { classId: { in: classIds } } } },
        include: { event: true, classes: { select: { classId: true } } },
      }),
      this.prisma.consentResponse.findMany({
        where: { studentId: { in: children.map((c) => c.id) } },
        include: { parent: { select: { name: true } } },
      }),
      this.timeZone(tenantId),
    ]);
    const today = todayIn(timeZone);
    const answer = new Map(
      responses.map((r) => [`${r.formId}:${r.studentId}`, r]),
    );

    const items = forms.flatMap((form) => {
      const formClasses = new Set(form.classes.map((c) => c.classId));
      return children
        .filter((child) => formClasses.has(child.classId))
        .map((child) => {
          const r = answer.get(`${form.id}:${child.id}`);
          const deadline = fromDbDate(form.deadline);
          return {
            formId: form.id,
            studentId: child.id,
            studentName: child.name,
            className: className(child.class),
            event: eventView(form.event),
            body: form.body,
            deadline,
            open: deadline >= today,
            status: statusOf(r),
            response: r
              ? {
                  decision: r.decision,
                  signedName: r.signedName,
                  signedAt: r.signedAt.toISOString(),
                  note: r.note,
                  signedByMe: r.parentId === parentId,
                  signedBy: r.parent?.name ?? null,
                }
              : null,
          };
        });
    });
    const rank = (i: (typeof items)[number]) =>
      i.open && i.status === 'PENDING' ? 0 : i.open ? 1 : 2;
    return items.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.deadline.localeCompare(b.deadline) ||
        a.studentName.localeCompare(b.studentName),
    );
  }

  async respond(
    tenantId: string,
    parentId: string,
    formId: string,
    dto: RespondConsentDto,
  ) {
    const notFound = new NotFoundException(
      err('CONSENT_NOT_FOUND', 'Consent form not found'),
    );
    const link = await this.prisma.studentParent.findFirst({
      where: { parentId, studentId: dto.studentId, student: { tenantId } },
      select: { student: { select: { classId: true } } },
    });
    if (!link) throw notFound;
    const form = await this.prisma.consentForm.findFirst({
      where: {
        id: formId,
        tenantId,
        classes: { some: { classId: link.student.classId } },
      },
    });
    if (!form) throw notFound;
    if (fromDbDate(form.deadline) < todayIn(await this.timeZone(tenantId)))
      throw new BadRequestException(
        err('CONSENT_CLOSED', 'The last day to sign has passed'),
      );

    const data = {
      parentId,
      decision: dto.decision,
      signedName: dto.signedName,
      note: dto.note?.trim() || null,
      signedAt: new Date(),
    };
    const previous = await this.prisma.consentResponse.findUnique({
      where: { formId_studentId: { formId, studentId: dto.studentId } },
      select: { decision: true },
    });
    const row = await this.prisma.consentResponse.upsert({
      where: { formId_studentId: { formId, studentId: dto.studentId } },
      create: { formId, studentId: dto.studentId, ...data },
      update: data,
    });
    await this.audit(tenantId, parentId, 'consent_form.sign', formId, {
      studentId: dto.studentId,
      decision: dto.decision,
      ...(previous ? { previous: previous.decision } : {}),
    });
    return {
      decision: row.decision,
      signedName: row.signedName,
      signedAt: row.signedAt.toISOString(),
      note: row.note,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findForm(tenantId: string, id: string) {
    const form = await this.prisma.consentForm.findFirst({
      where: { id, tenantId },
      include: FORM_INCLUDE,
    });
    if (!form)
      throw new NotFoundException(
        err('CONSENT_NOT_FOUND', 'Consent form not found'),
      );
    return form;
  }

  private studentsOf(tenantId: string, form: FormRow) {
    return this.prisma.student.findMany({
      where: { tenantId, classId: { in: form.classes.map((c) => c.classId) } },
      select: {
        id: true,
        name: true,
        admissionNo: true,
        rollNo: true,
        class: { select: { name: true, section: true } },
      },
      orderBy: [
        { class: { name: 'asc' } },
        { class: { section: 'asc' } },
        { rollNo: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  private async summarise(
    tenantId: string,
    form: FormRow,
    rows?: { status: ConsentStatus }[],
  ) {
    const statuses: { status: ConsentStatus }[] =
      rows ??
      (await (async () => {
        const students = await this.studentsOf(tenantId, form);
        const answers = await this.prisma.consentResponse.findMany({
          where: {
            formId: form.id,
            studentId: { in: students.map((s) => s.id) },
          },
          select: { decision: true },
        });
        return [
          ...answers.map((a) => ({ status: a.decision })),
          ...Array.from({ length: students.length - answers.length }, () => ({
            status: statusOf(null),
          })),
        ];
      })());
    const count = (s: ConsentStatus) =>
      statuses.filter((r) => r.status === s).length;
    const deadline = fromDbDate(form.deadline);
    return {
      id: form.id,
      event: eventView(form.event),
      classes: form.classes
        .map((c) => ({ id: c.class.id, name: className(c.class) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
      body: form.body,
      deadline,
      open: deadline >= todayIn(await this.timeZone(tenantId)),
      createdAt: form.createdAt.toISOString(),
      counts: {
        total: statuses.length,
        approved: count(ConsentDecision.APPROVED),
        declined: count(ConsentDecision.DECLINED),
        pending: count('PENDING'),
      },
    };
  }

  private async parentsOf(tenantId: string, classIds: string[]) {
    const links = await this.prisma.studentParent.findMany({
      where: { student: { tenantId, classId: { in: classIds } } },
      select: { parentId: true },
    });
    return [...new Set(links.map((l) => l.parentId))];
  }

  /** Push + notification row per parent in their language; never blocks the request. */
  private notifyInBackground(
    tenantId: string,
    form: FormRow,
    parentIds: string[],
    reminder: boolean,
  ) {
    void (async () => {
      const [tenant, parents] = await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { defaultLanguage: true },
        }),
        this.prisma.user.findMany({
          where: { id: { in: parentIds }, tenantId },
          select: { id: true, preferredLanguage: true },
        }),
      ]);
      const deadline = displayDate(fromDbDate(form.deadline));
      for (const p of parents) {
        const { title, body } = consentRequestText(
          effectiveLanguage(p.preferredLanguage, tenant?.defaultLanguage),
          form.event.title,
          deadline,
          reminder,
        );
        await this.notifications.send({
          tenantId,
          userId: p.id,
          channel: NotificationChannel.fcm,
          title,
          body,
          data: { type: 'consent', formId: form.id },
        });
      }
    })().catch((e: unknown) =>
      this.logger.error(
        `Consent notifications failed for form ${form.id}: ${(e as Error).message}`,
      ),
    );
  }

  private async timeZone(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return t?.timezone || 'Asia/Kolkata';
  }

  private audit(
    tenantId: string,
    actorId: string,
    action: string,
    entityId: string,
    diff: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        action,
        entityType: 'consent_form',
        entityId,
        diff,
      },
    });
  }
}
