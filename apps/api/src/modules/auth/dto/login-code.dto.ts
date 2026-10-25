import { IsBoolean, IsUUID, Matches } from 'class-validator';

export class LoginCodeChallengeDto {
  @IsUUID()
  challengeId: string;
}

export class VerifyLoginCodeDto extends LoginCodeChallengeDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class LoginCodesSettingDto {
  @IsBoolean()
  enabled: boolean;
}
