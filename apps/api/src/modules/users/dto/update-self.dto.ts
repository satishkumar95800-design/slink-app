import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSelfDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
