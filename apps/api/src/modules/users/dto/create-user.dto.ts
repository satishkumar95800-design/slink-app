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
import { CleanName } from '../../../common/decorators/clean-name.decorator';

const STAFF_ROLES = [Role.teacher, Role.admin, Role.accounts] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateUserDto {
  @CleanName()
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
