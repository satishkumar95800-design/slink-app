import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BroadcastKind, NotificationChannel } from '@prisma/client';

export enum BroadcastTarget {
  CLASS = 'class',
  ALL_PARENTS = 'all_parents',
  USER = 'user',
}

export class BroadcastNotificationDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  /** Required for FCM; optional for SMS */
  @IsString()
  @MaxLength(100)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @IsEnum(BroadcastTarget)
  targetType: BroadcastTarget;

  /** classId when targetType = 'class'; userId when targetType = 'user'; omit for 'all_parents' */
  @IsUUID()
  @ValidateIf(
    (o: BroadcastNotificationDto) =>
      o.targetType === BroadcastTarget.CLASS ||
      o.targetType === BroadcastTarget.USER,
  )
  targetId?: string;

  /** Extra key-value pairs forwarded as FCM data payload */
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;

  /** S3 key of a file already uploaded via POST /files/upload (category: attachment).
   * Single-photo form kept for older app builds; newer ones send [fileKeys]. */
  @IsString()
  @MaxLength(512)
  @IsOptional()
  fileKey?: string;

  /** Up to 3 photos, or 1 PDF (notices only). Takes precedence over [fileKey]. */
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  @IsOptional()
  fileKeys?: string[];

  /** notice or homework. Older builds omit it: an attachment meant homework, none meant a notice. */
  @IsEnum(BroadcastKind)
  @IsOptional()
  kind?: BroadcastKind;

  /** Homework only: the subject it's for (shown to parents). */
  @IsUUID()
  @IsOptional()
  subjectId?: string;
}
