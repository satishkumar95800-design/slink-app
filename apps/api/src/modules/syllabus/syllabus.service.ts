import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  fromDbDate,
  isValidYmd,
  toDbDate,
  todayIn,
} from '../attendance/attendance-dates';
import { CopyPlanDto, SavePlanDto } from './dto/syllabus.dto';
import { ImportRow, parseSyllabusWorkbook } from './syllabus-import';
import { isOverdue, progressOf } from './syllabus.math';

type Db = PrismaService | Prisma.TransactionClient;

const err = (code: string, message: string) => ({ code, message });

const isAdmin = (role: Role) =>
  role === Role.admin || role === Role.super_admin;

const className = (c: { name: string; section: string | null }) =>
  [c.name, c.section].filter(Boolean).join(' ');

const pairKey = (classId: string, subjectId: string) =>
  `${classId}:${subjectId}`;

interface TopicRow {
  id: string;
  classId: string;
  subjectId: string;
  unit: string | null;
  title: string;
  sortOrder: number;
  plannedBy: Date;
  completedOn: Date | null;
  completedBy: string | null;
}

const TOPIC_ORDER = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
] satisfies Prisma.SyllabusTopicOrderByWithRelationInput[];

/**
 * Syllabus progress (flag `syllabus`). The admin keeps each class's subject
 * plan (topics in teaching order, each with a date it should be finished by);
 * the subject teacher marks topics covered from the mobile app; parents see
 * how much of each subject is done for their own child's class. On time /
 * late is derived (syllabus.math.ts) and shown to staff only.
 */
@Injectable()
export class SyllabusService {
  constructor(private readonly prisma: PrismaService) {}

  // ── staff views ───────────────────────────────────────────────────────────

