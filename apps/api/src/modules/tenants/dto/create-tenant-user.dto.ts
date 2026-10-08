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

// super_admin may bootstrap a "developer" support account on a tenant in addition to
// the normal staff roles — deliberately excludes super_admin itself, which stays a
// manual/DB-level action rather than something creatable from a form.
const PLATFORM_CREATABLE_ROLES = [Role.admin, Role.accounts, Role.teacher, Role.developer] as const;
type PlatformCreatableRole = (typeof PLATFORM_CREATABLE_ROLES)[number];

export class CreateTenantUserDto {
  @CleanName()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(PLATFORM_CREATABLE_ROLES)
  role: PlatformCreatableRole;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}
