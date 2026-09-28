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
import { DiscountsModule } from './modules/discounts/discounts.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { TransportModule } from './modules/transport/transport.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { AccountantDocumentsModule } from './modules/accountant-documents/accountant-documents.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { TeacherDashboardModule } from './modules/teacher-dashboard/teacher-dashboard.module';
import { PaymentClaimsModule } from './modules/payment-claims/payment-claims.module';

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
    DiscountsModule,
    CustomFieldsModule,
    TransportModule,
    SubjectsModule,
    TeachersModule,
    AccountantDocumentsModule,
    TimetableModule,
    TeacherDashboardModule,
    PaymentClaimsModule,
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
        { path: 'auth/super-admin/login', method: RequestMethod.POST },
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/:id', method: RequestMethod.ALL },
        { path: 'tenants/:id/users', method: RequestMethod.ALL },
        { path: 'tenants/:id/users/:userId', method: RequestMethod.ALL },
        { path: 'tenants/:id/purge', method: RequestMethod.ALL },
        { path: 'dev/audit-logs', method: RequestMethod.ALL },
        // Addendum 4 / A9 — unauthenticated receipt link: no X-Tenant-ID header
        // (opened straight from an SMS/push, not a logged-in session); the
        // signed token itself carries the tenantId instead.
        { path: 'receipts/public/:token', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
