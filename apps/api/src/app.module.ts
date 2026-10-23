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
import { PaymentGatewayModule } from './modules/payment-gateway/payment-gateway.module';
import { AiModule } from './modules/ai/ai.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AssistantModule } from './modules/assistant/assistant.module';
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
import { StaffDocumentsModule } from './modules/staff-documents/staff-documents.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { TeacherDashboardModule } from './modules/teacher-dashboard/teacher-dashboard.module';
import { PaymentClaimsModule } from './modules/payment-claims/payment-claims.module';
import { StudentNotesModule } from './modules/student-notes/student-notes.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ConsentFormsModule } from './modules/consent-forms/consent-forms.module';
import { SyllabusModule } from './modules/syllabus/syllabus.module';
import { SchoolBusModule } from './modules/school-bus/school-bus.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PlatformDashboardModule } from './modules/platform-dashboard/platform-dashboard.module';
import { HeadOfficeModule } from './modules/head-office/head-office.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { LibraryModule } from './modules/library/library.module';
import { ReceptionModule } from './modules/reception/reception.module';
import { PhotoAlbumsModule } from './modules/photo-albums/photo-albums.module';
import { AdminHomeModule } from './modules/admin-home/admin-home.module';
import { PettyCashModule } from './modules/petty-cash/petty-cash.module';
import { HrmsModule } from './modules/hrms/hrms.module';
import { ParentModule } from './modules/parent/parent.module';
import { FeeRemindersModule } from './modules/fee-reminders/fee-reminders.module';
import { BroadcastsModule } from './modules/broadcasts/broadcasts.module';
import { PublicSiteModule } from './modules/public-site/public-site.module';
import { TransferCertificatesModule } from './modules/transfer-certificates/transfer-certificates.module';
import { FeeConcessionsModule } from './modules/fee-concessions/fee-concessions.module';
import { ClassRemindersModule } from './modules/class-reminders/class-reminders.module';
import { HolidayNoticesModule } from './modules/holiday-notices/holiday-notices.module';

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
    PaymentGatewayModule,
    AiModule,
    AlertsModule,
    AssistantModule,
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
    StaffDocumentsModule,
    TimetableModule,
    TeacherDashboardModule,
    PaymentClaimsModule,
    StudentNotesModule,
    AttendanceModule,
    CalendarModule,
    ConsentFormsModule,
    SyllabusModule,
    SchoolBusModule,
    SubscriptionsModule,
    PlatformDashboardModule,
    HeadOfficeModule,
    AdmissionsModule,
    LibraryModule,
    ReceptionModule,
    PhotoAlbumsModule,
    AdminHomeModule,
    PettyCashModule,
    HrmsModule,
    ParentModule,
    FeeRemindersModule,
    BroadcastsModule,
    PublicSiteModule,
    TransferCertificatesModule,
    FeeConcessionsModule,
    ClassRemindersModule,
    HolidayNoticesModule,
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
        // The refresh token alone identifies the user and school; the console
        // (incl. super admin and head office, who have no school) sends no
        // X-Tenant-ID here, so these must not need one.
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/logout', method: RequestMethod.POST },
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/:id', method: RequestMethod.ALL },
        { path: 'tenants/:id/users', method: RequestMethod.ALL },
        { path: 'tenants/:id/users/:userId', method: RequestMethod.ALL },
        { path: 'tenants/:id/purge', method: RequestMethod.ALL },
        { path: 'tenants/:id/features', method: RequestMethod.ALL },
        { path: 'tenants/:id/payment-gateway', method: RequestMethod.ALL },
        { path: 'tenants/:id/subscription', method: RequestMethod.ALL },
        { path: 'tenants/:id/renew', method: RequestMethod.ALL },
        { path: 'tenants/:id/renewals', method: RequestMethod.ALL },
        { path: 'platform/renewals', method: RequestMethod.GET },
        { path: 'platform/dashboard', method: RequestMethod.GET },
        // Head office (franchise) and its management: cross-school, no X-Tenant-ID.
        { path: 'platform/groups', method: RequestMethod.ALL },
        { path: 'platform/groups/:id', method: RequestMethod.ALL },
        { path: 'platform/groups/:id/schools', method: RequestMethod.ALL },
        { path: 'platform/groups/:id/users', method: RequestMethod.ALL },
        {
          path: 'platform/groups/:id/users/:userId',
          method: RequestMethod.ALL,
        },
        {
          path: 'platform/groups/:id/users/:userId/password',
          method: RequestMethod.ALL,
        },
        { path: 'head-office/overview', method: RequestMethod.GET },
        { path: 'head-office/circulars', method: RequestMethod.ALL },
        { path: 'head-office/branches/:tenantId', method: RequestMethod.GET },
        { path: 'dev/audit-logs', method: RequestMethod.ALL },
        // Addendum 4 / A9 — unauthenticated receipt link: no X-Tenant-ID header
        // (opened straight from an SMS/push, not a logged-in session); the
        // signed token itself carries the tenantId instead.
        { path: 'receipts/public/:token', method: RequestMethod.GET },
        { path: 'receipts/public/:token/pdf', method: RequestMethod.GET },
        // Marketing site (no tenant) and the super-admin views of its data.
        { path: 'public/contact', method: RequestMethod.POST },
        { path: 'public/events', method: RequestMethod.POST },
        { path: 'platform/contact-requests', method: RequestMethod.GET },
        { path: 'platform/site-stats', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
