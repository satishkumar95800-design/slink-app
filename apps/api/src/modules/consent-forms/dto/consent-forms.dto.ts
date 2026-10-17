import { ConsentDecision } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CleanName } from '../../../common/decorators/clean-name.decorator';
import { DATE_PATTERN } from '../../calendar/dto/calendar.dto';

export class CreateConsentFormDto {
  @IsUUID()
  eventId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  classIds: string[];

  /** The consent wording parents agree to. */
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  body: string;

  /** Last day parents can sign, YYYY-MM-DD (school-local, inclusive). */
  @Matches(DATE_PATTERN, { message: 'deadline must be YYYY-MM-DD' })
  deadline: string;
}

export class ConsentFormQueryDto {
  @IsUUID()
  @IsOptional()
  eventId?: string;
}

export class RespondConsentDto {
  @IsUUID()
  studentId: string;

  @IsEnum(ConsentDecision)
  decision: ConsentDecision;

  /** The parent's full name, typed as their signature. */
  @CleanName()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  signedName: string;

  /** Must be true: "I am this student's parent or guardian and I confirm this answer." */
  @Equals(true)
  confirm: boolean;

  /** Optional message to the school (e.g. allergies, pickup arrangements). */
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
