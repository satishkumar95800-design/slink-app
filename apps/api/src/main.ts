import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

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
