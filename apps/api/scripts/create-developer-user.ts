/**
 * One-off CLI to create a `developer` role account — deliberately NOT exposed as
 * an HTTP endpoint, since this role sees audit data across every tenant. Run by
 * whoever has direct repo/infra access, not self-service via the admin UI.
 *
 * Usage:
 *   pnpm --filter api exec ts-node scripts/create-developer-user.ts \
 *     --tenant-id <uuid-or-slug> --name "Dev Name" --email dev@example.com --password "..."
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const { name, email, password } = args;
  const tenantIdOrSlug = args['tenant-id'];

  if (!tenantIdOrSlug || !name || !email || !password) {
    console.error(
      'Usage: ts-node scripts/create-developer-user.ts --tenant-id <uuid-or-slug> --name "..." --email "..." --password "..."',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantIdOrSlug,
    );
    const tenant = await prisma.tenant.findUnique({
      where: isUuid ? { id: tenantIdOrSlug } : { slug: tenantIdOrSlug },
    });
    if (!tenant) {
      console.error(`Tenant "${tenantIdOrSlug}" not found`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        role: 'developer',
        passwordHash,
        isVerified: true,
      },
      select: { id: true, email: true, tenantId: true },
    });

    console.log('Created developer user:', user);
    console.log(`Log in with X-Tenant-ID: ${tenant.slug} (or ${tenant.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
