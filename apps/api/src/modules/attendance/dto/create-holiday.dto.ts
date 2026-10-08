import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DATE_PATTERN } from './attendance-query.dto';

export class CreateHolidayDto {
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
