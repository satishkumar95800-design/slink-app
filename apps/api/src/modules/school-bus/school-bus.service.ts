import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PettyCashPayeeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignStudentsDto,
  RouteInputDto,
  UnassignStudentsDto,
} from './dto/school-bus.dto';

type Db = PrismaService | Prisma.TransactionClient;

const err = (code: string, message: string) => ({ code, message });

const PERSON = {
  select: { id: true, name: true, phone: true, isActive: true },
};
const STOP_ORDER = { sortOrder: 'asc' } as const;

/**
 * School bus routes (flag `transport`). Admin, accounts and super_admin keep
 * routes, stops and who rides them; drivers and attendants are ground staff
 * from the petty cash payee list. A parent reads only their own child's bus,
 * resolved through student_parents, and the driver's phone only reaches the
 * parents of children on that route.
 */
@Injectable()
export class SchoolBusService {
  constructor(private readonly prisma: PrismaService) {}

  async routes(tenantId: string) {
    const [routes, perStop] = await Promise.all([
      this.prisma.transportRoute.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        include: {
          driver: PERSON,
          attendant: PERSON,
          stops: { orderBy: STOP_ORDER },
          _count: { select: { students: true } },
        },
      }),
      this.prisma.studentTransport.groupBy({
        by: ['stopId'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);
    const stopCount = new Map(perStop.map((r) => [r.stopId, r._count._all]));
    return routes.map(({ _count, stops, ...r }) => ({
      ...r,
      studentCount: _count.students,
      stops: stops.map((s) => ({
        id: s.id,
        name: s.name,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        studentCount: stopCount.get(s.id) ?? 0,
      })),
    }));
  }

  /** Active ground staff who can drive or attend a bus. */
  drivers(tenantId: string) {
    return this.prisma.pettyCashPayee.findMany({
      where: {
        tenantId,
        type: PettyCashPayeeType.GROUND_STAFF,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    });
  }

  async createRoute(tenantId: string, actorId: string, dto: RouteInputDto) {
    await this.assertStaff(tenantId, dto);
    const id = await this.prisma.$transaction(async (tx) => {
      const route = await this.writeRoute(tx, () =>
        tx.transportRoute.create({
          data: { tenantId, ...routeFields(dto) },
        }),
      );
      await tx.transportStop.createMany({
        data: dto.stops.map((s, i) => ({
          tenantId,
          routeId: route.id,
          sortOrder: i,
          ...stopFields(s),
        })),
      });
      await this.audit(
        tx,
        tenantId,
        actorId,
        'transport.route_created',
        route.id,
        {
          name: dto.name,
          stops: dto.stops.length,
        },
      );
      return route.id;
    });
    return this.route(tenantId, id);
  }

  async updateRoute(
    tenantId: string,
    actorId: string,
    routeId: string,
    dto: RouteInputDto,
  ) {
    await this.requireRoute(tenantId, routeId);
    await this.assertStaff(tenantId, dto);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transportStop.findMany({
        where: { routeId },
        select: { id: true, _count: { select: { students: true } } },
      });
      const known = new Set(existing.map((s) => s.id));
      for (const s of dto.stops) {
        if (s.id && !known.has(s.id))
          throw new BadRequestException(
            err('STOP_NOT_FOUND', 'A stop does not belong to this route'),
          );
      }
      const kept = new Set(dto.stops.map((s) => s.id).filter(Boolean));
      const removed = existing.filter((s) => !kept.has(s.id));
      if (removed.some((s) => s._count.students > 0)) {
        throw new ConflictException(
          err(
            'STOP_HAS_STUDENTS',
            'Move the students off a stop before removing it',
          ),
        );
      }
      await this.writeRoute(tx, () =>
        tx.transportRoute.update({
          where: { id: routeId },
          data: routeFields(dto),
        }),
      );
      if (removed.length > 0)
        await tx.transportStop.deleteMany({
          where: { id: { in: removed.map((s) => s.id) } },
        });
      for (const [i, s] of dto.stops.entries()) {
        if (s.id) {
          await tx.transportStop.update({
            where: { id: s.id },
            data: { sortOrder: i, ...stopFields(s) },
          });
        } else {
          await tx.transportStop.create({
            data: { tenantId, routeId, sortOrder: i, ...stopFields(s) },
          });
        }
      }
      await this.audit(
        tx,
        tenantId,
        actorId,
        'transport.route_updated',
        routeId,
        {
          name: dto.name,
          stops: dto.stops.length,
          stopsRemoved: removed.length,
        },
      );
    });
    return this.route(tenantId, routeId);
  }

  async deleteRoute(tenantId: string, actorId: string, routeId: string) {
    const route = await this.requireRoute(tenantId, routeId);
    const riders = await this.prisma.studentTransport.count({
      where: { routeId },
    });
    if (riders > 0)
      throw new ConflictException(
        err(
          'ROUTE_HAS_STUDENTS',
          'Move the students off this route before deleting it',
        ),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.transportRoute.delete({ where: { id: routeId } });
      await this.audit(
        tx,
        tenantId,
        actorId,
        'transport.route_deleted',
        routeId,
        {
          name: route.name,
        },
      );
    });
  }

