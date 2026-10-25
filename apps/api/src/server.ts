import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Express } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { MigrationRow, runPendingMigrations } from './migrations-runner';

/**
 * Builds the Nest app on [server], which main.ts has already put on the port
 * (see there for why). Resolves once every module is initialised.
 */
export async function startNest(server: Express, port: string | number) {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });

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

  // Exact origins only: a prefix test would also let in
  // https://schoolinkd.in.evil.com.
  const allowedOrigins = new Set(
    [
      process.env.ADMIN_BASE_URL ?? 'http://localhost:3001',
      ...(process.env.EXTRA_CORS_ORIGINS
        ? process.env.EXTRA_CORS_ORIGINS.split(',')
        : []),
    ]
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => cb(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
  });

  // Basic hardening headers (the API serves JSON and files, never pages).
  server.disable('x-powered-by');
  server.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    });
    next();
  });

  await app.init();
  console.warn(`API running on http://localhost:${port}/v1`);

  // After start-up, so a slow database can never trip the host's start-up
  // watchdog. Outcome is logged and shown on GET /v1/health.
  const prisma = app.get(PrismaService);
  void runPendingMigrations(
    join(__dirname, '..'),
    () =>
      prisma.$queryRaw<
        MigrationRow[]
      >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
  );
}
