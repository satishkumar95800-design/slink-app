import { ImportsProcessor } from './imports.processor';
import type { ImportsService } from './imports.service';
import type { Job } from 'bull';
import type { ImportJobQueuePayload } from './types';

function makeJob(data: ImportJobQueuePayload): Job<ImportJobQueuePayload> {
  return { data } as Job<ImportJobQueuePayload>;
}

describe('ImportsProcessor', () => {
  it('decodes the base64 payload and delegates to ImportsService.processQueuedJob', async () => {
    const processQueuedJob = jest.fn().mockResolvedValue(undefined);
    const processor = new ImportsProcessor({
      processQueuedJob,
    } as unknown as ImportsService);

    const buffer = Buffer.from('fake xlsx bytes');
    const job = makeJob({
      importJobId: 'job-1',
      tenantId: 'tenant-1',
      fileBase64: buffer.toString('base64'),
    });

    await processor.handleCommit(job);

    expect(processQueuedJob).toHaveBeenCalledWith('job-1', 'tenant-1', buffer);
  });

  it('rethrows so Bull marks the job failed', async () => {
    const processQueuedJob = jest
      .fn()
      .mockRejectedValue(new Error('db unreachable'));
    const processor = new ImportsProcessor({
      processQueuedJob,
    } as unknown as ImportsService);

    const job = makeJob({
      importJobId: 'job-1',
      tenantId: 'tenant-1',
      fileBase64: Buffer.from('x').toString('base64'),
    });

    await expect(processor.handleCommit(job)).rejects.toThrow('db unreachable');
  });
});