  /** Students on a route, with their class and stop. */
  async routeStudents(tenantId: string, routeId: string) {
    await this.requireRoute(tenantId, routeId);
    const rows = await this.prisma.studentTransport.findMany({
      where: { tenantId, routeId },
      select: {
        stopId: true,
        student: {
          select: {
            id: true,
            name: true,
            admissionNo: true,
            class: { select: { id: true, name: true, section: true } },
          },
        },
      },
    });
    return rows
      .map((r) => ({ ...r.student, stopId: r.stopId }))
      .sort(
        (a, b) =>
          a.class.name.localeCompare(b.class.name, 'en', { numeric: true }) ||
          (a.class.section ?? '').localeCompare(b.class.section ?? '') ||
          a.name.localeCompare(b.name),
      );
  }

  /** A class's students with the route each one is on (for adding riders). */
  async classStudents(tenantId: string, classId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, classId },
      orderBy: [{ rollNo: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        admissionNo: true,
        transport: {
          select: {
            routeId: true,
            stopId: true,
            route: { select: { name: true } },
          },
        },
      },
    });
    return students.map(({ transport, ...s }) => ({
      ...s,
      routeId: transport?.routeId ?? null,
      routeName: transport?.route.name ?? null,
      stopId: transport?.stopId ?? null,
    }));
  }

  /** Puts students on a route (and stop), moving them off any other route. */
  async assign(tenantId: string, actorId: string, dto: AssignStudentsDto) {
    await this.requireRoute(tenantId, dto.routeId);
    if (dto.stopId) {
      const stop = await this.prisma.transportStop.findFirst({
        where: { id: dto.stopId, routeId: dto.routeId, tenantId },
        select: { id: true },
      });
      if (!stop)
        throw new BadRequestException(
          err('STOP_NOT_FOUND', 'That stop is not on this route'),
        );
    }
    const ids = [...new Set(dto.studentIds)];
    const found = await this.prisma.student.count({
      where: { tenantId, id: { in: ids } },
    });
    if (found !== ids.length)
      throw new NotFoundException(
        err('STUDENT_NOT_FOUND', 'Student not found'),
      );
    const stopId = dto.stopId ?? null;
    await this.prisma.$transaction(async (tx) => {
      for (const studentId of ids) {
        await tx.studentTransport.upsert({
          where: { studentId },
          create: { studentId, tenantId, routeId: dto.routeId, stopId },
          update: { routeId: dto.routeId, stopId },
        });
      }
      await this.audit(
        tx,
        tenantId,
        actorId,
        'transport.students_assigned',
        dto.routeId,
        {
          students: ids.length,
          stopId,
        },
      );
    });
    return { assigned: ids.length };
  }

  async unassign(tenantId: string, actorId: string, dto: UnassignStudentsDto) {
    const ids = [...new Set(dto.studentIds)];
    const removed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.studentTransport.deleteMany({
        where: { tenantId, studentId: { in: ids } },
      });
      await this.audit(
        tx,
        tenantId,
        actorId,
        'transport.students_removed',
        null,
        {
          students: count,
        },
      );
      return count;
    });
    return { removed };
  }

  /** A parent's view of their own child's bus. */
  async child(tenantId: string, parentId: string, studentId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId, student: { tenantId } },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            transport: {
              select: {
                stop: {
                  select: { name: true, pickupTime: true, dropTime: true },
                },
                route: {
                  select: {
                    name: true,
                    vehicleNumber: true,
                    driver: PERSON,
                    attendant: PERSON,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!link)
      throw new NotFoundException(
        err('STUDENT_NOT_FOUND', 'Student not found'),
      );
    const { transport, ...student } = link.student;
    if (!transport) return { student, bus: null };
    const { route, stop } = transport;
    return {
      student,
      bus: {
        routeName: route.name,
        vehicleNumber: route.vehicleNumber,
        stop,
        driver: contact(route.driver),
        attendant: contact(route.attendant),
      },
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async route(tenantId: string, routeId: string) {
    const all = await this.routes(tenantId);
    return all.find((r) => r.id === routeId)!;
  }

  private async requireRoute(tenantId: string, routeId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: routeId, tenantId },
      select: { id: true, name: true },
    });
    if (!route)
      throw new NotFoundException(err('ROUTE_NOT_FOUND', 'Route not found'));
    return route;
  }

  /** Driver and attendant must be active ground staff of this school. */
  private async assertStaff(tenantId: string, dto: RouteInputDto) {
    const ids = [dto.driverId, dto.attendantId].filter((x): x is string => !!x);
    if (ids.length === 0) return;
    const ok = await this.prisma.pettyCashPayee.count({
      where: {
        tenantId,
        id: { in: ids },
        type: PettyCashPayeeType.GROUND_STAFF,
        isActive: true,
      },
    });
    if (ok !== new Set(ids).size)
      throw new BadRequestException(
        err(
          'DRIVER_INVALID',
          'Pick the driver and attendant from active ground staff',
        ),
      );
  }

  private async writeRoute<T>(_tx: Db, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          err('ROUTE_NAME_TAKEN', 'A route with this name already exists'),
        );
      throw e;
    }
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
        entityType: 'transport',
        entityId,
        diff,
      },
    });
  }
}

const routeFields = (dto: RouteInputDto) => ({
  name: dto.name,
  vehicleNumber: dto.vehicleNumber ?? null,
  driverId: dto.driverId ?? null,
  attendantId: dto.attendantId ?? null,
  notes: dto.notes ?? null,
});

const stopFields = (s: RouteInputDto['stops'][number]) => ({
  name: s.name,
  pickupTime: s.pickupTime ?? null,
  dropTime: s.dropTime ?? null,
});

/** Name and phone of an active driver or attendant; a deactivated one is hidden. */
const contact = (
  p: { name: string; phone: string | null; isActive: boolean } | null,
) => (p && p.isActive ? { name: p.name, phone: p.phone } : null);
