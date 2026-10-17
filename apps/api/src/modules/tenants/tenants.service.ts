import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantSelfDto } from './dto/update-tenant-self.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { UpdatePlatformFeaturesDto } from './dto/update-platform-features.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import {
  PLAN_LABEL,
  addOnsOf,
  branchListPrice,
  groupDiscount,
  oneYearFrom,
  presetFlags,
  subscriptionState,
  yearlyAmount,
} from '../../common/subscription';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';

export const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
  backgroundImageUrl: true,
  primaryColor: true,
  accentColor: true,
  classLabel: true,
  defaultLanguage: true,
  timezone: true,
  isActive: true,
  branding: true,
  features: true,
  subscriptionPlan: true,
  subscriptionStartsOn: true,
  subscriptionEndsOn: true,
  groupId: true,
  group: { select: { id: true, name: true, _count: { select: { tenants: true } } } },
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, students: true } },
} satisfies Prisma.TenantSelect;

export type TenantRow = Prisma.TenantGetPayload<{ select: typeof tenantSelect }>;

/** Schema default for features a new school starts with, before its plan's modules. */
const BASE_FEATURES = {
  installmentPlans: false,
  inAppMessaging: false,
  transportFeeModule: true,
  photoGallery: false,
};

/** Plan, period and derived status (docs/SPEC-subscriptions.md) for the platform console. */
export function subscriptionView(t: TenantRow) {
  const endsOn = fromDbDate(t.subscriptionEndsOn);
  const features = (t.features ?? {}) as Record<string, unknown>;
  return {
    plan: t.subscriptionPlan,
    planName: PLAN_LABEL[t.subscriptionPlan],
    startsOn: fromDbDate(t.subscriptionStartsOn),
    endsOn,
    ...subscriptionState(endsOn, todayIn(t.timezone || 'Asia/Kolkata')),
    addOns: addOnsOf(t.subscriptionPlan, features),
    yearlyAmount: branchAmount(t, features),
  };
}

/**
 * Yearly amount at renewal. A branch of a group of 3+ schools pays its share
 * of the group price (docs/SPEC-franchise.md §5); the head office fee is billed
 * on the group, not here.
 */
function branchAmount(t: TenantRow, features: Record<string, unknown>) {
  const branches = t.group?._count.tenants ?? 0;
  const single = yearlyAmount(t.subscriptionPlan, features, t._count.students);
  if (branches < 3) return { ...single, groupDiscountPercent: 0 };
  const list = branchListPrice(t.subscriptionPlan, t._count.students);
  const discount = groupDiscount(branches);
  return {
    plan: list,
    addOns: 0,
    extraStudents: 0,
    extraStudentsAmount: 0,
    groupDiscountPercent: discount,
    total: Math.round(list * (1 - discount / 100)),
  };
}

export const withSubscription = (t: TenantRow) => ({
  ...t,
  subscription: subscriptionView(t),
});

