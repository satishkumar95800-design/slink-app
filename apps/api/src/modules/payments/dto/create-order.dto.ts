import { IsUUID, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  studentFeeId: string;

  /**
   * Client-supplied idempotency key. Defaults to studentFeeId if omitted.
   * Re-submitting the same key returns the existing order instead of creating a new one.
   */
  @IsString()
  @MaxLength(128)
  @IsOptional()
  idempotencyKey?: string;
}
