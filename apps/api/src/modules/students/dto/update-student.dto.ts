import { IsString, IsUUID, IsOptional, IsEnum, MinLength, MaxLength, IsDateString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { BloodGroup, Caste } from '@prisma/client';
import { BLOOD_GROUP_DISPLAY_TO_ENUM, BLOOD_GROUP_OPTIONS } from '../../../common/blood-group';

export class UpdateStudentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @Transform(({ value }) => BLOOD_GROUP_DISPLAY_TO_ENUM[value] ?? value)
  @IsEnum(BloodGroup, {
    message: `bloodGroup must be one of ${BLOOD_GROUP_OPTIONS.join(', ')}`,
  })
  @IsOptional()
  bloodGroup?: BloodGroup;

  @IsEnum(Caste)
  @IsOptional()
  caste?: Caste;

  @IsUrl({ require_tld: false })
  @IsOptional()
  photoUrl?: string;
}
