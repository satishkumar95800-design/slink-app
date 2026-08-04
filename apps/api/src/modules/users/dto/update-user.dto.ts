import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString } from 'class-validator';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.teacher, Role.admin, Role.accounts] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class UpdateUserDto {
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
}
