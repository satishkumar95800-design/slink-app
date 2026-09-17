import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { DiscountKind } from '@prisma/client';

export class CreateDiscountTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(DiscountKind)
  kind: DiscountKind;
}
