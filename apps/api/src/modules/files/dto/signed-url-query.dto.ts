import { IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SignedUrlQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  key: string;

  /** Signed URL TTL in seconds. Default: 900 (15 min). Max: 604800 (7 days). */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(604800)
  @IsOptional()
  expiresIn?: number = 900;
}
