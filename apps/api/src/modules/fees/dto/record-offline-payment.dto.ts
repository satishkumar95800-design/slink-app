import {
  IsNumber,
  IsEnum,
  IsString,
  IsDateString,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export enum OfflinePaymentMethod {
  CASH = 'cash',
  CHEQUE = 'cheque',
  BANK_TRANSFER = 'bank_transfer',
  DEMAND_DRAFT = 'demand_draft',
}

export class RecordOfflinePaymentDto {
  /** Amount received, in major currency units (e.g. INR) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(OfflinePaymentMethod)
  method: OfflinePaymentMethod;

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
