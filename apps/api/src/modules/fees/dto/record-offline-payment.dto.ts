import {
  IsNumber,
  IsIn,
  IsString,
  IsDateString,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/** Every PaymentMethod except "gateway" — that value is reserved for online-gateway receipts. */
export const OFFLINE_PAYMENT_METHODS = [
  PaymentMethod.cash,
  PaymentMethod.cheque,
  PaymentMethod.bank_transfer,
  PaymentMethod.demand_draft,
] as const;

export class RecordOfflinePaymentDto {
  /** Amount received, in major currency units (e.g. INR) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsIn(OFFLINE_PAYMENT_METHODS)
  method: (typeof OFFLINE_PAYMENT_METHODS)[number];

  /** Cheque number, UTR, DD number, etc. */
  @IsString()
  @MaxLength(100)
  @IsOptional()
  reference?: string;

  /** Date the payment was received; defaults to today if omitted */
  @IsDateString()
  @IsOptional()
  paidOn?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
