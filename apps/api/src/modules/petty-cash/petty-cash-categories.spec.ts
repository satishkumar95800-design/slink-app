import { PettyCashService } from './petty-cash.service';
import { DEFAULT_CATEGORIES } from './petty-cash.strings';

const TENANT = 'tenant-a';

function setup(existing: number) {
  const prisma = {
    pettyCashSetting: {
      // Marked as seeded, as on a school whose defaults went missing.
      findUnique: jest.fn().mockResolvedValue({
        tenantId: TENANT,
        approvalThreshold: '2000',
        monthlyBudget: null,
        receiptRequiredAbove: '500',
        overdueDays: 7,
        categoriesSeeded: true,
      }),
    },
    pettyCashCategory: {
      count: jest.fn().mockResolvedValue(existing),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return {
    prisma,
    service: new PettyCashService(prisma as never, {} as never),
  };
}

describe('PettyCashService categories', () => {
  it('recreates the defaults for a school with no categories at all', async () => {
    const { prisma, service } = setup(0);
    await service.listCategories(TENANT, true);
    expect(prisma.pettyCashCategory.createMany).toHaveBeenCalledWith({
      data: DEFAULT_CATEGORIES.map((name) => ({ tenantId: TENANT, name })),
      skipDuplicates: true,
    });
  });

  it('leaves a school that has categories alone', async () => {
    const { prisma, service } = setup(3);
    await service.listCategories(TENANT, true);
    expect(prisma.pettyCashCategory.createMany).not.toHaveBeenCalled();
  });
});
