import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  fromDbDate,
  isValidYmd,
  todayIn,
  toDbDate,
} from '../attendance/attendance-dates';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentDto,
  AppointmentRangeDto,
  UpdateAppointmentDto,
} from './dto/appointments.dto';

const err = (code: string, message: string) => ({ code, message });

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Row = Prisma.AppointmentGetPayload<object>;

/**
 * Front desk appointments: someone expected on a day and time (a job
 * interview, a parent meeting the principal, a vendor). The desk books them,
 * marks them arrived, cancelled or not shown; the admin's phone shows today's.
 */
@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** From..to (school-local days), seven days from today by default, by time. */
  async list(tenantId: string, q: AppointmentRangeDto) {
    const today = await this.today(tenantId);
    const from = q.from ?? today;
    const to = q.to ?? addDays(from, 6);
    if (!isValidYmd(from) || !isValidYmd(to) || to < from)
      throw new BadRequestException(
        err('DATE_INVALID', 'Choose a valid range'),
      );
    const rows = await this.prisma.appointment.findMany({
      where: { tenantId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    return rows.map(view);
  }

  async create(tenantId: string, actorId: string, dto: AppointmentDto) {
    if (!isValidYmd(dto.date))
      throw new BadRequestException(err('DATE_INVALID', 'Choose a valid date'));
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          tenantId,
          kind: dto.kind,
          name: dto.name,
          phone: dto.phone || null,
          withWhom: dto.withWhom || null,
          date: toDbDate(dto.date),
          time: dto.time,
          note: dto.note || null,
          createdBy: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'reception.appointment_booked',
          entityType: 'reception',
          entityId: created.id,
          diff: {
            kind: dto.kind,
            name: dto.name,
            date: dto.date,
            time: dto.time,
          },
        },
      });
      return created;
    });
    return view(row);
  }

  /** Arrived, cancelled or no-show; or moved to another day or time. */
  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ) {
    const found = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!found)
      throw new NotFoundException(
        err('APPOINTMENT_NOT_FOUND', 'Appointment not found'),
      );
    if (dto.date && !isValidYmd(dto.date))
      throw new BadRequestException(err('DATE_INVALID', 'Choose a valid date'));
    const [row] = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.date && { date: toDbDate(dto.date) }),
          ...(dto.time && { time: dto.time }),
          ...(dto.withWhom !== undefined && { withWhom: dto.withWhom || null }),
          ...(dto.note !== undefined && { note: dto.note || null }),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'reception.appointment_updated',
          entityType: 'reception',
          entityId: id,
          diff: { ...dto },
        },
      }),
    ]);
    return view(row);
  }

  private async today(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return todayIn(t?.timezone || 'Asia/Kolkata');
  }
}

export const view = (a: Row) => ({
  id: a.id,
  kind: a.kind,
  name: a.name,
  phone: a.phone,
  withWhom: a.withWhom,
  date: fromDbDate(a.date),
  time: a.time,
  note: a.note,
  status: a.status,
});
