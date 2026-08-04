import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { FirebaseAdminModule } from './firebase/firebase-admin.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { FeesModule } from './modules/fees/fees.module';
import { SecretsModule } from './secrets/secrets.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    FirebaseAdminModule,
    SecretsModule,
    HealthModule,
    AuthModule,
    StudentsModule,
    FeesModule,
    PaymentsModule,
    ReportsModule,
    NotificationsModule,
    FilesModule,
    // Modules added as they are implemented:
    // TenantsModule
    // UsersModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolution to all routes; webhook excluded (Razorpay sends no X-Tenant-ID)
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'v1/health', method: RequestMethod.GET },
        { path: 'v1/payments/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
