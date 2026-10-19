import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Optional per-school modules stored in tenants.features. A missing key means
 * off. Only the platform (super_admin) can switch these, via
 * PATCH /tenants/:id/features. The plan flags below (timetable to
 * customBranding) were on for every school before plans existed, so migration
 * 20261022090000_plan_feature_flags switched them on for existing schools.
 */
export type OptionalFeature =
  | 'transferCertificate'
  | 'feeConcession'
  | 'aiInsights'
  | 'pettyCash'
  | 'calendar'
  | 'hrms'
  /** Timetable, bell times, teachers' weekly routine and next-class reminders. */
  | 'timetable'
  /** Shared staff folders and files (/staff-documents). */
  | 'staffDocuments'
  /** Attendance report and the fee reports (/insights) with CSV export. */
  | 'advancedReports'
  /** The school changing its own logo, background and colours. */
  | 'customBranding'
  /** Syllabus topics with target dates, ticked off by subject teachers (Premium). */
  | 'syllabus'
  /** Admissions pipeline: enquiry to enrolment (Premium). */
  | 'admissions'
  /** School bus routes, stops, drivers; parents see their child's bus (Premium). */
  | 'transport';

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
