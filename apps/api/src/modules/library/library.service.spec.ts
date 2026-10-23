/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { Prisma } from '@prisma/client';
import { LibraryService } from './library.service';

const T = 'tenant-1';
const ACTOR = 'librarian-1';
const D = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

function makePrisma() {
  const prisma: any = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    librarySettings: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    libraryBook: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    libraryCopy: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    libraryLoan: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'loan-1' }),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn().mockResolvedValue(loanRow()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    student: { count: jest.fn().mockResolvedValue(1) },
    user: { count: jest.fn().mockResolvedValue(1) },
    studentParent: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function loanRow() {
  return {
    id: 'loan-1',
    issuedOn: D('2026-10-01'),
    dueOn: D('2026-10-15'),
    returnedOn: null,
    fineAmount: new Prisma.Decimal(0),
    fineStatus: 'none',
    copy: {
      accessionNo: '12',
      book: { id: 'b1', title: 'Malgudi Days', author: 'R. K. Narayan' },
    },
    student: {
      id: 's1',
      name: 'Asha',
      admissionNo: 'A1',
      class: { name: '5', section: 'A' },
    },
    user: null,
  };
}

const freeCopy = {
  id: 'c1',
  status: 'available',
  book: { title: 'Malgudi Days' },
  loans: [],
};

describe('LibraryService', () => {
  let prisma: any;
  let service: LibraryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new LibraryService(prisma);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-20T06:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  describe('issue', () => {
    it('lends a free copy for the school loan period and logs it', async () => {
      prisma.libraryCopy.findUnique.mockResolvedValue(freeCopy);
      await service.issue(T, ACTOR, { accessionNo: '12', studentId: 's1' });
      expect(prisma.libraryLoan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 's1',
            issuedOn: D('2026-10-20'),
            dueOn: D('2026-11-03'),
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'library.issued' }),
        }),
      );
    });

    it('needs exactly one borrower', async () => {
      await expect(
        service.issue(T, ACTOR, { accessionNo: '12' }),
      ).rejects.toMatchObject({
        response: { code: 'BORROWER_REQUIRED' },
      });
      await expect(
        service.issue(T, ACTOR, {
          accessionNo: '12',
          studentId: 's1',
          userId: 'u1',
        }),
      ).rejects.toMatchObject({ response: { code: 'BORROWER_REQUIRED' } });
    });

    it('refuses a copy that is already out', async () => {
      prisma.libraryCopy.findUnique.mockResolvedValue({
        ...freeCopy,
        loans: [{ id: 'x' }],
      });
      await expect(
        service.issue(T, ACTOR, { accessionNo: '12', studentId: 's1' }),
      ).rejects.toMatchObject({
        response: { code: 'COPY_ON_LOAN' },
      });
    });

    it('refuses a lost or damaged copy', async () => {
      prisma.libraryCopy.findUnique.mockResolvedValue({
        ...freeCopy,
        status: 'lost',
      });
      await expect(
        service.issue(T, ACTOR, { accessionNo: '12', studentId: 's1' }),
      ).rejects.toMatchObject({
        response: { code: 'COPY_UNAVAILABLE' },
      });
    });

    it("stops at the borrower's limit", async () => {
      prisma.libraryCopy.findUnique.mockResolvedValue(freeCopy);
      prisma.libraryLoan.count.mockResolvedValue(2);
      await expect(
        service.issue(T, ACTOR, { accessionNo: '12', studentId: 's1' }),
      ).rejects.toMatchObject({
        response: { code: 'LOAN_LIMIT' },
      });
      expect(prisma.libraryLoan.create).not.toHaveBeenCalled();
    });

    it('refuses a student of another school', async () => {
      prisma.student.count.mockResolvedValue(0);
      await expect(
        service.issue(T, ACTOR, { accessionNo: '12', studentId: 's9' }),
      ).rejects.toMatchObject({
        response: { code: 'STUDENT_NOT_FOUND' },
      });
    });
  });

  describe('return', () => {
    it('fines every day late at the school rate', async () => {
      prisma.librarySettings.findUnique.mockResolvedValue({
        studentLoanDays: 14,
        staffLoanDays: 30,
        maxStudentBooks: 2,
        maxStaffBooks: 5,
        finePerDay: new Prisma.Decimal('2.50'),
      });
      prisma.libraryLoan.findFirst.mockResolvedValue({
        id: 'loan-1',
        dueOn: D('2026-10-15'),
      });
      await service.returnCopy(T, ACTOR, '12');
      expect(prisma.libraryLoan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            returnedOn: D('2026-10-20'),
            fineAmount: '12.50',
            fineStatus: 'due',
          }),
        }),
      );
    });

    it('charges nothing on time', async () => {
      prisma.libraryLoan.findFirst.mockResolvedValue({
        id: 'loan-1',
        dueOn: D('2026-10-25'),
      });
      await service.returnCopy(T, ACTOR, '12');
      expect(prisma.libraryLoan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fineAmount: '0.00',
            fineStatus: 'none',
          }),
        }),
      );
    });

    it('refuses a copy that is not out', async () => {
      prisma.libraryLoan.findFirst.mockResolvedValue(null);
      await expect(service.returnCopy(T, ACTOR, '12')).rejects.toMatchObject({
        response: { code: 'LOAN_NOT_FOUND' },
      });
    });
  });

  it("won't change a copy's status while it is lent out", async () => {
    prisma.libraryCopy.findFirst.mockResolvedValue({
      id: 'c1',
      accessionNo: '12',
      status: 'available',
      bookId: 'b1',
      loans: [{ id: 'l' }],
    });
    await expect(
      service.setCopyStatus(T, ACTOR, 'c1', 'lost'),
    ).rejects.toMatchObject({
      response: { code: 'COPY_ON_LOAN' },
    });
  });

  it("won't delete a book that has been lent", async () => {
    prisma.libraryBook.findFirst.mockResolvedValue({ id: 'b1', title: 'X' });
    prisma.libraryLoan.count.mockResolvedValue(3);
    await expect(service.deleteBook(T, ACTOR, 'b1')).rejects.toMatchObject({
      response: { code: 'BOOK_HAS_LOANS' },
    });
  });

  describe('parent view', () => {
    it("refuses a child that isn't the parent's", async () => {
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(service.child(T, 'parent-1', 's1')).rejects.toMatchObject({
        response: { code: 'STUDENT_NOT_FOUND' },
      });
      expect(prisma.studentParent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 's1',
            parentId: 'parent-1',
            student: { tenantId: T },
          },
        }),
      );
    });

    it("shows the child's books without borrower details", async () => {
      prisma.studentParent.findFirst.mockResolvedValue({ studentId: 's1' });
      prisma.libraryLoan.findMany = jest
        .fn()
        .mockResolvedValueOnce([loanRow()])
        .mockResolvedValueOnce([]);
      const r = await service.child(T, 'parent-1', 's1');
      expect(r.open).toEqual([
        expect.objectContaining({
          title: 'Malgudi Days',
          dueOn: '2026-10-15',
          daysLate: 5,
          fineAmount: null,
        }),
      ]);
      expect(r.open[0]).not.toHaveProperty('borrower');
    });
  });
});
