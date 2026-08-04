import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';

const mockUser = {
  id: 'user-uuid',
  tenantId: 'tenant-uuid',
  phone: '+911234567890',
  email: null,
  name: 'Test Parent',
  role: Role.parent,
  passwordHash: null,
  fcmTokens: [],
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const firebaseMock = {
  verifyIdToken: jest.fn(),
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

const configMock = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
    };
    return map[key];
  }),
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FirebaseAdminService, useValue: firebaseMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('verifyPhoneOtp', () => {
    it('creates a new user on first login and returns tokens', async () => {
      firebaseMock.verifyIdToken.mockResolvedValue({ phone_number: '+911234567890' });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockUser);
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyPhoneOtp('tenant-uuid', {
        firebaseIdToken: 'firebase.id.token',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+911234567890', role: Role.parent }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns tokens for existing verified user without re-creating', async () => {
      firebaseMock.verifyIdToken.mockResolvedValue({ phone_number: '+911234567890' });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.refreshToken.create.mockResolvedValue({});

      await service.verifyPhoneOtp('tenant-uuid', { firebaseIdToken: 'firebase.id.token' });

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('marks an unverified existing user as verified', async () => {
      const unverifiedUser = { ...mockUser, isVerified: false };
      firebaseMock.verifyIdToken.mockResolvedValue({ phone_number: '+911234567890' });
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser);
      prismaMock.user.update.mockResolvedValue({ ...unverifiedUser, isVerified: true });
      prismaMock.refreshToken.create.mockResolvedValue({});

      await service.verifyPhoneOtp('tenant-uuid', { firebaseIdToken: 'firebase.id.token' });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isVerified: true } }),
      );
    });

    it('throws UnauthorizedException when Firebase token is invalid', async () => {
      firebaseMock.verifyIdToken.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.verifyPhoneOtp('tenant-uuid', { firebaseIdToken: 'bad.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Firebase token has no phone number', async () => {
      firebaseMock.verifyIdToken.mockResolvedValue({ phone_number: undefined });

      await expect(
        service.verifyPhoneOtp('tenant-uuid', { firebaseIdToken: 'no-phone.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('emailLogin', () => {
    const teacherUser = {
      ...mockUser,
      role: Role.teacher,
      email: 'teacher@school.com',
      phone: null,
      passwordHash: '$2b$12$hashed',
    };

    it('throws ForbiddenException if a parent tries email login', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.emailLogin('tenant-uuid', { email: 'parent@x.com', password: 'password1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.emailLogin('tenant-uuid', { email: 'nobody@x.com', password: 'password1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(teacherUser);
      // bcrypt.compare will return false for a non-matching hash
      // The real hash won't match 'wrongpassword'
      await expect(
        service.emailLogin('tenant-uuid', {
          email: 'teacher@school.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const storedToken = {
      id: 'token-id',
      tokenHash: 'some-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      deviceId: null,
      user: mockUser,
    };

    it('revokes old token and issues new tokens', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(storedToken);
      prismaMock.refreshToken.update.mockResolvedValue({});
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-uuid-refresh-token');

      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(result.accessToken).toBeTruthy();
    });

    it('throws UnauthorizedException for revoked token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token not found', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-refresh-token');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
    });
  });

  describe('logoutAll', () => {
    it('revokes all refresh tokens for a user', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logoutAll('user-uuid');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
