import { IsString, MinLength } from 'class-validator';

export class PurgeTenantDto {
  /** Caller must echo the tenant's current slug back to confirm irreversible deletion. */
  @IsString()
  @MinLength(1)
  confirmSlug: string;
}
