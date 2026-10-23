/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import ExcelJS from 'exceljs';
import {
  bookKey,
  buildBooksTemplate,
  parseBooksWorkbook,
  splitAccession,
} from './library-import';
import { LibraryService } from './library.service';

const T = 'tenant-1';
const HEAD = [
  'Title',
  'Author',
  'Publisher',
  'ISBN',
  'Category',
  'Language',
  'Shelf',
  'Copies',
  'Accession numbers',
];

async function xlsx(rows: unknown[][], head = HEAD): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Books');
  sheet.addRow(head);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseBooksWorkbook', () => {
  it('reads books with a copy count or accession numbers', async () => {
    const { rows, errors } = await parseBooksWorkbook(
      await xlsx([
        [
          'The Jungle Book',
          'Kipling',
          'Penguin',
          '978-0141325293',
          'Fiction',
          'English',
          'A2',
          3,
          '',
        ],
        ['Panchatantra', '', '', '', '', 'Kannada', '', '', '1201, 1202'],
        ['Atlas', '', '', '', '', '', '', '', ''],
      ]),
    );
    expect(errors).toEqual([]);
    expect(
      rows.map((r) => [r.title, r.copies, r.accessionNos, r.isbn]),
    ).toEqual([
      ['The Jungle Book', 3, [], '9780141325293'],
      ['Panchatantra', 2, ['1201', '1202'], null],
      ['Atlas', 1, [], null],
    ]);
  });

  it('reports each bad row with its number', async () => {
    const { rows, errors } = await parseBooksWorkbook(
      await xlsx([
        ['', 'Someone'],
        ['Book A', '', '', '', '', '', '', 'two'],
        ['Book B', '', '', '', '', '', '', 3, '1, 2'],
        ['Book C', '', '', '', '', '', '', '', '7, 7'],
        ['x'.repeat(201)],
      ]),
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { row: 2, code: 'TITLE_MISSING' },
      { row: 3, code: 'COPIES_INVALID', value: 'two' },
      { row: 4, code: 'COPIES_MISMATCH', value: '3/2' },
      { row: 5, code: 'ACCESSION_REPEATED', value: '7' },
      { row: 6, code: 'TOO_LONG', value: 'Title' },
    ]);
  });

  it('needs a Title column and a readable file', async () => {
    expect(
      (await parseBooksWorkbook(await xlsx([['x']], ['Name']))).errors,
    ).toEqual([{ row: 1, code: 'HEADERS_MISSING', value: 'Title' }]);
    expect((await parseBooksWorkbook(Buffer.from('not excel'))).errors).toEqual(
      [{ row: 0, code: 'FILE_UNREADABLE' }],
    );
  });

  it('reads its own template', async () => {
    const { rows, errors } = await parseBooksWorkbook(
      await buildBooksTemplate(),
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('splits accession numbers on commas, semicolons and lines', () => {
    expect(splitAccession(' 1, 2;3\n4 ,')).toEqual(['1', '2', '3', '4']);
  });

  it('matches a book by ISBN, else by title and author', () => {
    expect(bookKey({ title: 'A', author: null, isbn: '978-1' })).toBe(
      bookKey({ title: 'B', author: 'X', isbn: '9781' }),
    );
    expect(
      bookKey({ title: ' Malgudi  Days', author: 'R K', isbn: null }),
    ).toBe(bookKey({ title: 'malgudi days', author: 'r k', isbn: null }));
  });
});

describe('LibraryService import', () => {
  function makePrisma() {
    const prisma: any = {
      libraryBook: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b-old',
            title: 'Malgudi Days',
            author: 'R. K. Narayan',
            isbn: null,
          },
        ]),
        createMany: jest.fn(),
      },
      libraryCopy: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $executeRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    return prisma;
  }

  const file = () =>
    xlsx([
      ['Malgudi Days', 'R. K. Narayan', '', '', '', '', '', 2, ''],
      [
        'Wings of Fire',
        'A. P. J. Abdul Kalam',
        '',
        '',
        '',
        '',
        '',
        '',
        '500, 501',
      ],
      ['wings of fire', 'a. p. j. abdul kalam', '', '', '', '', '', 1, ''],
    ]);

  it('says what it would add, without writing', async () => {
    const prisma = makePrisma();
    const service = new LibraryService(prisma);
    expect(await service.validateImport(T, await file())).toEqual({
      rows: 3,
      errors: [],
      newBooks: 1,
      existingBooks: 1,
      copies: 5,
    });
    expect(prisma.libraryBook.createMany).not.toHaveBeenCalled();
  });

  it('adds copies to existing books and numbers the rest after the highest', async () => {
    const prisma = makePrisma();
    prisma.libraryCopy.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.accessionNo
          ? []
          : [{ accessionNo: '40' }, { accessionNo: 'R-9' }],
      ),
    );
    const service = new LibraryService(prisma);
    expect(await service.commitImport(T, 'lib-1', await file())).toEqual({
      newBooks: 1,
      existingBooks: 1,
      copies: 5,
    });
    const books = prisma.libraryBook.createMany.mock.calls[0][0].data;
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ tenantId: T, title: 'Wings of Fire' });
    const copies = prisma.libraryCopy.createMany.mock.calls[0][0].data;
    // Given numbers are kept; automatic ones follow the highest (501).
    expect(copies).toEqual([
      { tenantId: T, bookId: 'b-old', accessionNo: '502' },
      { tenantId: T, bookId: 'b-old', accessionNo: '503' },
      { tenantId: T, bookId: books[0].id, accessionNo: '500' },
      { tenantId: T, bookId: books[0].id, accessionNo: '501' },
      { tenantId: T, bookId: books[0].id, accessionNo: '504' },
    ]);
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'library.import' }),
      }),
    );
  });

  it('refuses accession numbers already used and writes nothing', async () => {
    const prisma = makePrisma();
    prisma.libraryCopy.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where.accessionNo ? [{ accessionNo: '501' }] : []),
    );
    const service = new LibraryService(prisma);
    const report = await service.validateImport(T, await file());
    expect(report.errors).toEqual([
      { row: 3, code: 'ACCESSION_TAKEN', value: '501' },
    ]);
    await expect(
      service.commitImport(T, 'lib-1', await file()),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_ROWS_INVALID' } });
    expect(prisma.libraryCopy.createMany).not.toHaveBeenCalled();
  });
});
