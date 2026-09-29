import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from './prisma/prisma.service';

/**
 * Applies any pending migrations before the app starts serving traffic.
 *
 * Some hosts (e.g. Hostinger) run this compiled file directly (`node
 * dist/src/main.js`) rather than via `npm run start:prod`, bypassing
 * package.json's `start:prod` script entirely — so `prisma migrate deploy`
 * has to live here, in the entry file itself, to be guaranteed to run
 * regardless of how the host invokes it. Resolved via __dirname (not a
 * relative-to-cwd path) for the same reason: cwd at invocation time isn't
 * something we can rely on across hosts.
 *
 * Paths point into this same dist/ directory because the build step
 * (scripts/copy-node-modules.js) copies prisma/schema.prisma,
 * prisma/migrations, and node_modules in here — none of them would
 * otherwise survive a host that only promotes the build output directory.
 *
 * Deliberately non-fatal on failure: this could fail for an infra reason
 * unrelated to the migrations themselves (e.g. a transitive dependency
 * missing from a copied node_modules tree on some host), and crashing the
 * entire API over that would be worse than the schema-drift bug this is
 * meant to prevent — a request hitting the affected table still fails the
 * same way it did before, but everything else keeps working. Logged loudly
 * either way so it's never silently skipped.
 */
function runPendingMigrations() {
  const logger = new Logger('Migrations');
  const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
  const prismaCli = join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

  logger.log('Applying any pending migrations…');
  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
      stdio: 'inherit',
      // A hung schema engine (e.g. DB unreachable) previously blocked this
      // synchronous call for 60+ seconds, which froze the event loop long
      // enough to miss Hostinger's "must call listen() within 3 seconds"
      // watchdog — leaving the app permanently unroutable even after it
      // eventually did call listen(). Capping this ensures listen() is
      // never delayed by more than a few seconds regardless of DB state.
      timeout: 8000,
    });
    logger.log('Migrations up to date.');
  } catch (err) {
    logger.error(
      'Could not run migrations — continuing to start anyway. If the schema is actually out of date, requests touching the affected table(s) will still fail until this is resolved.',
      err instanceof Error ? err.stack : String(err),
    );
  }
}

async function bootstrap() {
  runPendingMigrations();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  // JwtAuthGuard must be registered before RolesGuard so req.user is populated
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
  app.useGlobalInterceptors(new AuditLogInterceptor(app.get(PrismaService)));

  const allowedOrigins = [
    process.env.ADMIN_BASE_URL ?? 'http://localhost:3001',
    ...(process.env.EXTRA_CORS_ORIGINS
      ? process.env.EXTRA_CORS_ORIGINS.split(',')
      : []),
  ];
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => cb(null, !origin || allowedOrigins.some((o) => origin.startsWith(o))),
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.warn(`API running on http://localhost:${port}/v1`);
}

bootstrap();
