import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  firebaseIdToken: string;

  /** Optional device identifier for per-device refresh token tracking */
  @IsString()
  @IsOptional()
  deviceId?: string;
}
