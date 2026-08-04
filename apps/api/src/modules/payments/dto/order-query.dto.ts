import { IsUUID, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentOrderStatus } from '@prisma/client';

export class OrderQueryDto {
  @IsEnum(PaymentOrderStatus)
  @IsOptional()
  status?: PaymentOrderStatus;

  @IsUUID()
  @IsOptional()
  studentFeeId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
