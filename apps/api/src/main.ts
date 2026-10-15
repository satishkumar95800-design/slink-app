import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { MigrationRow, runPendingMigrations } from './migrations-runner';

async function bootstrap() {
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

  // After listen(), so a slow database can never trip the host's start-up
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

bootstrap();
