import { IsEnum, IsUUID, IsOptional } from 'class-validator';

export enum FileCategory {
  LOGO = 'logo',               // public/{tenantId}/logos/  — publicly readable
  REPORT_PDF = 'report_pdf',   // private/{tenantId}/reports/
  ATTACHMENT = 'attachment',   // private/{tenantId}/attachments/
  STUDENT_PHOTO = 'student_photo', // private/{tenantId}/students/
}

export const ALLOWED_MIME: Record<FileCategory, string[]> = {
  [FileCategory.LOGO]: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  [FileCategory.REPORT_PDF]: ['application/pdf'],
  [FileCategory.ATTACHMENT]: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
  [FileCategory.STUDENT_PHOTO]: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Max file size in bytes per category */
export const MAX_BYTES: Record<FileCategory, number> = {
  [FileCategory.LOGO]: 5 * 1024 * 1024,       // 5 MB
  [FileCategory.REPORT_PDF]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.ATTACHMENT]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.STUDENT_PHOTO]: 2 * 1024 * 1024, // 2 MB
};

export class UploadFileDto {
  @IsEnum(FileCategory)
  category: FileCategory;

  /** e.g. reportId when category = report_pdf */
  @IsUUID()
  @IsOptional()
  entityId?: string;
}