// ── super_admin operations (no tenant-scoping) ────────────────────────────────

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /** A new school on the chosen plan (default Basic), subscribed for a year from today. */
  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const timezone = dto.timezone ?? 'Asia/Kolkata';
    const plan = dto.plan ?? 'basic';
    const startsOn = dto.startsOn ?? todayIn(timezone);
    return withSubscription(
      await this.prisma.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          timezone,
          primaryColor: dto.primaryColor ?? '#1E40AF',
          accentColor: dto.accentColor ?? '#F59E0B',
          subscriptionPlan: plan,
          subscriptionStartsOn: toDbDate(startsOn),
          subscriptionEndsOn: toDbDate(oneYearFrom(startsOn)),
          features: { ...BASE_FEATURES, ...presetFlags(plan) },
        },
        select: tenantSelect,
      }),
    );
  }

  async findAll(query: TenantQueryDto) {
    const where: Prisma.TenantWhereInput = {};

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.plan) where.subscriptionPlan = query.plan;

    // Subscription status is derived per school (its own timezone), so that
    // filter runs over the matching schools before paging.
    if (query.subscription) {
      const rows = (
        await this.prisma.tenant.findMany({
          where,
          select: tenantSelect,
          orderBy: { subscriptionEndsOn: 'asc' },
        })
      )
        .map(withSubscription)
        .filter((t) => t.subscription.status === query.subscription);
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      return {
        data: rows.slice((page - 1) * limit, page * limit),
        total: rows.length,
        page,
        limit,
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        select: tenantSelect,
        orderBy: { createdAt: 'desc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: data.map(withSubscription),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return withSubscription(tenant);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.requireTenant(id);

    if (dto.slug) {
      const taken = await this.prisma.tenant.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (taken) throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const row = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: tenantSelect,
    });
    return withSubscription(row);
  }

  async deactivate(id: string) {
    await this.requireTenant(id);
    return withSubscription(
      await this.prisma.tenant.update({
        where: { id },
        data: { isActive: false },
        select: tenantSelect,
      }),
    );
  }

  /**
   * Permanently deletes a tenant and, via FK cascade, every row scoped to it
   * (users, students, fees, payments, reports, etc.). Irreversible — only allowed
   * on an already-deactivated tenant so it can never fire against a live school.
   */
  async purge(id: string, confirmSlug: string) {
    const tenant = await this.requireTenant(id);
    if (tenant.isActive) {
      throw new BadRequestException('Deactivate the tenant before permanently deleting it');
    }
    if (confirmSlug !== tenant.slug) {
      throw new BadRequestException('Confirmation slug does not match this tenant');
    }
    await this.prisma.tenant.delete({ where: { id } });
    return { id, slug: tenant.slug, deleted: true };
  }

  // ── admin (own tenant) operations ─────────────────────────────────────────────

  /** The school's own settings; `subscription` carries only what the expiry banner needs. */
  async getSelf(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: tenantSelect,
    });
    return selfView(t);
  }

  async updateSelf(tenantId: string, dto: UpdateTenantSelfDto) {
    await this.assertBrandingAllowed(tenantId, dto);
    let logoUrl: string | undefined;
    let backgroundImageUrl: string | undefined;

    if (dto.logoKey) {
      // Convert the uploaded S3 key to its public URL
      logoUrl = await this.files.getSignedUrl(dto.logoKey, tenantId);
    }

    if (dto.backgroundImageKey) {
      backgroundImageUrl = await this.files.getSignedUrl(dto.backgroundImageKey, tenantId);
    }

    const brandingUpdate = dto.branding
      ? (dto.branding as Prisma.InputJsonValue)
      : undefined;

    const row = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(dto.classLabel !== undefined && { classLabel: dto.classLabel }),
        ...(dto.defaultLanguage !== undefined && { defaultLanguage: dto.defaultLanguage }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(backgroundImageUrl !== undefined && { backgroundImageUrl }),
        ...(brandingUpdate !== undefined && { branding: brandingUpdate }),
      },
      select: tenantSelect,
    });
    return selfView(row);
  }

  async updateFeatures(tenantId: string, dto: UpdateFeaturesDto | UpdatePlatformFeaturesDto) {
    const current = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { features: true },
    });

    const merged = {
      ...(current.features as Record<string, boolean>),
      ...Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      ),
    };

    return withSubscription(
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { features: merged },
        select: tenantSelect,
      }),
    );
  }

  /**
   * A new logo, background or colour needs the `customBranding` plan flag.
   * Resending the current colours (the settings form saves them with every
   * change) is always allowed, so schools without it can still edit the rest.
   */
  private async assertBrandingAllowed(tenantId: string, dto: UpdateTenantSelfDto) {
    const current = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { primaryColor: true, accentColor: true, features: true },
    });
    const changesBranding =
      !!dto.logoKey ||
      !!dto.backgroundImageKey ||
      (dto.primaryColor !== undefined &&
        dto.primaryColor.toLowerCase() !== current.primaryColor.toLowerCase()) ||
      (dto.accentColor !== undefined &&
        dto.accentColor.toLowerCase() !== current.accentColor.toLowerCase());
    const features = (current.features ?? {}) as Record<string, unknown>;
    if (changesBranding && features.customBranding !== true) {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'This feature is not enabled for your school',
      });
    }
  }

  private async requireTenant(id: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }
}

/** What a school's own users get: no prices, just the plan and the dates for the banner. */
function selfView(t: TenantRow) {
  const sub = subscriptionView(t);
  return {
    ...t,
    subscription: {
      plan: sub.plan,
      planName: sub.planName,
      endsOn: sub.endsOn,
      status: sub.status,
      daysLeft: sub.daysLeft,
      graceDaysLeft: sub.graceDaysLeft,
    },
  };
}
