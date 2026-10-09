import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Role } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const TENANT_ID = 'tenant-uuid';
const ADMIN: ActiveUser = {
  id: 'admin-1',
  name: 'Admin',
  role: Role.admin,
  tenantId: TENANT_ID,
} as ActiveUser;

const mockPrisma = {
  receipt: { findMany: jest.fn(), count: jest.fn() },
  paymentClaim: { findMany: jest.fn() },
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

const receipt = (id: string, method: PaymentMethod) => ({
  id,
  amount: '1000.00',
  method,
  paidOn: new Date('2026-10-01'),
  student: { name: `Student ${id}` },
});

describe('ReceiptsService.getRecent', () => {
  let service: ReceiptsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();
    service = module.get(ReceiptsService);
  });

  it('marks receipts produced by an approved payment claim as source "claim"', async () => {
    mockPrisma.receipt.findMany.mockResolvedValue([
      receipt('r1', PaymentMethod.cash),
      receipt('r2', PaymentMethod.bank_transfer),
    ]);
    mockPrisma.receipt.count.mockResolvedValue(2);
    mockPrisma.paymentClaim.findMany.mockResolvedValue([{ receiptId: 'r2' }]);

    const rows = await service.getRecent(TENANT_ID, ADMIN, 5);

    expect(mockPrisma.paymentClaim.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, receiptId: { in: ['r1', 'r2'] } },
      select: { receiptId: true },
    });
    expect(rows.map((r) => [r.id, r.method, r.source])).toEqual([
      ['r1', PaymentMethod.cash, 'direct'],
      ['r2', PaymentMethod.bank_transfer, 'claim'],
    ]);
  });
});
