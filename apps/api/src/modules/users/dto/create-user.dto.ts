import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.teacher, Role.admin, Role.accounts] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(STAFF_ROLES)
  role: StaffRole;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}
