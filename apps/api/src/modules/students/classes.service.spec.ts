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
  teachers: [{ teacher: { id: TEACHER_ID, name: 'Teacher' } }],
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
    updateMany: jest.fn(),
  },
  report: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
  receipt: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
  attendanceRecord: { updateMany: jest.fn() },
  broadcast: { updateMany: jest.fn() },
  user: {
    findUnique: jest.fn(),
  },
  classTeacher: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  teacherSubject: { count: jest.fn().mockResolvedValue(0) },
  $transaction: jest.fn(),
};
// Interactive transactions run against the same mock.
mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
  fn(mockPrisma),
);

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
          where: {
            tenantId: TENANT,
            teachers: { some: { teacherId: TEACHER_ID } },
          },
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

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.update(TENANT, 'bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addTeacher / removeTeacher ────────────────────────────────────────────────

  describe('addTeacher', () => {
    it('assigns a co-teacher to a class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue(null);
      mockPrisma.classTeacher.create.mockResolvedValue({
        classId: CLASS_ID,
        teacherId: 'teacher-2',
      });

      await service.addTeacher(TENANT, CLASS_ID, { teacherId: 'teacher-2' });

      expect(mockPrisma.classTeacher.create).toHaveBeenCalledWith({
        data: {
          classId: CLASS_ID,
          teacherId: 'teacher-2',
          isClassTeacher: true,
        },
      });
    });

    it('replaces the current class teacher, keeping them as a co-teacher while they teach a subject here', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue(null);
      mockPrisma.classTeacher.findMany.mockResolvedValueOnce([
        { teacherId: 'teacher-1' },
      ]);
      mockPrisma.teacherSubject.count.mockResolvedValueOnce(1);

      await service.addTeacher(TENANT, CLASS_ID, {
        teacherId: 'teacher-2',
        isClassTeacher: true,
      });

      expect(mockPrisma.classTeacher.findMany).toHaveBeenCalledWith({
        where: {
          classId: CLASS_ID,
          isClassTeacher: true,
          teacherId: { not: 'teacher-2' },
        },
        select: { teacherId: true },
      });
      expect(mockPrisma.classTeacher.updateMany).toHaveBeenCalledWith({
        where: { classId: CLASS_ID, teacherId: 'teacher-1' },
        data: { isClassTeacher: false },
      });
      expect(mockPrisma.classTeacher.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.classTeacher.create).toHaveBeenCalled();
    });

    it('drops the replaced class teacher from the class when they teach no subject there', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue(null);
      mockPrisma.classTeacher.findMany.mockResolvedValueOnce([
        { teacherId: 'teacher-1' },
      ]);
      mockPrisma.teacherSubject.count.mockResolvedValueOnce(0);

      await service.addTeacher(TENANT, CLASS_ID, {
        teacherId: 'teacher-2',
        isClassTeacher: true,
      });

      expect(mockPrisma.classTeacher.deleteMany).toHaveBeenCalledWith({
        where: { classId: CLASS_ID, teacherId: 'teacher-1' },
      });
    });

    it('promotes an existing co-teacher instead of rejecting them', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClassTeacher: false,
      });

      await service.addTeacher(TENANT, CLASS_ID, { teacherId: TEACHER_ID });

      expect(mockPrisma.classTeacher.update).toHaveBeenCalledWith({
        where: {
          classId_teacherId: { classId: CLASS_ID, teacherId: TEACHER_ID },
        },
        data: { isClassTeacher: true },
      });
      expect(mockPrisma.classTeacher.create).not.toHaveBeenCalled();
    });

    it('adds a co-teacher without touching the class teacher', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue(null);

      await service.addTeacher(TENANT, CLASS_ID, {
        teacherId: 'teacher-3',
        isClassTeacher: false,
      });

      expect(mockPrisma.classTeacher.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when teacherId is not a teacher', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.admin });

      await expect(
        service.addTeacher(TENANT, CLASS_ID, { teacherId: 'admin-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when teacher is already assigned', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.teacher });
      mockPrisma.classTeacher.findUnique.mockResolvedValue({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClassTeacher: true,
      });

      await expect(
        service.addTeacher(TENANT, CLASS_ID, { teacherId: TEACHER_ID }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeTeacher', () => {
    it('removes a teacher from a class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.classTeacher.findUnique.mockResolvedValue({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
      });
      mockPrisma.teacherSubject.count.mockResolvedValueOnce(0);

      await service.removeTeacher(TENANT, CLASS_ID, TEACHER_ID);

      expect(mockPrisma.classTeacher.deleteMany).toHaveBeenCalledWith({
        where: { classId: CLASS_ID, teacherId: TEACHER_ID },
      });
    });

    it('keeps a removed class teacher as a co-teacher while they teach a subject there', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.classTeacher.findUnique.mockResolvedValue({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClassTeacher: true,
      });
      mockPrisma.teacherSubject.count.mockResolvedValueOnce(2);

      await service.removeTeacher(TENANT, CLASS_ID, TEACHER_ID);

      expect(mockPrisma.classTeacher.updateMany).toHaveBeenCalledWith({
        where: { classId: CLASS_ID, teacherId: TEACHER_ID },
        data: { isClassTeacher: false },
      });
      expect(mockPrisma.classTeacher.deleteMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the teacher is not assigned to the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.classTeacher.findUnique.mockResolvedValue(null);

      await expect(
        service.removeTeacher(TENANT, CLASS_ID, 'not-assigned'),
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

    it('refuses a class that still has reports or receipts', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.student.count.mockResolvedValue(0);
      mockPrisma.report.count.mockResolvedValueOnce(2);

      await expect(service.remove(TENANT, CLASS_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.class.delete).not.toHaveBeenCalled();
    });

    it('moves students and their history to another class, then deletes', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown[]) =>
        Promise.all(ops),
      );

      await service.remove(TENANT, CLASS_ID, 'class-target');

      const move = {
        where: { tenantId: TENANT, classId: CLASS_ID },
        data: { classId: 'class-target' },
      };
      expect(mockPrisma.student.updateMany).toHaveBeenCalledWith(move);
      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith(move);
      expect(mockPrisma.receipt.updateMany).toHaveBeenCalledWith(move);
      expect(mockPrisma.attendanceRecord.updateMany).toHaveBeenCalledWith(move);
      expect(mockPrisma.class.delete).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
      });
    });

    it('will not move a class into itself', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(baseClass);
      await expect(service.remove(TENANT, CLASS_ID, CLASS_ID)).rejects.toThrow(
        'different class',
      );
    });
  });
});
