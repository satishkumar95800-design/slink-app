import {
  IsIn,
  IsString,
  IsDateString,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { FeeAllocationDto } from './fee-allocation.dto';

/** Every PaymentMethod except "gateway" — that value is reserved for online-gateway receipts. */
export const OFFLINE_PAYMENT_METHODS = [
  PaymentMethod.cash,
  PaymentMethod.cheque,
  PaymentMethod.bank_transfer,
  PaymentMethod.demand_draft,
] as const;

export class RecordOfflinePaymentDto {
  /** Which fee component(s) this payment covers, and how much of each — e.g. one cash receipt covering "Tuition & Van Fee" */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeAllocationDto)
  allocations: FeeAllocationDto[];

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
