import type { ExecutionContext } from '@nestjs/common';
import { FeatureGuard } from './feature.guard';

const contextFor = (tenantId: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ tenantId }) }),
  }) as unknown as ExecutionContext;

describe('FeatureGuard', () => {
  const prismaWith = (features: Record<string, unknown>) => ({
    tenant: { findUnique: jest.fn().mockResolvedValue({ features }) },
  });

  it('lets the request through when the school has the flag', async () => {
    const Guard = FeatureGuard('timetable');
    const guard = new Guard(prismaWith({ timetable: true }));
    await expect(guard.canActivate(contextFor('t1'))).resolves.toBe(true);
  });

  it('answers FEATURE_DISABLED when the flag is missing or off', async () => {
    const Guard = FeatureGuard('staffDocuments');
    for (const features of [{}, { staffDocuments: false }]) {
      const guard = new Guard(prismaWith(features));
      await expect(guard.canActivate(contextFor('t1'))).rejects.toMatchObject({
        response: { code: 'FEATURE_DISABLED' },
      });
    }
  });
});
