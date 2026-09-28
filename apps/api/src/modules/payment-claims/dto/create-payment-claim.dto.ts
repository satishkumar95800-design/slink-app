import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ClaimPaymentMode } from '@prisma/client';

/** Addendum 4 / A12 — all fields except the fee + uploaded proof are optional per spec. */
export class CreatePaymentClaimDto {
  @IsUUID()
  studentFeeId: string;

  /** Key returned by POST /files/upload with category=payment_claim_proof. */
  @IsString()
  fileKey: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  claimedAmount?: number;

  @IsDateString()
  @IsOptional()
  claimedDate?: string;

  @IsEnum(ClaimPaymentMode)
  @IsOptional()
  claimedMode?: ClaimPaymentMode;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
