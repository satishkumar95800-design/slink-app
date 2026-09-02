export enum Role {
  PARENT = 'parent',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  ACCOUNTS = 'accounts',
  SUPER_ADMIN = 'super_admin',
  DEVELOPER = 'developer',
}

export enum FeeStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WAIVED = 'waived',
}

export enum PaymentOrderStatus {
  CREATED = 'created',
  ATTEMPTED = 'attempted',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  PAYU = 'payu',
}

export enum ReportStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum ReportType {
  ACADEMIC = 'academic',
  ATTENDANCE = 'attendance',
  BEHAVIOR = 'behavior',
  HOMEWORK = 'homework',
}

export enum NotificationChannel {
  FCM = 'fcm',
  SMS = 'sms',
  EMAIL = 'email',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum GuardianRelation {
  FATHER = 'father',
  MOTHER = 'mother',
  GUARDIAN = 'guardian',
}

// Wire-format values (what the API/UI/spreadsheet actually use) — the DB stores
// these under safe Prisma enum identifiers (A_POSITIVE, etc.), translated at the
// API boundary. See apps/api/src/common/blood-group.ts.
export enum BloodGroup {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
  O_POS = 'O+',
  O_NEG = 'O-',
}

export enum Caste {
  GENERAL = 'General',
  OBC = 'OBC',
  SC = 'SC',
  ST = 'ST',
  EWS = 'EWS',
  OTHER = 'Other',
}

export enum PaymentMethod {
  CASH = 'cash',
  CHEQUE = 'cheque',
  BANK_TRANSFER = 'bank_transfer',
  DEMAND_DRAFT = 'demand_draft',
  GATEWAY = 'gateway',
}