  /**
   * One row per class and subject: every subject teacher assignment plus any
   * plan without one. A teacher sees only their own assignments.
   */
  async overview(tenantId: string, user: ActiveUser, classId?: string) {
    const today = await this.today(tenantId);
    const own = !isAdmin(user.role);
    const assignments = await this.prisma.teacherSubject.findMany({
      where: {
        tenantId,
        ...(classId && { classId }),
        ...(own && { teacherId: user.id }),
      },
      select: {
        classId: true,
        subjectId: true,
        teacher: { select: { id: true, name: true } },
      },
    });
    const ownPairs = new Set(
      assignments.map((a) => pairKey(a.classId, a.subjectId)),
    );
    const topics = (
      await this.prisma.syllabusTopic.findMany({
        where: { tenantId, ...(classId && { classId }) },
        orderBy: TOPIC_ORDER,
      })
    ).filter((t) => !own || ownPairs.has(pairKey(t.classId, t.subjectId)));

    const pairs = new Map<
      string,
      {
        classId: string;
        subjectId: string;
        teachers: { id: string; name: string }[];
      }
    >();
    const pairOf = (cId: string, sId: string) => {
      const key = pairKey(cId, sId);
      let p = pairs.get(key);
      if (!p) {
        p = { classId: cId, subjectId: sId, teachers: [] };
        pairs.set(key, p);
      }
      return p;
    };
    for (const a of assignments)
      pairOf(a.classId, a.subjectId).teachers.push(a.teacher);
    for (const t of topics) pairOf(t.classId, t.subjectId);

    const byPair = new Map<string, TopicRow[]>();
    for (const t of topics) {
      const key = pairKey(t.classId, t.subjectId);
      byPair.set(key, [...(byPair.get(key) ?? []), t]);
    }
    const [classes, subjects] = await Promise.all([
      this.prisma.class.findMany({
        where: {
          tenantId,
          id: { in: [...pairs.values()].map((p) => p.classId) },
        },
        select: { id: true, name: true, section: true },
      }),
      this.prisma.subject.findMany({
        where: {
          tenantId,
          id: { in: [...pairs.values()].map((p) => p.subjectId) },
        },
        select: { id: true, name: true },
      }),
    ]);
    const classById = new Map(classes.map((c) => [c.id, c]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

    return [...pairs.entries()]
      .filter(
        ([, p]) => classById.has(p.classId) && subjectById.has(p.subjectId),
      )
      .map(([key, p]) => {
        const list = byPair.get(key) ?? [];
        const progress = progressOf(list.map(dates), today);
        const next = progress.nextIndex >= 0 ? list[progress.nextIndex] : null;
        const c = classById.get(p.classId)!;
        return {
          classId: p.classId,
          className: className(c),
          subjectId: p.subjectId,
          subjectName: subjectById.get(p.subjectId)!.name,
          teachers: p.teachers.sort((a, b) => a.name.localeCompare(b.name)),
          ...progress,
          nextTopic: next
            ? { title: next.title, plannedBy: fromDbDate(next.plannedBy) }
            : null,
        };
      })
      .sort(
        (a, b) =>
          // numeric: "Class 9" before "Class 10".
          a.className.localeCompare(b.className, undefined, {
            numeric: true,
          }) || a.subjectName.localeCompare(b.subjectName),
      );
  }

  /** The full plan of one class's subject, for the console editor and the teacher's topic list. */
  async plan(
    tenantId: string,
    user: ActiveUser,
    classId: string,
    subjectId: string,
  ) {
    const assigned = await this.isAssigned(tenantId, user, classId, subjectId);
    if (!isAdmin(user.role) && !assigned)
      throw new ForbiddenException(
        err(
          'NOT_SUBJECT_TEACHER',
          'You do not teach this subject in this class',
        ),
      );
    const { cls, subject } = await this.requireClassSubject(
      tenantId,
      classId,
      subjectId,
    );
    const today = await this.today(tenantId);
    const [topics, teachers] = await Promise.all([
      this.prisma.syllabusTopic.findMany({
        where: { tenantId, classId, subjectId },
        orderBy: TOPIC_ORDER,
      }),
      this.prisma.teacherSubject.findMany({
        where: { tenantId, classId, subjectId },
        select: { teacher: { select: { id: true, name: true } } },
      }),
    ]);
    const names = await this.userNames(topics.map((t) => t.completedBy));
    return {
      class: { id: cls.id, name: className(cls) },
      subject: { id: subject.id, name: subject.name },
      teachers: teachers.map((t) => t.teacher),
      canEdit: isAdmin(user.role),
      canMark: isAdmin(user.role) || assigned,
      ...progressOf(topics.map(dates), today),
      topics: topics.map((t) => ({
        id: t.id,
        unit: t.unit,
        title: t.title,
        plannedBy: fromDbDate(t.plannedBy),
        completedOn: t.completedOn ? fromDbDate(t.completedOn) : null,
        completedBy: t.completedBy
          ? { id: t.completedBy, name: names.get(t.completedBy) ?? '' }
          : null,
        overdue: isOverdue(dates(t), today),
      })),
    };
  }

  // ── admin: plan editing ───────────────────────────────────────────────────

  /**
   * Replaces the list from the editor. Topics sent with an id keep their
   * covered date; topics left out are removed.
   */
  async savePlan(
    tenantId: string,
    user: ActiveUser,
    classId: string,
    subjectId: string,
    dto: SavePlanDto,
  ) {
    await this.requireClassSubject(tenantId, classId, subjectId);
    for (const t of dto.topics)
      if (!isValidYmd(t.plannedBy))
        throw new BadRequestException(
          err('DATE_INVALID', 'Not a valid calendar date'),
        );
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.syllabusTopic.findMany({
        where: { tenantId, classId, subjectId },
        select: { id: true, completedOn: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const keep = new Set<string>();
      for (const t of dto.topics) {
        if (!t.id) continue;
        if (!existingIds.has(t.id) || keep.has(t.id))
          throw new NotFoundException(
            err(
              'TOPIC_NOT_FOUND',
              'A topic in the list does not belong to this plan',
            ),
          );
        keep.add(t.id);
      }
      const removed = existing.filter((e) => !keep.has(e.id));
      if (removed.length)
        await tx.syllabusTopic.deleteMany({
          where: { tenantId, id: { in: removed.map((r) => r.id) } },
        });
      for (const [i, t] of dto.topics.entries()) {
        const data = {
          unit: t.unit?.trim() || null,
          title: t.title.trim(),
          plannedBy: toDbDate(t.plannedBy),
          sortOrder: i,
        };
        if (t.id) await tx.syllabusTopic.update({ where: { id: t.id }, data });
        else
          await tx.syllabusTopic.create({
            data: { tenantId, classId, subjectId, ...data },
          });
      }
      await this.audit(tx, tenantId, user.id, 'syllabus.plan.save', classId, {
        classId,
        subjectId,
        topics: dto.topics.length,
        removed: removed.length,
        removedCovered: removed.filter((r) => r.completedOn).length,
      });
    });
    return this.plan(tenantId, user, classId, subjectId);
  }

  /** Copies a plan (titles, units, target dates; not covered dates) to other sections. */
  async copyPlan(
    tenantId: string,
    user: ActiveUser,
    classId: string,
    subjectId: string,
    dto: CopyPlanDto,
  ) {
    await this.requireClassSubject(tenantId, classId, subjectId);
    const targets = [...new Set(dto.classIds)].filter((id) => id !== classId);
    const classes = await this.prisma.class.findMany({
      where: { tenantId, id: { in: targets } },
      select: { id: true, name: true, section: true },
    });
    if (classes.length !== targets.length)
      throw new NotFoundException(err('CLASS_NOT_FOUND', 'Class not found'));
    const source = await this.prisma.syllabusTopic.findMany({
      where: { tenantId, classId, subjectId },
      orderBy: TOPIC_ORDER,
    });
    if (source.length === 0)
      throw new BadRequestException(
        err('SYLLABUS_EMPTY', 'This plan has no topics to copy'),
      );
    const taken = await this.prisma.syllabusTopic.groupBy({
      by: ['classId'],
      where: { tenantId, subjectId, classId: { in: targets } },
      _count: { _all: true },
    });
    if (taken.length && !dto.replace) {
      const names = classes
        .filter((c) => taken.some((x) => x.classId === c.id))
        .map(className);
      throw new ConflictException({
        ...err(
          'SYLLABUS_EXISTS',
          'Some classes already have a plan for this subject',
        ),
        classes: names,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.syllabusTopic.deleteMany({
        where: { tenantId, subjectId, classId: { in: targets } },
      });
      await tx.syllabusTopic.createMany({
        data: targets.flatMap((target) =>
          source.map((t) => ({
            tenantId,
            classId: target,
            subjectId,
            unit: t.unit,
            title: t.title,
            sortOrder: t.sortOrder,
            plannedBy: t.plannedBy,
          })),
        ),
      });
      await this.audit(tx, tenantId, user.id, 'syllabus.plan.copy', classId, {
        classId,
        subjectId,
        toClassIds: targets,
        replaced: taken.map((x) => x.classId),
        topics: source.length,
      });
    });
    return { copied: targets.length, topics: source.length };
  }

  // ── marking topics covered ───────────────────────────────────────────────

  async complete(
    tenantId: string,
    user: ActiveUser,
    topicId: string,
    date?: string,
  ) {
    const topic = await this.requireMarkable(tenantId, user, topicId);
    const today = await this.today(tenantId);
    const day = date ?? today;
    if (!isValidYmd(day))
      throw new BadRequestException(
        err('DATE_INVALID', 'Not a valid calendar date'),
      );
    if (day > today)
      throw new BadRequestException(
        err(
          'DATE_IN_FUTURE',
          'A topic cannot be marked covered on a future date',
        ),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.syllabusTopic.update({
        where: { id: topicId },
        data: { completedOn: toDbDate(day), completedBy: user.id },
      });
      await this.audit(
        tx,
        tenantId,
        user.id,
        'syllabus.topic.complete',
        topicId,
        {
          classId: topic.classId,
          subjectId: topic.subjectId,
          title: topic.title,
          date: day,
          previous: topic.completedOn ? fromDbDate(topic.completedOn) : null,
        },
      );
    });
    return this.plan(tenantId, user, topic.classId, topic.subjectId);
  }

  async undo(tenantId: string, user: ActiveUser, topicId: string) {
    const topic = await this.requireMarkable(tenantId, user, topicId);
    await this.prisma.$transaction(async (tx) => {
      await tx.syllabusTopic.update({
        where: { id: topicId },
        data: { completedOn: null, completedBy: null },
      });
      await this.audit(tx, tenantId, user.id, 'syllabus.topic.undo', topicId, {
        classId: topic.classId,
        subjectId: topic.subjectId,
        title: topic.title,
        previous: topic.completedOn ? fromDbDate(topic.completedOn) : null,
      });
    });
    return this.plan(tenantId, user, topic.classId, topic.subjectId);
  }

  // ── parents ───────────────────────────────────────────────────────────────

  /**
   * Coverage for the parent's own child (resolved from student_parents). No
   * target dates or late status: those are for the school.
   */
  async child(tenantId: string, parentId: string, studentId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId, student: { tenantId } },
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
    if (!link)
      throw new NotFoundException(
        err('STUDENT_NOT_FOUND', 'Student not found'),
      );
    const { student } = link;
    const topics = await this.prisma.syllabusTopic.findMany({
      where: { tenantId, classId: student.classId },
      orderBy: TOPIC_ORDER,
      include: { subject: { select: { id: true, name: true } } },
    });
    const bySubject = new Map<string, typeof topics>();
    for (const t of topics)
      bySubject.set(t.subjectId, [...(bySubject.get(t.subjectId) ?? []), t]);
    return {
      student: {
        id: student.id,
        name: student.name,
        className: className(student.class),
      },
      subjects: [...bySubject.values()]
        .map((list) => {
          const covered = list.filter((t) => t.completedOn);
          const last = covered
            .map((t) => fromDbDate(t.completedOn!))
            .sort()
            .at(-1);
          return {
            subjectId: list[0].subject.id,
            subjectName: list[0].subject.name,
            total: list.length,
            covered: covered.length,
            percent: Math.round((covered.length / list.length) * 100),
            lastCoveredOn: last ?? null,
            topics: list.map((t) => ({
              id: t.id,
              unit: t.unit,
              title: t.title,
              completedOn: t.completedOn ? fromDbDate(t.completedOn) : null,
            })),
          };
        })
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    };
  }

  // ── Excel import ──────────────────────────────────────────────────────────

  /** Checks every row; nothing is written. */
  async validateImport(tenantId: string, buffer: Buffer) {
    const { rows, errors } = await this.resolveImport(tenantId, buffer);
    const groups = this.groupImport(rows);
    const existing = await this.prisma.syllabusTopic.groupBy({
      by: ['classId', 'subjectId'],
      where: {
        tenantId,
        OR: groups.map((g) => ({ classId: g.classId, subjectId: g.subjectId })),
      },
      _count: { _all: true },
    });
    const covered = await this.prisma.syllabusTopic.groupBy({
      by: ['classId', 'subjectId'],
      where: {
        tenantId,
        completedOn: { not: null },
        OR: groups.map((g) => ({ classId: g.classId, subjectId: g.subjectId })),
      },
      _count: { _all: true },
    });
    const countOf = (
      list: { classId: string; subjectId: string; _count: { _all: number } }[],
      g: { classId: string; subjectId: string },
    ) =>
      list.find((x) => x.classId === g.classId && x.subjectId === g.subjectId)
        ?._count._all ?? 0;
    return {
      rows: rows.length,
      errors,
      plans: groups.map((g) => ({
        className: g.className,
        subjectName: g.subjectName,
        topics: g.rows.length,
        existingTopics: countOf(existing, g),
        existingCovered: countOf(covered, g),
      })),
    };
  }

  /**
   * Writes the plans in the file. A class and subject that already has a plan
   * is only replaced with `replace` (its covered dates are lost).
   */
  async commitImport(
    tenantId: string,
    user: ActiveUser,
    buffer: Buffer,
    replace: boolean,
  ) {
    const report = await this.validateImport(tenantId, buffer);
    if (report.errors.length)
      throw new BadRequestException(
        err(
          'IMPORT_ROWS_INVALID',
          'Fix the rows with problems and upload again',
        ),
      );
    if (!replace && report.plans.some((p) => p.existingTopics > 0))
      throw new ConflictException(
        err(
          'SYLLABUS_EXISTS',
          'Some classes already have a plan for this subject',
        ),
      );
    const { rows } = await this.resolveImport(tenantId, buffer);
    const groups = this.groupImport(rows);
    await this.prisma.$transaction(async (tx) => {
      for (const g of groups) {
        await tx.syllabusTopic.deleteMany({
          where: { tenantId, classId: g.classId, subjectId: g.subjectId },
        });
        await tx.syllabusTopic.createMany({
          data: g.rows.map((r, i) => ({
            tenantId,
            classId: g.classId,
            subjectId: g.subjectId,
            unit: r.unit,
            title: r.title,
            sortOrder: i,
            plannedBy: toDbDate(r.plannedBy),
          })),
        });
      }
      await this.audit(tx, tenantId, user.id, 'syllabus.import', null, {
        plans: report.plans.map((p) => ({
          className: p.className,
          subjectName: p.subjectName,
          topics: p.topics,
          replacedTopics: p.existingTopics,
        })),
      });
    });
    return { plans: groups.length, topics: rows.length };
  }

  private async resolveImport(tenantId: string, buffer: Buffer) {
    const parsed = await parseSyllabusWorkbook(buffer);
    const [classes, subjects] = await Promise.all([
      this.prisma.class.findMany({
        where: { tenantId },
        select: { id: true, name: true, section: true, academicYear: true },
        orderBy: { academicYear: 'desc' },
      }),
      this.prisma.subject.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);
    const norm = (s: string | null | undefined) =>
      (s ?? '').trim().toLowerCase();
    // Latest academic year wins when a class name repeats across years.
    const classOf = (name: string, section: string | null) =>
      classes.find(
        (c) => norm(c.name) === norm(name) && norm(c.section) === norm(section),
      );
    const subjectOf = (name: string) =>
      subjects.find((s) => norm(s.name) === norm(name));

    const errors = [...parsed.errors];
    const rows: (ImportRow & {
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
    })[] = [];
    for (const r of parsed.rows) {
      const cls = classOf(r.className, r.section);
      const subject = subjectOf(r.subject);
      if (!cls)
        errors.push({
          row: r.row,
          code: 'CLASS_UNKNOWN',
          value: [r.className, r.section].filter(Boolean).join(' '),
        });
      if (!subject)
        errors.push({ row: r.row, code: 'SUBJECT_UNKNOWN', value: r.subject });
      if (cls && subject)
        rows.push({
          ...r,
          classId: cls.id,
          className: className(cls),
          subjectId: subject.id,
          subjectName: subject.name,
        });
    }
    errors.sort((a, b) => a.row - b.row);
    return { rows, errors };
  }

  private groupImport<
    R extends {
      classId: string;
      subjectId: string;
      className: string;
      subjectName: string;
    },
  >(rows: R[]) {
    const groups = new Map<
      string,
      {
        classId: string;
        subjectId: string;
        className: string;
        subjectName: string;
        rows: R[];
      }
    >();
    for (const r of rows) {
      const key = pairKey(r.classId, r.subjectId);
      const g = groups.get(key) ?? {
        classId: r.classId,
        subjectId: r.subjectId,
        className: r.className,
        subjectName: r.subjectName,
        rows: [],
      };
      g.rows.push(r);
      groups.set(key, g);
    }
    return [...groups.values()];
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async today(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return todayIn(tenant?.timezone || 'Asia/Kolkata');
  }

  private async isAssigned(
    tenantId: string,
    user: ActiveUser,
    classId: string,
    subjectId: string,
  ) {
    if (user.role !== Role.teacher) return false;
    const row = await this.prisma.teacherSubject.findFirst({
      where: { tenantId, teacherId: user.id, classId, subjectId },
      select: { id: true },
    });
    return !!row;
  }

  private async requireClassSubject(
    tenantId: string,
    classId: string,
    subjectId: string,
  ) {
    const [cls, subject] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: classId, tenantId },
        select: { id: true, name: true, section: true },
      }),
      this.prisma.subject.findFirst({
        where: { id: subjectId, tenantId },
        select: { id: true, name: true },
      }),
    ]);
    if (!cls)
      throw new NotFoundException(err('CLASS_NOT_FOUND', 'Class not found'));
    if (!subject)
      throw new NotFoundException(
        err('SUBJECT_NOT_FOUND', 'Subject not found'),
      );
    return { cls, subject };
  }

  /** The topic, if this user may tick it: an admin, or the class's teacher of that subject. */
  private async requireMarkable(
    tenantId: string,
    user: ActiveUser,
    topicId: string,
  ) {
    const topic = await this.prisma.syllabusTopic.findFirst({
      where: { id: topicId, tenantId },
    });
    if (!topic)
      throw new NotFoundException(err('TOPIC_NOT_FOUND', 'Topic not found'));
    if (
      !isAdmin(user.role) &&
      !(await this.isAssigned(tenantId, user, topic.classId, topic.subjectId))
    )
      throw new ForbiddenException(
        err(
          'NOT_SUBJECT_TEACHER',
          'You do not teach this subject in this class',
        ),
      );
    return topic;
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

  private audit(
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
        entityType: 'syllabus',
        entityId,
        diff,
      },
    });
  }
}

const dates = (t: { plannedBy: Date; completedOn: Date | null }) => ({
  plannedBy: fromDbDate(t.plannedBy),
  completedOn: t.completedOn ? fromDbDate(t.completedOn) : null,
});
