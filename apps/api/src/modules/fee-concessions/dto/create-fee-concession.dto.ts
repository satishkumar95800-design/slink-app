import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFeeConcessionDto {
  @IsUUID()
  studentId: string;

  /** Percentage off the student's outstanding fees, e.g. 10 for 10%. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percentage: number;

  /** Limit the concession to one fee component (e.g. Tuition); omit for all components. */
  @IsUUID()
  @IsOptional()
  feeItemId?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
