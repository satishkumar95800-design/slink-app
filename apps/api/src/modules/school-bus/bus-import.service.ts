import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PettyCashPayeeType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ImportIssue,
  parseBusWorkbook,
  Person,
  phoneOf,
  RouteRows,
  sameName,
} from './bus-import';

type Db = PrismaService | Prisma.TransactionClient;

const err = (code: string, message: string) => ({ code, message });

/** Who drives or attends: an existing ground staff member, or one to add. */
type StaffRef = {
  id: string;
  isNew: boolean;
  name: string;
  phone: string | null;
};

interface PlannedRoute extends RouteRows {
  driverRef: StaffRef | null;
  attendantRef: StaffRef | null;
}

interface Assignment {
  row: number;
  studentId: string;
  /** A route in the file (by name) or an existing one (by id). */
  routeName: string;
  existingRouteId: string | null;
  stopName: string | null;
  existingStopId: string | null;
}

/**
 * School bus Excel import (bus-import.ts reads the file): new routes with
 * their stops, drivers and attendants matched to (or added as) ground staff,
 * and children put on a route and stop by admission number. Nothing is
 * written unless the whole file is clean; a child already on a route, a
 * route name already used or an unknown admission number stops the import.
 */
@Injectable()
export class BusImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Checks both sheets against the school's data; nothing is written. */
  async validate(tenantId: string, buffer: Buffer) {
    const plan = await this.plan(this.prisma, tenantId, buffer);
    return summary(plan);
  }

  async commit(tenantId: string, actorId: string, buffer: Buffer) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const plan = await this.plan(tx, tenantId, buffer);
          if (plan.errors.length)
            throw new BadRequestException(
              err(
                'IMPORT_ROWS_INVALID',
                'Fix the rows with problems and upload again',
              ),
            );

          // Ground staff the file brings in.
          if (plan.newStaff.length)
            await tx.pettyCashPayee.createMany({
              data: plan.newStaff.map((s) => ({
                id: s.id,
                tenantId,
                type: PettyCashPayeeType.GROUND_STAFF,
                name: s.name,
                phone: s.phone,
              })),
            });

          // Routes and their stops (ids made here so children can be placed).
          const routeIds = new Map<string, string>();
          const stopIds = new Map<string, string>();
          const key = (route: string, stop: string) =>
            `${route.toLowerCase()}|${stop.toLowerCase()}`;
          for (const r of plan.routes) {
            const id = randomUUID();
            routeIds.set(r.name.toLowerCase(), id);
            await tx.transportRoute.create({
              data: {
                id,
                tenantId,
                name: r.name,
                vehicleNumber: r.vehicleNumber,
                trackingUrl: r.trackingUrl,
                driverId: r.driverRef?.id ?? null,
                attendantId: r.attendantRef?.id ?? null,
              },
            });
            await tx.transportStop.createMany({
              data: r.stops.map((s, i) => {
                const stopId = randomUUID();
                stopIds.set(key(r.name, s.name), stopId);
                return {
                  id: stopId,
                  tenantId,
                  routeId: id,
                  name: s.name,
                  sortOrder: i,
                  pickupTime: s.pickupTime,
                  dropTime: s.dropTime,
                  lat: s.lat,
                  lng: s.lng,
                };
              }),
            });
          }

          if (plan.assignments.length)
            await tx.studentTransport.createMany({
              data: plan.assignments.map((a) => ({
                tenantId,
                studentId: a.studentId,
                routeId:
                  a.existingRouteId ?? routeIds.get(a.routeName.toLowerCase())!,
                stopId:
                  a.existingStopId ??
                  (a.stopName
                    ? stopIds.get(key(a.routeName, a.stopName))!
                    : null),
              })),
            });

          const result = summary(plan);
          await tx.auditLog.create({
            data: {
              tenantId,
              actorId,
              action: 'transport.import',
              entityType: 'transport',
              entityId: null,
              diff: {
                routes: plan.routes.map((r) => r.name),
                stops: result.stops,
                staffAdded: plan.newStaff.map((s) => s.name),
                students: result.students,
              },
            },
          });
          return {
            routes: result.routes,
            stops: result.stops,
            staffAdded: result.staffAdded,
            students: result.students,
          };
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      // Someone added the same route or put a child on a bus meanwhile.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          err(
            'IMPORT_CHANGED',
            'Bus routes changed while importing. Check the file again.',
          ),
        );
      throw e;
    }
  }

  private async plan(db: Db, tenantId: string, buffer: Buffer) {
    const parsed = await parseBusWorkbook(buffer);
    const errors: ImportIssue[] = [...parsed.issues];
    const warnings: ImportIssue[] = [];

    const existingRoutes = await db.transportRoute.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        stops: { select: { id: true, name: true } },
      },
    });
    const existingRoute = (name: string) =>
      existingRoutes.find((r) => sameName(r.name, name));

    // ── Routes ──
    const staff = await db.pettyCashPayee.findMany({
      where: { tenantId, type: PettyCashPayeeType.GROUND_STAFF },
      select: { id: true, name: true, phone: true, isActive: true },
    });
    const newStaff: StaffRef[] = [];
    const resolve = (p: Person | null, row: number): StaffRef | null => {
      if (!p) return null;
      const bad = (code: string, value?: string) =>
        errors.push({
          sheet: 'routes',
          row,
          code,
          ...(value !== undefined && { value }),
        });
      const byPhone = p.phone
        ? staff.filter((s) => s.phone && phoneOf(s.phone) === p.phone)
        : [];
      const byName =
        !p.phone && p.name
          ? staff.filter((s) => s.isActive && sameName(s.name, p.name!))
          : [];
      const found =
        byPhone.find((s) => s.isActive) ??
        byPhone[0] ??
        (byName.length === 1 ? byName[0] : null);
      if (byName.length > 1) {
        bad('STAFF_AMBIGUOUS', p.name!);
        return null;
      }
      if (found) {
        if (!found.isActive) {
          bad('STAFF_INACTIVE', found.name);
          return null;
        }
        return {
          id: found.id,
          isNew: false,
          name: found.name,
          phone: found.phone,
        };
      }
      // Someone new: added once even when they appear on several routes.
      const again = newStaff.find((s) =>
        p.phone
          ? s.phone === p.phone
          : !s.phone && sameName(s.name, p.name ?? ''),
      );
      if (again) return again;
      if (!p.name) {
        bad('STAFF_NAME_MISSING', p.phone ?? '');
        return null;
      }
      const ref = {
        id: randomUUID(),
        isNew: true,
        name: p.name,
        phone: p.phone,
      };
      newStaff.push(ref);
      return ref;
    };
    const routes: PlannedRoute[] = [];
    for (const r of parsed.routes) {
      if (existingRoute(r.name)) {
        errors.push({
          sheet: 'routes',
          row: r.row,
          code: 'ROUTE_EXISTS',
          value: r.name,
        });
        continue;
      }
      const driverRef = resolve(r.driver, r.row);
      const attendantRef = resolve(r.attendant, r.row);
      if (driverRef && attendantRef && driverRef.id === attendantRef.id)
        errors.push({
          sheet: 'routes',
          row: r.row,
          code: 'DRIVER_IS_ATTENDANT',
          value: driverRef.name,
        });
      routes.push({ ...r, driverRef, attendantRef });
    }

    // ── Students ──
    const admissionNos = [
      ...new Set(parsed.students.map((s) => s.admissionNo)),
    ];
    const found = admissionNos.length
      ? await db.student.findMany({
          where: {
            tenantId,
            admissionNo: { in: admissionNos, mode: 'insensitive' },
          },
          select: {
            id: true,
            name: true,
            admissionNo: true,
            transport: { select: { route: { select: { name: true } } } },
          },
        })
      : [];
    const byAdmission = new Map(
      found.map((s) => [s.admissionNo.toLowerCase(), s]),
    );
    const seen = new Map<string, number>();
    const assignments: Assignment[] = [];
    for (const row of parsed.students) {
      const bad = (code: string, value: string, detail?: string) =>
        errors.push({
          sheet: 'students',
          row: row.row,
          code,
          value,
          ...(detail !== undefined && { detail }),
        });
      const student = byAdmission.get(row.admissionNo.toLowerCase());
      if (!student) {
        bad('STUDENT_NOT_FOUND', row.admissionNo);
        continue;
      }
      if (seen.has(student.id)) {
        bad('STUDENT_REPEATED', row.admissionNo, String(seen.get(student.id)));
        continue;
      }
      seen.set(student.id, row.row);
      if (row.name && !sameName(row.name, student.name))
        warnings.push({
          sheet: 'students',
          row: row.row,
          code: 'NAME_DIFFERS',
          value: row.admissionNo,
          detail: student.name,
        });
      if (student.transport) {
        bad('STUDENT_ON_ROUTE', student.name, student.transport.route.name);
        continue;
      }
      const inFile = routes.find((r) => sameName(r.name, row.route));
      const existing = inFile ? null : existingRoute(row.route);
      if (!inFile && !existing) {
        bad('ROUTE_UNKNOWN', row.route);
        continue;
      }
      let stopName: string | null = null;
      let existingStopId: string | null = null;
      if (row.stop) {
        const stop = inFile
          ? inFile.stops.find((s) => sameName(s.name, row.stop!))
          : existing!.stops.find((s) => sameName(s.name, row.stop!));
        if (!stop) {
          bad('STOP_UNKNOWN', row.stop, inFile?.name ?? existing!.name);
          continue;
        }
        stopName = stop.name;
        existingStopId = 'id' in stop ? stop.id : null;
      }
      assignments.push({
        row: row.row,
        studentId: student.id,
        routeName: inFile?.name ?? existing!.name,
        existingRouteId: existing?.id ?? null,
        stopName,
        existingStopId,
      });
    }

    const order = (a: ImportIssue, b: ImportIssue) =>
      a.sheet === b.sheet ? a.row - b.row : a.sheet === 'routes' ? -1 : 1;
    return {
      routes,
      newStaff,
      assignments,
      errors: errors.sort(order),
      warnings: warnings.sort(order),
      matchedStaff: new Set(
        routes
          .flatMap((r) => [r.driverRef, r.attendantRef])
          .filter((s) => s && !s.isNew)
          .map((s) => s!.id),
      ).size,
    };
  }
}

function summary(plan: {
  routes: PlannedRoute[];
  newStaff: StaffRef[];
  assignments: Assignment[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  matchedStaff: number;
}) {
  return {
    routes: plan.routes.length,
    stops: plan.routes.reduce((n, r) => n + r.stops.length, 0),
    staffAdded: plan.newStaff.length,
    staffMatched: plan.matchedStaff,
    students: plan.assignments.length,
    errors: plan.errors,
    warnings: plan.warnings,
  };
}
