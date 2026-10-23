import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BusTripDirection,
  NotificationChannel,
  PettyCashPayeeType,
  Prisma,
  Role,
} from '@prisma/client';
import { effectiveLanguage } from '../../common/i18n/languages';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  etaMinutes,
  etaTo,
  reachedStops,
  stopsToAlert,
  tripOrder,
} from './bus-eta';
import { arrivingText, tripStartedText } from './bus-push';
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
  passedStopIds: true,
} as const;

/** What the arrival time needs from a stop. */
const STOP_ETA = {
  id: true,
  name: true,
  sortOrder: true,
  lat: true,
  lng: true,
  pickupTime: true,
  dropTime: true,
} as const;

/** A fix less accurate than this doesn't mark stops reached. */
const PROGRESS_ACCURACY_M = 150;
/** "I'm at this stop" needs a fix at most this old. */
const HERE_MAX_AGE_MS = 2 * 60 * 1000;

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
  private readonly logger = new Logger(BusTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
      trip: trip
        ? {
            ...publicTrip(trip, now),
            routeId: trip.routeId,
            reachedStopIds: trip.passedStopIds,
          }
        : null,
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
    this.inBackground(
      this.notifyStarted(tenantId, dto.routeId, trip.id, dto.direction),
      'trip started',
    );
    return {
      ...publicTrip(trip, now),
      routeId: trip.routeId,
      reachedStopIds: [],
    };
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
    const refused = { accepted: false, reachedStopIds: trip.passedStopIds };
    if (at.getTime() > now + 60_000) return refused;
    if (trip.positionAt && at <= trip.positionAt) return refused;

    // Stops reached, and stops whose parents should hear "arriving soon".
    let reached = trip.passedStopIds;
    let alerts: { stopId: string; minutes: number }[] = [];
    if ((dto.accuracy ?? 0) <= PROGRESS_ACCURACY_M) {
      const stops = await this.prisma.transportStop.findMany({
        where: { routeId: trip.routeId },
        select: STOP_ETA,
      });
      const ordered = tripOrder(stops, trip.direction);
      reached = reachedStops(ordered, trip.passedStopIds, dto);
      alerts = stopsToAlert(
        ordered,
        reached,
        trip.alertedStopIds,
        dto,
        trip.direction,
        new Set(stops.map((s) => s.id)),
      );
    }
    await this.prisma.busTrip.update({
      where: { id: trip.id },
      data: {
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        accuracy: dto.accuracy ?? null,
        positionAt: at,
        passedStopIds: reached,
        ...(alerts.length
          ? {
              alertedStopIds: [
                ...trip.alertedStopIds,
                ...alerts.map((a) => a.stopId),
              ],
            }
          : {}),
      },
    });
    if (alerts.length)
      this.inBackground(
        this.notifyArriving(tenantId, trip, alerts),
        'bus arriving',
      );
    return { accepted: true, reachedStopIds: reached };
  }

  /**
   * The driver standing at a stop saves its location from the trip's latest
   * fix (not a position sent with the request), and the stop counts as reached.
   */
  async stopHere(
    tenantId: string,
    userId: string,
    tripId: string,
    stopId: string,
  ) {
    const trip = await this.ownOpenTrip(tenantId, userId, tripId);
    const stop = await this.prisma.transportStop.findFirst({
      where: { id: stopId, routeId: trip.routeId, tenantId },
      select: { id: true, name: true, lat: true, lng: true },
    });
    if (!stop)
      throw new NotFoundException(
        err('STOP_NOT_FOUND', 'This stop is not on the route'),
      );
    const fresh =
      trip.lat != null &&
      trip.lng != null &&
      trip.positionAt != null &&
      Date.now() - trip.positionAt.getTime() <= HERE_MAX_AGE_MS &&
      (trip.accuracy ?? 0) <= PROGRESS_ACCURACY_M;
    if (!fresh)
      throw new BadRequestException(
        err('NO_GPS_FIX', 'Wait for the phone to find its location'),
      );
    const stops = await this.prisma.transportStop.findMany({
      where: { routeId: trip.routeId },
      select: STOP_ETA,
    });
    const ordered = tripOrder(
      stops.map((s) =>
        s.id === stop.id ? { ...s, lat: trip.lat, lng: trip.lng } : s,
      ),
      trip.direction,
    );
    const reached = reachedStops(ordered, trip.passedStopIds, {
      lat: trip.lat!,
      lng: trip.lng!,
    });
    await this.prisma.$transaction([
      this.prisma.transportStop.update({
        where: { id: stop.id },
        data: { lat: trip.lat, lng: trip.lng },
      }),
      this.prisma.busTrip.update({
        where: { id: trip.id },
        data: { passedStopIds: reached },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: 'transport.stop_located',
          entityType: 'transport',
          entityId: stop.id,
          diff: {
            name: stop.name,
            from: stop.lat != null ? [stop.lat, stop.lng] : null,
            to: [trip.lat, trip.lng],
          },
        },
      }),
    ]);
    return { stopId: stop.id, reachedStopIds: reached };
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
                  select: {
                    id: true,
                    name: true,
                    pickupTime: true,
                    dropTime: true,
                  },
                },
                route: {
                  select: {
                    stops: { select: STOP_ETA },
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
    const { route } = transport;
    const now = new Date();
    const open =
      route.trips[0] && tripState(route.trips[0], now) !== 'over'
        ? route.trips[0]
        : null;
    const driver = route.driver?.isActive
      ? { name: route.driver.name, phone: route.driver.phone }
      : null;
    const stop = transport.stop
      ? {
          name: transport.stop.name,
          pickupTime: transport.stop.pickupTime,
          dropTime: transport.stop.dropTime,
        }
      : null;
    let eta: { minutes: number | null; reached: boolean } | null = null;
    if (open && transport.stop && open.lat != null && open.lng != null) {
      const e = etaTo(
        tripOrder(route.stops, open.direction),
        open.passedStopIds,
        { lat: open.lat, lng: open.lng },
        transport.stop.id,
        open.direction,
      );
      if (e)
        eta = e.reached
          ? { minutes: null, reached: true }
          : { minutes: etaMinutes(e.seconds), reached: false };
    }
    return {
      bus: {
        routeName: route.name,
        vehicleNumber: route.vehicleNumber,
        stop,
        driver,
      },
      trip: open ? { ...publicTrip(open, now), eta } : null,
    };
  }

  // ── Pushes ─────────────────────────────────────────────────────────────────

  /** "The bus has started" to the parents of every child on the route. */
  async notifyStarted(
    tenantId: string,
    routeId: string,
    tripId: string,
    direction: BusTripDirection,
  ) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: routeId, tenantId },
      select: {
        name: true,
        tenant: { select: { defaultLanguage: true } },
        students: { select: { studentId: true, student: PARENTS } },
      },
    });
    if (!route) return 0;
    const parents = parentsOf(route.students);
    let sent = 0;
    for (const p of parents.values()) {
      const text = tripStartedText(
        effectiveLanguage(p.language, route.tenant.defaultLanguage),
        direction,
        route.name,
      );
      sent += await this.push(tenantId, p.id, text, {
        type: 'bus_started',
        studentId: p.studentId,
        tripId,
      });
    }
    return sent;
  }

  /** "Arriving in about N minutes", with the chime, to the parents at a stop. */
  async notifyArriving(
    tenantId: string,
    trip: { id: string; routeId: string; direction: BusTripDirection },
    alerts: { stopId: string; minutes: number }[],
  ) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: trip.routeId, tenantId },
      select: {
        name: true,
        tenant: { select: { defaultLanguage: true } },
        stops: {
          where: { id: { in: alerts.map((a) => a.stopId) } },
          select: {
            id: true,
            name: true,
            students: { select: { studentId: true, student: PARENTS } },
          },
        },
      },
    });
    if (!route) return 0;
    let sent = 0;
    for (const stop of route.stops) {
      const minutes = alerts.find((a) => a.stopId === stop.id)!.minutes;
      for (const p of parentsOf(stop.students).values()) {
        const text = arrivingText(
          effectiveLanguage(p.language, route.tenant.defaultLanguage),
          trip.direction,
          route.name,
          stop.name,
          minutes,
        );
        sent += await this.push(
          tenantId,
          p.id,
          text,
          { type: 'bus_arriving', studentId: p.studentId, tripId: trip.id },
          true,
        );
      }
    }
    return sent;
  }

  private async push(
    tenantId: string,
    userId: string,
    text: { title: string; body: string },
    data: Record<string, string>,
    chime = false,
  ): Promise<number> {
    try {
      await this.notifications.send({
        tenantId,
        userId,
        channel: NotificationChannel.fcm,
        ...text,
        data,
        ...(chime ? { sound: 'bus_arrival' as const } : {}),
      });
      return 1;
    } catch (e) {
      this.logger.warn(`Bus push to ${userId} failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Pushes go out after the driver's request has been answered. */
  private inBackground(work: Promise<unknown>, what: string) {
    work.catch((e: Error) =>
      this.logger.error(`Bus push (${what}) failed: ${e.message}`),
    );
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
          select: {
            id: true,
            name: true,
            pickupTime: true,
            dropTime: true,
            lat: true,
          },
        },
        _count: { select: { students: true } },
      },
    });
    return routes.map(({ _count, stops, ...r }) => ({
      ...r,
      stops: stops.map(({ lat, ...s }) => ({ ...s, located: lat != null })),
      studentCount: _count.students,
    }));
  }

  private async ownOpenTrip(tenantId: string, userId: string, tripId: string) {
    await this.assertOn(tenantId);
    const trip = await this.prisma.busTrip.findFirst({
      where: { id: tripId, tenantId, driverUserId: userId, endedAt: null },
      select: {
        id: true,
        routeId: true,
        direction: true,
        startedAt: true,
        endedAt: true,
        lat: true,
        lng: true,
        accuracy: true,
        positionAt: true,
        passedStopIds: true,
        alertedStopIds: true,
      },
    });
    if (!trip || tripState(trip) === 'over')
      throw new NotFoundException(
        err('TRIP_NOT_RUNNING', 'This trip has ended'),
      );
    return trip;
  }
}

const PARENTS = {
  select: {
    parents: {
      select: { parent: { select: { id: true, preferredLanguage: true } } },
    },
  },
} as const;

/** Each parent once, with one of their children on the bus (for the tap). */
function parentsOf(
  riders: {
    studentId: string;
    student: {
      parents: { parent: { id: string; preferredLanguage: string | null } }[];
    };
  }[],
) {
  const out = new Map<
    string,
    { id: string; language: string | null; studentId: string }
  >();
  for (const r of riders)
    for (const { parent } of r.student.parents)
      if (!out.has(parent.id))
        out.set(parent.id, {
          id: parent.id,
          language: parent.preferredLanguage,
          studentId: r.studentId,
        });
  return out;
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
