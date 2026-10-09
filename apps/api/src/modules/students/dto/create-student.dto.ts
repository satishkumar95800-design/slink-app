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
import { GuardianRelation, BloodGroup, Caste, Gender } from '@prisma/client';
import {
  BLOOD_GROUP_DISPLAY_TO_ENUM,
  BLOOD_GROUP_OPTIONS,
} from '../../../common/blood-group';
import { CleanName } from '../../../common/decorators/clean-name.decorator';

export class CreateStudentDto {
  @CleanName()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  admissionNo: string;

  /** Optional class roll number, e.g. "12". Attendance lists sort by it. */
  @IsString()
  @MaxLength(20)
  @IsOptional()
  rollNo?: string;

  /** ISO 8601 date, e.g. "2010-03-15" */
  @IsDateString()
  @IsOptional()
  dob?: string;

  /** Addendum 4 / A10 — feeds the Teacher Dashboard's class-strength (boy/girl/total) stat. */
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

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
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'parentPhone must be a valid E.164 phone number',
  })
  @IsOptional()
  parentPhone?: string;

  @IsEnum(GuardianRelation)
  @IsOptional()
  parentRelation?: GuardianRelation;

  @IsBoolean()
  @IsOptional()
  isParentPrimary?: boolean;
}
