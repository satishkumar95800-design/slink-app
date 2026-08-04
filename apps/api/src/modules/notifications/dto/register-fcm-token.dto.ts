import { IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token: string;
}
