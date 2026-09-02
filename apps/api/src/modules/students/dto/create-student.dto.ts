import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
  MaxLength,
  IsDateString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GuardianRelation, BloodGroup, Caste } from '@prisma/client';
import { BLOOD_GROUP_DISPLAY_TO_ENUM, BLOOD_GROUP_OPTIONS } from '../../../common/blood-group';

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  admissionNo: string;

  /** ISO 8601 date, e.g. "2010-03-15" */
  @IsDateString()
  @IsOptional()
  dob?: string;

  /** Accepts "A+", "A-", "B+", ... on the wire; translated to the Prisma enum here. */
  @Transform(({ value }) => BLOOD_GROUP_DISPLAY_TO_ENUM[value] ?? value)
  @IsEnum(BloodGroup, {
    message: `bloodGroup must be one of ${BLOOD_GROUP_OPTIONS.join(', ')}`,
  })
  @IsOptional()
  bloodGroup?: BloodGroup;

  @IsEnum(Caste)
  @IsOptional()
  caste?: Caste;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsUUID()
  classId: string;

  /** Parent phone in E.164 format, e.g. "+919876543210" */
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'parentPhone must be a valid E.164 phone number' })
  @IsOptional()
  parentPhone?: string;

  @IsEnum(GuardianRelation)
  @IsOptional()
  parentRelation?: GuardianRelation;

  @IsBoolean()
  @IsOptional()
  isParentPrimary?: boolean;
}
