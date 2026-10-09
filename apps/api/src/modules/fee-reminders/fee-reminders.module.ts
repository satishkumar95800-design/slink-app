import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeeRemindersService } from './fee-reminders.service';
import {
  FEE_REMINDERS_QUEUE,
  FeeRemindersProcessor,
} from './fee-reminders.processor';

/** 03:30 UTC = 09:00 IST, a sensible time for parents in the default timezone. */
const DAILY_CRON = '30 3 * * *';

@Module({
  imports: [
    BullModule.registerQueue({ name: FEE_REMINDERS_QUEUE }),
    NotificationsModule,
  ],
  providers: [FeeRemindersService, FeeRemindersProcessor],
})
export class FeeRemindersModule implements OnModuleInit {
  private readonly logger = new Logger(FeeRemindersModule.name);

  constructor(
    @InjectQueue(FEE_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Repeatable jobs are keyed by name + cron in Redis, so every API instance registering it still yields one daily run. */
  async onModuleInit() {
    try {
      await this.queue.add(
        'daily',
        {},
        {
          repeat: { cron: DAILY_CRON },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      this.logger.error(
        `Could not schedule fee reminders: ${(err as Error).message}`,
      );
    }
  }
}
