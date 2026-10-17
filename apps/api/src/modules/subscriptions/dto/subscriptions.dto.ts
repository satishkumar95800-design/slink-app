import { SubscriptionPlan } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class UpdateSubscriptionDto {
  /** Changing the plan also switches the modules to its preset. */
  @IsEnum(SubscriptionPlan)
  @IsOptional()
  plan?: SubscriptionPlan;

  @Matches(DATE, { message: 'startsOn must be YYYY-MM-DD' })
  @IsOptional()
  startsOn?: string;

  @Matches(DATE, { message: 'endsOn must be YYYY-MM-DD' })
  @IsOptional()
  endsOn?: string;
}

export class RenewSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  @IsOptional()
  plan?: SubscriptionPlan;

  /** Defaults to one year after the new period starts. */
  @Matches(DATE, { message: 'endsOn must be YYYY-MM-DD' })
  @IsOptional()
  endsOn?: string;

  /** Rupees received. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999.99)
  @IsOptional()
  amount?: number;

  @trim()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  reference?: string;

  @trim()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
