export type CopyStatus = 'available' | 'lost' | 'damaged' | 'withdrawn';
export const COPY_STATUSES: CopyStatus[] = ['available', 'lost', 'damaged', 'withdrawn'];
export type FineStatus = 'none' | 'due' | 'paid' | 'waived';

export interface Borrower {
  kind: 'student' | 'staff';
  id: string;
  name: string;
  detail: string;
  onLoan?: number;
}

export interface Loan {
  id: string;
  accessionNo: string;
  book: { id: string; title: string; author: string | null };
  borrower: Borrower;
  issuedOn: string;
  dueOn: string;
  returnedOn: string | null;
  daysLate: number;
  fineAmount: string;
  fineStatus: FineStatus;
}

export interface Copy {
  id: string;
  accessionNo: string;
  status: CopyStatus;
  loan: Loan | null;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  category: string | null;
  language: string | null;
  shelf: string | null;
  copies: Copy[];
  total: number;
  available: number;
}

export interface CopyLookup {
  id: string;
  accessionNo: string;
  status: CopyStatus;
  book: { id: string; title: string; author: string | null; shelf: string | null };
  loan: Loan | null;
}

export interface Summary {
  titles: number;
  copies: number;
  onLoan: number;
  available: number;
  overdue: number;
  finesDue: string;
  finesDueCount: number;
}

export interface Settings {
  studentLoanDays: number;
  staffLoanDays: number;
  maxStudentBooks: number;
  maxStaffBooks: number;
  finePerDay: string;
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
}

/** Row problems from /library/import/validate (messages library.importError.*). */
export const IMPORT_ERROR_CODES = [
  'FILE_UNREADABLE',
  'HEADERS_MISSING',
  'TOO_MANY_ROWS',
  'TITLE_MISSING',
  'TOO_LONG',
  'COPIES_INVALID',
  'COPIES_MISMATCH',
  'ACCESSION_TOO_LONG',
  'ACCESSION_REPEATED',
  'ACCESSION_TAKEN',
] as const;

export interface ImportReport {
  rows: number;
  errors: { row: number; code: string; value?: string }[];
  newBooks: number;
  existingBooks: number;
  copies: number;
}
