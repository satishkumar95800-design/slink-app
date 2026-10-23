import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PettyCashPayeeType, Prisma, Role } from '@prisma/client';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { PositionDto, StartTripDto } from './dto/bus-tracking.dto';

const err = (code: string, message: string) => ({ code, message });

/** A trip with no position for this long shows as "no signal" to parents. */
export const STALE_AFTER_MS = 5 * 60 * 1000;
/** A trip with no position for this long (or older than MAX_TRIP_MS) is over. */
export const ABANDONED_AFTER_MS = 30 * 60 * 1000;
export const MAX_TRIP_MS = 4 * 60 * 60 * 1000;

type TripLike = {
  startedAt: Date;
  endedAt: Date | null;
  positionAt: Date | null;
};

/** Live, signal lost, or over (ended, abandoned or too long). Never stored. */
export function tripState(
  trip: TripLike,
  now: Date = new Date(),
): 'live' | 'stale' | 'over' {
  if (trip.endedAt) return 'over';
  const t = now.getTime();
  if (t - trip.startedAt.getTime() > MAX_TRIP_MS) return 'over';
  const last = (trip.positionAt ?? trip.startedAt).getTime();
  if (t - last > ABANDONED_AFTER_MS) return 'over';
  return t - last > STALE_AFTER_MS ? 'stale' : 'live';
}

const TRIP = {
  id: true,
  routeId: true,
  direction: true,
  startedAt: true,
  endedAt: true,
  lat: true,
  lng: true,
  speed: true,
  heading: true,
  positionAt: true,
} as const;

type TripRow = Prisma.BusTripGetPayload<{ select: typeof TRIP }>;

function publicTrip(trip: TripRow, now = new Date()) {
  return {
    id: trip.id,
    direction: trip.direction,
    startedAt: trip.startedAt,
    state: tripState(trip, now),
    position:
      trip.lat != null && trip.lng != null
        ? {
            lat: trip.lat,
            lng: trip.lng,
            speed: trip.speed,
            heading: trip.heading,
            at: trip.positionAt,
          }
        : null,
  };
}

/**
 * Live bus tracking (flag `busTracking`, Premium Max, on top of `transport`).
 * A driver is a ground staff member given an app login (role `driver`); they
 * start a trip on one of their own routes and the app sends the phone's
 * position until they end it. Only the latest position is kept. Parents see
 * the bus of their own child's route only (student_parents), and only while a
 * trip is running.
 */
