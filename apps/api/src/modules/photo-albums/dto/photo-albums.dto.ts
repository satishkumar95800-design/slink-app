import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class AlbumDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @trim()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  /** YYYY-MM-DD, the day of the activity. */
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  /** Staff folder: teachers, admin and accounts only; never parents. */
  @IsBoolean()
  @IsOptional()
  forStaff?: boolean;

  /** Every child of these classes sees it... */
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  classIds: string[];

  /** ...plus these children. */
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  studentIds: string[];
}

/** Sent with an uploaded photo (multipart fields). */
export class PhotoMetaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  @IsOptional()
  width?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  @IsOptional()
  height?: number;
}
