import {
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

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
  @ValidateIf((o: BroadcastNotificationDto) =>
    o.targetType === BroadcastTarget.CLASS || o.targetType === BroadcastTarget.USER,
  )
  targetId?: string;

  /** Extra key-value pairs forwarded as FCM data payload */
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
