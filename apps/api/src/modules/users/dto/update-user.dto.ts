import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { CleanName } from '../../../common/decorators/clean-name.decorator';

const STAFF_ROLES = [Role.teacher, Role.admin, Role.accounts] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class UpdateUserDto {
  @CleanName()
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsEnum(STAFF_ROLES)
  @IsOptional()
  role?: StaffRole;

  /** Not role-restricted — used to edit a parent's profession too. */
  @IsString()
  @IsOptional()
  @MaxLength(150)
  profession?: string;
}
