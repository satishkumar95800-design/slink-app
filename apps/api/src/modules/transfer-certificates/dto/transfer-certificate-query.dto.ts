import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TransferCertificateQueryDto {
  /** missing = no TC attached yet (default); attached = TC on file. */
  @IsIn(['missing', 'attached'])
  @IsOptional()
  status?: 'missing' | 'attached';

  @IsUUID()
  @IsOptional()
  classId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number;
}
