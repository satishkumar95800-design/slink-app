export enum Role {
  PARENT = 'parent',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  ACCOUNTS = 'accounts',
  SUPER_ADMIN = 'super_admin',
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
