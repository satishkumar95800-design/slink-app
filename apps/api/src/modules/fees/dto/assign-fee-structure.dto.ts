import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class AssignFeeStructureDto {
  /** Override the amount due for this assignment (e.g. custom scholarship amount) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  amountDueOverride?: number;

  /** Override the due date for this assignment */
  @IsDateString()
  @IsOptional()
  dueDateOverride?: string;

  /** When true, broadcasts a fee-due notification to the class's parents after assigning */
  @IsBoolean()
  @IsOptional()
  notifyParents?: boolean;
}
