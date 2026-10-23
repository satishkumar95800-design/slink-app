import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LibraryCopyStatus,
  LibraryFineStatus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  fromDbDate,
  isValidYmd,
  todayIn,
  toDbDate,
} from '../attendance/attendance-dates';
import { fromPaise, toPaise } from '../petty-cash/petty-cash.math';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddCopiesDto,
  BookInputDto,
  BooksQueryDto,
  CreateBookDto,
  IssueDto,
  LibrarySettingsDto,
  LoansQueryDto,
} from './dto/library.dto';
import {
  addDays,
  daysLate,
  finePaise,
  nextAccessionNumbers,
} from './library.math';

type Db = PrismaService | Prisma.TransactionClient;

const err = (code: string, message: string) => ({ code, message });
const PAGE = 50;

/** Staff who can borrow books (anyone working at the school with a login). */
export const STAFF_BORROWER_ROLES: Role[] = [
  Role.teacher,
  Role.admin,
  Role.accounts,
  Role.librarian,
  Role.receptionist,
];

const DEFAULTS = {
  studentLoanDays: 14,
  staffLoanDays: 30,
  maxStudentBooks: 2,
  maxStaffBooks: 5,
  finePerDay: '0.00',
};

const LOAN_SELECT = {
  id: true,
  issuedOn: true,
  dueOn: true,
  returnedOn: true,
  fineAmount: true,
  fineStatus: true,
  copy: {
    select: {
      accessionNo: true,
      book: { select: { id: true, title: true, author: true } },
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      admissionNo: true,
      class: { select: { name: true, section: true } },
    },
  },
  user: { select: { id: true, name: true, role: true } },
} as const;

type LoanRow = Prisma.LibraryLoanGetPayload<{ select: typeof LOAN_SELECT }>;

const BOOK_INCLUDE = {
  copies: {
    orderBy: { accessionNo: 'asc' },
    select: {
      id: true,
      accessionNo: true,
      status: true,
      loans: { where: { returnedOn: null }, select: LOAN_SELECT, take: 1 },
    },
  },
} as const;

type BookRow = Prisma.LibraryBookGetPayload<{ include: typeof BOOK_INCLUDE }>;

