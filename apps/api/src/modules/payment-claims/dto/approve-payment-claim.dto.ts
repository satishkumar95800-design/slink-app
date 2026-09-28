import { IsNumber, IsOptional, Min } from 'class-validator';

/**
 * The parent's claimedAmount is optional (per A12); if they didn't give one,
 * or the accountant needs to correct it against the uploaded proof, this
 * lets the approver confirm the actual amount before it's recorded.
 */
export class ApprovePaymentClaimDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  amount?: number;
}
