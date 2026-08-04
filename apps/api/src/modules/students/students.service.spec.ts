import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Role, GuardianRelation } from '@prisma/client';
import { StudentsService } from './students.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT = 'tenant-uuid';
const CLASS_ID = 'class-uuid';
const STUDENT_ID = 'student-uuid';
const PARENT_ID = 'parent-uuid';
const TEACHER_ID = 'teacher-uuid';

const makeUser = (role: Role, id = 'user-uuid'): ActiveUser => ({
  id,
  tenantId: TENANT,
  role,
  name: 'Test User',
  isVerified: true,
});

const baseStudent = {
  id: STUDENT_ID,
  tenantId: TENANT,
  name: 'Alice',
  admissionNo: '2024001',
  dob: null,
  classId: CLASS_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  class: { id: CLASS_ID, name: 'Grade 5', academicYear: '2025-26' },
  parents: [{ relation: GuardianRelation.mother, isPrimary: true, parent: { id: PARENT_ID, name: 'Jane', phone: '+911234567890' } }],
};

const prismaMock = {
  student: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  studentParent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  class: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((args: unknown[]) => Promise.all(args)),
};

describe('StudentsService', () => {
  let service: StudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('admin sees all students in tenant', async () => {
      prismaMock.student.findMany.mockResolvedValue([baseStudent]);
      prismaMock.student.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT, makeUser(Role.admin), {});

      expect(prismaMock.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('parent query includes student_parents filter scoped to their own id', async () => {
      prismaMock.student.findMany.mockResolvedValue([baseStudent]);
      prismaMock.student.count.mockResolvedValue(1);

      await service.findAll(TENANT, makeUser(Role.parent, PARENT_ID), {});

      expect(prismaMock.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parents: { some: { parentId: PARENT_ID } },
          }),
        }),
      );
    });

    it('teacher query is scoped to their assigned class(es)', async () => {
      prismaMock.class.findMany.mockResolvedValue([{ id: CLASS_ID }]);
      prismaMock.student.findMany.mockResolvedValue([baseStudent]);
      prismaMock.student.count.mockResolvedValue(1);

      await service.findAll(TENANT, makeUser(Role.teacher, TEACHER_ID), {});

      expect(prismaMock.class.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, teacherId: TEACHER_ID },
        select: { id: true },
      });
      expect(prismaMock.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ classId: { in: [CLASS_ID] } }),
        }),
      );
    });

    it('parent response only includes their own parent entry', async () => {
      const otherParent = { relation: GuardianRelation.father, isPrimary: false, parent: { id: 'other-parent', name: 'John', phone: '+910000000000' } };
      const studentWithTwoParents = { ...baseStudent, parents: [baseStudent.parents[0], otherParent] };

      prismaMock.student.findMany.mockResolvedValue([studentWithTwoParents]);
      prismaMock.student.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT, makeUser(Role.parent, PARENT_ID), {});

      expect(result.data[0].parents).toHaveLength(1);
      expect(result.data[0].parents[0].parent.id).toBe(PARENT_ID);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('admin can access any student in the tenant', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);

      const result = await service.findOne(TENANT, STUDENT_ID, makeUser(Role.admin));
      expect(result.id).toBe(STUDENT_ID);
    });

    it('parent can access their own linked child', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);

      const result = await service.findOne(TENANT, STUDENT_ID, makeUser(Role.parent, PARENT_ID));
      expect(result.id).toBe(STUDENT_ID);
    });

    it('parent cannot access a student they are not linked to', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);

      await expect(
        service.findOne(TENANT, STUDENT_ID, makeUser(Role.parent, 'other-parent-id')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('teacher can access a student in their class', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.class.findUnique.mockResolvedValue({ teacherId: TEACHER_ID });

      const result = await service.findOne(TENANT, STUDENT_ID, makeUser(Role.teacher, TEACHER_ID));
      expect(result.id).toBe(STUDENT_ID);
    });

    it('teacher cannot access a student not in their class', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.class.findUnique.mockResolvedValue({ teacherId: 'other-teacher' });

      await expect(
        service.findOne(TENANT, STUDENT_ID, makeUser(Role.teacher, TEACHER_ID)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown student', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT, 'unknown-uuid', makeUser(Role.admin)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      prismaMock.class.findUnique.mockResolvedValue({ id: CLASS_ID });
      prismaMock.student.findUnique.mockResolvedValue(null); // no duplicate
      prismaMock.student.create.mockResolvedValue(baseStudent);
      prismaMock.student.findUniqueOrThrow.mockResolvedValue(baseStudent);
    });

    it('creates a student without parent linkage when parentPhone is omitted', async () => {
      const result = await service.create(TENANT, {
        name: 'Alice',
        admissionNo: '2024001',
        classId: CLASS_ID,
      });
      expect(prismaMock.student.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.studentParent.create).not.toHaveBeenCalled();
      expect(result.id).toBe(STUDENT_ID);
    });

    it('creates a student and links an existing parent by phone', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: PARENT_ID, role: Role.parent });
      prismaMock.studentParent.findUnique.mockResolvedValue(null);
      prismaMock.studentParent.create.mockResolvedValue({});

      await service.create(TENANT, {
        name: 'Alice',
        admissionNo: '2024001',
        classId: CLASS_ID,
        parentPhone: '+911234567890',
      });

      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.studentParent.create).toHaveBeenCalledTimes(1);
    });

    it('creates an unverified parent user when the phone number is not yet registered', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'new-parent-uuid', role: Role.parent });
      prismaMock.studentParent.findUnique.mockResolvedValue(null);
      prismaMock.studentParent.create.mockResolvedValue({});

      await service.create(TENANT, {
        name: 'Bob',
        admissionNo: '2024002',
        classId: CLASS_ID,
        parentPhone: '+919999999999',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+919999999999', isVerified: false }),
        }),
      );
    });

    it('throws ConflictException for duplicate admission number', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent); // already exists

      await expect(
        service.create(TENANT, { name: 'Alice', admissionNo: '2024001', classId: CLASS_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when classId does not exist in tenant', async () => {
      prismaMock.class.findUnique.mockResolvedValue(null);

      await expect(
        service.create(TENANT, { name: 'Alice', admissionNo: '2024001', classId: 'bad-class' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates allowed fields', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.student.update.mockResolvedValue({ ...baseStudent, name: 'Alice Updated' });

      const result = await service.update(TENANT, STUDENT_ID, { name: 'Alice Updated' });
      expect(result.name).toBe('Alice Updated');
    });

    it('throws NotFoundException when student does not exist', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(service.update(TENANT, 'bad-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes an existing student', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.student.delete.mockResolvedValue(baseStudent);

      await service.remove(TENANT, STUDENT_ID);
      expect(prismaMock.student.delete).toHaveBeenCalledWith({ where: { id: STUDENT_ID } });
    });

    it('throws NotFoundException for unknown student', async () => {
      prismaMock.student.findUnique.mockResolvedValue(null);

      await expect(service.remove(TENANT, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── linkParent ───────────────────────────────────────────────────────────

  describe('linkParent', () => {
    it('links an existing parent user by phone', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.user.findUnique.mockResolvedValue({ id: PARENT_ID, role: Role.parent });
      prismaMock.studentParent.findUnique.mockResolvedValue(null);
      prismaMock.studentParent.create.mockResolvedValue({});

      await service.linkParent(TENANT, STUDENT_ID, { parentPhone: '+911234567890' });

      expect(prismaMock.studentParent.create).toHaveBeenCalledTimes(1);
    });

    it('creates unverified parent user if phone not found, then links', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'new-id', role: Role.parent });
      prismaMock.studentParent.findUnique.mockResolvedValue(null);
      prismaMock.studentParent.create.mockResolvedValue({});

      await service.linkParent(TENANT, STUDENT_ID, { parentPhone: '+919876543210' });

      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.studentParent.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException if parent already linked', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.user.findUnique.mockResolvedValue({ id: PARENT_ID });
      prismaMock.studentParent.findUnique.mockResolvedValue({ studentId: STUDENT_ID, parentId: PARENT_ID });

      await expect(
        service.linkParent(TENANT, STUDENT_ID, { parentPhone: '+911234567890' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── unlinkParent ─────────────────────────────────────────────────────────

  describe('unlinkParent', () => {
    it('removes the parent link', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.studentParent.findUnique.mockResolvedValue({ studentId: STUDENT_ID, parentId: PARENT_ID });
      prismaMock.studentParent.delete.mockResolvedValue({});

      await service.unlinkParent(TENANT, STUDENT_ID, PARENT_ID);
      expect(prismaMock.studentParent.delete).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when link does not exist', async () => {
      prismaMock.student.findUnique.mockResolvedValue(baseStudent);
      prismaMock.studentParent.findUnique.mockResolvedValue(null);

      await expect(service.unlinkParent(TENANT, STUDENT_ID, 'bad-parent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
