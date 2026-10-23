import { IsEnum, IsUUID, IsOptional } from 'class-validator';

export enum FileCategory {
  LOGO = 'logo', // public/{tenantId}/logos/  — publicly readable
  BACKGROUND = 'background', // public/{tenantId}/backgrounds/ — publicly readable
  REPORT_PDF = 'report_pdf', // private/{tenantId}/reports/
  ATTACHMENT = 'attachment', // private/{tenantId}/attachments/
  STUDENT_PHOTO = 'student_photo', // private/{tenantId}/students/
  GENERAL_DOCUMENT = 'general_document', // private/{tenantId}/documents/ — Addendum 4 A13
  PAYMENT_CLAIM_PROOF = 'payment_claim_proof', // private/{tenantId}/payment-claims/ — Addendum 4 A12
  TRANSFER_CERTIFICATE = 'transfer_certificate', // private/{tenantId}/students/{studentId}/tc/
  PETTY_CASH_RECEIPT = 'petty_cash_receipt', // private/{tenantId}/petty-cash/ — admin/accounts only, via /petty-cash/receipts
  HR_DOCUMENT = 'hr_document', // private/{tenantId}/hr/{employeeId}/ — admin/accounts only, via /hrms/employees/:id/documents
  STAFF_DOCUMENT = 'staff_document', // private/{tenantId}/staff-docs/{folderId}/ — staff only, via /staff-documents
  RECEPTION_FORM = 'reception_form', // private/{tenantId}/reception-forms/ — front desk only, via /reception/forms
}

export const ALLOWED_MIME: Record<FileCategory, string[]> = {
  [FileCategory.LOGO]: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  [FileCategory.BACKGROUND]: ['image/jpeg', 'image/png', 'image/webp'],
  [FileCategory.REPORT_PDF]: ['application/pdf'],
  [FileCategory.ATTACHMENT]: [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain',
  ],
  [FileCategory.STUDENT_PHOTO]: ['image/jpeg', 'image/png', 'image/webp'],
  [FileCategory.GENERAL_DOCUMENT]: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
  [FileCategory.PAYMENT_CLAIM_PROOF]: [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
  [FileCategory.TRANSFER_CERTIFICATE]: [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
  [FileCategory.PETTY_CASH_RECEIPT]: [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
  [FileCategory.HR_DOCUMENT]: ['image/jpeg', 'image/png', 'application/pdf'],
  // Printable at the desk: PDF or a photo/scan of the form.
  [FileCategory.RECEPTION_FORM]: ['application/pdf', 'image/jpeg', 'image/png'],
  [FileCategory.STAFF_DOCUMENT]: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
};

/** Max file size in bytes per category */
export const MAX_BYTES: Record<FileCategory, number> = {
  [FileCategory.LOGO]: 5 * 1024 * 1024, // 5 MB
  [FileCategory.BACKGROUND]: 8 * 1024 * 1024, // 8 MB
  [FileCategory.REPORT_PDF]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.ATTACHMENT]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.STUDENT_PHOTO]: 2 * 1024 * 1024, // 2 MB
  [FileCategory.GENERAL_DOCUMENT]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.PAYMENT_CLAIM_PROOF]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.TRANSFER_CERTIFICATE]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.PETTY_CASH_RECEIPT]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.HR_DOCUMENT]: 10 * 1024 * 1024, // 10 MB
  [FileCategory.STAFF_DOCUMENT]: 20 * 1024 * 1024, // 20 MB
  [FileCategory.RECEPTION_FORM]: 15 * 1024 * 1024, // 15 MB
};

export class UploadFileDto {
  @IsEnum(FileCategory)
  category: FileCategory;

  /** e.g. reportId when category = report_pdf */
  @IsUUID()
  @IsOptional()
  entityId?: string;
}
