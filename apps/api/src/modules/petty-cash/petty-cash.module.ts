import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PettyCashController } from './petty-cash.controller';
import { PettyCashFeatureGuard } from './petty-cash-feature.guard';
import { PettyCashForecastService } from './petty-cash-forecast.service';
import { PettyCashService } from './petty-cash.service';

@Module({
  imports: [FilesModule],
  controllers: [PettyCashController],
  providers: [
    PettyCashService,
    PettyCashForecastService,
    PettyCashFeatureGuard,
  ],
})
export class PettyCashModule {}
