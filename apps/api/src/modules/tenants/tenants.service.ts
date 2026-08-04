import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantSelfDto } from './dto/update-tenant-self.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
  primaryColor: true,
  accentColor: true,
  timezone: true,
  isActive: true,
  branding: true,
  features: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, students: true } },
} satisfies Prisma.TenantSelect;

// ── super_admin operations (no tenant-scoping) ────────────────────────────────

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    return this.prisma.tenant.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        primaryColor: dto.primaryColor ?? '#1E40AF',
        accentColor: dto.accentColor ?? '#F59E0B',
      },
      select: tenantSelect,
    });
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

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.requireTenant(id);

    if (dto.slug) {
      const taken = await this.prisma.tenant.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (taken) throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    return this.prisma.tenant.update({
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
  }

  async deactivate(id: string) {
    await this.requireTenant(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
      select: tenantSelect,
    });
  }

  // ── admin (own tenant) operations ─────────────────────────────────────────────

  async getSelf(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: tenantSelect,
    });
  }

  async updateSelf(tenantId: string, dto: UpdateTenantSelfDto) {
    let logoUrl: string | undefined;

    if (dto.logoKey) {
      // Convert the uploaded S3 key to its public URL
      logoUrl = await this.files.getSignedUrl(dto.logoKey, tenantId);
    }

    const brandingUpdate = dto.branding
      ? (dto.branding as Prisma.InputJsonValue)
      : undefined;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(brandingUpdate !== undefined && { branding: brandingUpdate }),
      },
      select: tenantSelect,
    });
  }

  async updateFeatures(tenantId: string, dto: UpdateFeaturesDto) {
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

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: merged },
      select: tenantSelect,
    });
  }

  private async requireTenant(id: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }
}
