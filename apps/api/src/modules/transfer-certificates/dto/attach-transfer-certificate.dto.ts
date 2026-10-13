import { IsString, MaxLength } from 'class-validator';

export class AttachTransferCertificateDto {
  /** S3 key from POST /files/upload (category: transfer_certificate, entityId: studentId). */
  @IsString()
  @MaxLength(512)
  fileKey: string;
}
