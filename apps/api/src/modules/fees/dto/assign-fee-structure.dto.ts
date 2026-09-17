import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class AssignFeeStructureDto {
  /** Which of this plan's linked classes to assign — a plan may span more than one */
  @IsUUID()
  classId: string;

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
