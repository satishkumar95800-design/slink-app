import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { FeeRemindersService } from './fee-reminders.service';

export const FEE_REMINDERS_QUEUE = 'fee-reminders';

@Processor(FEE_REMINDERS_QUEUE)
export class FeeRemindersProcessor {
  private readonly logger = new Logger(FeeRemindersProcessor.name);

  constructor(private readonly feeReminders: FeeRemindersService) {}

  @Process('daily')
  async handleDaily(): Promise<void> {
    const { sent } = await this.feeReminders.sendDueReminders();
    this.logger.log(`Fee due reminders sent: ${sent}`);
  }
}
