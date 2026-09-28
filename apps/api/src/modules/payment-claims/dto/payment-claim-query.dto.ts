import { IsEnum, IsOptional } from 'class-validator';
import { PaymentClaimStatus } from '@prisma/client';

export class PaymentClaimQueryDto {
  @IsEnum(PaymentClaimStatus)
  @IsOptional()
  status?: PaymentClaimStatus;
}
