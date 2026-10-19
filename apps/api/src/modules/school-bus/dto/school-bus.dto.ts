import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
/** "" from an emptied form field means "none". */
const emptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' ? null : typeof value === 'string' ? value.trim() : value,
  );

export class StopInputDto {
  /** Present for a stop that already exists (keeps its students). */
  @IsUUID()
  @IsOptional()
  id?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @emptyToNull()
  @Matches(HHMM, { message: 'pickupTime must be HH:MM' })
  @IsOptional()
  pickupTime?: string | null;

  @emptyToNull()
  @Matches(HHMM, { message: 'dropTime must be HH:MM' })
  @IsOptional()
  dropTime?: string | null;
}

export class RouteInputDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @emptyToNull()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  vehicleNumber?: string | null;

  /** A ground-staff payee (petty cash "Vendors & ground staff"). */
  @emptyToNull()
  @IsUUID()
  @IsOptional()
  driverId?: string | null;

  @emptyToNull()
  @IsUUID()
  @IsOptional()
  attendantId?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string | null;

  /** In pick-up order. */
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => StopInputDto)
  stops: StopInputDto[];
}

export class AssignStudentsDto {
  @IsUUID()
  routeId: string;

  @emptyToNull()
  @IsUUID()
  @IsOptional()
  stopId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  studentIds: string[];
}

export class UnassignStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  studentIds: string[];
}

export class StudentsQueryDto {
  @IsUUID()
  classId: string;
}
