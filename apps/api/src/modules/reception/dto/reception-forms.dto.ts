import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Name and note of a front desk form (sent with the file, or to rename it). */
export class ReceptionFormDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}
