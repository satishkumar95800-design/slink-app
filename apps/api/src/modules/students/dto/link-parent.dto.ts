import { IsEnum, IsBoolean, IsOptional, Matches } from 'class-validator';
import { GuardianRelation } from '@prisma/client';

export class LinkParentDto {
  /** Parent phone in E.164 format. Creates an unverified user if one doesn't exist yet. */
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'parentPhone must be a valid E.164 phone number' })
  parentPhone: string;

  @IsEnum(GuardianRelation)
  @IsOptional()
  relation?: GuardianRelation;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
