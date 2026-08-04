import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashed_password'),
  compare: jest.fn(),
}));

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid',
  tenantId: 'tenant-uuid',
  name: 'Alice Teacher',
  email: 'alice@school.com',
  phone: null,
  role: Role.teacher,
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { linkedStudents: 0 },
  ...overrides,
});

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
  },
  report: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Alice Teacher',
      email: 'alice@school.com',
      password: 'password123',
      role: Role.teacher,
    };

    it('hashes password and creates user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // email not taken
      mockPrisma.user.create.mockResolvedValue(makeUser());

      const result = await service.create('tenant-uuid', dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'alice@school.com',
            passwordHash: '$2b$12$hashed_password',
            isVerified: true,
          }),
        }),
      );
      expect(result.email).toBe('alice@school.com');
    });

    it('throws ConflictException when email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.create('tenant-uuid', dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated users', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeUser()], 1]);

      const result = await service.findAll('tenant-uuid', {});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('applies role filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll('tenant-uuid', { role: Role.admin });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies search filter across name, email, phone', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeUser()], 1]);

      await service.findAll('tenant-uuid', { search: 'alice' });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.findById('tenant-uuid', 'user-uuid');
      expect(result.id).toBe('user-uuid');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('tenant-uuid', 'bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates allowed fields', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-uuid', role: Role.teacher }) // requireUser
        .mockResolvedValueOnce(null); // email uniqueness check
      mockPrisma.user.update.mockResolvedValue(makeUser({ name: 'Bob' }));

      await service.update('tenant-uuid', 'user-uuid', { name: 'Bob', email: 'new@school.com' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Bob', email: 'new@school.com' }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('tenant-uuid', 'bad-uuid', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new email is taken by another user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-uuid', role: Role.teacher }) // requireUser
        .mockResolvedValueOnce(makeUser({ id: 'other-uuid' })); // email taken

      await expect(
        service.update('tenant-uuid', 'user-uuid', { email: 'taken@school.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a user with no reports', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', role: Role.accounts });
      mockPrisma.user.delete.mockResolvedValue({});

      await service.remove('tenant-uuid', 'user-uuid');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-uuid' } });
      expect(mockPrisma.report.count).not.toHaveBeenCalled();
    });

    it('blocks teacher deletion when they have reports', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', role: Role.teacher });
      mockPrisma.report.count.mockResolvedValue(5);

      await expect(service.remove('tenant-uuid', 'user-uuid')).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes teacher who has no reports', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', role: Role.teacher });
      mockPrisma.report.count.mockResolvedValue(0);
      mockPrisma.user.delete.mockResolvedValue({});

      await service.remove('tenant-uuid', 'user-uuid');

      expect(mockPrisma.user.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('tenant-uuid', 'bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('hashes new password, updates user, revokes all refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', role: Role.teacher });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.resetPassword('tenant-uuid', 'user-uuid', { newPassword: 'newPass123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newPass123', 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: '$2b$12$hashed_password' } }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
    });

    it('throws BadRequestException for parent users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid', role: Role.parent });

      await expect(
        service.resetPassword('tenant-uuid', 'user-uuid', { newPassword: 'newPass123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getMe ─────────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('returns own profile', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());

      const result = await service.getMe('user-uuid');
      expect(result.id).toBe('user-uuid');
    });
  });

  // ── updateMe ──────────────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('updates own name', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // no email uniqueness conflict
      mockPrisma.user.update.mockResolvedValue(makeUser({ name: 'Alice Updated' }));

      await service.updateMe('user-uuid', 'tenant-uuid', { name: 'Alice Updated' });

      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.name).toBe('Alice Updated');
    });

    it('throws ConflictException when new email is taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'other-uuid' }));

      await expect(
        service.updateMe('user-uuid', 'tenant-uuid', { email: 'taken@school.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const dto = { currentPassword: 'oldPass123', newPassword: 'newPass456' };

    it('verifies current password and stores new hash', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-uuid',
        role: Role.teacher,
        passwordHash: '$2b$12$existing_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      await service.changePassword('user-uuid', dto);

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPass123', '$2b$12$existing_hash');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPass456', 12);
    });

    it('throws UnauthorizedException when current password is wrong', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-uuid',
        role: Role.teacher,
        passwordHash: '$2b$12$existing_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('user-uuid', dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException for parent users', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-uuid',
        role: Role.parent,
        passwordHash: null,
      });

      await expect(service.changePassword('user-uuid', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no password is set', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-uuid',
        role: Role.teacher,
        passwordHash: null,
      });

      await expect(service.changePassword('user-uuid', dto)).rejects.toThrow(BadRequestException);
    });
  });
});
