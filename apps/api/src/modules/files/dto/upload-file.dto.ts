import { IsEnum, IsUUID, IsOptional } from 'class-validator';

export enum FileCategory {
  LOGO = 'logo',               // public/{tenantId}/logos/  — publicly readable
  BACKGROUND = 'background',   // public/{tenantId}/backgrounds/ — publicly readable
  REPORT_PDF = 'report_pdf',   // private/{tenantId}/reports/
  ATTACHMENT = 'attachment',   // private/{tenantId}/attachments/
  STUDENT_PHOTO = 'student_photo', // private/{tenantId}/students/
  GENERAL_DOCUMENT = 'general_document', // private/{tenantId}/documents/ — Addendum 4 A13
  PAYMENT_CLAIM_PROOF = 'payment_claim_proof', // private/{tenantId}/payment-claims/ — Addendum 4 A12
}

export const ALLOWED_MIME: Record<FileCategory, string[]> = {
  [FileCategory.LOGO]: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  [FileCategory.BACKGROUND]: ['image/jpeg', 'image/png', 'image/webp'],
  [FileCategory.REPORT_PDF]: ['application/pdf'],
  [FileCategory.ATTACHMENT]: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
  [FileCategory.STUDENT_PHOTO]: ['image/jpeg', 'image/png', 'image/webp'],
  [FileCategory.GENERAL_DOCUMENT]: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
  [FileCategory.PAYMENT_CLAIM_PROOF]: ['image/jpeg', 'image/png', 'application/pdf'],
};

/** Max file size in bytes per category */
export const MAX_BYTES: Record<FileCategory, number> = {
  [FileCategory.LOGO]: 5 * 1024 * 1024,       // 5 MB
  [FileCategory.BACKGROUND]: 8 * 1024 * 1024, // 8 MB
  [FileCategory.REPORT_PDF]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.ATTACHMENT]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.STUDENT_PHOTO]: 2 * 1024 * 1024, // 2 MB
  [FileCategory.GENERAL_DOCUMENT]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.PAYMENT_CLAIM_PROOF]: 10 * 1024 * 1024, // 10 MB
};

export class UploadFileDto {
  @IsEnum(FileCategory)
  category: FileCategory;

  /** e.g. reportId when category = report_pdf */
  @IsUUID()
  @IsOptional()
  entityId?: string;
}
