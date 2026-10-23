import { LibraryCopyStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
/** "" from an emptied form field means "none". */
const emptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' ? null : typeof value === 'string' ? value.trim() : value,
  );
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class BookInputDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @emptyToNull()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  author?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  isbn?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  publisher?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(60)
  @IsOptional()
  category?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(40)
  @IsOptional()
  language?: string | null;

  @emptyToNull()
  @IsString()
  @MaxLength(40)
  @IsOptional()
  shelf?: string | null;
}

/** New copies: their accession numbers, or a count to number automatically. */
export class AddCopiesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  accessionNos?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  count?: number;
}

export class CreateBookDto extends BookInputDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  accessionNos?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  @IsOptional()
  count?: number;
}

export class CopyStatusDto {
  @IsIn(Object.values(LibraryCopyStatus))
  status: LibraryCopyStatus;
}

export class BooksQueryDto {
  @trim()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
}

export class IssueDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  accessionNo: string;

  @IsUUID()
  @IsOptional()
  studentId?: string;

  /** A staff member of the school. */
  @IsUUID()
  @IsOptional()
  userId?: string;

  @Matches(YMD)
  @IsOptional()
  dueOn?: string;
}

export class ReturnDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  accessionNo: string;
}

export class FineActionDto {
  @IsIn(['paid', 'waived'])
  action: 'paid' | 'waived';
}

export class LoansQueryDto {
  @IsIn(['open', 'overdue', 'returned', 'fines'])
  @IsOptional()
  status?: 'open' | 'overdue' | 'returned' | 'fines';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
}

export class BorrowerQueryDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  search: string;
}

export class LibrarySettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  studentLoanDays: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  staffLoanDays: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxStudentBooks: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxStaffBooks: number;

  /** Rupees per day late, e.g. "2.00"; "0" for no fines. */
  @IsNumberString()
  @Matches(/^\d{1,6}(\.\d{1,2})?$/)
  finePerDay: string;
}
