import { NotFoundException } from '@nestjs/common';
import { TeachersService } from './teachers.service';

describe('TeachersService.addSubjects', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    subject: { findUnique: jest.fn() },
    class: { findMany: jest.fn() },
    teacherSubject: { createMany: jest.fn() },
    classTeacher: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new TeachersService(prisma as never);
  const dto = { subjectId: 'subject-science', classIds: ['class-1', 'class-2'] };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'teacher' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-science' });
    prisma.class.findMany.mockResolvedValue([{ id: 'class-1' }, { id: 'class-2' }]);
    prisma.teacherSubject.createMany.mockResolvedValue({ count: 2 });
    prisma.classTeacher.createMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
  });

  it('assigns the subject in every chosen class, skipping ones already taught', async () => {
    const result = await service.addSubjects('tenant-a', 'teacher-1', dto);

    expect(prisma.teacherSubject.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: 'tenant-a', teacherId: 'teacher-1', subjectId: 'subject-science', classId: 'class-1' },
        { tenantId: 'tenant-a', teacherId: 'teacher-1', subjectId: 'subject-science', classId: 'class-2' },
      ],
      skipDuplicates: true,
    });
    expect(prisma.classTeacher.createMany).toHaveBeenCalledWith({
      data: [
        { classId: 'class-1', teacherId: 'teacher-1', isClassTeacher: false },
        { classId: 'class-2', teacherId: 'teacher-1', isClassTeacher: false },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ added: 2 });
  });

  it('refuses the whole request when any class is not in this school', async () => {
    prisma.class.findMany.mockResolvedValue([{ id: 'class-1' }]);

    await expect(service.addSubjects('tenant-a', 'teacher-1', dto)).rejects.toThrow(NotFoundException);
    expect(prisma.teacherSubject.createMany).not.toHaveBeenCalled();
  });
});
