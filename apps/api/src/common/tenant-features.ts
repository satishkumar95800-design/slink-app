import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Optional per-school modules stored in tenants.features. A missing key means
 * off, so new flags never need a data migration. Only the platform
 * (super_admin) can switch these, via PATCH /tenants/:id/features.
 */
export type OptionalFeature =
  'transferCertificate' | 'feeConcession' | 'aiInsights';

export async function isFeatureEnabled(
  prisma: PrismaService,
  tenantId: string,
  feature: OptionalFeature,
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { features: true },
  });
  const features = (tenant?.features ?? {}) as Record<string, unknown>;
  return features[feature] === true;
}

export async function assertFeatureEnabled(
  prisma: PrismaService,
  tenantId: string,
  feature: OptionalFeature,
): Promise<void> {
  if (!(await isFeatureEnabled(prisma, tenantId, feature))) {
    throw new ForbiddenException({
      code: 'FEATURE_DISABLED',
      message: 'This feature is not enabled for your school',
    });
  }
}
