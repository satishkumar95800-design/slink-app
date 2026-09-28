import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectPaymentClaimDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reviewNote?: string;
}
