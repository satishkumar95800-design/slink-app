import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClassesService } from './classes.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const TENANT = 'tenant-uuid';
const CLASS_ID = 'class-uuid';
const TEACHER_ID = 'teacher-uuid';

const makeUser = (role: Role, id = 'user-uuid'): ActiveUser => ({
  id,
  tenantId: TENANT,
  role,
  name: 'Test User',
  isVerified: true,
});

const baseClass = {
  id: CLASS_ID,
  tenantId: TENANT,
  name: 'Grade 5',
  academicYear: '2025-26',
  teacherId: TEACHER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { students: 10 },
};

const mockPrisma = {
  class: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  student: {
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('ClassesService', () => {
  let service: ClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
    jest.clearAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('admin sees all classes in tenant', async () => {
      mockPrisma.class.findMany.mockResolvedValue([baseClass]);

      const result = await service.findAll(TENANT, makeUser(Role.admin));

      expect(mockPrisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
      expect(result).toHaveLength(1);
    });

    it('teacher sees only their assigned classes', async () => {
      mockPrisma.class.findMany.mockResolvedValue([baseClass]);

      await service.findAll(TENANT, makeUser(Role.teacher, TEACHER_ID));

      expect(mockPrisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, teacherId: TEACHER_ID },
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('admin can view any class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);

      const result = await service.findOne(
        TENANT,
        CLASS_ID,
        makeUser(Role.admin),
      );
      expect(result.id).toBe(CLASS_ID);
    });

    it('teacher can view their own class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);

      const result = await service.findOne(
        TENANT,
        CLASS_ID,
        makeUser(Role.teacher, TEACHER_ID),
      );
      expect(result.id).toBe(CLASS_ID);
    });

    it('teacher cannot view a class they are not assigned to', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);

      await expect(
        service.findOne(
          TENANT,
          CLASS_ID,
          makeUser(Role.teacher, 'other-teacher'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT, 'bad-id', makeUser(Role.admin)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a class successfully', async () => {
      mockPrisma.class.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.class.create.mockResolvedValue(baseClass);

      const result = await service.create(TENANT, {
        name: 'Grade 5',
        academicYear: '2025-26',
      });
      expect(result.name).toBe('Grade 5');
    });

    it('throws ConflictException when name+section+academicYear already exists', async () => {
      mockPrisma.class.findFirst.mockResolvedValue(baseClass);

      await expect(
        service.create(TENANT, { name: 'Grade 5', academicYear: '2025-26' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.class.create).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates class name', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.class.update.mockResolvedValue({
        ...baseClass,
        name: 'Grade 6',
      });

      const result = await service.update(TENANT, CLASS_ID, {
        name: 'Grade 6',
      });
      expect(result.name).toBe('Grade 6');
    });

    it('validates teacherId belongs to a teacher in the tenant', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.class.update.mockResolvedValue({
        ...baseClass,
        teacherId: TEACHER_ID,
      });

      await service.update(TENANT, CLASS_ID, { teacherId: TEACHER_ID });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEACHER_ID, tenantId: TENANT },
        }),
      );
    });

    it('throws NotFoundException when teacherId is not a teacher', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.admin }); // wrong role

      await expect(
        service.update(TENANT, CLASS_ID, { teacherId: 'admin-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when teacherId user does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(TENANT, CLASS_ID, { teacherId: 'bad-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.update(TENANT, 'bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a class with no students', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.student.count.mockResolvedValue(0);
      mockPrisma.class.delete.mockResolvedValue({});

      await service.remove(TENANT, CLASS_ID);
      expect(mockPrisma.class.delete).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
      });
    });

    it('throws ConflictException when students are still assigned to the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.student.count.mockResolvedValue(3);

      await expect(service.remove(TENANT, CLASS_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.class.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(service.remove(TENANT, 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
