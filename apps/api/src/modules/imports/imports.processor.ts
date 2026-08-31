import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ImportsService } from './imports.service';
import type { ImportJobQueuePayload } from './types';

@Processor('imports')
export class ImportsProcessor {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(private readonly importsService: ImportsService) {}

  @Process('commit')
  async handleCommit(job: Job<ImportJobQueuePayload>): Promise<void> {
    const { importJobId, tenantId, fileBase64 } = job.data;
    const buffer = Buffer.from(fileBase64, 'base64');

    try {
      await this.importsService.processQueuedJob(importJobId, tenantId, buffer);
    } catch (err) {
      this.logger.error(
        `Import job ${importJobId} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw err;
    }
  }
}
