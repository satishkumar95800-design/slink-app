import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Settings → Admission numbers (admin). Off: numbers are typed by hand. */
export class AdmissionNumberingDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o: AdmissionNumberingDto) => o.enabled)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  pattern: string;

  @ValidateIf((o: AdmissionNumberingDto) => o.enabled)
  @IsInt()
  @Min(1)
  @Max(8)
  digits: number;

  @ValidateIf((o: AdmissionNumberingDto) => o.enabled)
  @IsInt()
  @Min(1)
  @Max(99_999_999)
  next: number;

  @ValidateIf((o: AdmissionNumberingDto) => o.enabled)
  @IsBoolean()
  resetEachYear: boolean;
}
