import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeaturesDto {
  @IsBoolean()
  @IsOptional()
  installmentPlans?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppMessaging?: boolean;

  @IsBoolean()
  @IsOptional()
  transportFeeModule?: boolean;

  @IsBoolean()
  @IsOptional()
  photoGallery?: boolean;
}
