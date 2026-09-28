import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

// Kept separate from any real school so a tenant purge can never take out
// platform access — see PLATFORM_TENANT_SLUG usage below.
const PLATFORM_TENANT_SLUG = 'platform';

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@platform.local';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
const SUPER_ADMIN_NAME = process.env.SEED_SUPER_ADMIN_NAME ?? 'Super Admin';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: PLATFORM_TENANT_SLUG },
    update: {},
    create: {
      slug: PLATFORM_TENANT_SLUG,
      name: 'Platform (system account holder — not a real school)',
      isActive: false,
    },
  });

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: SUPER_ADMIN_EMAIL } },
    update: { passwordHash, role: Role.super_admin, isVerified: true },
    create: {
      tenantId: tenant.id,
      email: SUPER_ADMIN_EMAIL,
      name: SUPER_ADMIN_NAME,
      role: Role.super_admin,
      passwordHash,
      isVerified: true,
    },
  });

  console.log(`Super admin ready: ${SUPER_ADMIN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