@Injectable()
export class BusTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Staff ──────────────────────────────────────────────────────────────────

  /** Ground staff with whether each has a driver login. */
  async driverAccess(tenantId: string) {
    await this.assertOn(tenantId);
    const rows = await this.prisma.pettyCashPayee.findMany({
      where: {
        tenantId,
        type: PettyCashPayeeType.GROUND_STAFF,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, userId: true },
    });
    return rows.map(({ userId, ...p }) => ({ ...p, hasAppAccess: !!userId }));
  }

  /** Make (or re-link) the driver login for a ground staff member's phone. */
  async grantAccess(tenantId: string, actorId: string, payeeId: string) {
    await this.assertOn(tenantId);
    const payee = await this.prisma.pettyCashPayee.findFirst({
      where: {
        id: payeeId,
        tenantId,
        type: PettyCashPayeeType.GROUND_STAFF,
        isActive: true,
      },
    });
    if (!payee)
      throw new NotFoundException(
        err('DRIVER_NOT_FOUND', 'Ground staff member not found'),
      );
    if (payee.userId) return { id: payee.id, hasAppAccess: true };
    // The app signs in with the compact form (+919845077788).
    const phone = payee.phone?.replace(/[\s()-]/g, '') ?? '';
    if (!/^\+[1-9]\d{6,14}$/.test(phone))
      throw new BadRequestException(
        err(
          'DRIVER_PHONE_MISSING',
          'Add a mobile number with country code (e.g. +919876543210) to this ground staff member first',
        ),
      );

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { tenantId, phone },
        select: { id: true, role: true, driverOf: { select: { id: true } } },
      });
      if (existing && (existing.role !== Role.driver || existing.driverOf))
        throw new ConflictException(
          err(
            'PHONE_IN_USE',
            'This phone number already belongs to another login of the school',
          ),
        );
      const user =
        existing ??
        (await tx.user.create({
          data: {
            tenantId,
            name: payee.name,
            phone,
            role: Role.driver,
            isVerified: true,
          },
          select: { id: true },
        }));
      await tx.pettyCashPayee.update({
        where: { id: payee.id },
        data: { userId: user.id },
      });
      await audit(
        tx,
        tenantId,
        actorId,
        'transport.driver_access_granted',
        payee.id,
        {
          name: payee.name,
        },
      );
    });
    return { id: payee.id, hasAppAccess: true };
  }

  /** Remove the driver login; it is signed out at its next request. */
  async revokeAccess(tenantId: string, actorId: string, payeeId: string) {
    await this.assertOn(tenantId);
    const payee = await this.prisma.pettyCashPayee.findFirst({
      where: { id: payeeId, tenantId },
      select: { id: true, name: true, userId: true },
    });
    if (!payee)
      throw new NotFoundException(
        err('DRIVER_NOT_FOUND', 'Ground staff member not found'),
      );
    if (!payee.userId) return { id: payee.id, hasAppAccess: false };
    const userId = payee.userId;
    await this.prisma.$transaction(async (tx) => {
      await tx.pettyCashPayee.update({
        where: { id: payee.id },
        data: { userId: null },
      });
      await tx.user.deleteMany({
        where: { id: userId, tenantId, role: Role.driver },
      });
      await audit(
        tx,
        tenantId,
        actorId,
        'transport.driver_access_removed',
        payee.id,
        {
          name: payee.name,
        },
      );
    });
    return { id: payee.id, hasAppAccess: false };
  }

  /** Every route with its running trip, for the console and the admin app. */
  async live(tenantId: string) {
    await this.assertOn(tenantId);
    const now = new Date();
    const routes = await this.prisma.transportRoute.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        vehicleNumber: true,
        driver: { select: { name: true, phone: true } },
        trips: { where: { endedAt: null }, select: TRIP, take: 1 },
      },
    });
    return routes.map(({ trips, ...r }) => {
      const trip = trips[0];
      return {
        ...r,
        trip:
          trip && tripState(trip, now) !== 'over'
            ? publicTrip(trip, now)
            : null,
      };
    });
  }

  // ── Driver ─────────────────────────────────────────────────────────────────

  /** The driver's own routes (as driver of the route) and running trip. */
  async driverHome(tenantId: string, userId: string) {
    await this.assertOn(tenantId);
    const now = new Date();
    const [routes, open] = await Promise.all([
      this.myRoutes(tenantId, userId),
      this.prisma.busTrip.findFirst({
        where: { tenantId, driverUserId: userId, endedAt: null },
        select: TRIP,
      }),
    ]);
    const trip = open && tripState(open, now) !== 'over' ? open : null;
    return {
      routes,
      trip: trip ? { ...publicTrip(trip, now), routeId: trip.routeId } : null,
    };
  }

  async startTrip(tenantId: string, userId: string, dto: StartTripDto) {
    await this.assertOn(tenantId);
    const routes = await this.myRoutes(tenantId, userId);
    if (!routes.some((r) => r.id === dto.routeId))
      throw new NotFoundException(
        err('ROUTE_NOT_FOUND', 'This route is not assigned to you'),
      );
    const now = new Date();
    const trip = await this.prisma.$transaction(async (tx) => {
      // Close this driver's earlier trip and any abandoned one on the route.
      const open = await tx.busTrip.findMany({
        where: {
          tenantId,
          endedAt: null,
          OR: [{ driverUserId: userId }, { routeId: dto.routeId }],
        },
        select: {
          id: true,
          driverUserId: true,
          startedAt: true,
          endedAt: true,
          positionAt: true,
        },
      });
      for (const t of open) {
        if (t.driverUserId !== userId && tripState(t, now) !== 'over')
          throw new ConflictException(
            err('TRIP_IN_PROGRESS', 'Another trip is running on this route'),
          );
      }
      if (open.length)
        await tx.busTrip.updateMany({
          where: { id: { in: open.map((t) => t.id) } },
          data: { endedAt: now },
        });
      const created = await tx.busTrip.create({
        data: {
          tenantId,
          routeId: dto.routeId,
          driverUserId: userId,
          direction: dto.direction,
          startedAt: now,
        },
        select: TRIP,
      });
      await audit(tx, tenantId, userId, 'transport.trip_started', created.id, {
        routeId: dto.routeId,
        direction: dto.direction,
      });
      return created;
    });
    return { ...publicTrip(trip, now), routeId: trip.routeId };
  }

  /** The phone's latest position. Only the trip's own driver, while it runs. */
  async position(
    tenantId: string,
    userId: string,
    tripId: string,
    dto: PositionDto,
  ) {
    const trip = await this.ownOpenTrip(tenantId, userId, tripId);
    const at = dto.at ? new Date(dto.at) : new Date();
    const now = Date.now();
    // A queued fix older than the stored one, or from the future, is dropped.
    if (at.getTime() > now + 60_000) return { accepted: false };
    if (trip.positionAt && at <= trip.positionAt) return { accepted: false };
    await this.prisma.busTrip.update({
      where: { id: trip.id },
      data: {
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        accuracy: dto.accuracy ?? null,
        positionAt: at,
      },
    });
    return { accepted: true };
  }

  async endTrip(tenantId: string, userId: string, tripId: string) {
    const trip = await this.ownOpenTrip(tenantId, userId, tripId);
    await this.prisma.$transaction([
      this.prisma.busTrip.update({
        where: { id: trip.id },
        data: { endedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: 'transport.trip_ended',
          entityType: 'transport',
          entityId: trip.id,
          diff: {},
        },
      }),
    ]);
    return { ended: true };
  }

  // ── Parent ─────────────────────────────────────────────────────────────────

  /** The parent's own child's bus, live, or `trip: null` when none is running. */
  async childLive(tenantId: string, parentId: string, studentId: string) {
    await this.assertOn(tenantId);
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId, student: { tenantId } },
      select: {
        student: {
          select: {
            transport: {
              select: {
                stop: {
                  select: { name: true, pickupTime: true, dropTime: true },
                },
                route: {
                  select: {
                    name: true,
                    vehicleNumber: true,
                    driver: {
                      select: { name: true, phone: true, isActive: true },
                    },
                    trips: { where: { endedAt: null }, select: TRIP, take: 1 },
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
    const transport = link.student.transport;
    if (!transport) return { bus: null, trip: null };
    const { route, stop } = transport;
    const now = new Date();
    const open = route.trips[0];
    const driver = route.driver?.isActive
      ? { name: route.driver.name, phone: route.driver.phone }
      : null;
    return {
      bus: {
        routeName: route.name,
        vehicleNumber: route.vehicleNumber,
        stop,
        driver,
      },
      trip:
        open && tripState(open, now) !== 'over' ? publicTrip(open, now) : null,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertOn(tenantId: string) {
    return assertFeatureEnabled(this.prisma, tenantId, 'busTracking');
  }

  /** Routes whose driver is this login's (active) ground staff record. */
  private async myRoutes(tenantId: string, userId: string) {
    const routes = await this.prisma.transportRoute.findMany({
      where: { tenantId, driver: { userId, isActive: true } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        vehicleNumber: true,
        stops: {
          orderBy: { sortOrder: 'asc' },
          select: { name: true, pickupTime: true, dropTime: true },
        },
        _count: { select: { students: true } },
      },
    });
    return routes.map(({ _count, ...r }) => ({
      ...r,
      studentCount: _count.students,
    }));
  }

  private async ownOpenTrip(tenantId: string, userId: string, tripId: string) {
    await this.assertOn(tenantId);
    const trip = await this.prisma.busTrip.findFirst({
      where: { id: tripId, tenantId, driverUserId: userId, endedAt: null },
      select: { id: true, startedAt: true, endedAt: true, positionAt: true },
    });
    if (!trip || tripState(trip) === 'over')
      throw new NotFoundException(
        err('TRIP_NOT_RUNNING', 'This trip has ended'),
      );
    return trip;
  }
}

function audit(
  db: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  action: string,
  entityId: string,
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
