import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';

export class AssignStudentFeeDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  feeStructureId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  amountDueOverride?: number;

  @IsDateString()
  @IsOptional()
  dueDateOverride?: string;
}
