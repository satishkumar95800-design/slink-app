import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
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
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { InsightsModule } from './modules/insights/insights.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('REDIS_URL'),
      }),
    }),
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
    TenantsModule,
    UsersModule,
    ImportsModule,
    ReceiptsModule,
    InsightsModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // /tenants (platform CRUD) and /dev/* (developer tooling) excluded —
    // super_admin/developer have no X-Tenant-ID context; both operate cross-tenant.
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'payments/webhook', method: RequestMethod.POST },
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/:id', method: RequestMethod.ALL },
        { path: 'dev/audit-logs', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
