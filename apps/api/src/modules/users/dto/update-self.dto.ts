import { IsEmail, IsOptional, IsString } from 'class-validator';
import { CleanName } from '../../../common/decorators/clean-name.decorator';

export class UpdateSelfDto {
  @CleanName()
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
