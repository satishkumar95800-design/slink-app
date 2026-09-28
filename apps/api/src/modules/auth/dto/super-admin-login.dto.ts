import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class SuperAdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}
