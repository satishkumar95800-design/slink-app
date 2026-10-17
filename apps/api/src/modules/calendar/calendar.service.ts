import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SchoolEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AttendanceService } from '../attendance/attendance.service';
import {
  daysBetween,
  fromDbDate,
  isValidYmd,
  toDbDate,
} from '../attendance/attendance-dates';
import { calendarStrings as t } from './calendar.strings';
import { CreateEventDto } from './dto/calendar.dto';

const MAX_RANGE_DAYS = 366;

export type CalendarItemType = 'HOLIDAY' | SchoolEventType;

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  description: string | null;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD; equals startDate for one-day items. */
  endDate: string;
  /** HH:mm or null */
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
}

type EventRow = Prisma.SchoolEventGetPayload<object>;

const toItem = (e: EventRow): CalendarItem => ({
  id: e.id,
  type: e.type,
  title: e.title,
  description: e.description,
  startDate: fromDbDate(e.startDate),
  endDate: fromDbDate(e.endDate ?? e.startDate),
  startTime: e.startTime,
  endTime: e.endTime,
  venue: e.venue,
});

const clean = (s?: string) => {
  const v = s?.trim();
  return v ? v : null;
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  /** Holidays + events + PTMs overlapping [from, to], sorted by start date, then time, then title. */
  async list(tenantId: string, from: string, to: string) {
    this.assertRange(from, to);
    const [holidays, events] = await Promise.all([
      this.attendance.listHolidays(tenantId, from, to),
      this.findEvents(tenantId, from, to),
    ]);
    const items: CalendarItem[] = [
      ...holidays.map((h): CalendarItem => ({
        id: h.id,
        type: 'HOLIDAY',
        title: h.name,
        description: null,
        startDate: h.date,
        endDate: h.date,
        startTime: null,
        endTime: null,
        venue: null,
      })),
      ...events.map(toItem),
    ].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
        a.title.localeCompare(b.title),
    );
    return { from, to, data: items };
  }

  async listEvents(tenantId: string, from?: string, to?: string) {
    if (from) this.assertDate(from);
    if (to) this.assertDate(to);
    const rows = await this.findEvents(tenantId, from, to);
    return rows.map(toItem);
  }

  async createEvent(tenantId: string, dto: CreateEventDto, user: ActiveUser) {
    this.assertDate(dto.startDate);
    if (dto.endDate) {
      this.assertDate(dto.endDate);
      if (dto.endDate < dto.startDate)
        throw new BadRequestException(t.endBeforeStart);
    }
    if (dto.endTime && !dto.startTime)
      throw new BadRequestException(t.endTimeNeedsStart);
    const singleDay = !dto.endDate || dto.endDate === dto.startDate;
    if (
      singleDay &&
      dto.startTime &&
      dto.endTime &&
      dto.endTime <= dto.startTime
    )
      throw new BadRequestException(t.endTimeBeforeStart);

    const row = await this.prisma.schoolEvent.create({
      data: {
        tenantId,
        type: dto.type,
        title: dto.title.trim(),
        description: clean(dto.description),
        startDate: toDbDate(dto.startDate),
        endDate:
          dto.endDate && dto.endDate !== dto.startDate
            ? toDbDate(dto.endDate)
            : null,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        venue: clean(dto.venue),
        createdBy: user.id,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: user.id,
        action: 'school_event.create',
        entityType: 'school_event',
        entityId: row.id,
        diff: { type: row.type, title: row.title, startDate: dto.startDate },
      },
    });
    return toItem(row);
  }

  async deleteEvent(tenantId: string, id: string, user: ActiveUser) {
    const row = await this.prisma.schoolEvent.findFirst({
      where: { id, tenantId },
      include: {
        consentForm: {
          select: { id: true, _count: { select: { responses: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException(t.eventNotFound);
    // Signed consent answers are a record the school must keep.
    if (row.consentForm && row.consentForm._count.responses > 0)
      throw new ConflictException({
        code: 'EVENT_HAS_CONSENT',
        message: t.eventHasConsent,
      });
    await this.prisma.$transaction([
      ...(row.consentForm
        ? [
            this.prisma.consentForm.delete({
              where: { id: row.consentForm.id },
            }),
          ]
        : []),
      this.prisma.schoolEvent.delete({ where: { id } }),
    ]);
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: user.id,
        action: 'school_event.delete',
        entityType: 'school_event',
        entityId: id,
        diff: {
          type: row.type,
          title: row.title,
          startDate: fromDbDate(row.startDate),
        },
      },
    });
  }

  /** Events whose [start, end ?? start] span overlaps [from, to]; open-ended bounds are skipped. */
  private findEvents(tenantId: string, from?: string, to?: string) {
    const and: Prisma.SchoolEventWhereInput[] = [];
    if (to) and.push({ startDate: { lte: toDbDate(to) } });
    if (from) {
      and.push({
        OR: [
          { endDate: null, startDate: { gte: toDbDate(from) } },
          { endDate: { gte: toDbDate(from) } },
        ],
      });
    }
    return this.prisma.schoolEvent.findMany({
      where: { tenantId, AND: and },
      orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }, { title: 'asc' }],
    });
  }

  private assertDate(ymd: string) {
    if (!isValidYmd(ymd)) throw new BadRequestException(t.invalidDate);
  }

  private assertRange(from: string, to: string) {
    this.assertDate(from);
    this.assertDate(to);
    if (from > to) throw new BadRequestException(t.rangeReversed);
    if (daysBetween(from, to) > MAX_RANGE_DAYS)
      throw new BadRequestException(t.rangeTooLong);
  }
}
