import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { migrationStatus } from '../../migrations-runner';

@Controller('health')
export class HealthController {
  /**
   * "migrations.state" is "ok" when the database has every migration this
   * build ships; "behind" lists what's missing or failed (see migrations-runner.ts).
   * Names only — nothing sensitive.
   */
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      migrations: {
        state: migrationStatus.state,
        missing: migrationStatus.missing,
        failed: migrationStatus.failed,
        checkedAt: migrationStatus.checkedAt ?? null,
      },
    };
  }
}
