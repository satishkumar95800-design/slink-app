import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class TopicInputDto {
  /** Present for a topic that already exists (keeps its covered date). */
  @IsUUID()
  @IsOptional()
  id?: string;

  @trim()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  unit?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Matches(DATE, { message: 'plannedBy must be YYYY-MM-DD' })
  plannedBy: string;
}

export class SavePlanDto {
  /** The whole list in teaching order. */
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => TopicInputDto)
  topics: TopicInputDto[];
}

export class CopyPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  classIds: string[];

  /** Overwrite classes that already have a plan (their covered dates are lost). */
  @IsBoolean()
  @IsOptional()
  replace?: boolean;
}

export class CompleteTopicDto {
  /** The day it was taught; defaults to today (school time). */
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  @IsOptional()
  date?: string;
}

export class OverviewQueryDto {
  @IsUUID()
  @IsOptional()
  classId?: string;
}

export class ImportQueryDto {
  /** Replace plans that already exist for a class and subject in the file. */
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  replace?: boolean;
}
