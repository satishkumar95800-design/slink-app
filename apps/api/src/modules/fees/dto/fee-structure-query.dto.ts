import { IsUUID, IsString, IsOptional, Matches } from 'class-validator';

export class FeeStructureQueryDto {
  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  academicYear?: string;
}
