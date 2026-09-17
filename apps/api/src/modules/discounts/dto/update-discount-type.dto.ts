import { IsEnum, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { DiscountKind } from '@prisma/client';

export class UpdateDiscountTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsEnum(DiscountKind)
  @IsOptional()
  kind?: DiscountKind;
}