function loanView(l: LoanRow, today: string) {
  const due = fromDbDate(l.dueOn);
  const returned = l.returnedOn ? fromDbDate(l.returnedOn) : null;
  return {
    id: l.id,
    accessionNo: l.copy.accessionNo,
    book: l.copy.book,
    borrower: l.student
      ? {
          kind: 'student' as const,
          id: l.student.id,
          name: l.student.name,
          detail: [
            l.student.class
              ? `${l.student.class.name} ${l.student.class.section}`.trim()
              : null,
            l.student.admissionNo,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : {
          kind: 'staff' as const,
          id: l.user!.id,
          name: l.user!.name,
          detail: l.user!.role,
        },
    issuedOn: fromDbDate(l.issuedOn),
    dueOn: due,
    returnedOn: returned,
    daysLate: daysLate(due, returned ?? today),
    fineAmount: l.fineAmount.toFixed(2),
    fineStatus: l.fineStatus,
  };
}

function bookView({ copies, ...b }: BookRow, today: string) {
  return {
    ...b,
    copies: copies.map(({ loans, ...c }) => ({
      ...c,
      loan: loans[0] ? loanView(loans[0], today) : null,
    })),
    total: copies.filter((c) => c.status !== LibraryCopyStatus.withdrawn)
      .length,
    available: copies.filter(
      (c) => c.status === LibraryCopyStatus.available && c.loans.length === 0,
    ).length,
  };
}

/**
 * Library (flag `library`, Premium Max). The librarian (or an admin) keeps the
 * catalogue: a book has physical copies, each with an accession number. A copy
 * is lent to a student or a staff member; it is "out" while that loan is open
 * (never stored). Returning late sets a fine from the school's rate, which is
 * then marked paid or waived. Parents see their own child's loans only
 * (student_parents). Every write is audit-logged.
 */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Overview and settings ─────────────────────────────────────────────────

  async summary(tenantId: string) {
    const today = await this.today(tenantId);
    const [titles, copies, out, overdue, fines] = await Promise.all([
      this.prisma.libraryBook.count({ where: { tenantId } }),
      this.prisma.libraryCopy.count({
        where: { tenantId, status: LibraryCopyStatus.available },
      }),
      this.prisma.libraryLoan.count({ where: { tenantId, returnedOn: null } }),
      this.prisma.libraryLoan.count({
        where: { tenantId, returnedOn: null, dueOn: { lt: toDbDate(today) } },
      }),
      this.prisma.libraryLoan.aggregate({
        where: { tenantId, fineStatus: LibraryFineStatus.due },
        _sum: { fineAmount: true },
        _count: true,
      }),
    ]);
    return {
      titles,
      copies,
      onLoan: out,
      available: copies - out,
      overdue,
      finesDue: (fines._sum.fineAmount ?? new Prisma.Decimal(0)).toFixed(2),
      finesDueCount: fines._count,
    };
  }

  async settings(tenantId: string) {
    const s = await this.prisma.librarySettings.findUnique({
      where: { tenantId },
    });
    if (!s) return DEFAULTS;
    return {
      studentLoanDays: s.studentLoanDays,
      staffLoanDays: s.staffLoanDays,
      maxStudentBooks: s.maxStudentBooks,
      maxStaffBooks: s.maxStaffBooks,
      finePerDay: s.finePerDay.toFixed(2),
    };
  }

  async saveSettings(
    tenantId: string,
    actorId: string,
    dto: LibrarySettingsDto,
  ) {
    const data = {
      studentLoanDays: dto.studentLoanDays,
      staffLoanDays: dto.staffLoanDays,
      maxStudentBooks: dto.maxStudentBooks,
      maxStaffBooks: dto.maxStaffBooks,
      finePerDay: fromPaise(toPaise(dto.finePerDay)),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.librarySettings.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      await audit(tx, tenantId, actorId, 'library.settings_saved', null, data);
    });
    return this.settings(tenantId);
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────

  async books(tenantId: string, q: BooksQueryDto) {
    const page = q.page ?? 1;
    const search = q.search?.trim();
    const where: Prisma.LibraryBookWhereInput = {
      tenantId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { isbn: { contains: search } },
              { category: { contains: search, mode: 'insensitive' } },
              { copies: { some: { accessionNo: search } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.libraryBook.count({ where }),
      this.prisma.libraryBook.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: BOOK_INCLUDE,
      }),
    ]);
    const today = await this.today(tenantId);
    return {
      data: rows.map((b) => bookView(b, today)),
      meta: { total, page, pageSize: PAGE },
    };
  }

  async createBook(tenantId: string, actorId: string, dto: CreateBookDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const book = await tx.libraryBook.create({
        data: { tenantId, ...bookFields(dto) },
        select: { id: true },
      });
      const added = await this.insertCopies(tx, tenantId, book.id, dto);
      await audit(tx, tenantId, actorId, 'library.book_created', book.id, {
        title: dto.title,
        copies: added,
      });
      return book.id;
    });
    return this.book(tenantId, id);
  }

  async updateBook(
    tenantId: string,
    actorId: string,
    id: string,
    dto: BookInputDto,
  ) {
    await this.requireBook(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryBook.update({ where: { id }, data: bookFields(dto) });
      await audit(tx, tenantId, actorId, 'library.book_updated', id, {
        ...bookFields(dto),
      });
    });
    return this.book(tenantId, id);
  }

  async addCopies(
    tenantId: string,
    actorId: string,
    id: string,
    dto: AddCopiesDto,
  ) {
    await this.requireBook(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      const added = await this.insertCopies(tx, tenantId, id, dto);
      if (added.length === 0)
        throw new BadRequestException(
          err('NO_COPIES', 'Give accession numbers or how many copies to add'),
        );
      await audit(tx, tenantId, actorId, 'library.copies_added', id, {
        copies: added,
      });
    });
    return this.book(tenantId, id);
  }

  /** A book that was never lent can be deleted; otherwise withdraw its copies. */
  async deleteBook(tenantId: string, actorId: string, id: string) {
    const book = await this.requireBook(tenantId, id);
    const lent = await this.prisma.libraryLoan.count({
      where: { tenantId, copy: { bookId: id } },
    });
    if (lent > 0)
      throw new ConflictException(
        err(
          'BOOK_HAS_LOANS',
          'This book has been lent before; withdraw its copies instead',
        ),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryCopy.deleteMany({ where: { bookId: id, tenantId } });
      await tx.libraryBook.delete({ where: { id } });
      await audit(tx, tenantId, actorId, 'library.book_deleted', id, {
        title: book.title,
      });
    });
    return { deleted: true };
  }

  /** Lost, damaged, withdrawn or back to available. Not while the copy is out. */
  async setCopyStatus(
    tenantId: string,
    actorId: string,
    copyId: string,
    status: LibraryCopyStatus,
  ) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId },
      select: {
        id: true,
        accessionNo: true,
        status: true,
        bookId: true,
        loans: { where: { returnedOn: null }, select: { id: true } },
      },
    });
    if (!copy)
      throw new NotFoundException(err('COPY_NOT_FOUND', 'Copy not found'));
    if (copy.loans.length > 0)
      throw new ConflictException(
        err('COPY_ON_LOAN', 'This copy is lent out; take it back first'),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryCopy.update({ where: { id: copy.id }, data: { status } });
      await audit(tx, tenantId, actorId, 'library.copy_status', copy.id, {
        accessionNo: copy.accessionNo,
        from: copy.status,
        to: status,
      });
    });
    return this.book(tenantId, copy.bookId);
  }

  // ── Desk: lookup, issue, return ───────────────────────────────────────────

  /** One copy by accession number, with its book and the open loan if any. */
  async copy(tenantId: string, accessionNo: string) {
    const copy = await this.prisma.libraryCopy.findUnique({
      where: {
        tenantId_accessionNo: { tenantId, accessionNo: accessionNo.trim() },
      },
      select: {
        id: true,
        accessionNo: true,
        status: true,
        book: { select: { id: true, title: true, author: true, shelf: true } },
        loans: { where: { returnedOn: null }, select: LOAN_SELECT, take: 1 },
      },
    });
    if (!copy)
      throw new NotFoundException(
        err('COPY_NOT_FOUND', 'No copy with this accession number'),
      );
    const today = await this.today(tenantId);
    const { loans, ...rest } = copy;
    return { ...rest, loan: loans[0] ? loanView(loans[0], today) : null };
  }

  /** Students and staff matching a name, admission number or phone. */
  async borrowers(tenantId: string, search: string) {
    const [students, staff] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { admissionNo: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 15,
        select: {
          id: true,
          name: true,
          admissionNo: true,
          class: { select: { name: true, section: true } },
          _count: { select: { libraryLoans: { where: { returnedOn: null } } } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: STAFF_BORROWER_ROLES },
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 10,
        select: {
          id: true,
          name: true,
          role: true,
          _count: { select: { libraryLoans: { where: { returnedOn: null } } } },
        },
      }),
    ]);
    return [
      ...students.map((s) => ({
        kind: 'student' as const,
        id: s.id,
        name: s.name,
        detail: [
          s.class ? `${s.class.name} ${s.class.section}`.trim() : null,
          s.admissionNo,
        ]
          .filter(Boolean)
          .join(' · '),
        onLoan: s._count.libraryLoans,
      })),
      ...staff.map((u) => ({
        kind: 'staff' as const,
        id: u.id,
        name: u.name,
        detail: u.role,
        onLoan: u._count.libraryLoans,
      })),
    ];
  }

  /** A borrower's open loans and the last returned ones. */
  async borrowerLoans(tenantId: string, kind: 'student' | 'staff', id: string) {
    const where = kind === 'student' ? { studentId: id } : { userId: id };
    const today = await this.today(tenantId);
    const [open, recent] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where: { tenantId, ...where, returnedOn: null },
        orderBy: { dueOn: 'asc' },
        select: LOAN_SELECT,
      }),
      this.prisma.libraryLoan.findMany({
        where: { tenantId, ...where, returnedOn: { not: null } },
        orderBy: { returnedOn: 'desc' },
        take: 10,
        select: LOAN_SELECT,
      }),
    ]);
    return {
      open: open.map((l) => loanView(l, today)),
      recent: recent.map((l) => loanView(l, today)),
    };
  }

  async issue(tenantId: string, actorId: string, dto: IssueDto) {
    if (!dto.studentId === !dto.userId)
      throw new BadRequestException(
        err('BORROWER_REQUIRED', 'Pick one student or one staff member'),
      );
    const [today, settings] = await Promise.all([
      this.today(tenantId),
      this.settings(tenantId),
    ]);
    if (dto.dueOn && (!isValidYmd(dto.dueOn) || dto.dueOn < today))
      throw new BadRequestException(
        err('DUE_DATE_INVALID', 'The return date must be today or later'),
      );

    const isStudent = !!dto.studentId;
    if (isStudent) {
      const ok = await this.prisma.student.count({
        where: { id: dto.studentId, tenantId },
      });
      if (!ok)
        throw new NotFoundException(
          err('STUDENT_NOT_FOUND', 'Student not found'),
        );
    } else {
      const ok = await this.prisma.user.count({
        where: { id: dto.userId, tenantId, role: { in: STAFF_BORROWER_ROLES } },
      });
      if (!ok)
        throw new NotFoundException(
          err('STAFF_NOT_FOUND', 'Staff member not found'),
        );
    }

    const loanId = await this.prisma
      .$transaction(async (tx) => {
        const copy = await tx.libraryCopy.findUnique({
          where: {
            tenantId_accessionNo: { tenantId, accessionNo: dto.accessionNo },
          },
          select: {
            id: true,
            status: true,
            book: { select: { title: true } },
            loans: { where: { returnedOn: null }, select: { id: true } },
          },
        });
        if (!copy)
          throw new NotFoundException(
            err('COPY_NOT_FOUND', 'No copy with this accession number'),
          );
        if (copy.loans.length > 0)
          throw new ConflictException(
            err('COPY_ON_LOAN', 'This copy is already lent out'),
          );
        if (copy.status !== LibraryCopyStatus.available)
          throw new ConflictException(
            err(
              'COPY_UNAVAILABLE',
              'This copy is marked lost, damaged or withdrawn',
            ),
          );

        const borrower = isStudent
          ? { studentId: dto.studentId }
          : { userId: dto.userId };
        const out = await tx.libraryLoan.count({
          where: { tenantId, ...borrower, returnedOn: null },
        });
        const max = isStudent
          ? settings.maxStudentBooks
          : settings.maxStaffBooks;
        if (out >= max)
          throw new ConflictException(
            err(
              'LOAN_LIMIT',
              `This borrower already has ${out} of ${max} books`,
            ),
          );

        const dueOn =
          dto.dueOn ??
          addDays(
            today,
            isStudent ? settings.studentLoanDays : settings.staffLoanDays,
          );
        const loan = await tx.libraryLoan.create({
          data: {
            tenantId,
            copyId: copy.id,
            ...borrower,
            issuedOn: toDbDate(today),
            dueOn: toDbDate(dueOn),
            issuedBy: actorId,
          },
          select: { id: true },
        });
        await audit(tx, tenantId, actorId, 'library.issued', loan.id, {
          accessionNo: dto.accessionNo,
          title: copy.book.title,
          ...borrower,
          dueOn,
        });
        return loan.id;
      })
      .catch(rethrowDoubleIssue);
    return this.loan(tenantId, loanId);
  }

  async returnCopy(tenantId: string, actorId: string, accessionNo: string) {
    const [today, settings] = await Promise.all([
      this.today(tenantId),
      this.settings(tenantId),
    ]);
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { tenantId, returnedOn: null, copy: { accessionNo } },
      select: { id: true, dueOn: true },
    });
    if (!loan)
      throw new NotFoundException(
        err('LOAN_NOT_FOUND', 'This copy is not lent out'),
      );
    const fine = finePaise(
      fromDbDate(loan.dueOn),
      today,
      toPaise(settings.finePerDay),
    );
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.libraryLoan.updateMany({
        where: { id: loan.id, returnedOn: null },
        data: {
          returnedOn: toDbDate(today),
          returnedBy: actorId,
          fineAmount: fromPaise(fine),
          fineStatus: fine > 0 ? LibraryFineStatus.due : LibraryFineStatus.none,
        },
      });
      if (done.count === 0)
        throw new ConflictException(
          err('LOAN_NOT_FOUND', 'This copy was already returned'),
        );
      await audit(tx, tenantId, actorId, 'library.returned', loan.id, {
        accessionNo,
        fine: fromPaise(fine),
      });
    });
    return this.loan(tenantId, loan.id);
  }

  /** A new return date counted from today. */
  async renew(tenantId: string, actorId: string, loanId: string) {
    const [today, settings] = await Promise.all([
      this.today(tenantId),
      this.settings(tenantId),
    ]);
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { id: loanId, tenantId, returnedOn: null },
      select: { id: true, studentId: true, dueOn: true },
    });
    if (!loan)
      throw new NotFoundException(err('LOAN_NOT_FOUND', 'Loan not found'));
    const dueOn = addDays(
      today,
      loan.studentId ? settings.studentLoanDays : settings.staffLoanDays,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryLoan.update({
        where: { id: loan.id },
        data: { dueOn: toDbDate(dueOn) },
      });
      await audit(tx, tenantId, actorId, 'library.renewed', loan.id, {
        from: fromDbDate(loan.dueOn),
        to: dueOn,
      });
    });
    return this.loan(tenantId, loan.id);
  }

  async settleFine(
    tenantId: string,
    actorId: string,
    loanId: string,
    action: 'paid' | 'waived',
  ) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { id: loanId, tenantId, fineStatus: LibraryFineStatus.due },
      select: { id: true, fineAmount: true },
    });
    if (!loan)
      throw new NotFoundException(
        err('FINE_NOT_FOUND', 'No fine is due on this loan'),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryLoan.update({
        where: { id: loan.id },
        data: {
          fineStatus:
            action === 'paid'
              ? LibraryFineStatus.paid
              : LibraryFineStatus.waived,
        },
      });
      await audit(tx, tenantId, actorId, `library.fine_${action}`, loan.id, {
        amount: loan.fineAmount.toFixed(2),
      });
    });
    return this.loan(tenantId, loan.id);
  }

  async loans(tenantId: string, q: LoansQueryDto) {
    const today = await this.today(tenantId);
    const page = q.page ?? 1;
    const status = q.status ?? 'open';
    const where: Prisma.LibraryLoanWhereInput = { tenantId };
    if (status === 'open') where.returnedOn = null;
    if (status === 'overdue')
      Object.assign(where, {
        returnedOn: null,
        dueOn: { lt: toDbDate(today) },
      });
    if (status === 'returned') where.returnedOn = { not: null };
    if (status === 'fines') where.fineStatus = LibraryFineStatus.due;
    const [total, rows] = await Promise.all([
      this.prisma.libraryLoan.count({ where }),
      this.prisma.libraryLoan.findMany({
        where,
        orderBy:
          status === 'returned' ? { returnedOn: 'desc' } : { dueOn: 'asc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: LOAN_SELECT,
      }),
    ]);
    return {
      data: rows.map((l) => loanView(l, today)),
      meta: { total, page, pageSize: PAGE },
    };
  }

  // ── Parent ────────────────────────────────────────────────────────────────

  /** The parent's own child: books out now and the last few returned. */
  async child(tenantId: string, parentId: string, studentId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId, student: { tenantId } },
      select: { studentId: true },
    });
    if (!link)
      throw new NotFoundException(
        err('STUDENT_NOT_FOUND', 'Student not found'),
      );
    const { open, recent } = await this.borrowerLoans(
      tenantId,
      'student',
      studentId,
    );
    const strip = (l: ReturnType<typeof loanView>) => ({
      id: l.id,
      title: l.book.title,
      author: l.book.author,
      issuedOn: l.issuedOn,
      dueOn: l.dueOn,
      returnedOn: l.returnedOn,
      daysLate: l.daysLate,
      fineAmount: l.fineStatus === LibraryFineStatus.due ? l.fineAmount : null,
    });
    return { open: open.map(strip), recent: recent.slice(0, 5).map(strip) };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async today(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return todayIn(t?.timezone ?? 'Asia/Kolkata');
  }

  private async requireBook(tenantId: string, id: string) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id, tenantId },
      select: { id: true, title: true },
    });
    if (!book)
      throw new NotFoundException(err('BOOK_NOT_FOUND', 'Book not found'));
    return book;
  }

  private async book(tenantId: string, id: string) {
    const row = await this.prisma.libraryBook.findFirstOrThrow({
      where: { id, tenantId },
      include: BOOK_INCLUDE,
    });
    return bookView(row, await this.today(tenantId));
  }

  private async loan(tenantId: string, id: string) {
    const today = await this.today(tenantId);
    const row = await this.prisma.libraryLoan.findFirstOrThrow({
      where: { id, tenantId },
      select: LOAN_SELECT,
    });
    return loanView(row, today);
  }

  /** Copies from given accession numbers, or [count] numbered after the highest. */
  private async insertCopies(
    tx: Prisma.TransactionClient,
    tenantId: string,
    bookId: string,
    dto: AddCopiesDto,
  ): Promise<string[]> {
    let numbers = (dto.accessionNos ?? []).map((a) => a.trim()).filter(Boolean);
    if (new Set(numbers).size !== numbers.length)
      throw new BadRequestException(
        err('ACCESSION_DUPLICATE', 'An accession number is repeated'),
      );
    if (numbers.length === 0 && dto.count) {
      // Serialise automatic numbering per school.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'library:' + tenantId}))`;
      const existing = await tx.libraryCopy.findMany({
        where: { tenantId },
        select: { accessionNo: true },
      });
      numbers = nextAccessionNumbers(
        existing.map((c) => c.accessionNo),
        dto.count,
      );
    }
    if (numbers.length === 0) return [];
    const taken = await tx.libraryCopy.findMany({
      where: { tenantId, accessionNo: { in: numbers } },
      select: { accessionNo: true },
    });
    if (taken.length > 0)
      throw new ConflictException(
        err(
          'ACCESSION_TAKEN',
          `Accession number already used: ${taken.map((t) => t.accessionNo).join(', ')}`,
        ),
      );
    await tx.libraryCopy.createMany({
      data: numbers.map((accessionNo) => ({ tenantId, bookId, accessionNo })),
    });
    return numbers;
  }
}

const bookFields = (dto: BookInputDto) => ({
  title: dto.title,
  author: dto.author ?? null,
  isbn: dto.isbn ?? null,
  publisher: dto.publisher ?? null,
  category: dto.category ?? null,
  language: dto.language ?? null,
  shelf: dto.shelf ?? null,
});

/** Two desks issuing the same copy at once: the partial unique index refuses one. */
function rethrowDoubleIssue(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    throw new ConflictException(
      err('COPY_ON_LOAN', 'This copy is already lent out'),
    );
  throw e;
}

function audit(
  db: Db,
  tenantId: string,
  actorId: string,
  action: string,
  entityId: string | null,
  diff: Prisma.InputJsonValue,
) {
  return db.auditLog.create({
    data: { tenantId, actorId, action, entityType: 'library', entityId, diff },
  });
}
