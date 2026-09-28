import { IsUUID } from 'class-validator';

export class TimetableQueryDto {
  @IsUUID()
  classId: string;
}
